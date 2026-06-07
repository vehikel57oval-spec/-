#!/usr/bin/env python3
import http.server
import socketserver
import webbrowser
import threading
import time
import sys

PORT = 8000

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        # ターミナルを綺麗に保つためにアクセスログを出力しないようにします
        pass

def open_browser():
    # サーバーが起動するのを少し待ってからブラウザを開きます
    time.sleep(0.8)
    url = f"http://localhost:{PORT}"
    print(f"ブラウザを開いています: {url}")
    webbrowser.open(url)

def main():
    import os
    # スクリプトがあるディレクトリを作業ディレクトリに変更して、正しいファイルを配信するようにします
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    # 簡易ポート競合チェック
    handler = QuietHandler
    
    # 別スレッドでブラウザを自動起動
    browser_thread = threading.Thread(target=open_browser, daemon=True)
    browser_thread.start()

    print("=" * 60)
    print("  隔日勤務 シフト自動生成システム ローカルサーバー")
    print(f"  URL: http://localhost:{PORT}")
    print("=" * 60)
    print("  サーバーを停止するには [Ctrl + C] を押してください。")
    print("-" * 60)

    try:
        with socketserver.TCPServer(("", PORT), handler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nサーバーを停止しました。ご利用ありがとうございました。")
        sys.exit(0)
    except Exception as e:
        print(f"\nエラーが発生しました: {e}")
        print("ポート 8000 が既に使用されている可能性があります。")
        sys.exit(1)

if __name__ == "__main__":
    main()
