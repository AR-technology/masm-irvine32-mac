#!/usr/bin/env python3
"""
Simple local HTTP server to launch MASM Irvine32 Lab Studio
"""
import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8080

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    socketserver.TCPServer.allow_reuse_address = True
    try:
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            url = f"http://localhost:{PORT}"
            print(f"=====================================================")
            print(f"  MASM 32 + Irvine32 Assembly Lab Studio (macOS)")
            print(f"  Server running at: {url}")
            print(f"  Press Ctrl+C to stop")
            print(f"=====================================================")
            webbrowser.open(url)
            httpd.serve_forever()
    except OSError as e:
        # Fallback to alternate port if 8080 is busy
        fallback_port = 8088
        with socketserver.TCPServer(("", fallback_port), Handler) as httpd:
            url = f"http://localhost:{fallback_port}"
            print(f"Server running at: {url}")
            webbrowser.open(url)
            httpd.serve_forever()

if __name__ == '__main__':
    main()
