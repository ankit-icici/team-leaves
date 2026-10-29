"""Headless logic checks for index.html: syntax check, then the app's own functions
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
sys.exit(1 if r.returncode or "FAIL" in r.stdout else 0)
