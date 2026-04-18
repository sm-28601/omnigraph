from __future__ import annotations

import re
from pathlib import Path

import pandas as pd
from rapidfuzz import fuzz
from llm_fallback import resolve_with_llm


ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "raw"
DEPARTMENTS_DIR = RAW_DIR / "40_departments"
OUT_DIR = ROOT / "data" / "processed"


def norm(text: str) -> str:
    text = (text or "").lower().strip()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def extract_city_state(address: str) -> tuple[str, str]:
    parts = [p.strip() for p in str(address or "").split(",") if p.strip()]
    if len(parts) >= 2:
        return parts[-2], parts[-1]
    return "Unknown", "Unknown"


def load_departments_sources() -> pd.DataFrame:
    csv_files = sorted(DEPARTMENTS_DIR.glob("*_data.csv"))
    frames = []

    for csv_file in csv_files:
        src = csv_file.stem.replace("_data", "").upper()
        df = pd.read_csv(csv_file, dtype=str).fillna("")
        frame = pd.DataFrame(
            {
                "source": src,
                "record_id": df.get("DeptID", pd.Series([""] * len(df))),
                "name": df.get("EntityName", pd.Series([""] * len(df))),
                "pan": df.get("PAN", pd.Series([""] * len(df))).str.upper(),
                "address": df.get("RegisteredAddress", pd.Series([""] * len(df))),
                "strong_id": df.get("DeptID", pd.Series([""] * len(df))).str.upper(),
            }
        )
        city_state = frame["address"].map(extract_city_state)
        frame["city"] = city_state.map(lambda c: c[0])
        frame["state"] = city_state.map(lambda c: c[1])
        frame["pincode"] = ""
        frames.append(frame)

    if not frames:
        return pd.DataFrame()

    df = pd.concat(frames, ignore_index=True)
    df["name_norm"] = df["name"].map(norm)
    df["address_norm"] = df["address"].map(norm)
    df["tier"] = "UNRESOLVED"
    df["confidence"] = 0.0
    df["decision_reason"] = "Not evaluated"
    return df


def load_legacy_sources() -> pd.DataFrame:
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
    df["decision_reason"] = "Not evaluated"
    return df


def load_sources() -> pd.DataFrame:
    if DEPARTMENTS_DIR.exists() and any(DEPARTMENTS_DIR.glob("*_data.csv")):
        return load_departments_sources()
    return load_legacy_sources()


def tier1_pan_resolution(df: pd.DataFrame) -> pd.DataFrame:
    pans = (
        df[df["pan"].astype(str).str.strip() != ""]["pan"]
        .drop_duplicates()
        .sort_values()
        .reset_index(drop=True)
        .to_frame()
    )
    pans["entity_id"] = pans.index.map(lambda x: f"ENT-{x+1:04d}")
    out = df.merge(pans, on="pan", how="left")
    out.loc[out["entity_id"].notna(), "tier"] = "TIER1_DETERMINISTIC"
    out.loc[out["entity_id"].notna(), "confidence"] = 1.0
    out.loc[out["entity_id"].notna(), "decision_reason"] = "Exact PAN match"
    return out


def tier2_fuzzy_enrichment(df: pd.DataFrame) -> pd.DataFrame:
    # Compare records sharing the same city/state where PAN may be missing/dirty.
    # This is a baseline for future production-grade blocking/indexing.
    unresolved = df[df["entity_id"].isna()].copy()
    if unresolved.empty:
        return df

    resolved = df[df["entity_id"].notna()].copy()

    # For large generated datasets, avoid expensive pairwise fuzzy + LLM fallback.
    if len(df) > 2000:
        lookup = (
            resolved.assign(_key=resolved["name_norm"].str.cat(resolved["address_norm"], sep="|"))
            .drop_duplicates("_key")
            .set_index("_key")["entity_id"]
            .to_dict()
        )

        for idx, row in unresolved.iterrows():
            key = f"{row['name_norm']}|{row['address_norm']}"
            matched = lookup.get(key)
            if matched:
                df.loc[idx, "entity_id"] = matched
                df.loc[idx, "tier"] = "TIER2_EXACT"
                df.loc[idx, "confidence"] = 0.9
                df.loc[idx, "decision_reason"] = "Exact normalized name+address match"
            else:
                df.loc[idx, "tier"] = "TIER3_REVIEW_REQUIRED"
                df.loc[idx, "confidence"] = 0.0
                df.loc[idx, "decision_reason"] = "No exact candidate in large-dataset fast path"
        return df

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
            df.loc[idx, "decision_reason"] = f"Fuzzy match score={round(best_score, 2)}"
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
                df.loc[idx, "decision_reason"] = "LLM fallback selected candidate"
            else:
                df.loc[idx, "tier"] = "TIER3_REVIEW_REQUIRED"
                df.loc[idx, "confidence"] = round(best_score / 100, 2)
                df.loc[idx, "decision_reason"] = f"No candidate above threshold; best_score={round(best_score, 2)}"
    return df


def export_outputs(df: pd.DataFrame) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    mapping = df[
        [
            "source",
            "record_id",
            "entity_id",
            "tier",
            "confidence",
            "decision_reason",
            "pan",
            "name",
            "address",
            "city",
            "state",
            "pincode",
        ]
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
            sample_decision_reason=("decision_reason", "first"),
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
