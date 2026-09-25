const express = require("express");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-this";
const DATA_DIR = path.join(__dirname, "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "depannow.db"));
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 email TEXT UNIQUE NOT NULL,
 phone TEXT NOT NULL,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('client','pro','admin')),
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS professionals (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER UNIQUE NOT NULL,
 service TEXT NOT NULL,
 district TEXT NOT NULL,
 bio TEXT DEFAULT '',
 available INTEGER DEFAULT 1,
 rating REAL DEFAULT 5,
 reviews_count INTEGER DEFAULT 0,
 FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS requests (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 client_id INTEGER NOT NULL,
 professional_id INTEGER,
 service TEXT NOT NULL,
 problem TEXT NOT NULL,
 location TEXT NOT NULL,
 status TEXT DEFAULT 'pending',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(client_id) REFERENCES users(id),
 FOREIGN KEY(professional_id) REFERENCES professionals(id)
);
CREATE TABLE IF NOT EXISTS reviews (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 request_id INTEGER UNIQUE NOT NULL,
 client_id INTEGER NOT NULL,
 professional_id INTEGER NOT NULL,
 rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
 comment TEXT DEFAULT '',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

const seed = db.prepare("SELECT COUNT(*) c FROM users").get().c;
if (process.env.SEED_DEMO === "true" && !seed) {
  const pw = bcrypt.hashSync("demo1234", 10);
  const insertUser = db.prepare("INSERT INTO users(name,email,phone,password_hash,role) VALUES(?,?,?,?,?)");
  const insertPro = db.prepare("INSERT INTO professionals(user_id,service,district,bio,available,rating,reviews_count) VALUES(?,?,?,?,?,?,?)");
  const demos = [
    ["Moussa Traoré","moussa@demo.local","70000001","Mécanicien","Ouaga 2000","Dépannage auto et diagnostic.",1,4.8,36],
    ["Awa Kaboré","awa@demo.local","70000002","Électricienne","Patte d'Oie","Installation et dépannage électrique.",1,4.9,28],
    ["Idrissa Sawadogo","idrissa@demo.local","70000003","Plombier","Dassasgho","Fuites, robinets et installations.",1,4.7,19],
    ["Adama Ouédraogo","adama@demo.local","70000004","Climatisation","Koulouba","Entretien et dépannage de climatiseurs.",0,4.6,14]
  ];
  const tx = db.transaction(() => {
    for (const d of demos) {
      const r = insertUser.run(d[0],d[1],d[2],pw,"pro");
      insertPro.run(r.lastInsertRowid,d[3],d[4],d[5],d[6],d[7],d[8]);
    }
  });
  tx();
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({limit:"200kb"}));
app.use(express.static(path.join(__dirname,"public")));

function tokenFor(user) {
  return jwt.sign({id:user.id, role:user.role}, JWT_SECRET, {expiresIn:"7d"});
}
function auth(req,res,next) {
  const h=req.headers.authorization||"";
  if(!h.startsWith("Bearer ")) return res.status(401).json({error:"Connexion requise"});
  try { req.user=jwt.verify(h.slice(7),JWT_SECRET); next(); }
  catch { res.status(401).json({error:"Session expirée"}); }
}
function clean(v,max=500){ return String(v??"").trim().slice(0,max); }

app.post("/api/register",(req,res)=>{
  const name=clean(req.body.name,80), email=clean(req.body.email,160).toLowerCase();
  const phone=clean(req.body.phone,30), password=String(req.body.password||"");
  const role=req.body.role==="pro"?"pro":"client";
  if(name.length<2 || !email.includes("@") || phone.length<6 || password.length<6)
    return res.status(400).json({error:"Informations d'inscription invalides"});
  try {
    const hash=bcrypt.hashSync(password,10);
    const r=db.prepare("INSERT INTO users(name,email,phone,password_hash,role) VALUES(?,?,?,?,?)")
      .run(name,email,phone,hash,role);
    if(role==="pro"){
      const service=clean(req.body.service,60)||"Autre";
      const district=clean(req.body.district,80)||"Non précisé";
      db.prepare("INSERT INTO professionals(user_id,service,district,bio) VALUES(?,?,?,?)")
        .run(r.lastInsertRowid,service,district,clean(req.body.bio,300));
    }
    const user=db.prepare("SELECT id,name,email,phone,role FROM users WHERE id=?").get(r.lastInsertRowid);
    res.json({token:tokenFor(user),user});
  } catch(e){ res.status(400).json({error:"Cet e-mail est déjà utilisé"}); }
});

app.post("/api/login",(req,res)=>{
  const email=clean(req.body.email,160).toLowerCase(), password=String(req.body.password||"");
  const user=db.prepare("SELECT * FROM users WHERE email=?").get(email);
  if(!user || !bcrypt.compareSync(password,user.password_hash))
    return res.status(401).json({error:"E-mail ou mot de passe incorrect"});
  const safe={id:user.id,name:user.name,email:user.email,phone:user.phone,role:user.role};
  res.json({token:tokenFor(safe),user:safe});
});

app.get("/api/me",auth,(req,res)=>{
  const u=db.prepare("SELECT id,name,email,phone,role FROM users WHERE id=?").get(req.user.id);
  if(!u) return res.status(404).json({error:"Utilisateur introuvable"});
  let professional=null;
  if(u.role==="pro") professional=db.prepare("SELECT * FROM professionals WHERE user_id=?").get(u.id);
  res.json({user:u,professional});
});

app.get("/api/professionals",(req,res)=>{
  const service=clean(req.query.service,60), district=clean(req.query.district,80), q=clean(req.query.q,100);
  let sql=`SELECT p.id,p.service,p.district,p.bio,p.available,p.rating,p.reviews_count,u.name,u.phone
           FROM professionals p JOIN users u ON u.id=p.user_id WHERE 1=1`;
  const args=[];
  if(service && service!=="Tous"){sql+=" AND lower(p.service)=lower(?)";args.push(service);}
  if(district){sql+=" AND lower(p.district) LIKE lower(?)";args.push("%"+district+"%");}
  if(q){sql+=" AND (lower(u.name) LIKE lower(?) OR lower(p.service) LIKE lower(?) OR lower(p.district) LIKE lower(?))";args.push("%"+q+"%","%"+q+"%","%"+q+"%");}
  sql+=" ORDER BY p.available DESC,p.rating DESC LIMIT 100";
  res.json(db.prepare(sql).all(...args));
});

app.post("/api/requests",auth,(req,res)=>{
  if(req.user.role!=="client") return res.status(403).json({error:"Seuls les clients peuvent créer une demande"});
  const service=clean(req.body.service,60), problem=clean(req.body.problem,800), location=clean(req.body.location,200);
  const professionalId=Number(req.body.professionalId)||null;
  if(!service||!problem||!location) return res.status(400).json({error:"Remplis le métier, le problème et le lieu"});
  if(professionalId && !db.prepare("SELECT id FROM professionals WHERE id=?").get(professionalId))
    return res.status(400).json({error:"Professionnel introuvable"});
  const r=db.prepare("INSERT INTO requests(client_id,professional_id,service,problem,location) VALUES(?,?,?,?,?)")
    .run(req.user.id,professionalId,service,problem,location);
  res.json({id:r.lastInsertRowid,status:"pending"});
});

app.get("/api/requests",auth,(req,res)=>{
  let rows;
  if(req.user.role==="client"){
    rows=db.prepare(`SELECT r.*,p.district,u.name professional_name,u.phone professional_phone
      FROM requests r LEFT JOIN professionals p ON p.id=r.professional_id LEFT JOIN users u ON u.id=p.user_id
      WHERE r.client_id=? ORDER BY r.id DESC`).all(req.user.id);
  } else if(req.user.role==="pro"){
    const p=db.prepare("SELECT id FROM professionals WHERE user_id=?").get(req.user.id);
    rows=p?db.prepare(`SELECT r.*,u.name client_name,u.phone client_phone
      FROM requests r JOIN users u ON u.id=r.client_id
      WHERE r.professional_id=? OR (r.professional_id IS NULL AND lower(r.service)=lower((SELECT service FROM professionals WHERE id=?)))
      ORDER BY r.id DESC LIMIT 100`).all(p.id,p.id):[];
  } else rows=db.prepare("SELECT * FROM requests ORDER BY id DESC LIMIT 200").all();
  res.json(rows);
});

app.patch("/api/requests/:id",auth,(req,res)=>{
  const id=Number(req.params.id), status=clean(req.body.status,30);
  const allowed=["accepted","en_route","done","cancelled"];
  if(!allowed.includes(status)) return res.status(400).json({error:"Statut invalide"});
  const r=db.prepare("SELECT * FROM requests WHERE id=?").get(id);
  if(!r) return res.status(404).json({error:"Demande introuvable"});
  let ok=req.user.role==="admin" || r.client_id===req.user.id;
  if(req.user.role==="pro"){
    const p=db.prepare("SELECT id FROM professionals WHERE user_id=?").get(req.user.id);
    ok=p && (r.professional_id===p.id);
    if(!r.professional_id && p) { db.prepare("UPDATE requests SET professional_id=? WHERE id=?").run(p.id,id); ok=true; }
  }
  if(!ok) return res.status(403).json({error:"Action non autorisée"});
  db.prepare("UPDATE requests SET status=? WHERE id=?").run(status,id);
  res.json({ok:true});
});

app.post("/api/reviews",auth,(req,res)=>{
  if(req.user.role!=="client") return res.status(403).json({error:"Action non autorisée"});
  const requestId=Number(req.body.requestId), rating=Number(req.body.rating), comment=clean(req.body.comment,500);
  const r=db.prepare("SELECT * FROM requests WHERE id=? AND client_id=? AND status='done'").get(requestId,req.user.id);
  if(!r || !r.professional_id) return res.status(400).json({error:"Cette demande ne peut pas être notée"});
  if(rating<1||rating>5) return res.status(400).json({error:"Note entre 1 et 5"});
  try{
    db.prepare("INSERT INTO reviews(request_id,client_id,professional_id,rating,comment) VALUES(?,?,?,?,?)")
      .run(requestId,req.user.id,r.professional_id,rating,comment);
    const avg=db.prepare("SELECT AVG(rating) avg,COUNT(*) c FROM reviews WHERE professional_id=?").get(r.professional_id);
    db.prepare("UPDATE professionals SET rating=?,reviews_count=? WHERE id=?").run(Number(avg.avg.toFixed(2)),avg.c,r.professional_id);
    res.json({ok:true});
  }catch{res.status(400).json({error:"Cette demande a déjà été notée"});}
});

app.get("/api/health",(req,res)=>res.json({ok:true,app:"DepanNow",version:"3.0.0"}));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

app.listen(PORT, "0.0.0.0", ()=>console.log(`DepanNow running on port ${PORT}`));