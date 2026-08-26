import os
import sys
import http.server
import socketserver

PORT = int(os.environ.get('PORT', 3000))
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class CineboxHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Service-Worker-Allowed', '/')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def guess_type(self, path):
        if path.endswith('.svg'):
            return 'image/svg+xml'
        if path.endswith('.json'):
            return 'application/json'
        if path.endswith('.js'):
            return 'application/javascript'
        if path.endswith('.webmanifest') or path.endswith('manifest.json'):
            return 'application/manifest+json'
        return super().guess_type(path)

def run():
    port = PORT
    while port < PORT + 100:
        try:
            with socketserver.TCPServer(("", port), CineboxHTTPRequestHandler) as httpd:
                print("\n==============================================")
                print("  🎬 CineBox Local Development Server Running")
                print("==============================================")
                print(f"  > Local URL:   http://localhost:{port}")
                print(f"  > Network URL: http://127.0.0.1:{port}")
                print("\n  Press Ctrl + C to stop the server.\n")
                httpd.serve_forever()
                break
        except OSError as e:
            if getattr(e, 'winerror', None) == 10048 or e.errno in (48, 98):
                port += 1
            else:
                raise

if __name__ == '__main__':
    try:
        run()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        sys.exit(0)
