from __future__ import annotations

import re
from pathlib import Path

import pandas as pd


RAW_DIR = Path(__file__).resolve().parents[2] / "data" / "raw"
OUTPUT_DIR = Path(__file__).resolve().parents[2] / "data" / "processed"
OUTPUT_FILE = OUTPUT_DIR / "consolidated_entities.csv"


def normalize_text(value: str) -> str:
    value = (value or "").strip().lower()
    value = re.sub(r"[^a-z0-9\s]", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def build_source_frame(path: Path, source: str, name_col: str, addr_col: str, id_cols: list[str]) -> pd.DataFrame:
    df = pd.read_csv(path, dtype=str).fillna("")

    base = pd.DataFrame(
        {
            "source_system": source,
            "source_record_id": df["record_id"],
            "business_name_raw": df[name_col],
            "business_name_norm": df[name_col].map(normalize_text),
            "pan": df["pan"].str.upper(),
            "address_raw": df[addr_col],
            "address_norm": df[addr_col].map(normalize_text),
            "city": df["city"].str.title(),
            "state": df["state"].str.title(),
            "pincode": df["pincode"],
        }
    )

    for id_col in id_cols:
        base[id_col] = df[id_col].str.upper()

    return base


def load_all_sources() -> pd.DataFrame:
    frames = [
        build_source_frame(
            RAW_DIR / "gst_records.csv",
            source="GST",
            name_col="business_name",
            addr_col="address",
            id_cols=["gstin", "phone", "email"],
        ),
        build_source_frame(
            RAW_DIR / "labour_records.csv",
            source="LABOUR",
            name_col="business_name",
            addr_col="address",
            id_cols=["shop_license_no"],
        ),
        build_source_frame(
            RAW_DIR / "pollution_records.csv",
            source="POLLUTION",
            name_col="unit_name",
            addr_col="address",
            id_cols=["pollution_consent_id"],
        ),
        build_source_frame(
            RAW_DIR / "mca_records.csv",
            source="MCA",
            name_col="legal_name",
            addr_col="registered_address",
            id_cols=["company_cin", "director_name"],
        ),
    ]
    return pd.concat(frames, ignore_index=True)


def assign_entity_ids(df: pd.DataFrame) -> pd.DataFrame:
    """
    Tier-1 baseline: unify records by PAN.
    Later phases will expand with fuzzy and LLM-assisted matching.
    """
    pan_groups = (
        df[["pan"]]
        .drop_duplicates()
        .sort_values("pan")
        .reset_index(drop=True)
        .reset_index(names="entity_seq")
    )
    pan_groups["unified_entity_id"] = pan_groups["entity_seq"].map(lambda i: f"ENT-{i + 1:04d}")
    pan_groups = pan_groups.drop(columns=["entity_seq"])
    return df.merge(pan_groups, on="pan", how="left")


def build_entity_rollup(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for entity_id, group in df.groupby("unified_entity_id"):
        canonical_name = group["business_name_raw"].mode().iloc[0]
        primary_pan = group["pan"].iloc[0]
        city = group["city"].mode().iloc[0]
        state = group["state"].mode().iloc[0]
        pincode = group["pincode"].mode().iloc[0]
        source_count = group["source_system"].nunique()
        source_records = "|".join(sorted(group["source_record_id"].tolist()))
        rows.append(
            {
                "unified_entity_id": entity_id,
                "canonical_name": canonical_name,
                "pan": primary_pan,
                "city": city,
                "state": state,
                "pincode": pincode,
                "source_system_count": source_count,
                "source_record_ids": source_records,
            }
        )
    return pd.DataFrame(rows).sort_values("unified_entity_id")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    all_records = load_all_sources()
    mapped_records = assign_entity_ids(all_records)
    consolidated = build_entity_rollup(mapped_records)
    consolidated.to_csv(OUTPUT_FILE, index=False)
    print(f"Wrote consolidated output: {OUTPUT_FILE}")
    print(f"Source records read: {len(all_records)}")
    print(f"Unified entities created: {len(consolidated)}")


if __name__ == "__main__":
    main()
