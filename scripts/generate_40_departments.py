import os
import csv
import random
import string

# Configuration
NUM_BASE_ENTITIES = 3000
FRAUD_CLUSTER_COUNT = 25  
COMPANIES_PER_CLUSTER = 5 
# This will create a new folder on YOUR computer
OUTPUT_DIR = os.path.join("data", "raw", "40_departments")

CITIES = ["Mumbai, MH", "Bengaluru, KA", "Delhi, DL", "Hyderabad, TS", "Chennai, TN", "Pune, MH", "Ahmedabad, GJ"]
AREAS = ["MIDC", "Phase 1, Electronic City", "Okhla Ind Estate", "Hitec City", "Guindy", "Peenya", "GIDC"]
COMPANY_PREFIXES = ["Acme", "Apex", "Global", "Sunrise", "Metro", "Prime", "Pioneer", "Dynamic", "Stellar", "Tech", "Om", "Shree", "Balaji"]
COMPANY_SUFFIXES = ["Industries", "Technologies", "Logistics", "Traders", "Enterprises", "Fabrication", "Solutions", "Ventures", "Corp"]
ENTITY_TYPES = ["Pvt Ltd", "LLP", "Limited"]

DEPARTMENTS = [
    {"code": "MCA", "id_prefix": "CIN", "coverage": 0.95, "quality": "high"},
    {"code": "GST", "id_prefix": "GSTIN", "coverage": 0.90, "quality": "high"},
    {"code": "ITD", "id_prefix": "PAN_REG", "coverage": 0.98, "quality": "high"},
    {"code": "EPFO", "id_prefix": "EPF", "coverage": 0.70, "quality": "medium"},
    {"code": "ESIC", "id_prefix": "ESI", "coverage": 0.65, "quality": "medium"},
    {"code": "SPCB", "id_prefix": "PCB", "coverage": 0.35, "quality": "low"},
    {"code": "MUNI", "id_prefix": "TRD", "coverage": 0.80, "quality": "low"},
    {"code": "CUST", "id_prefix": "IEC", "coverage": 0.25, "quality": "high"},
    {"code": "MSME", "id_prefix": "UDYAM", "coverage": 0.60, "quality": "medium"},
    {"code": "SHPE", "id_prefix": "SHOP", "coverage": 0.85, "quality": "low"}
    # Truncated to 10 for speed, you can add more if you want!
]

def generate_pan():
    return ''.join(random.choices(string.ascii_uppercase, k=5)) + ''.join(random.choices(string.digits, k=4)) + random.choice(string.ascii_uppercase)

def introduce_typo(text):
    if len(text) < 5 or random.random() > 0.4: return text
    idx = random.randint(1, len(text)-2)
    chars = list(text)
    chars[idx], chars[idx+1] = chars[idx+1], chars[idx]
    return "".join(chars)

def corrupt_address(address):
    if random.random() > 0.5: return address
    return address.lower().replace("estate", "est").replace("phase", "ph")

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    base_entities = []
    
    print(f"Generating {NUM_BASE_ENTITIES} base truth entities...")
    for i in range(NUM_BASE_ENTITIES):
        name = f"{random.choice(COMPANY_PREFIXES)} {random.choice(COMPANY_SUFFIXES)} {random.choice(ENTITY_TYPES)}"
        pan = generate_pan()
        address = f"Plot {random.randint(1, 999)}, {random.choice(AREAS)}, {random.choice(CITIES)}"
        phone = f"9{random.randint(100000000, 999999999)}"
        base_entities.append({"name": name, "pan": pan, "address": address, "phone": phone})

    print(f"Injecting {FRAUD_CLUSTER_COUNT} massive shell company networks...")
    for _ in range(FRAUD_CLUSTER_COUNT):
        fraud_address = f"Gala No. {random.randint(1, 100)}, Shady Complex, {random.choice(CITIES)}"
        fraud_phone = f"800{random.randint(100000, 999999)}"
        for idx in random.sample(range(NUM_BASE_ENTITIES), COMPANIES_PER_CLUSTER):
            base_entities[idx]["address"] = fraud_address
            base_entities[idx]["phone"] = fraud_phone

    print(f"Splitting data across departments...")
    total_records = 0

    for dept in DEPARTMENTS:
        dept_data = []
        for ent in base_entities:
            if random.random() <= dept["coverage"]:
                if dept["quality"] == "high":
                    name, addr, pan = ent["name"], ent["address"], ent["pan"]
                elif dept["quality"] == "medium":
                    name, addr, pan = introduce_typo(ent["name"]), corrupt_address(ent["address"]), ent["pan"]
                else: 
                    name, addr, pan = ent["name"].replace(" Pvt Ltd", "").upper(), corrupt_address(ent["address"]), "" 

                dept_id = f"{dept['id_prefix']}-{random.randint(10000, 999999)}"
                row = {"DeptID": dept_id, "EntityName": name, "PAN": pan, "RegisteredAddress": addr, "Contact": ent["phone"]}
                dept_data.append(row)

        if dept_data:
            filepath = os.path.join(OUTPUT_DIR, f"{dept['code']}_data.csv")
            with open(filepath, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=dept_data[0].keys())
                writer.writeheader()
                writer.writerows(dept_data)
            total_records += len(dept_data)

    print(f"✅ SUCCESS: Created datasets in {OUTPUT_DIR}! Total Rows: {total_records}")

if __name__ == '__main__':
    main()