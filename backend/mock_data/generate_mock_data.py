"""Generate 4 intentionally messy CSV/XLSX files for testing the migration agent."""
import pandas as pd
import random
import os

random.seed(42)
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

FIRST_NAMES = ["Aarav", "Vivaan", "Aditya", "Sai", "Arjun", "Reyansh", "Ayaan", "Krishna", "Ishaan", "Shaurya",
               "Priya", "Ananya", "Diya", "Isha", "Kavya", "Meera", "Neha", "Pooja", "Riya", "Shreya",
               "Amit", "Rahul", "Vikram", "Suresh", "Deepak", "Rajesh", "Manoj", "Karan", "Rohit", "Nikhil",
               "Sneha", "Swati", "Divya", "Nisha", "Pallavi", "Anjali", "Simran", "Tanvi", "Komal", "Ritika",
               "Dev", "Harsh", "Jay", "Om", "Yash", "Zara", "Tara", "Sara", "Nia", "Mira"]

LAST_NAMES = ["Sharma", "Patel", "Singh", "Kumar", "Gupta", "Reddy", "Nair", "Verma", "Joshi", "Rao",
              "Malhotra", "Chopra", "Desai", "Iyer", "Mehta", "Shah", "Das", "Mishra", "Chauhan", "Yadav"]

DEPARTMENTS = ["Engineering", "Marketing", "Sales", "Human Resources", "Finance", "Operations", "Product", "Design"]
DEPT_ABBREVS = {"Engineering": "Engg", "Marketing": "Mktg", "Sales": "Sales", "Human Resources": "HR",
                "Finance": "Fin", "Operations": "Ops", "Product": "Prod", "Design": "Des"}
DESIGNATIONS = ["Software Engineer", "Senior Engineer", "Manager", "Analyst", "Associate", "Lead", "Director", "VP"]
LOCATIONS = ["Hyderabad", "Bangalore", "Mumbai", "Delhi", "Pune", "Chennai"]
GENDERS = ["Male", "Female", "M", "F", "male", "female"]
EMP_TYPES = ["Full-time", "FT", "Part-time", "PT"]


def make_employee(i, used_emails):
    fn = random.choice(FIRST_NAMES)
    ln = random.choice(LAST_NAMES)
    base_email = f"{fn.lower()}.{ln.lower()}@company.com"
    # Ensure unique emails within a file
    email = base_email
    c = 1
    while email in used_emails:
        email = f"{fn.lower()}.{ln.lower()}{c}@company.com"
        c += 1
    used_emails.add(email)
    dept = random.choice(DEPARTMENTS)
    return {
        "fn": fn, "ln": ln, "email": email, "dept": dept,
        "desg": random.choice(DESIGNATIONS),
        "doj_d": random.randint(1, 28), "doj_m": random.randint(1, 12), "doj_y": random.randint(2018, 2024),
        "dob_d": random.randint(1, 28), "dob_m": random.randint(1, 12), "dob_y": random.randint(1985, 2000),
        "gender": random.choice(GENDERS),
        "loc": random.choice(LOCATIONS),
        "phone": f"+91 {random.randint(70000, 99999)} {random.randint(10000, 99999)}",
        "salary": random.randint(400000, 3000000),
        "emp_type": random.choice(EMP_TYPES),
    }


# --- File 1: employees_old_system.csv ---
# DD/MM/YYYY dates, weird column names
used = set()
emps = [make_employee(i, used) for i in range(50)]

rows = []
for e in emps:
    rows.append({
        "emp_code": f"EMP{random.randint(1000, 9999)}",
        "fname": e["fn"],
        "lname": e["ln"],
        "email_id": e["email"],
        "contact_no": e["phone"],
        "dept_name": e["dept"],
        "role": e["desg"],
        "joining_dt": f"{e['doj_d']:02d}/{e['doj_m']:02d}/{e['doj_y']}",
        "birth_dt": f"{e['dob_d']:02d}/{e['dob_m']:02d}/{e['dob_y']}",
        "sex": e["gender"],
        "city": e["loc"],
        "mgr_email": f"manager{random.randint(1,5)}@company.com",
        "type": e["emp_type"],
        "annual_ctc": e["salary"],
    })

df1 = pd.DataFrame(rows)
df1.to_csv(os.path.join(OUTPUT_DIR, "employees_old_system.csv"), index=False)
print(f"File 1: {len(df1)} rows")

# --- File 2: employees_hrms.csv ---
# full_name (needs splitting), abbreviated depts, 15 overlap with file 1
used2 = set()
overlap_emps = emps[:15]  # 15 from file 1
new_emps = [make_employee(i, used2) for i in range(25)]  # 25 new

rows2 = []
for e in overlap_emps + new_emps:
    rows2.append({
        "employee_id": f"HR-{random.randint(100, 999)}",
        "full_name": f"{e['fn']} {e['ln']}",
        "email": e["email"],
        "phone_number": e["phone"],
        "department": DEPT_ABBREVS.get(e["dept"], e["dept"]),
        "title": e["desg"],
        "date_of_joining": f"{e['doj_y']}-{e['doj_m']:02d}-{e['doj_d']:02d}",
        "dob": f"{e['dob_y']}-{e['dob_m']:02d}-{e['dob_d']:02d}",
        "gender": e["gender"],
        "work_location": e["loc"],
        "reporting_manager": f"manager{random.randint(1,5)}@company.com",
        "employment_status": "Active",
        "employment_type": e["emp_type"],
        "compensation": e["salary"] + random.randint(-50000, 50000),  # slightly different salary for overlaps
    })

df2 = pd.DataFrame(rows2)
df2.to_csv(os.path.join(OUTPUT_DIR, "employees_hrms.csv"), index=False)
print(f"File 2: {len(df2)} rows")

# --- File 3: contractors.csv ---
# Missing many fields, "Mon DD, YYYY" dates, hourly_rate not salary
import calendar
used3 = set()
rows3 = []
for i in range(20):
    e = make_employee(i, used3)
    month_name = calendar.month_abbr[e["doj_m"]]
    rows3.append({
        "contractor_id": f"CTR-{random.randint(100, 999)}",
        "name": f"{e['fn']} {e['ln']}",
        "email_address": e["email"],
        "start_date": f"{month_name} {e['doj_d']:02d}, {e['doj_y']}",
        "department": e["dept"],
        "role": e["desg"],
        "hourly_rate": random.randint(500, 5000),
        "location": e["loc"] if random.random() > 0.3 else None,
        "phone": e["phone"] if random.random() > 0.4 else None,
    })

df3 = pd.DataFrame(rows3)
df3.to_csv(os.path.join(OUTPUT_DIR, "contractors.csv"), index=False)
print(f"File 3: {len(df3)} rows")

# --- File 4: employee_updates.xlsx ---
# Partial updates that conflict with file 1/2
rows4 = []
update_emps = emps[:25]
for e in update_emps:
    row = {"email": e["email"]}
    # Randomly include some fields with updated values
    if random.random() > 0.5:
        row["department"] = random.choice(DEPARTMENTS)  # department change
    if random.random() > 0.5:
        row["designation"] = random.choice(DESIGNATIONS)  # title change
    if random.random() > 0.6:
        row["location"] = random.choice(LOCATIONS)  # relocation
    if random.random() > 0.7:
        row["salary"] = e["salary"] + random.randint(50000, 200000)  # raise
    if random.random() > 0.8:
        row["manager_email"] = f"newmanager{random.randint(1,3)}@company.com"
    if len(row) > 1:  # only add if there's at least one update besides email
        rows4.append(row)

df4 = pd.DataFrame(rows4)
df4.to_excel(os.path.join(OUTPUT_DIR, "employee_updates.xlsx"), index=False)
print(f"File 4: {len(df4)} rows")

print("\nAll mock data files generated!")
