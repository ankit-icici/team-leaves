"""All automatic checks: the app (index.html), the alert display (sw.js) and the
alert sender (alerts/). For index.html: syntax check, then the app's own functions
run in Node against stubbed Firebase and browser objects (test/checks.mjs).

    python3 test/run-checks.py

Every line should start with "ok". Add a check here for every bug fixed."""
import os, re, subprocess, sys, tempfile
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
s = open(os.path.join(root, "index.html"), encoding="utf-8").read()
js = s.split('<script type="module">', 1)[1].split('</script>', 1)[0]
tmp = tempfile.mkdtemp()
app = os.path.join(tmp, "app.mjs"); open(app, "w", encoding="utf-8").write(js)
if subprocess.run(["node", "--check", app]).returncode: sys.exit("Syntax error in index.html")
js = re.sub(r'import[\s\S]*?from "https://[^"]+";\n', '', js).replace('apiKey:            "AIza', 'apiKey:            "PASTE_AIza')
js = js.split('/* ═══════════════════════════════════════════════════════════\n   ⑩  Boot')[0]
checks = open(os.path.join(root, "test", "checks.mjs"), encoding="utf-8").read().replace("/*__APP__*/", js)
run = os.path.join(tmp, "run.mjs"); open(run, "w", encoding="utf-8").write(checks)
r = subprocess.run(["node", run], capture_output=True, text=True)
print(r.stdout, r.stderr, sep="")
w = subprocess.run(["node", os.path.join(root, "test", "sw-checks.mjs"), os.path.join(root, "sw.js")], capture_output=True, text=True)
print(w.stdout, w.stderr, sep="")
a = subprocess.run(["node", os.path.join(root, "alerts", "test-alerts.mjs")], capture_output=True, text=True)
print(a.stdout, a.stderr, sep="")
# Every field written to a phone's alert record (by the app or by the sender) must be
# in the rules' list: the list covers the whole record, so one missing field blocks
# every later save from the phone (caught in review, v34).
rules = open(os.path.join(root, "firestore.rules"), encoding="utf-8").read()
blk = rules.split("match /devices/{deviceId}", 1)[1].split("allow get", 1)[0]
allowed = set(re.findall(r"'(\w+)'", blk.split("hasOnly(", 1)[1].split(")", 1)[0]))
code = open(os.path.join(root, "alerts", "apps-script", "Code.js"), encoding="utf-8").read()
def obj_keys(body):
    """Top-level keys of a JS object literal body, shorthand ({ token, subs }) included."""
    prev = None
    while prev != body: prev, body = body, re.sub(r'\([^()]*\)|\[[^\[\]]*\]|\{[^{}]*\}', '', body)
    keys = set()
    for part in body.split(","):
        k = re.match(r'\s*(\w+)\s*(:|$)', part)
        if k: keys.add(k.group(1))
    return keys
written = set()
for m in re.finditer(r'patchDoc_\("devices/"[^{]*\{([^}]*)\}', code): written |= obj_keys(m.group(1))
app_js = s.split('<script type="module">', 1)[1]
for m in re.finditer(r'setDoc\(doc\(db,\s*"devices",\s*deviceId\(\)\),\s*(\w+|\{[^}]*\})', app_js):
    body = m.group(1)
    if body.startswith("{"): written |= obj_keys(body[1:-1])
    else:   # a variable: find where it is built (const name = { ... })
        d = re.search(r'(?:const|let)\s+' + body + r'\s*=\s*\{([^;]*?)\};', app_js, re.S)
        if d: written |= obj_keys(d.group(1))
for m in re.finditer(r'rec\.(\w+)\s*=', app_js): written.add(m.group(1))
written -= {"merge", "tid", "mid"}
missing = sorted(written - allowed)
print(("ok " if not missing else "FAIL ") + "phone alert record: every field written is allowed by the rules"
      + ("" if not missing else " — missing: " + ", ".join(missing)) + " (" + ", ".join(sorted(written)) + ")")
bad = r.returncode or w.returncode or a.returncode or "FAIL" in (r.stdout + w.stdout + a.stdout) or bool(missing)
sys.exit(1 if bad else 0)
