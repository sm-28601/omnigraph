from __future__ import annotations

import re
from pathlib import Path

import pandas as pd
from rapidfuzz import fuzz
from llm_fallback import resolve_with_llm


ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "raw"
OUT_DIR = ROOT / "data" / "processed"


def norm(text: str) -> str:
    text = (text or "").lower().strip()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def load_sources() -> pd.DataFrame:
    gst = pd.read_csv(RAW_DIR / "gst_records.csv", dtype=str).fillna("")
    labour = pd.read_csv(RAW_DIR / "labour_records.csv", dtype=str).fillna("")
    pol = pd.read_csv(RAW_DIR / "pollution_records.csv", dtype=str).fillna("")
    mca = pd.read_csv(RAW_DIR / "mca_records.csv", dtype=str).fillna("")

    frames = [
        pd.DataFrame(
            {
                "source": "GST",
                "record_id": gst["record_id"],
                "name": gst["business_name"],
                "pan": gst["pan"].str.upper(),
                "address": gst["address"],
                "city": gst["city"],
                "state": gst["state"],
                "pincode": gst["pincode"],
                "strong_id": gst["gstin"].str.upper(),
            }
        ),
        pd.DataFrame(
            {
                "source": "LABOUR",
                "record_id": labour["record_id"],
                "name": labour["business_name"],
                "pan": labour["pan"].str.upper(),
                "address": labour["address"],
                "city": labour["city"],
                "state": labour["state"],
                "pincode": labour["pincode"],
                "strong_id": labour["shop_license_no"].str.upper(),
            }
        ),
        pd.DataFrame(
            {
                "source": "POLLUTION",
                "record_id": pol["record_id"],
                "name": pol["unit_name"],
                "pan": pol["pan"].str.upper(),
                "address": pol["address"],
                "city": pol["city"],
                "state": pol["state"],
                "pincode": pol["pincode"],
                "strong_id": pol["pollution_consent_id"].str.upper(),
            }
        ),
        pd.DataFrame(
            {
                "source": "MCA",
                "record_id": mca["record_id"],
                "name": mca["legal_name"],
                "pan": mca["pan"].str.upper(),
                "address": mca["registered_address"],
                "city": mca["city"],
                "state": mca["state"],
                "pincode": mca["pincode"],
                "strong_id": mca["company_cin"].str.upper(),
            }
        ),
    ]
    df = pd.concat(frames, ignore_index=True)
    df["name_norm"] = df["name"].map(norm)
    df["address_norm"] = df["address"].map(norm)
    df["tier"] = "UNRESOLVED"
    df["confidence"] = 0.0
    return df


def tier1_pan_resolution(df: pd.DataFrame) -> pd.DataFrame:
    pans = df[["pan"]].drop_duplicates().sort_values("pan").reset_index(drop=True)
    pans["entity_id"] = pans.index.map(lambda x: f"ENT-{x+1:04d}")
    out = df.merge(pans, on="pan", how="left")
    out["tier"] = "TIER1_DETERMINISTIC"
    out["confidence"] = 1.0
    return out


def tier2_fuzzy_enrichment(df: pd.DataFrame) -> pd.DataFrame:
    # Compare records sharing the same city/state where PAN may be missing/dirty.
    # This is a baseline for future production-grade blocking/indexing.
    unresolved = df[df["entity_id"].isna()].copy()
    if unresolved.empty:
        return df

    resolved = df[df["entity_id"].notna()].copy()
    for idx, row in unresolved.iterrows():
        candidates = resolved[
            (resolved["city"].str.lower() == str(row["city"]).lower())
            & (resolved["state"].str.lower() == str(row["state"]).lower())
        ]
        best_score = 0
        best_entity = None
        for _, cand in candidates.iterrows():
            score = 0.65 * fuzz.ratio(row["name_norm"], cand["name_norm"]) + 0.35 * fuzz.ratio(
                row["address_norm"], cand["address_norm"]
            )
            if score > best_score:
                best_score = score
                best_entity = cand["entity_id"]
        if best_score >= 85 and best_entity:
            df.loc[idx, "entity_id"] = best_entity
            df.loc[idx, "tier"] = "TIER2_FUZZY"
            df.loc[idx, "confidence"] = round(best_score / 100, 2)
        else:
            llm_candidates = [
                {
                    "entity_id": c["entity_id"],
                    "name": c["name"],
                    "address": c["address"],
                    "city": c["city"],
                    "state": c["state"],
                    "pan": c["pan"],
                }
                for _, c in candidates.head(5).iterrows()
            ]
            chosen_entity, llm_conf = resolve_with_llm(row.to_dict(), llm_candidates)
            if chosen_entity:
                df.loc[idx, "entity_id"] = chosen_entity
                df.loc[idx, "tier"] = "TIER3_LLM_FALLBACK"
                df.loc[idx, "confidence"] = llm_conf
            else:
                df.loc[idx, "tier"] = "TIER3_REVIEW_REQUIRED"
                df.loc[idx, "confidence"] = round(best_score / 100, 2)
    return df


def export_outputs(df: pd.DataFrame) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    mapping = df[
        ["source", "record_id", "entity_id", "tier", "confidence", "pan", "name", "address", "city", "state", "pincode"]
    ].copy()
    mapping.rename(columns={"record_id": "source_record_id"}, inplace=True)
    mapping.to_csv(OUT_DIR / "source_to_entity_mapping.csv", index=False)

    rollup = (
        mapping.groupby("entity_id", as_index=False)
        .agg(
            canonical_name=("name", lambda s: s.mode().iloc[0]),
            pan=("pan", "first"),
            city=("city", lambda s: s.mode().iloc[0]),
            state=("state", lambda s: s.mode().iloc[0]),
            pincode=("pincode", lambda s: s.mode().iloc[0]),
            source_system_count=("source", "nunique"),
            resolution_quality=("confidence", "mean"),
        )
        .sort_values("entity_id")
    )
    rollup.to_csv(OUT_DIR / "resolved_entities.csv", index=False)


def main() -> None:
    df = load_sources()
    df = tier1_pan_resolution(df)
    df = tier2_fuzzy_enrichment(df)
    export_outputs(df)
    print(f"Resolved records: {len(df)}")
    print(f"Resolved entities: {df['entity_id'].nunique()}")
    print(f"Review-required records: {(df['tier'] == 'TIER3_REVIEW_REQUIRED').sum()}")


if __name__ == "__main__":
    main()
