from playwright.sync_api import sync_playwright
import json, time

URL = "http://localhost:8000/"
OUT_CONSOLE = "talkinghead_console.log"
OUT_NETWORK = "talkinghead_network.jsonl"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    console_msgs = []
    network_events = []

    def on_console(msg):
        try:
            loc = msg.location
        except Exception:
            loc = {}
        console_msgs.append({"type": msg.type, "text": msg.text, "location": loc})

    def on_request(req):
        network_events.append({"event": "request", "url": req.url, "method": req.method, "headers": dict(req.headers)})

    def on_response(resp):
        try:
            network_events.append({"event": "response", "url": resp.url, "status": resp.status, "headers": dict(resp.headers)})
        except Exception:
            network_events.append({"event": "response", "url": resp.url, "status": None})

    page.on("console", on_console)
    page.on("request", on_request)
    page.on("response", on_response)

    print(f"Navigating to {URL}")
    page.goto(URL, timeout=60000)

    # Wait for app to initialize; increase if needed
    time.sleep(6)

    # Optionally try to call window.TalkingHead presence
    try:
        ready = page.evaluate("!!window.TalkingHead")
        print("window.TalkingHead present:", ready)
    except Exception as e:
        print("evaluate error:", e)

    # Dump console and network captures
    with open(OUT_CONSOLE, "w", encoding="utf-8") as f:
        for m in console_msgs:
            f.write(json.dumps(m, ensure_ascii=False) + "\n")

    with open(OUT_NETWORK, "w", encoding="utf-8") as f:
        for e in network_events:
            f.write(json.dumps(e, ensure_ascii=False) + "\n")

    print("Wrote:", OUT_CONSOLE, OUT_NETWORK)
    browser.close()
