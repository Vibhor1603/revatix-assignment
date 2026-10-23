#!/usr/bin/env bash
# Full happy-path + edge-case sweep against local API (Aiven-backed).

set -u
BASE="${API_BASE:-http://127.0.0.1:4000/api/v1}"
PASS=0
FAIL=0

green() { printf 'PASS  %s\n' "$1"; PASS=$((PASS+1)); }
red() { printf 'FAIL  %s\n      %s\n' "$1" "$2"; FAIL=$((FAIL+1)); }

# usage: expect STATUS METHOD PATH [json_body] [token]
expect() {
  local want="$1" method="$2" path="$3" body="${4:-}" token="${5:-}"
  local args=(-s -w "\n%{http_code}" -X "$method" "$BASE$path" -H "Content-Type: application/json")
  if [[ -n "$token" ]]; then
    args+=(-H "Authorization: Bearer $token")
  fi
  if [[ -n "$body" ]]; then
    args+=(-d "$body")
  fi

  local raw code resp
  raw=$(curl "${args[@]}")
  code=$(printf '%s' "$raw" | tail -n1)
  resp=$(printf '%s' "$raw" | sed '$d')

  if [[ "$code" == "$want" ]]; then
    green "$method $path -> $code"
    LAST_BODY="$resp"
    return 0
  fi
  red "$method $path (want $want got $code)" "$resp"
  LAST_BODY="$resp"
  return 1
}

json_field() {
  # tiny extractor without jq dependency for simple "key":"value"
  node -e "const d=JSON.parse(process.argv[1]); const p=process.argv[2].split('.'); let v=d; for (const k of p) v=v?.[k]; if (v===undefined||v===null) process.exit(2); process.stdout.write(String(v));" "$1" "$2"
}

echo "Sweep against $BASE"
echo

# --- Auth edges ---
expect 401 POST /auth/login '{"email":"manager@isp.local","password":"wrong-pass"}' || true
expect 400 POST /auth/login '{"email":"bad","password":"x"}' || true

expect 200 POST /auth/login '{"email":"manager@isp.local","password":"Password123!"}' || exit 1
MGR=$(json_field "$LAST_BODY" token)

expect 200 POST /auth/login '{"email":"support@isp.local","password":"Password123!"}' || exit 1
SUP=$(json_field "$LAST_BODY" token)

expect 200 POST /auth/login '{"email":"tech@isp.local","password":"Password123!"}' || exit 1
TECH=$(json_field "$LAST_BODY" token)
TECH_ID=$(json_field "$LAST_BODY" user.id)

expect 200 GET /auth/me "" "$MGR" || true
expect 401 GET /auth/me || true

# --- Catalog ---
expect 201 POST /plans "{\"name\":\"Sweep Plan $(date +%s)\",\"bandwidthMbps\":150,\"price\":1200}" "$MGR" || exit 1
PLAN=$(json_field "$LAST_BODY" id)

expect 201 POST /pops "{\"code\":\"POP-SWEEP-$(date +%s)\",\"name\":\"Sweep POP\",\"location\":\"Lab\"}" "$MGR" || exit 1
POP=$(json_field "$LAST_BODY" id)

expect 201 POST /sectors "{\"name\":\"Sweep Sector $(date +%s)\",\"geoDescription\":\"lab sector\"}" "$MGR" || exit 1
SECTOR=$(json_field "$LAST_BODY" id)

expect 200 GET "/plans?page=1" "" "$SUP" || true
expect 403 POST /plans '{"name":"Nope","bandwidthMbps":1,"price":1}' "$SUP" || true

# --- Connections ---
expect 403 POST /connections "{\"customerName\":\"X\",\"phone\":\"1\",\"planId\":\"$PLAN\",\"popId\":\"$POP\",\"sectorId\":\"$SECTOR\"}" "$SUP" || true

expect 201 POST /connections "{\"customerName\":\"Sweep Cust\",\"phone\":\"9999999999\",\"email\":\"sweep@example.com\",\"address\":\"1 Lab Rd\",\"planId\":\"$PLAN\",\"popId\":\"$POP\",\"sectorId\":\"$SECTOR\",\"staticIp\":\"10.9.9.9\",\"status\":\"Active\"}" "$MGR" || exit 1
CONN=$(json_field "$LAST_BODY" id)

expect 200 GET "/connections?status=Active&planId=$PLAN&popId=$POP&sectorId=$SECTOR&page=1" "" "$MGR" || true
expect 200 PATCH "/connections/$CONN/status" '{"status":"Suspended"}' "$MGR" || true
expect 200 PATCH "/connections/$CONN/status" '{"status":"Active"}' "$MGR" || true
expect 200 PATCH "/connections/$CONN" "{\"planId\":\"$PLAN\",\"customerName\":\"Sweep Cust Updated\"}" "$MGR" || true

# Terminated connection cannot get ticket
expect 201 POST /connections "{\"customerName\":\"Dead Line\",\"phone\":\"111\",\"planId\":\"$PLAN\",\"popId\":\"$POP\",\"sectorId\":\"$SECTOR\",\"status\":\"Terminated\"}" "$MGR" || exit 1
DEAD=$(json_field "$LAST_BODY" id)
expect 400 POST /tickets "{\"connectionId\":\"$DEAD\",\"title\":\"Nope\",\"slaDueAt\":\"2026-10-25 12:00:00\"}" "$SUP" || true

# --- Tickets / tasks ---
expect 403 POST /tickets "{\"connectionId\":\"$CONN\",\"title\":\"Tech blocked\",\"slaDueAt\":\"2026-10-25 18:00:00\"}" "$TECH" || true

expect 201 POST /tickets "{\"connectionId\":\"$CONN\",\"title\":\"Outage\",\"description\":\"No link\",\"complaintType\":\"outage\",\"priority\":\"critical\",\"slaDueAt\":\"2026-10-25 18:00:00\"}" "$SUP" || exit 1
TICKET=$(json_field "$LAST_BODY" id)

expect 201 POST "/tickets/$TICKET/tasks" '{"taskType":"Feeder Line Check"}' "$SUP" || exit 1
TASK_A=$(json_field "$LAST_BODY" id)
expect 201 POST "/tickets/$TICKET/tasks" '{"taskType":"ONU Configuration"}' "$MGR" || exit 1
TASK_B=$(json_field "$LAST_BODY" id)
expect 201 POST "/tickets/$TICKET/tasks" '{"taskType":"Splicing"}' "$SUP" || exit 1
TASK_C=$(json_field "$LAST_BODY" id)

expect 200 GET "/tickets/$TICKET/tasks?page=1" "" "$MGR" || true

# --- Shifts + conflict ---
# Unique future day so re-runs do not collide with prior seed data
DAY=$(node -e "const d=new Date(); d.setUTCDate(d.getUTCDate()+14+Math.floor(Math.random()*40)); console.log(d.toISOString().slice(0,10));")
expect 201 POST "/technicians/$TECH_ID/shifts" "{\"shiftDate\":\"$DAY\",\"startTime\":\"09:00:00\",\"endTime\":\"17:00:00\"}" "$MGR" || exit 1
expect 400 POST "/technicians/$TECH_ID/shifts" "{\"shiftDate\":\"$DAY\",\"startTime\":\"22:00:00\",\"endTime\":\"06:00:00\"}" "$MGR" || true
expect 400 POST "/technicians/$TECH_ID/shifts" "{\"shiftDate\":\"$DAY\",\"startTime\":\"10:00:00\",\"endTime\":\"12:00:00\"}" "$MGR" || true

expect 200 POST "/tasks/$TASK_A/assign" "{\"technicianId\":\"$TECH_ID\",\"scheduledStart\":\"$DAY 10:00:00\",\"scheduledEnd\":\"$DAY 12:00:00\"}" "$SUP" || exit 1
expect 400 POST "/tasks/$TASK_B/assign" "{\"technicianId\":\"$TECH_ID\",\"scheduledStart\":\"$DAY 11:00:00\",\"scheduledEnd\":\"$DAY 13:00:00\"}" "$SUP" || true
expect 400 POST "/tasks/$TASK_B/assign" "{\"technicianId\":\"$TECH_ID\",\"scheduledStart\":\"$DAY 18:00:00\",\"scheduledEnd\":\"$DAY 19:00:00\"}" "$SUP" || true
expect 400 POST "/tasks/$TASK_B/assign" "{\"technicianId\":\"$TECH_ID\",\"scheduledStart\":\"$DAY 22:00:00\",\"scheduledEnd\":\"2026-10-27 01:00:00\"}" "$SUP" || true
expect 200 POST "/tasks/$TASK_B/assign" "{\"technicianId\":\"$TECH_ID\",\"scheduledStart\":\"$DAY 13:00:00\",\"scheduledEnd\":\"$DAY 15:00:00\"}" "$SUP" || true

# Reassign + unassign
expect 200 POST "/tasks/$TASK_B/unassign" "" "$MGR" || true
expect 200 POST "/tasks/$TASK_B/assign" "{\"technicianId\":\"$TECH_ID\",\"scheduledStart\":\"$DAY 14:00:00\",\"scheduledEnd\":\"$DAY 16:00:00\"}" "$SUP" || true

# Status ranks
expect 200 PATCH "/tasks/$TASK_A/status" '{"status":"In-Progress"}' "$TECH" || true
expect 200 PATCH "/tasks/$TASK_A/status" '{"status":"Field Visit"}' "$TECH" || true
expect 200 PATCH "/tickets/$TICKET/status" '{"status":"In-Progress"}' "$SUP" || true

# Close ticket blocked while tasks open
expect 400 PATCH "/tickets/$TICKET/status" '{"status":"Closed"}' "$SUP" || true

expect 200 POST "/tasks/$TASK_A/cancel" "" "$SUP" || true
expect 200 POST "/tasks/$TASK_B/cancel" "" "$SUP" || true
expect 200 POST "/tasks/$TASK_C/cancel" "" "$SUP" || true
expect 200 PATCH "/tickets/$TICKET/status" '{"status":"Closed"}' "$SUP" || true

# Audit
expect 200 GET "/audit?page=1&entityType=field_task" "" "$MGR" || true
expect 200 GET "/audit?page=1&action=status_change" "" "$SUP" || true
expect 403 GET "/audit?page=1" "" "$TECH" || true

# Technicians list
expect 200 GET "/technicians?page=1" "" "$MGR" || true

echo
echo "SUMMARY passed=$PASS failed=$FAIL"
[[ "$FAIL" -gt 0 ]] && exit 1
exit 0
