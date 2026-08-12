#!/usr/bin/env python3
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse
import json, mimetypes, os, subprocess, sys, time

ROOT=Path(__file__).resolve().parents[2]
PUBLIC=Path(os.environ.get('GOJET_FIXTURE_PUBLIC', '/tmp/gojet-browser-fixture'))
APP=ROOT/'frontend'/'userconsole'
ADMIN=ROOT/'frontend'/'adminconsole'

USERS=[{'id':1,'email':'user@example.test','name':'Browser User','status':'active','email_verified':True,'workspaces':1,'last_login_at':'2026-08-10T00:00:00Z','created_at':'2026-08-01T00:00:00Z'}]
USER_DETAIL={'id':1,'email':'user@example.test','display_name':'Browser User','status':'active','email_verified':True,'active_sessions':2,'last_login_at':'2026-08-10T00:00:00Z','resources':{'links':4,'file_shares':1},'workspaces':[{'id':1,'name':'Browser Workspace','role':'owner','status':'active'}]}
ADMINISTRATORS=[{'id':1,'email':'owner@example.test','display_name':'Owner','role':'super_admin','status':'active','totp_enabled':False,'permissions':['*'],'last_login_at':'2026-08-10T00:00:00Z'}]
PERMISSIONS=['platform.read','users.manage','workspaces.manage','links.manage','content.manage','mail.manage','files.manage','domains.manage','security.manage','settings.manage','billing.manage','operations.manage','admins.manage','tickets.manage']
TICKET={'id':1,'ticket_number':'GJ-260811-A1B2C3D4','user_id':1,'user_email':'user@example.test','workspace_id':1,'department_id':1,'department_name':'技术支持','subject':'短链接跳转问题','priority':'normal','status':'customer_reply','last_reply_at':'2026-08-11T01:20:00Z','last_reply_by':'customer','closed_at':None,'created_at':'2026-08-11T01:00:00Z'}
TICKET_MESSAGES=[{'id':1,'author_type':'customer','author_user_id':1,'author_name':'Browser User','body':'访问短链接时出现异常，请协助检查。','internal':False,'created_at':'2026-08-11T01:00:00Z'},{'id':2,'author_type':'administrator','author_administrator_id':1,'author_name':'Owner','body':'已收到，我们正在检查。','internal':False,'created_at':'2026-08-11T01:10:00Z'}]
BOT={'turnstile.enabled':False,'turnstile.site_key':'','turnstile.fail_open':False,'turnstile.allowed_hostnames':['gojet.cc','app.gojet.cc'],'turnstile.registration':True,'turnstile.login':True,'turnstile.forgot_password':True,'turnstile.reset_password':True,'turnstile.ticket_create':True,'turnstile.ticket_reply':True,'turnstile.abuse_report':True,'turnstile.secret_configured':True}

def ensure_public_build():
    if (PUBLIC/'index.html').is_file():
        return
    subprocess.run([sys.executable,str(ROOT/'scripts'/'buildpublicsite.py'),'--output',str(PUBLIC)],check=True)

class H(BaseHTTPRequestHandler):
    def log_message(self,*args): pass
    def send_json(self,obj,status=200):
        raw=json.dumps(obj,ensure_ascii=False).encode()
        self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
    def send_file(self,path):
        if not path.is_file(): self.send_error(404);return
        raw=path.read_bytes();self.send_response(200);self.send_header('Content-Type',mimetypes.guess_type(path.name)[0] or 'application/octet-stream');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
    def body(self):
        n=int(self.headers.get('Content-Length','0') or 0)
        return json.loads(self.rfile.read(n) or b'{}')
    def static(self,path):
        p=urlparse(path).path
        if p=='/': return PUBLIC/'index.html'
        if p.startswith('/assets/'): return PUBLIC/p.lstrip('/')
        if p=='/app' or p.startswith('/app/'):
            rel=p[len('/app/'):]
            if p=='/app' or not rel or '/' not in rel and '.' not in rel: return APP/'index.html'
            return APP/rel
        if p=='/admin' or p=='/admin/': return ADMIN/'index.html'
        if p.startswith('/admin/'): return ADMIN/p[len('/admin/'):]
        rel=p.lstrip('/')
        candidate=PUBLIC/rel
        if candidate.is_dir(): return candidate/'index.html'
        if candidate.is_file(): return candidate
        html=PUBLIC/(rel+'.html')
        if html.is_file(): return html
        return None
    def do_GET(self):
        p=urlparse(self.path).path
        if p=='/api/public/settings': return self.send_json({'registration.enabled':True,'site.name':'GoJet','site.support_email':'support@example.test','brand.primary_color':'#16A66A'})
        if p=='/api/public/turnstile': return self.send_json({'enabled':False,'site_key':'','surfaces':{'registration':False,'login':False,'forgot_password':False,'reset_password':False,'ticket_create':False,'ticket_reply':False,'abuse_report':False}})
        if p=='/api/public/announcements': return self.send_json({'data':[]})
        if p=='/api/admin/auth/me': return self.send_json(ADMINISTRATORS[0])
        if p=='/api/admin/overview': return self.send_json({'users':1,'workspaces':1,'active_links':4,'today_clicks':42,'mail_failures':0,'abuse_reports':0,'domain_errors':0,'security_events':0,'file_scan_backlog':0,'file_scan_failures':0})
        if p=='/api/admin/users': return self.send_json({'data':USERS,'total':1,'limit':50,'offset':0})
        if p=='/api/admin/users/1': return self.send_json(USER_DETAIL)
        if p=='/api/admin/administrators': return self.send_json({'data':ADMINISTRATORS,'permission_catalog':PERMISSIONS,'role_templates':{'super_admin':['*'],'operator':['platform.read','users.manage','workspaces.manage','links.manage','content.manage','mail.manage','operations.manage','tickets.manage'],'security':['platform.read','users.manage','files.manage','domains.manage','security.manage'],'support':['platform.read','users.manage','mail.manage','tickets.manage'],'analyst':['platform.read'],'custom':[]}})
        if p=='/api/admin/announcements': return self.send_json({'data':[{'id':1,'title':'Browser Announcement','body':'# Hello\n\n**World**','status':'draft','created_at':'2026-08-10T00:00:00Z'}]})
        if p=='/api/admin/diagnostics': return self.send_json({'database':{'status':'operational'},'redis':{'status':'operational','stream_events':0},'maintenance_mode':False,'alerts':[]})
        if p=='/api/admin/settings': return self.send_json({'basic':{},'seo':{},'registration':{},'links':{},'runtime':{},'brand':{},'payments':{},'mail':{'port':587,'password_configured':False}})
        if p=='/api/admin/bot-protection': return self.send_json(BOT)
        if p=='/api/admin/support/tickets': return self.send_json({'data':[TICKET]})
        if p=='/api/admin/support/tickets/1': return self.send_json({'ticket':TICKET,'messages':TICKET_MESSAGES})
        if p=='/api/admin/mail/templates': return self.send_json({'data':[]})
        if p=='/api/admin/mail/logs': return self.send_json({'data':[]})
        if p=='/api/admin/workspaces': return self.send_json({'data':[]})
        if p=='/api/admin/links': return self.send_json({'data':[]})
        if p=='/api/admin/files': return self.send_json({'data':[]})
        if p=='/api/admin/resources': return self.send_json({'data':[]})
        if p=='/api/admin/abuse': return self.send_json({'data':[]})
        if p=='/api/admin/domains': return self.send_json({'data':[]})
        if p=='/api/admin/security': return self.send_json({'data':[]})
        if p=='/api/admin/audit': return self.send_json({'data':[]})
        if p=='/api/admin/plans': return self.send_json({'data':[]})
        if p.startswith('/api/admin/invoices'): return self.send_json({'data':[]})
        if p=='/api/me': return self.send_json({'id':1,'email':'user@example.test','display_name':'Browser User','status':'active','email_verified':True})
        if p=='/api/workspaces': return self.send_json({'data':[{'id':1,'name':'Browser Workspace','type':'personal','role':'owner'}]})
        if p=='/api/workspaces/1/links': return self.send_json({'data':[],'total':0})
        if p=='/api/support/departments': return self.send_json({'data':[{'id':1,'name':'技术支持','slug':'technical','description':'网站功能、短链接、域名、API 与文件服务问题'},{'id':2,'name':'账户与账单','slug':'billing','description':'账户、套餐、账单与支付相关问题'}]})
        if p=='/api/support/tickets': return self.send_json({'data':[TICKET]})
        if p=='/api/support/tickets/1': return self.send_json({'ticket':TICKET,'messages':TICKET_MESSAGES})
        f=self.static(self.path)
        if f: return self.send_file(f)
        self.send_error(404)
    def do_POST(self):
        p=urlparse(self.path).path
        if p=='/api/admin/auth/login': return self.send_json({'administrator':ADMINISTRATORS[0],'token':'a'*64})
        if p=='/api/admin/mail/test':
            body=self.body(); time.sleep(.35)
            if body.get('recipient')=='fail@example.test': return self.send_json({'error':'SMTP 连接失败'},503)
            return self.send_json({'ok':True})
        if p in ['/api/admin/auth/logout','/api/admin/diagnostics/reconcile','/api/admin/diagnostics/cache/flush','/api/auth/logout']: return self.send_json({'ok':True})
        if p=='/api/admin/announcements': return self.send_json({'id':2},201)
        if p=='/api/admin/support/tickets/1/replies': return self.send_json({'saved':True},201)
        if p=='/api/support/tickets': return self.send_json({'id':1,'ticket_number':TICKET['ticket_number'],'status':'open'},201)
        if p=='/api/support/tickets/1/replies': return self.send_json({'saved':True},201)
        if p=='/api/public/abuse-reports': return self.send_json({'accepted':True,'reference':42},202)
        if p=='/api/auth/login': return self.send_json({'user':{'id':1,'email':'user@example.test','display_name':'Browser User'},'token':'u'*64})
        if p=='/api/auth/register': return self.send_json({'user':{'id':2},'token':'r'*64},201)
        if p=='/api/auth/forgotpassword': return self.send_json({'queued':True},202)
        if p=='/api/auth/resetpassword': return self.send_json({'reset':True})
        if p.startswith('/api/'): return self.send_json({'ok':True})
        self.send_error(404)
    def do_PATCH(self):
        if self.path.startswith('/api/'): return self.send_json({'updated':True})
        self.send_error(404)
    def do_PUT(self):
        p=urlparse(self.path).path
        if p=='/api/admin/bot-protection':
            body=self.body(); BOT.update(body); BOT['turnstile.secret_configured']=True; return self.send_json({'saved':True})
        if p.startswith('/api/'): return self.send_json({'updated':True})
        self.send_error(404)
    def do_DELETE(self):
        if self.path.startswith('/api/'):
            self.send_response(204);self.end_headers();return
        self.send_error(404)

if __name__=='__main__':
    ensure_public_build()
    ThreadingHTTPServer(('127.0.0.1',4173),H).serve_forever()
