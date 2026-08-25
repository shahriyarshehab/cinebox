import urllib.request
import urllib.parse
import re

def test_url(u):
    try:
        req = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=8) as res:
            content = res.read().decode('utf-8', errors='ignore')
            print(f"URL: {u} (Length: {len(content)})")
            links = re.findall(r'<a\s+href=[\'"]([^\'"]+)[\'"]>(.*?)</a>', content, re.I)
            for href, text in links[:30]:
                print(f"   {href} -> {text.strip()}")
    except Exception as e:
        print(f"Error on {u}: {e}")

print("=== Checking DHAKA-FLIX-14 ===")
test_url("http://172.16.50.14/DHAKA-FLIX-14/")

print("=== Checking KOREAN variations ===")
test_url("http://172.16.50.14/DHAKA-FLIX-14/KOREAN%20TV%20%26%20WEB%20Series/")
test_url("http://172.16.50.12/DHAKA-FLIX-12/TV-WEB-Series/")
test_url("http://172.16.50.4/DHAKA-FLIX-4/")
test_url("http://172.16.50.7/DHAKA-FLIX-7/")
