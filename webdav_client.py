import json, time, uuid, requests
from urllib.parse import urljoin

class NextcloudWebDAV:
    def __init__(self, base, username, password):
        if not base.endswith('/'):
            base += '/'
        self.base = base
        self.session = requests.Session()
        self.session.auth = (username, password)

    def ensure_folder(self, folder_path: str):
        if not folder_path.endswith('/'):
            folder_path += '/'
        url = urljoin(self.base, folder_path)
        r = self.session.request("MKCOL", url)
        if r.status_code not in (201, 405):
            raise RuntimeError(f"MKCOL failed {r.status_code}: {r.text}")

    def put_json(self, rel_path: str, payload):
        url = urljoin(self.base, rel_path)
        data = json.dumps(payload, ensure_ascii=False, indent=2).encode('utf-8')
        r = self.session.put(url, data=data, headers={"Content-Type": "application/json"})
        if r.status_code not in (200, 201, 204):
            raise RuntimeError(f"PUT failed {r.status_code}: {r.text}")

    def get_json(self, rel_path: str):
        url = urljoin(self.base, rel_path)
        r = self.session.get(url)
        if r.status_code == 404:
            return None
        if r.status_code != 200:
            raise RuntimeError(f"GET failed {r.status_code}: {r.text}")
        return r.json()

    def append_order_index(self, order_meta: dict, index_path="orders/index.json"):
        existing = self.get_json(index_path)
        if existing is None:
            existing = []
        existing.append(order_meta)
        self.put_json(index_path, existing)

    def new_order_id(self) -> str:
        ts = time.strftime("%Y%m%d-%H%M%S")
        return f"ORD-{ts}-{str(uuid.uuid4())[:8]}"
