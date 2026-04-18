from __future__ import annotations
import re
from pathlib import Path
import pandas as pd

# Pointing to the NEW massive dataset folder
RAW_DIR = Path(__file__).resolve().parents[2] / "data" / "raw" / "40_departments"
OUTPUT_DIR = Path(__file__).resolve().parents[2] / "data" / "processed"
OUTPUT_FILE = OUTPUT_DIR / "consolidated_entities.csv"

def normalize_text(value: str) -> str:
    value = (value or "").strip().lower()
    value = re.sub(r"[^a-z0-9\s]", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value

def build_dynamic_source_frame(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, dtype=str).fillna("")
    source_name = path.stem.replace("_data", "").upper()

    base = pd.DataFrame({
        "source_system": source_name,
        "source_record_id": df["DeptID"] if "DeptID" in df.columns else "",
        "business_name_raw": df["EntityName"] if "EntityName" in df.columns else "",
        "pan": df["PAN"].str.upper() if "PAN" in df.columns else "",
        "address_raw": df["RegisteredAddress"] if "RegisteredAddress" in df.columns else "",
    })

    base["business_name_norm"] = base["business_name_raw"].map(normalize_text)
    base["address_norm"] = base["address_raw"].map(normalize_text)
    base["city"], base["state"], base["pincode"] = "Unknown", "Unknown", ""
    return base

def load_all_sources() -> pd.DataFrame:
    if not RAW_DIR.exists():
        raise FileNotFoundError(f"Missing {RAW_DIR}. Run generate_40_departments.py first!")
    csv_files = list(RAW_DIR.glob("*.csv"))
    frames = [build_dynamic_source_frame(fp) for fp in csv_files]
    return pd.concat(frames, ignore_index=True)

def assign_entity_ids(df: pd.DataFrame) -> pd.DataFrame:
    valid_pans = df[df["pan"] != ""]
    pan_groups = valid_pans[["pan"]].drop_duplicates().sort_values("pan").reset_index(drop=True).reset_index(names="entity_seq")
    pan_groups["unified_entity_id"] = pan_groups["entity_seq"].map(lambda i: f"ENT-{i + 1:04d}")
    return df.merge(pan_groups.drop(columns=["entity_seq"]), on="pan", how="left")

def build_entity_rollup(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    resolved_df = df.dropna(subset=["unified_entity_id"])
    for entity_id, group in resolved_df.groupby("unified_entity_id"):
        rows.append({
            "unified_entity_id": entity_id,
            "canonical_name": group["business_name_raw"].mode().iloc[0] if not group["business_name_raw"].empty else "UNKNOWN",
            "pan": group["pan"].iloc[0],
            "city": "Unknown", "state": "Unknown", "pincode": "",
            "source_system_count": group["source_system"].nunique(),
            "source_record_ids": "|".join(sorted(group["source_record_id"].tolist())),
        })
    return pd.DataFrame(rows)

def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    all_records = load_all_sources()
    mapped_records = assign_entity_ids(all_records)
    consolidated = build_entity_rollup(mapped_records)
    consolidated.to_csv(OUTPUT_FILE, index=False)
    print(f"✅ Success! Processed {len(all_records)} source records into {len(consolidated)} entities.")

if __name__ == "__main__":
    main()