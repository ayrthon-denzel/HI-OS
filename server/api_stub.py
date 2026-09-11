"""Minimal local API stub for the HI OS prototype.
No external AI call is performed in this starter; production will bind each action to explicit policies/connectors.
"""
from http.server import BaseHTTPRequestHandler, HTTPServer
import json

class Handler(BaseHTTPRequestHandler):
    def _send(self, code, payload):
        body=json.dumps(payload).encode()
        self.send_response(code); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        if self.path == '/health': return self._send(200, {'status':'ok','service':'hi-os-api'})
        return self._send(404, {'error':'not_found'})
    def do_POST(self):
        if self.path != '/orchestrate': return self._send(404, {'error':'not_found'})
        length=int(self.headers.get('Content-Length','0')); raw=self.rfile.read(length)
        try: data=json.loads(raw or b'{}')
        except Exception: return self._send(400, {'error':'invalid_json'})
        cmd=(data.get('command') or '').lower(); route=['HI Orchestrator']
        if any(k in cmd for k in ['post','contenu','visuel','designer']): route += ['Master Designer','Social Media Manager']
        if any(k in cmd for k in ['prospect','contrat','entreprise']): route += ['Contract Hunter','CRM & Sales']
        if any(k in cmd for k in ['mail','inbox','réponse']): route += ['Inbox Agent']
        return self._send(200, {'accepted':True,'route':list(dict.fromkeys(route)),'approval_required':False})

if __name__=='__main__':
    HTTPServer(('0.0.0.0', 8080), Handler).serve_forever()
