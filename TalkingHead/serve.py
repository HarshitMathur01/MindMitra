import argparse
import http.server
import mimetypes


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    """SimpleHTTPRequestHandler with no-cache headers so browsers always
    fetch the latest files during development."""

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def send_head(self):
        """Override to strip If-Modified-Since so we never send 304."""
        if "If-Modified-Since" in self.headers:
            del self.headers["If-Modified-Since"]
        if "If-None-Match" in self.headers:
            del self.headers["If-None-Match"]
        return super().send_head()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Serve TalkingHead locally with correct MIME types for ES modules."
    )
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind")
    parser.add_argument("--port", type=int, default=8000, help="Port to listen on")
    args = parser.parse_args()

    mimetypes.add_type("application/javascript", ".mjs")

    server = http.server.ThreadingHTTPServer((args.host, args.port), NoCacheHandler)

    print(f"Serving on http://{args.host}:{args.port}/")
    print("Press Ctrl+C to stop")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()