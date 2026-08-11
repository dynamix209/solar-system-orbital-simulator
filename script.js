
// Lightweight multi-octave value noise + crater DEM generator (no external dep).
// Used as the surface "terrain API" so every planet gets real relief without multi-GB DEMs.
(function(){
  function hash2(x,y){ let n = Math.sin(x*127.1+y*311.7)*43758.5453; return n-Math.floor(n); }
  function lerp(a,b,t){ return a+(b-a)*t; }
  function smooth(t){ return t*t*(3-2*t); }
  function noise2(x,y){
    const xi=Math.floor(x), yi=Math.floor(y);
    const xf=x-xi, yf=y-yi;
    const u=smooth(xf), v=smooth(yf);
    return lerp(lerp(hash2(xi,yi),hash2(xi+1,yi),u), lerp(hash2(xi,yi+1),hash2(xi+1,yi+1),u), v);
  }
  function fbm(x,y,oct){
    let a=0.5, f=1, s=0, n=0;
    for(let i=0;i<oct;i++){ s+=a*noise2(x*f,y*f); n+=a; a*=0.5; f*=2.03; }
    return s/n;
  }
  // Classic bowl + raised rim crater (physically plausible morphology)
  function crater(dx,dz,R,depth,rim){
    const d=Math.sqrt(dx*dx+dz*dz);
    if(d>R*1.6) return 0;
    const rInner = R*0.55;
    if(d<rInner){ const u=d/rInner; return -depth*(1-u*u); }
    if(d<R){ const t=(d-rInner)/(R-rInner); return -depth*(1-t) + rim*t*t; }
    const t=(d-R)/(R*0.6); return rim*(1-t)*(1-t)*0.65;
  }
  window.TerrainAPI = {
    heightAt: function(x,z,key,seed){
      const sx=x*0.012+seed, sz=z*0.012+seed*1.7;
      let h = fbm(sx,sz,6)*1.0;
      h += fbm(sx*2.4+10,sz*2.4,4)*0.35;
      h += fbm(sx*8.1,sz*8.1,3)*0.08;
      if(key==='mars'){
        const vx=x+55, vz=z-70;
        const vd=Math.sqrt(vx*vx+vz*vz);
        if(vd<110){
          const t=1-vd/110;
          h += 18*t*t*(3-2*t) - crater(vx,vz,14,2.2,1.4);
        }
        const d2=Math.sqrt((x-40)*(x-40)+(z+30)*(z+30));
        h += 4.5*Math.max(0,1-d2/35)*Math.max(0,1-d2/35);
      }
      if(key==='earth'){
        h *= 0.85;
        h += fbm(sx*0.6,sz*0.6,3)*1.4;
        const valley = Math.abs(fbm(sx*1.1+3,sz*0.4,2)-0.5);
        h -= Math.max(0,0.22-valley)*2.8;
      }
      if(key==='mercury' || key==='mars'){
        for(let i=0;i<28;i++){
          const cx = (hash2(i*3.1,seed*2)-0.5)*180;
          const cz = (hash2(i*7.7,seed*3)-0.5)*180;
          const R  = 2.5 + hash2(i,seed)*14;
          const depth = R*0.22 + hash2(i+1,seed)*0.8;
          const rim = depth*0.45;
          h += crater(x-cx,z-cz,R,depth,rim);
        }
      }
      if(key==='venus'){
        h *= 0.55;
        h += fbm(sx*0.8,sz*0.8,4)*0.9;
      }
      // Smooth rocky lunar regolith — rolling highlands + soft maria (no hard crater pits)
      if(key==='moon'){
        h *= 0.4;
        const highland = fbm(sx*0.45, sz*0.45, 5);
        h += highland * 2.0;
        for(let i=0;i<4;i++){
          const mx = (hash2(i*2.3, seed)-0.5)*130;
          const mz = (hash2(i*5.1, seed*1.4)-0.5)*130;
          const mR = 32 + hash2(i, seed)*36;
          const md = Math.sqrt((x-mx)*(x-mx)+(z-mz)*(z-mz));
          if(md < mR){
            const t = 1 - md/mR;
            const s = t*t*(3-2*t);
            h -= 1.2 * s;
            h *= 0.75 + 0.25 * (1-s);
          }
        }
        h += fbm(sx*1.1, sz*1.1, 4) * 0.5;
        h += fbm(sx*4.2, sz*4.2, 3) * 0.16;
        h += fbm(sx*12, sz*12, 2) * 0.05;
      }
      return h;
    }
  };
})();


/* ============================== */


(function(){
  function killLoader(){
    var ls = document.getElementById('loading-screen');
    if(!ls) return;
    ls.classList.add('hide');
    ls.classList.add('force-off');
    ls.style.cssText = 'display:none!important;opacity:0!important;visibility:hidden!important;pointer-events:none!important;';
  }
  // Run ASAP — do not wait for Three.js or textures
  setTimeout(killLoader, 100);
  setTimeout(killLoader, 500);
  setTimeout(killLoader, 1200);
  setTimeout(killLoader, 2500);
  if(document.readyState === 'complete') setTimeout(killLoader, 200);
  else window.addEventListener('load', function(){ setTimeout(killLoader, 200); });
  document.addEventListener('keydown', function(e){ if(e.key==='Escape'||e.key==='Enter'||e.key===' ') killLoader(); });
})();


/* ============================== */


// =========================================================================
// ASTRONOMY CORE — real Keplerian elements (J2000, valid ~1800–2050)
// =========================================================================
if(typeof THREE === 'undefined'){
  var ls = document.getElementById('loading-screen');
  if(ls){ ls.classList.add('force-off'); ls.style.display='none'; }
  var err = document.createElement('div');
  err.style.cssText = 'position:fixed;inset:0;z-index:200;background:#05060a;color:#f2b8ac;font-family:sans-serif;display:flex;align-items:center;justify-content:center;text-align:center;padding:40px';
  err.innerHTML = '<div><h2>Three.js failed to load</h2><p>Check network / CDN access and reload.</p><p style="color:#9aa3b0;font-size:13px">Need: cdnjs.cloudflare.com</p></div>';
  document.body.appendChild(err);
  throw new Error('THREE is not defined');
}
const ELEMENTS = {
  mercury: { a:[0.38709927,0.00000037], e:[0.20563593,0.00001906], I:[7.00497902,-0.00594749], L:[252.25032350,149472.67411175], peri:[77.45779628,0.16047689], node:[48.33076593,-0.12534081] },
  venus:   { a:[0.72333566,0.00000390], e:[0.00677672,-0.00004107], I:[3.39467605,-0.00078890], L:[181.97909950,58517.81538729], peri:[131.60246718,0.00268329], node:[76.67984255,-0.27769418] },
  earth:   { a:[1.00000261,0.00000562], e:[0.01671123,-0.00004392], I:[-0.00001531,-0.01294668], L:[100.46457166,35999.37244981], peri:[102.93768193,0.32327364], node:[0.0,0.0] },
  mars:    { a:[1.52371034,0.00001847], e:[0.09339410,0.00007882], I:[1.84969142,-0.00813131], L:[-4.55343205,19140.30268499], peri:[-23.94362959,0.44441088], node:[49.55953891,-0.29257343] },
  jupiter: { a:[5.20288700,-0.00011607], e:[0.04838624,-0.00013253], I:[1.30439695,-0.00183714], L:[34.39644051,3034.74612775], peri:[14.72847983,0.21252668], node:[100.47390909,0.20469106] },
  saturn:  { a:[9.53667594,-0.00125060], e:[0.05386179,-0.00050991], I:[2.48599187,0.00193609], L:[49.95424423,1222.49362201], peri:[92.59887831,-0.41897216], node:[113.66242448,-0.28867794] },
  uranus:  { a:[19.18916464,-0.00196176], e:[0.04725744,-0.00004397], I:[0.77263783,-0.00242939], L:[313.23810451,428.48202785], peri:[170.95427630,0.40805281], node:[74.01692503,0.04240589] },
  neptune: { a:[30.06992276,0.00026291], e:[0.00859048,0.00005105], I:[1.77004347,0.00035372], L:[-55.12002969,218.45945325], peri:[44.96476227,-0.32241464], node:[131.78422574,-0.00508664] },
};
const DEG = Math.PI/180;
const OBLIQUITY = 23.4392911 * DEG;

function toJulianDate(date){ return date.getTime()/86400000 + 2440587.5; }
function centuriesSinceJ2000(jd){ return (jd - 2451545.0) / 36525; }
function norm360(deg){ let d = deg % 360; if(d < 0) d += 360; return d; }
function norm180(deg){ let d = norm360(deg); if(d > 180) d -= 360; return d; }

// Newton–Raphson solution of Kepler's equation: M = E − e sin E
function solveKeplerRad(Mrad, e){
  // Normalize mean anomaly to (−π, π]
  let M = Mrad;
  while(M > Math.PI) M -= 2*Math.PI;
  while(M < -Math.PI) M += 2*Math.PI;
  // Better initial guess for moderate eccentricity
  let E = (e < 0.8) ? M : Math.PI;
  for(let i=0;i<12;i++){
    const f = E - e*Math.sin(E) - M;
    const fp = 1 - e*Math.cos(E);
    const dE = f / fp;
    E -= dE;
    if(Math.abs(dE) < 1e-14) break;
  }
  return E;
}

// True anomaly from eccentric anomaly
function trueAnomalyFromE(E, e){
  const cosE = Math.cos(E), sinE = Math.sin(E);
  const cosNu = (cosE - e) / (1 - e*cosE);
  const sinNu = (Math.sqrt(1 - e*e) * sinE) / (1 - e*cosE);
  return Math.atan2(sinNu, cosNu);
}

// Generic Keplerian state in orbital plane → inertial (ecliptic) frame
// a in AU (or display units), angles in degrees, Mdeg = mean anomaly degrees
function keplerianXYZ(a, e, Ideg, nodeDeg, periDeg, Mdeg){
  e = Math.min(0.999, Math.max(0, e));
  const Mrad = norm180(Mdeg) * DEG;
  const E = solveKeplerRad(Mrad, e);
  const nu = trueAnomalyFromE(E, e);
  const r = a * (1 - e*e) / (1 + e*Math.cos(nu));
  // Perifocal coordinates
  const xp = r * Math.cos(nu);
  const yp = r * Math.sin(nu);
  // Rotate by ω (arg of peri), i, Ω (node)
  const w = (periDeg - nodeDeg) * DEG;
  const node = nodeDeg * DEG;
  const I = Ideg * DEG;
  const cosw=Math.cos(w), sinw=Math.sin(w);
  const cosnode=Math.cos(node), sinnode=Math.sin(node);
  const cosI=Math.cos(I), sinI=Math.sin(I);
  const x = (cosw*cosnode - sinw*sinnode*cosI)*xp + (-sinw*cosnode - cosw*sinnode*cosI)*yp;
  const y = (cosw*sinnode + sinw*cosnode*cosI)*xp + (-sinw*sinnode + cosw*cosnode*cosI)*yp;
  const z = (sinw*sinI)*xp + (cosw*sinI)*yp;
  return { x, y, z, r, E, nu, a, e };
}

// heliocentric ecliptic rectangular coordinates in AU (JPL approximate elements)
function heliocentricAtM(key, T, Mdeg){
  const el = ELEMENTS[key];
  const a = el.a[0] + el.a[1]*T;
  const e = el.e[0] + el.e[1]*T;
  const I = el.I[0] + el.I[1]*T;
  const peri = el.peri[0] + el.peri[1]*T;
  const node = el.node[0] + el.node[1]*T;
  return keplerianXYZ(a, e, I, node, peri, Mdeg);
}

// =========================================================================
// REALISTIC ORBITAL MECHANICS (Kepler + vis-viva)
// =========================================================================
// GM_sun in AU^3 / day^2  (k^2 Gaussian gravitational constant squared ≈ 0.000295912)
const GM_SUN = 0.0002959122082855911; // AU^3 day^-2
const AU_KM = 149597870.7;

/** Mean motion n (rad/day) from semi-major axis via Kepler III: n = sqrt(GM/a^3) */
function meanMotionRadPerDay(aAU){
  return Math.sqrt(GM_SUN / Math.pow(Math.max(aAU, 1e-6), 3));
}

/** Orbital period (days) from Kepler III */
function keplerPeriodDays(aAU){
  return 2 * Math.PI / meanMotionRadPerDay(aAU);
}

/** Vis-viva speed (km/s) at distance rAU on ellipse with semi-major aAU */
function visVivaKmS(rAU, aAU){
  const vAU_per_day = Math.sqrt(GM_SUN * (2/Math.max(rAU,1e-6) - 1/Math.max(aAU,1e-6)));
  // AU/day → km/s
  return vAU_per_day * AU_KM / 86400;
}

/** True anomaly degrees from current state */
function trueAnomalyDeg(key, T){
  const st = heliocentric(key, T);
  return (st.nu != null ? st.nu : 0) * 180 / Math.PI;
}

function orbitalMechanicsSummary(key, T){
  const el = ELEMENTS[key];
  if(!el) return null;
  const a = el.a[0] + el.a[1]*T;
  const e = el.e[0] + el.e[1]*T;
  const st = heliocentric(key, T);
  const r = st.r;
  const period = keplerPeriodDays(a);
  const speed = visVivaKmS(r, a);
  const nu = (st.nu != null ? st.nu : 0) * 180 / Math.PI;
  return {
    aAU: a, e: e, rAU: r,
    periodDays: period,
    periodYears: period / 365.25,
    speedKmS: speed,
    trueAnomalyDeg: ((nu % 360) + 360) % 360,
    meanMotionDegPerDay: meanMotionRadPerDay(a) * 180 / Math.PI
  };
}

function heliocentric(key, T){
  const el = ELEMENTS[key];
  const L = el.L[0] + el.L[1]*T;
  const peri = el.peri[0] + el.peri[1]*T;
  const M = L - peri;
  return heliocentricAtM(key, T, M);
}
function eclipticToEquatorial(x,y,z){
  const xeq = x;
  const yeq = y*Math.cos(OBLIQUITY) - z*Math.sin(OBLIQUITY);
  const zeq = y*Math.sin(OBLIQUITY) + z*Math.cos(OBLIQUITY);
  const r = Math.sqrt(xeq*xeq+yeq*yeq+zeq*zeq);
  let ra = norm360(Math.atan2(yeq, xeq)/DEG);
  const dec = Math.asin(zeq/r)/DEG;
  return { raDeg: ra, decDeg: dec };
}
function gmstHours(jd){
  const D = jd - 2451545.0;
  let gmst = (18.697374558 + 24.06570982441908*D) % 24;
  if(gmst<0) gmst += 24;
  return gmst;
}
function altitudeDeg(raDeg, decDeg, jd, latDeg, lonDeg){
  const lst = (gmstHours(jd) + lonDeg/15) % 24;
  const H = norm180(lst*15 - raDeg);
  const Hrad=H*DEG, decRad=decDeg*DEG, latRad=latDeg*DEG;
  const sinAlt = Math.sin(decRad)*Math.sin(latRad) + Math.cos(decRad)*Math.cos(latRad)*Math.cos(Hrad);
  return Math.asin(sinAlt)/DEG;
}
function azimuthDeg(raDeg, decDeg, jd, latDeg, lonDeg){
  const lst = (gmstHours(jd) + lonDeg/15) % 24;
  const H = norm180(lst*15 - raDeg);
  const Hrad=H*DEG, decRad=decDeg*DEG, latRad=latDeg*DEG;
  const az = Math.atan2(Math.sin(Hrad), Math.cos(Hrad)*Math.sin(latRad) - Math.tan(decRad)*Math.cos(latRad))/DEG;
  return norm360(az + 180); // 0=N, 90=E, 180=S, 270=W
}
function compassLabel(azDeg){
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(norm360(azDeg)/22.5) % 16];
}

// =========================================================================
// NIGHT SKY — a curated real bright-star catalog (J2000 RA/Dec, approximate
// to roughly ±0.5°, good for a recognizable sky rather than precise
// astrometry) plus stick-figure constellation lines drawn between them.
// Reused for every teleport destination: at solar-system distances the
// background stars are effectively at infinity, so the same sky is seen
// from anywhere in the system — only which half is above the horizon
// (governed by the observer's local rotation) changes.
// =========================================================================
// Bright stars with J2000 RA/Dec (degrees), V magnitude, constellation, and Henry Draper (HD) catalog number.
// Coordinates from standard IAU / SIMBAD values (epoch J2000).
const STAR_CATALOG = [
  {n:'Sirius', ra:101.287, dec:-16.716, mag:-1.46, con:'Canis Major', hd:48915, hip:32349},
  {n:'Canopus', ra:95.988, dec:-52.696, mag:-0.74, con:'Carina', hd:45348, hip:30438},
  {n:'Arcturus', ra:213.915, dec:19.182, mag:-0.05, con:'Boötes', hd:124897, hip:69673},
  {n:'Vega', ra:279.234, dec:38.784, mag:0.03, con:'Lyra', hd:172167, hip:91262},
  {n:'Capella', ra:79.172, dec:45.998, mag:0.08, con:'Auriga', hd:34029, hip:24608},
  {n:'Rigel', ra:78.634, dec:-8.202, mag:0.13, con:'Orion', hd:34085, hip:24436},
  {n:'Procyon', ra:114.825, dec:5.225, mag:0.34, con:'Canis Minor', hd:61421, hip:37279},
  {n:'Betelgeuse', ra:88.793, dec:7.407, mag:0.42, con:'Orion', hd:39801, hip:27989},
  {n:'Achernar', ra:24.428, dec:-57.237, mag:0.46, con:'Eridanus', hd:10144, hip:7588},
  {n:'Hadar', ra:210.956, dec:-60.373, mag:0.61, con:'Centaurus', hd:122451, hip:68702},
  {n:'Altair', ra:297.696, dec:8.868, mag:0.76, con:'Aquila', hd:187642, hip:97649},
  {n:'Aldebaran', ra:68.980, dec:16.509, mag:0.86, con:'Taurus', hd:29139, hip:21421},
  {n:'Antares', ra:247.352, dec:-26.432, mag:0.96, con:'Scorpius', hd:148478, hip:80763},
  {n:'Spica', ra:201.298, dec:-11.161, mag:0.97, con:'Virgo', hd:116658, hip:65474},
  {n:'Pollux', ra:116.329, dec:28.026, mag:1.14, con:'Gemini', hd:62509, hip:37826},
  {n:'Fomalhaut', ra:344.413, dec:-29.622, mag:1.16, con:'Piscis Austrinus', hd:216956, hip:113368},
  {n:'Deneb', ra:310.358, dec:45.280, mag:1.25, con:'Cygnus', hd:197345, hip:102098},
  {n:'Regulus', ra:152.093, dec:11.967, mag:1.35, con:'Leo', hd:87901, hip:49669},
  {n:'Adhara', ra:104.656, dec:-28.972, mag:1.50, con:'Canis Major', hd:52089, hip:33579},
  {n:'Castor', ra:113.649, dec:31.888, mag:1.58, con:'Gemini', hd:60179, hip:36850},
  {n:'Shaula', ra:263.402, dec:-37.104, mag:1.63, con:'Scorpius', hd:161868, hip:85927},
  {n:'Bellatrix', ra:81.283, dec:6.350, mag:1.64, con:'Orion', hd:35468, hip:25336},
  {n:'Elnath', ra:81.573, dec:28.607, mag:1.65, con:'Taurus', hd:35497, hip:25428},
  {n:'Miaplacidus', ra:138.300, dec:-69.717, mag:1.68, con:'Carina', hd:80007, hip:45238},
  {n:'Alnilam', ra:84.053, dec:-1.202, mag:1.69, con:'Orion', hd:37128, hip:26311},
  {n:'Alnair', ra:332.058, dec:-46.961, mag:1.73, con:'Grus', hd:209952, hip:109268},
  {n:'Alnitak', ra:85.190, dec:-1.943, mag:1.74, con:'Orion', hd:37742, hip:26727},
  {n:'Alioth', ra:193.507, dec:55.960, mag:1.76, con:'Ursa Major', hd:112185, hip:62956},
  {n:'Dubhe', ra:165.932, dec:61.751, mag:1.79, con:'Ursa Major', hd:95689, hip:54061},
  {n:'Mirfak', ra:51.081, dec:49.861, mag:1.79, con:'Perseus', hd:20902, hip:15863},
  {n:'Wezen', ra:107.098, dec:-26.393, mag:1.83, con:'Canis Major', hd:54605, hip:34444},
  {n:'Kaus Australis', ra:276.043, dec:-34.385, mag:1.85, con:'Sagittarius', hd:169022, hip:90185},
  {n:'Alkaid', ra:206.885, dec:49.313, mag:1.85, con:'Ursa Major', hd:120315, hip:67301},
  {n:'Sargas', ra:264.330, dec:-42.998, mag:1.87, con:'Scorpius', hd:159532, hip:86228},
  {n:'Atria', ra:252.166, dec:-68.680, mag:1.91, con:'Triangulum Australe', hd:150798, hip:82273},
  {n:'Alhena', ra:99.428, dec:16.399, mag:1.93, con:'Gemini', hd:47105, hip:31681},
  {n:'Peacock', ra:306.412, dec:-56.735, mag:1.94, con:'Pavo', hd:193924, hip:100751},
  {n:'Mirzam', ra:95.674, dec:-17.956, mag:1.98, con:'Canis Major', hd:44743, hip:30122},
  {n:'Alphard', ra:141.897, dec:-8.659, mag:1.98, con:'Hydra', hd:81797, hip:46390},
  {n:'Polaris', ra:37.955, dec:89.264, mag:1.98, con:'Ursa Minor', hd:8890, hip:11767},
  {n:'Nunki', ra:283.816, dec:-26.297, mag:2.05, con:'Sagittarius', hd:175191, hip:92855},
  {n:'Saiph', ra:86.939, dec:-9.670, mag:2.06, con:'Orion', hd:38771, hip:27366},
  {n:'Menkent', ra:211.671, dec:-36.370, mag:2.06, con:'Centaurus', hd:124897, hip:68933},
  {n:'Alpheratz', ra:2.097, dec:29.090, mag:2.07, con:'Andromeda', hd:358, hip:677},
  {n:'Beta Gruis', ra:340.667, dec:-46.885, mag:2.11, con:'Grus', hd:214952, hip:112122},
  {n:'Denebola', ra:177.265, dec:14.572, mag:2.14, con:'Leo', hd:102647, hip:57632},
  {n:'Mizar', ra:200.981, dec:54.925, mag:2.23, con:'Ursa Major', hd:116656, hip:65378},
  {n:'Sadr', ra:305.557, dec:40.257, mag:2.23, con:'Cygnus', hd:194093, hip:100453},
  {n:'Schedar', ra:10.127, dec:56.537, mag:2.24, con:'Cassiopeia', hd:3712, hip:3179},
  {n:'Caph', ra:2.295, dec:59.150, mag:2.28, con:'Cassiopeia', hd:3360, hip:746},
  {n:'Dschubba', ra:240.083, dec:-22.622, mag:2.29, con:'Scorpius', hd:143275, hip:78401},
  {n:'Merak', ra:165.460, dec:56.382, mag:2.37, con:'Ursa Major', hd:95418, hip:53910},
  {n:'Scheat', ra:345.943, dec:28.083, mag:2.42, con:'Pegasus', hd:217906, hip:113881},
  {n:'Phecda', ra:178.458, dec:53.695, mag:2.44, con:'Ursa Major', hd:103287, hip:58001},
  {n:'Gienah', ra:311.553, dec:33.970, mag:2.46, con:'Cygnus', hd:197345, hip:102488},
  {n:'Navi', ra:14.177, dec:60.717, mag:2.47, con:'Cassiopeia', hd:5394, hip:4427},
  {n:'Markab', ra:346.190, dec:15.205, mag:2.49, con:'Pegasus', hd:218045, hip:113963},
  {n:'Algieba', ra:154.993, dec:19.842, mag:2.08, con:'Leo', hd:89484, hip:50583},
  {n:'Zosma', ra:168.527, dec:20.524, mag:2.56, con:'Leo', hd:97633, hip:54849},
  {n:'Graffias', ra:241.359, dec:-19.805, mag:2.62, con:'Scorpius', hd:144217, hip:78820},
  {n:'Ruchbah', ra:21.454, dec:60.235, mag:2.66, con:'Cassiopeia', hd:8538, hip:6686},
  {n:'Tarazed', ra:296.565, dec:10.613, mag:2.72, con:'Aquila', hd:186791, hip:97278},
  {n:'Porrima', ra:190.415, dec:-1.449, mag:2.74, con:'Virgo', hd:110379, hip:61941},
  {n:'Zubenelgenubi', ra:222.720, dec:-16.042, mag:2.75, con:'Libra', hd:130841, hip:72622},
  {n:'Acrux', ra:186.650, dec:-63.099, mag:0.77, con:'Crux', hd:108248, hip:60718},
  {n:'Mimosa', ra:191.930, dec:-59.689, mag:1.25, con:'Crux', hd:111123, hip:62434},
  {n:'Gacrux', ra:187.791, dec:-57.113, mag:1.63, con:'Crux', hd:108903, hip:61084},
  {n:'Delta Crucis', ra:183.786, dec:-58.749, mag:2.79, con:'Crux', hd:106881, hip:59747},
  {n:'Algenib', ra:3.309, dec:15.184, mag:2.83, con:'Pegasus', hd:886, hip:1067},
  {n:'Vindemiatrix', ra:195.544, dec:10.959, mag:2.85, con:'Virgo', hd:113226, hip:63608},
  {n:'Beta TrA', ra:235.316, dec:-63.430, mag:2.85, con:'Triangulum Australe', hd:141891, hip:77952},
  {n:'Fawaris', ra:296.244, dec:45.131, mag:2.87, con:'Cygnus', hd:184006, hip:95853},
  {n:'Deneb Algedi', ra:326.760, dec:-16.127, mag:2.87, con:'Capricornus', hd:207098, hip:107556},
  {n:'Sadalsuud', ra:322.890, dec:-5.571, mag:2.87, con:'Aquarius', hd:204867, hip:106278},
  {n:'Gamma TrA', ra:244.006, dec:-68.792, mag:2.87, con:'Triangulum Australe', hd:135382, hip:74946},
  {n:'Sadalmelik', ra:331.446, dec:-0.320, mag:2.95, con:'Aquarius', hd:210433, hip:109074},
  {n:'Dabih', ra:305.253, dec:-14.781, mag:3.05, con:'Capricornus', hd:193495, hip:100064},
  {n:'Albireo', ra:292.680, dec:27.960, mag:3.18, con:'Cygnus', hd:183912, hip:95947},
  {n:'Megrez', ra:183.857, dec:57.033, mag:3.31, con:'Ursa Major', hd:106591, hip:59774},
  {n:'Segin', ra:28.599, dec:63.670, mag:3.35, con:'Cassiopeia', hd:11415, hip:8886},
  {n:'Hamal', ra:31.793, dec:23.462, mag:2.00, con:'Aries', hd:12929, hip:9884},
  {n:'Sheratan', ra:28.660, dec:20.808, mag:2.64, con:'Aries', hd:11636, hip:8903},
  {n:'Mesarthim', ra:28.420, dec:19.294, mag:3.86, con:'Aries', hd:11502, hip:8832},
  {n:'Al Tarf', ra:124.129, dec:9.186, mag:3.53, con:'Cancer', hd:71155, hip:41173},
  {n:'Asellus Australis', ra:130.176, dec:18.154, mag:3.94, con:'Cancer', hd:74732, hip:43103},
  {n:'Acubens', ra:134.621, dec:11.858, mag:4.25, con:'Cancer', hd:76756, hip:44066},
  {n:'Zubeneschamali', ra:229.252, dec:-9.383, mag:2.61, con:'Libra', hd:135742, hip:74785},
  {n:'Alrescha', ra:30.906, dec:2.764, mag:3.82, con:'Pisces', hd:12447, hip:9487},
  {n:'Alshain', ra:298.828, dec:6.407, mag:3.71, con:'Aquila', hd:188310, hip:98036},
  {n:'Mintaka', ra:83.002, dec:-0.299, mag:2.23, con:'Orion', hd:36486, hip:25930},
  {n:'Meissa', ra:83.784, dec:9.934, mag:3.39, con:'Orion', hd:36861, hip:26207},
  {n:'Kochab', ra:222.676, dec:74.155, mag:2.08, con:'Ursa Minor', hd:131873, hip:72607},
  {n:'Pherkad', ra:230.182, dec:71.834, mag:3.05, con:'Ursa Minor', hd:137422, hip:75097},
  {n:'Rasalhague', ra:263.734, dec:12.560, mag:2.08, con:'Ophiuchus', hd:163993, hip:86032},
  {n:'Sabik', ra:257.595, dec:-15.724, mag:2.43, con:'Ophiuchus', hd:155125, hip:84012},
  {n:'Unukalhai', ra:236.067, dec:6.426, mag:2.63, con:'Serpens', hd:141714, hip:77070},
  {n:'Enif', ra:326.046, dec:9.875, mag:2.38, con:'Pegasus', hd:206778, hip:107315},
  {n:'Mirach', ra:17.433, dec:35.620, mag:2.07, con:'Andromeda', hd:5448, hip:5447},
  {n:'Almach', ra:30.975, dec:42.330, mag:2.10, con:'Andromeda', hd:12533, hip:9640},
  {n:'Algol', ra:47.042, dec:40.956, mag:2.12, con:'Perseus', hd:19356, hip:14576},
  {n:'Menkar', ra:45.570, dec:4.090, mag:2.53, con:'Cetus', hd:18884, hip:14135},
  {n:'Diphda', ra:10.897, dec:-17.987, mag:2.04, con:'Cetus', hd:4128, hip:3419},
];
const CONSTELLATION_LINES = [
  // Orion
  ['Betelgeuse','Bellatrix'],['Bellatrix','Mintaka'],['Mintaka','Alnilam'],['Alnilam','Alnitak'],
  ['Betelgeuse','Alnitak'],['Alnitak','Saiph'],['Saiph','Rigel'],['Rigel','Mintaka'],['Bellatrix','Meissa'],['Meissa','Betelgeuse'],
  // Ursa Major (Big Dipper)
  ['Dubhe','Merak'],['Merak','Phecda'],['Phecda','Megrez'],['Megrez','Alioth'],['Alioth','Mizar'],['Mizar','Alkaid'],['Megrez','Dubhe'],
  // Cassiopeia
  ['Caph','Schedar'],['Schedar','Navi'],['Navi','Ruchbah'],['Ruchbah','Segin'],
  // Scorpius
  ['Graffias','Dschubba'],['Dschubba','Antares'],['Antares','Sargas'],['Sargas','Shaula'],
  // Crux
  ['Acrux','Gacrux'],['Mimosa','Delta Crucis'],['Acrux','Mimosa'],['Gacrux','Delta Crucis'],
  // Cygnus
  ['Deneb','Sadr'],['Sadr','Gienah'],['Sadr','Fawaris'],['Sadr','Albireo'],
  // Gemini
  ['Castor','Pollux'],['Pollux','Alhena'],
  // Taurus
  ['Aldebaran','Elnath'],
  // Leo
  ['Regulus','Algieba'],['Algieba','Denebola'],['Denebola','Zosma'],['Zosma','Algieba'],
  // Aquila
  ['Altair','Tarazed'],['Altair','Alshain'],
  // Pegasus Square + Enif
  ['Markab','Scheat'],['Scheat','Alpheratz'],['Alpheratz','Algenib'],['Algenib','Markab'],['Markab','Enif'],
  // Andromeda
  ['Alpheratz','Mirach'],['Mirach','Almach'],
  // Ursa Minor
  ['Polaris','Kochab'],['Kochab','Pherkad'],
  // Sagittarius
  ['Kaus Australis','Nunki'],
  // Aries
  ['Hamal','Sheratan'],['Sheratan','Mesarthim'],
  // Libra
  ['Zubenelgenubi','Zubeneschamali'],
  // Virgo
  ['Spica','Porrima'],['Porrima','Vindemiatrix'],
  // Capricornus
  ['Dabih','Deneb Algedi'],
  // Aquarius
  ['Sadalsuud','Sadalmelik'],
  // Perseus
  ['Mirfak','Algol'],
  // Canis Major
  ['Sirius','Mirzam'],['Sirius','Adhara'],['Adhara','Wezen'],
  // Centaurus
  ['Hadar','Menkent'],
  // Ophiuchus
  ['Rasalhague','Sabik'],
  // Triangulum Australe
  ['Atria','Beta TrA'],['Beta TrA','Gamma TrA'],['Gamma TrA','Atria'],
  // Cancer
  ['Al Tarf','Asellus Australis'],['Asellus Australis','Acubens'],
  // Carina / Grus
  ['Canopus','Miaplacidus'],
  ['Alnair','Beta Gruis'],
];

// ---- Islamabad, Pakistan ----
const LAT = 33.6844, LON = 73.0479;
const PKT_OFFSET_MS = 5*3600*1000;
function pad2(n){ return String(n).padStart(2,'0'); }

function findVisibilityWindow(planetKey, refDate){
  const localNow = new Date(refDate.getTime() + PKT_OFFSET_MS);
  const Y = localNow.getUTCFullYear(), M = localNow.getUTCMonth(), D = localNow.getUTCDate();
  const steps = [];
  const startMin = 15*60, endMin = 24*60 + 9*60;
  for(let m=startMin; m<=endMin; m+=10){
    const dayOffset = Math.floor(m/1440);
    const hh = Math.floor((m%1440)/60), mm = (m%1440)%60;
    const realUTCms = Date.UTC(Y, M, D+dayOffset, hh, mm, 0) - PKT_OFFSET_MS;
    const t = new Date(realUTCms);
    const jd = toJulianDate(t);
    const T = centuriesSinceJ2000(jd);
    const earthPos = heliocentric('earth', T);
    const sunGeo = { x:-earthPos.x, y:-earthPos.y, z:-earthPos.z };
    const sunEq = eclipticToEquatorial(sunGeo.x, sunGeo.y, sunGeo.z);
    const sunAlt = altitudeDeg(sunEq.raDeg, sunEq.decDeg, jd, LAT, LON);
    const pPos = heliocentric(planetKey, T);
    const pGeo = { x:pPos.x-earthPos.x, y:pPos.y-earthPos.y, z:pPos.z-earthPos.z };
    const pEq = eclipticToEquatorial(pGeo.x, pGeo.y, pGeo.z);
    const planetAlt = altitudeDeg(pEq.raDeg, pEq.decDeg, jd, LAT, LON);
    steps.push({ localLabel: `${pad2(hh)}:${pad2(mm)}`, dayOffset, sunAlt, planetAlt });
  }
  let bestRun=null, curRun=null;
  for(const s of steps){
    const dark = s.sunAlt < -6 && s.planetAlt > 3;
    if(dark){ curRun = curRun ? { start:curRun.start, end:s, count:curRun.count+1 } : { start:s, end:s, count:1 }; }
    else { if(curRun){ if(!bestRun||curRun.count>bestRun.count) bestRun=curRun; curRun=null; } }
  }
  if(curRun && (!bestRun||curRun.count>bestRun.count)) bestRun = curRun;
  return bestRun;
}

function describeWindow(run){
  if(!run) return null;
  const startsToday = run.start.dayOffset===0;
  const spansMidnight = run.start.dayOffset !== run.end.dayOffset;
  let tag = 'Evening object';
  if(!startsToday) tag = 'Morning object — visible before dawn';
  else if(spansMidnight) tag = 'Visible most of the night';
  else if(parseInt(run.start.localLabel)>=22 || run.start.dayOffset===1) tag = 'Late-night object';
  return { label: `${run.start.localLabel} – ${run.end.localLabel} PKT`, tag, minutes: run.count*10 };
}

// =========================================================================
// DATA — planetary facts (real values)
// =========================================================================
const PLANETS = [
  { key:'mercury', relMass:0.0553, name:'Mercury', type:'Terrestrial planet', color:0x9c9186, emissive:0x1a1712,
    diameterKm:4879, periodDays:88, periodLabel:'88 days', distanceAU:0.39, displayRadius:0.601, moonCount:0,
    gravity:3.7, meanTempC:167, escapeKmS:4.3, density:5.43, rotationHours:1407.6, axialTiltDeg:0.03,
    visibility:"Hugs the Sun in our sky, so it's only visible low on the horizon just after sunset or before sunrise, during its periodic greatest elongations." },
  { key:'venus', relMass:0.815, name:'Venus', type:'Terrestrial planet', color:0xe8c78a, emissive:0x2a2114,
    // Scale to Earth: 2.1 * (12104/12742) ≈ 1.995
    diameterKm:12104, periodDays:225, periodLabel:'225 days', distanceAU:0.72, displayRadius:1.156, moonCount:0,
    gravity:8.87, meanTempC:464, escapeKmS:10.36, density:5.24, rotationHours:-5832.5, axialTiltDeg:177.4,
    visibility:"The brightest planet in the sky — often called the 'Morning Star' or 'Evening Star' depending on which side of the Sun it's currently on." },
  { key:'earth', relMass:1.0, name:'Earth', type:'Terrestrial planet', color:0x3d7ab5, emissive:0x0a1520,
    diameterKm:12742, periodDays:365.25, periodLabel:'365.25 days (1 year)', distanceAU:1.0, displayRadius:1.2, moonCount:1,
    gravity:9.81, meanTempC:15, escapeKmS:11.19, density:5.51, rotationHours:23.93, axialTiltDeg:23.44,
    atmosphere:'N2 78% · O2 21% · Ar 0.9% · CO2 0.04%', magneticField:'Global dipole (~25–65 µT)',
    surface:'71% oceans · continents · ice caps', discovery:'Known since antiquity',
    visibility:"Home. Viewed from elsewhere in the solar system, Earth appears as a bright blue-white 'Pale Blue Dot.'" },
  { key:'mars', relMass:0.107, name:'Mars', type:'Terrestrial planet', color:0xb1502f, emissive:0x1f0d05,
    diameterKm:6779, periodDays:687, periodLabel:'687 days (1.88 years)', distanceAU:1.52, displayRadius:0.762, moonCount:2,
    gravity:3.71, meanTempC:-63, escapeKmS:5.03, density:3.93, rotationHours:24.62, axialTiltDeg:25.19,
    atmosphere:'CO2 95% · N2 2.7% · Ar 1.6% · O2 0.13%', magneticField:'No global field (crustal remnants)',
    surface:'Iron-oxide dust · volcanoes (Olympus Mons) · polar ice · canyons (Valles Marineris)', discovery:'Known since antiquity',
    visibility:"A distinct reddish naked-eye object, at its brightest for several months around opposition, which occurs roughly every 26 months." },
  { key:'jupiter', relMass:317.8, name:'Jupiter', type:'Gas giant', color:0xd8b48c, emissive:0x241c12,
    diameterKm:139820, periodDays:4333, periodLabel:'11.86 years', distanceAU:5.2, displayRadius:6.733, moonCount:95,
    gravity:24.79, meanTempC:-110, escapeKmS:59.5, density:1.33, rotationHours:9.93, axialTiltDeg:3.13,
    visibility:"Naked-eye visible for most of the year outside solar conjunction — usually the brightest 'star' in the sky after Venus." },
  { key:'saturn', relMass:95.2, name:'Saturn', type:'Gas giant', color:0xe4d0a0, emissive:0x241f14,
    diameterKm:116460, periodDays:10759, periodLabel:'29.4 years', distanceAU:9.58, displayRadius:5.903, moonCount:146,
    gravity:10.44, meanTempC:-140, escapeKmS:35.5, density:0.69, rotationHours:10.66, axialTiltDeg:26.73,
    visibility:"Naked-eye visible as a steady golden point; its rings only resolve through a small telescope or good binoculars.", ring:true },
  { key:'uranus', relMass:14.5, name:'Uranus', type:'Ice giant', color:0x9fd8e0, emissive:0x0d1e20,
    diameterKm:50724, periodDays:30687, periodLabel:'84 years', distanceAU:19.2, displayRadius:3.245, moonCount:28,
    gravity:8.69, meanTempC:-195, escapeKmS:21.3, density:1.27, rotationHours:-17.24, axialTiltDeg:97.77,
    visibility:"Technically at the edge of naked-eye visibility (mag ~5.7) under very dark skies — binoculars make it easy to spot as a faint blue-green dot." },
  { key:'neptune', relMass:17.1, name:'Neptune', type:'Ice giant', color:0x4f6fd0, emissive:0x0a1024,
    diameterKm:49244, periodDays:60190, periodLabel:'164.8 years', distanceAU:30.05, displayRadius:3.176, moonCount:16,
    gravity:11.15, meanTempC:-200, escapeKmS:23.5, density:1.64, rotationHours:16.11, axialTiltDeg:28.32,
    visibility:"Too faint for the naked eye — requires a telescope or good binoculars and a precise finder chart to locate." },
];

// =========================================================================
// ATMOSPHERES — real composition data (mole fraction, %) → derived sky color
// Sources: NASA planetary fact sheets. Trace species lumped as 'trace'.
// =========================================================================
const GAS_TINTS = {
  N2:    [130,175,235],
  O2:    [150,195,235],
  CO2:   [255,250,235],
  Ar:    [205,205,200],
  H2:    [225,232,242],
  He:    [244,246,250],
  CH4:   [70,195,205],   // strong red-light absorber → cyan/teal push
  H2SO4: [235,214,150],  // Venus' global sulfuric-acid haze deck
  NH3:   [222,201,158],  // ammonia cloud decks (Jupiter/Saturn)
  dust:  [200,140,95],   // suspended iron-oxide dust (Mars)
  Na:    [255,200,60],
  K:     [180,130,220],
  mystery:[35,85,190],   // Neptune's still-unexplained extra blue absorber
  trace: [190,190,190]
};
const GAS_BOOST = { CH4:9, H2SO4:1, NH3:1, dust:1, mystery:40 }; // weight multiplier — trace-but-potent absorbers punch above their %

const ATMOSPHERES = {
  moon: { hasAtmosphere:false, pressure:'~10-12 bar — collisionless exosphere (essentially vacuum)',
    composition:[{gas:'He',pct:25},{gas:'Ar',pct:25},{gas:'Ne',pct:20},{gas:'Na',pct:15},{gas:'trace',pct:15}],
    note:'No breathable air. The sky is always black — stars visible even when the Sun is up. Earth hangs as a blue-white marble.' },
  mercury: { hasAtmosphere:false, pressure:'~10-14 bar — a collisional exosphere, essentially a vacuum',
    composition:[{gas:'O2',pct:42},{gas:'Na',pct:29},{gas:'H2',pct:22},{gas:'He',pct:6},{gas:'K',pct:0.5},{gas:'trace',pct:0.5}],
    note:'No true atmosphere to scatter light — the sky is black even at local noon, and the Sun appears roughly 2.5x larger than from Earth.' },
  venus:   { pressure:'92 bar — comparable to standing 900 m under Earth\'s ocean',
    composition:[{gas:'CO2',pct:96.5},{gas:'N2',pct:3.5}], cloudTint:'H2SO4',
    note:'A permanent, planet-wide deck of sulfuric-acid droplets diffuses sunlight into a flat, oppressive yellow-white glow. Surface temperature: ~465°C, hot enough to melt lead.' },
  earth:   { pressure:'1 bar (reference)',
    composition:[{gas:'N2',pct:78.1},{gas:'O2',pct:20.9},{gas:'Ar',pct:0.93},{gas:'CO2',pct:0.04},{gas:'trace',pct:0.03}],
    note:'Rayleigh scattering off N₂ and O₂ molecules — shorter blue wavelengths scatter far more than red — is what paints the sky blue.' },
  mars:    { pressure:'~0.006 bar — about 0.6% of Earth\'s surface pressure',
    composition:[{gas:'CO2',pct:95.3},{gas:'N2',pct:2.7},{gas:'Ar',pct:1.6},{gas:'trace',pct:0.4}], cloudTint:'dust',
    note:'Fine iron-oxide dust suspended in the thin CO₂ air scatters light forward, giving Mars its butterscotch sky — and, famously, blue sunsets.' },
  jupiter: { pressure:'No solid surface — pressure climbs continuously with depth',
    composition:[{gas:'H2',pct:89.8},{gas:'He',pct:10.2}], cloudTint:'NH3',
    note:'Bands of ammonia-ice clouds, tinted by trace sulfur and phosphorus compounds, produce the cream, tan and rust bands seen from outside.' },
  saturn:  { pressure:'No solid surface',
    composition:[{gas:'H2',pct:96.3},{gas:'He',pct:3.25},{gas:'CH4',pct:0.45}], cloudTint:'NH3',
    note:'A hazier, more uniform ammonia deck than Jupiter\'s gives Saturn a softer, muted-gold cast, dimmed further by its distance from the Sun.' },
  uranus:  { pressure:'No solid surface',
    composition:[{gas:'H2',pct:82.5},{gas:'He',pct:15.2},{gas:'CH4',pct:2.3}],
    note:'Methane absorbs red light and reflects blue-green — even at only ~2.3%, it dominates the color, giving Uranus its pale cyan disc.' },
  neptune: { pressure:'No solid surface',
    composition:[{gas:'H2',pct:79.4},{gas:'He',pct:19},{gas:'CH4',pct:1},{gas:'mystery',pct:0.6}],
    note:'Neptune has more methane-driven blue than Uranus plus an extra, still-unidentified high-altitude absorber that deepens it toward indigo — a genuine open question in planetary science.' },
};

function computeSkyColor(planetKey, distanceAU){
  const atm = ATMOSPHERES[planetKey];
  let r=0,g=0,b=0,wsum=0;
  atm.composition.forEach(c=>{
    const tint = GAS_TINTS[c.gas] || GAS_TINTS.trace;
    const boost = GAS_BOOST[c.gas] || 1;
    const w = c.pct*boost;
    r+=tint[0]*w; g+=tint[1]*w; b+=tint[2]*w; wsum+=w;
  });
  r/=wsum; g/=wsum; b/=wsum;
  if(atm.cloudTint){
    const t = GAS_TINTS[atm.cloudTint];
    const cw = 0.55;
    r = r*(1-cw)+t[0]*cw; g = g*(1-cw)+t[1]*cw; b = b*(1-cw)+t[2]*cw;
  }
  const brightness = Math.max(0.55, Math.min(1, 1.35/Math.pow(distanceAU,0.22)));
  r=Math.min(255,r*brightness); g=Math.min(255,g*brightness); b=Math.min(255,b*brightness);
  return { r:Math.round(r), g:Math.round(g), b:Math.round(b), hex:'#'+[r,g,b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('') };
}

// AU → scene distance. Nested orbits MUST never cross (Venus inside Earth).
// With BASE=24, EXP=0.58: Venus≈19.7, Earth=24, gap≈4.3 > radii sum.
const SCALE_BASE = 26.0, SCALE_EXP = 0.62;

// =========================================================================
// REAL EXTERNAL APIS
// -------------------------------------------------------------------------
// 1) Solar System OpenData (api.le-systeme-solaire.net) — a free, public REST
//    API explicitly designed for client-side/browser use. Live physical data
//    (gravity, mass, mean temperature, moon counts, discovery record).
//    Since Sept 2025 it requires a free bearer token — get one instantly at
//    https://api.le-systeme-solaire.net/generatekey.html and paste it in the
//    "Live data" field on any planet's panel, or hardcode it below.
// 2) JPL Horizons (ssd.jpl.nasa.gov/api) — NASA's own ephemeris system. Its
//    fair-use policy explicitly forbids embedding the API in a website's own
//    fetch calls, so instead of violating that we build a correct query URL
//    and open it in a new tab for direct, real ground-truth verification —
//    exactly the Week 7 validation step from the project plan.
// =========================================================================
let SOLAR_API_KEY = ''; // paste a free key from the link above to enable live sync

const SOLAR_API_IDS = { mercury:'mercure', venus:'venus', earth:'terre', mars:'mars', jupiter:'jupiter', saturn:'saturne', uranus:'uranus', neptune:'neptune' };
const HORIZONS_COMMAND = { mercury:'199', venus:'299', earth:'399', mars:'499', jupiter:'599', saturn:'699', uranus:'799', neptune:'899' };

async function fetchLiveBodyData(planetKey){
  const apiId = SOLAR_API_IDS[planetKey];
  const fields = 'englishName,gravity,avgTemp,meanRadius,mass,density,escape,sideralRotation,discoveredBy,discoveryDate,moons';
  const url = `https://api.le-systeme-solaire.net/rest/bodies/${apiId}?data=${fields}`;
  const headers = {};
  if(SOLAR_API_KEY.trim()) headers['Authorization'] = 'Bearer ' + SOLAR_API_KEY.trim();
  const res = await fetch(url, { headers });
  if(!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

function buildHorizonsUrl(planetKey, simDate){
  const cmd = HORIZONS_COMMAND[planetKey];
  const y = simDate.getUTCFullYear(), m = String(simDate.getUTCMonth()+1).padStart(2,'0'), d = String(simDate.getUTCDate()).padStart(2,'0');
  const start = `${y}-${m}-${d}`;
  const stopDate = new Date(simDate.getTime()+86400000);
  const stop = `${stopDate.getUTCFullYear()}-${String(stopDate.getUTCMonth()+1).padStart(2,'0')}-${String(stopDate.getUTCDate()).padStart(2,'0')}`;
  const params = {
    format:'text', COMMAND:`'${cmd}'`, OBJ_DATA:"'YES'", MAKE_EPHEM:"'YES'", EPHEM_TYPE:"'VECTORS'",
    CENTER:"'500@10'", START_TIME:`'${start}'`, STOP_TIME:`'${stop}'`, STEP_SIZE:"'1 d'"
  };
  const qs = Object.entries(params).map(([k,v])=>`${k}=${encodeURIComponent(v)}`).join('&');
  return `https://ssd.jpl.nasa.gov/api/horizons.api?${qs}`;
}
function displayDistanceFromAU(au){
  if(!isFinite(au) || au <= 0) return 0;
  return SCALE_BASE * Math.pow(au, SCALE_EXP);
}

// =========================================================================
// THREE.JS SCENE SETUP
// =========================================================================
const wrap = document.getElementById('scene-wrap');

window.addEventListener('error', function(ev){
  try {
    console.error('[NCGSA]', ev.message, ev.filename, ev.lineno, ev.error);
    var el = document.getElementById('texture-status');
    var msg = (ev && ev.message) ? ev.message : 'script';
    if(msg === 'Script error.' && ev.lineno) msg = 'line ' + ev.lineno;
    if(ev && ev.error && ev.error.message) msg = ev.error.message;
    if(el){ el.classList.add('show','warn'); el.textContent = 'Error: ' + msg + (ev.lineno ? ' @' + ev.lineno : ''); }
  } catch(e){}
});
window.addEventListener('unhandledrejection', function(ev){
  try {
    var el = document.getElementById('texture-status');
    var msg = (ev.reason && ev.reason.message) ? ev.reason.message : String(ev.reason||'promise');
    if(el){ el.classList.add('show','warn'); el.textContent = 'Error: ' + msg; }
    console.error('[NCGSA promise]', ev.reason);
  } catch(e){}
});

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 2000);
let camDistance = 90, camTheta = 0.9, camPhi = 1.15;
let desiredDistance = camDistance; // farther default for linear planet sizes
let camTarget = new THREE.Vector3(0,0,0);
let focusedPlanet = null; // set by selectPlanet() to smoothly orbit/track a body instead of the system's center
let focusedDwarf = null;  // dwarf planet / major asteroid under observation
let focusedMoon = null;
let playing = true;
let daysPerSecond = 1/86400; // REAL-TIME default: 1 sim-second per real-second; speed slider accelerates
let simulatedDate = new Date();
let teleportActive = false;
let constellationFocus = null;
let moonSurfaceActive = false;
const ORIGIN = new THREE.Vector3(0,0,0);
function updateCameraPosition(){
  camera.position.x = camTarget.x + camDistance * Math.sin(camPhi) * Math.sin(camTheta);
  camera.position.y = camTarget.y + camDistance * Math.cos(camPhi);
  camera.position.z = camTarget.z + camDistance * Math.sin(camPhi) * Math.cos(camTheta);
  camera.lookAt(camTarget);
}
updateCameraPosition();

// =========================================================================
// CAMERA TRANSITION TECHNOLOGY — unified smooth tween for planet / moon / sky
// easeInOutCubic + shortest-path angle lerp; optional look-at target tracking
// =========================================================================
let cameraTween = null; // { t, duration, from:{}, to:{}, onDone }
function easeInOutCubic(u){
  return u < 0.5 ? 4*u*u*u : 1 - Math.pow(-2*u+2, 3)/2;
}
function shortestAngleDelta(from, to){
  let d = to - from;
  while(d > Math.PI) d -= Math.PI*2;
  while(d < -Math.PI) d += Math.PI*2;
  return d;
}
function startCameraTween(opts){
  // opts: { target?, distance?, theta?, phi?, duration? }
  const duration = (opts && opts.duration) || 1.25;
  cameraTween = {
    t: 0,
    duration: duration,
    from: {
      theta: camTheta,
      phi: camPhi,
      dist: camDistance,
      tx: camTarget.x, ty: camTarget.y, tz: camTarget.z
    },
    to: {
      theta: opts.theta != null ? opts.theta : camTheta,
      phi: opts.phi != null ? opts.phi : camPhi,
      dist: opts.distance != null ? opts.distance : desiredDistance,
      tx: opts.target ? opts.target.x : camTarget.x,
      ty: opts.target ? opts.target.y : camTarget.y,
      tz: opts.target ? opts.target.z : camTarget.z
    },
    dTheta: 0,
    onDone: opts.onDone || null
  };
  cameraTween.dTheta = shortestAngleDelta(cameraTween.from.theta, cameraTween.to.theta);
  if(opts.distance != null) desiredDistance = opts.distance;
}
function updateCameraTween(dt){
  if(!cameraTween) return false;
  cameraTween.t = Math.min(1, cameraTween.t + dt / cameraTween.duration);
  const e = easeInOutCubic(cameraTween.t);
  const f = cameraTween.from, to = cameraTween.to;
  camTheta = f.theta + cameraTween.dTheta * e;
  camPhi = f.phi + (to.phi - f.phi) * e;
  camDistance = f.dist + (to.dist - f.dist) * e;
  desiredDistance = camDistance;
  camTarget.set(
    f.tx + (to.tx - f.tx) * e,
    f.ty + (to.ty - f.ty) * e,
    f.tz + (to.tz - f.tz) * e
  );
  if(cameraTween.t >= 1){
    camTheta = f.theta + cameraTween.dTheta;
    camPhi = to.phi;
    camDistance = to.dist;
    desiredDistance = to.dist;
    camTarget.set(to.tx, to.ty, to.tz);
    const done = cameraTween.onDone;
    cameraTween = null;
    if(done) done();
  }
  return true;
}

// Robust WebGL renderer — try multiple option sets. Never pre-create extra GL contexts
// (browsers limit concurrent contexts; probing webgl2 first often causes this error).
let renderer = null;
let _isWebGL2 = false;
const _rendererAttempts = [
  { antialias: true,  alpha: false, powerPreference: 'default', failIfMajorPerformanceCaveat: false },
  { antialias: false, alpha: false, powerPreference: 'default', failIfMajorPerformanceCaveat: false },
  { antialias: false, alpha: true,  powerPreference: 'low-power', failIfMajorPerformanceCaveat: false },
  { antialias: false, alpha: false, failIfMajorPerformanceCaveat: false }
];
(function createRenderer(){
  for(let i = 0; i < _rendererAttempts.length; i++){
    try {
      const r = new THREE.WebGLRenderer(_rendererAttempts[i]);
      // Verify context actually works
      const gl = r.getContext();
      if(gl && typeof gl.drawArrays === 'function'){
        renderer = r;
        break;
      }
      if(r.dispose) r.dispose();
    } catch(err){
      console.warn('[NCGSA] WebGL attempt ' + (i+1) + ' failed:', err && err.message);
    }
  }
})();
if(!renderer){
  var ls = document.getElementById('loading-screen');
  if(ls){ ls.classList.add('force-off'); ls.style.display = 'none'; }
  var box = document.createElement('div');
  box.style.cssText = 'position:fixed;inset:0;z-index:300;background:#05060a;color:#e8eef8;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;text-align:center;padding:32px;';
  box.innerHTML = '<div style="max-width:420px"><h2 style="color:#c9a227;margin:0 0 12px">WebGL unavailable</h2>' +
    '<p style="line-height:1.5;color:#9aa3b0">This browser could not create a WebGL context.</p>' +
    '<p style="line-height:1.5;color:#9aa3b0;font-size:14px">Try: close other 3D tabs, enable hardware acceleration, or use Chrome/Edge/Firefox.</p>' +
    '<button onclick="location.reload()" style="margin-top:16px;padding:10px 18px;border-radius:8px;border:1px solid #c9a227;background:rgba(201,162,39,0.15);color:#c9a227;cursor:pointer">Reload</button></div>';
  document.body.appendChild(box);
  throw new Error('WebGL context unavailable');
}
renderer.setSize(window.innerWidth || 800, window.innerHeight || 600);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
if(THREE.ACESFilmicToneMapping != null){
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
}
try { renderer.physicallyCorrectLights = true; } catch(e){}
try { renderer.outputEncoding = THREE.sRGBEncoding; } catch(e){}
const maxAnisotropy = (renderer.capabilities && renderer.capabilities.getMaxAnisotropy) ? renderer.capabilities.getMaxAnisotropy() : 4;
const maxTextureSize = (function(){
  try {
    const gl = renderer.getContext();
    return gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
  } catch(e){ return 4096; }
})();
const SUPPORTS_8K = maxTextureSize >= 8192;
if(wrap) wrap.appendChild(renderer.domElement);
else document.body.appendChild(renderer.domElement);
// Ensure canvas + hide loader
setTimeout(function(){
  var ls = document.getElementById('loading-screen');
  if(ls){ ls.classList.add('hide'); ls.classList.add('force-off'); ls.style.display = 'none'; }
}, 400);
if(typeof console !== 'undefined'){
  console.info('[Solar System Simulator] WebGL ready · MAX_TEXTURE_SIZE=' + maxTextureSize);
}

// Soft fill so the night side of moons/planets is readable (not pure black)
scene.add(new THREE.AmbientLight(0x8a93a8, 1.15));
scene.add(new THREE.HemisphereLight(0xc8d4f0, 0x2a2530, 0.55));
const sunLight = new THREE.PointLight(0xfff5e0, 5.0, 0, 0.4);
scene.add(sunLight);

// =========================================================================
// REAL PLANETARY IMAGERY — photographic textures, not procedural
// -------------------------------------------------------------------------
// Source: Solar System Scope (solarsystemscope.com), built from NASA imagery
// (Blue Marble, MESSENGER, Viking/Cassini-tuned Venus, etc.), released under
// CC BY 4.0. Served here via Wikimedia Commons' Special:FilePath, a stable,
// CORS-enabled endpoint — the same mechanism Wikipedia itself uses to embed
// these images cross-origin. Resolutions used are the highest Commons hosts
// for each body (up to 8K equirectangular for the Sun/Earth/Jupiter/skybox).
// NASA's own JPL Horizons/SSD API explicitly forbids being embedded this way
// (see the "REAL EXTERNAL APIS" note below) — that's why imagery comes from
// Commons while live numeric data comes from the Solar System OpenData API.
// =========================================================================
// Direct upload.wikimedia.org URLs (not the Special:FilePath redirect) — the
// static media CDN is guaranteed CORS-enabled (Access-Control-Allow-Origin: *
// on every file, confirmed by Wikimedia engineering), whereas routing through
// the wiki-page redirect adds an extra hop that can behave inconsistently
// with crossOrigin image loads in some browsers. Paths below are each file's
// real commons storage path (md5-hash-sharded, computed from the filename).
// Texture CDN: jsDelivr mirror of Solar System Scope 2K maps (CC BY 4.0).
// Official solarsystemscope.com/download is often blocked by captcha / CORS for browsers;
// Wikimedia can rate-limit. This mirror is CORS-enabled and reliable for the web.
// Texture architecture (priority order):
// 1) Solar System Scope 2K via jsDelivr (CORS-safe, NASA-derived equirectangular maps)
// 2) NASA 3D Resources / PDS-derived maps (nasa/NASA-3D-Resources on GitHub)
// 3) three.js example planet maps
// 4) Optional 8K SSS upgrade when GPU MAX_TEXTURE_SIZE ≥ 8192
// Attribution: NASA / JPL / USGS PDS imagery; SSS maps CC BY 4.0 (NASA-based)
const TEX = 'https://cdn.jsdelivr.net/gh/CKret/SOL---Solar-System-Simulation@main/textures/';
const TEX2 = 'https://raw.githubusercontent.com/CKret/SOL---Solar-System-Simulation/main/textures/';
const THREE_TEX = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/';
const THREE_TEX_HTTP = 'https://threejs.org/examples/textures/planets/';
const SSS8 = 'https://www.solarsystemscope.com/textures/download/';
const NASA3D = 'https://cdn.jsdelivr.net/gh/nasa/NASA-3D-Resources@master/Images%20and%20Textures/';
const WIKI_SSS = 'https://upload.wikimedia.org/wikipedia/commons/';
// Primary maps — CORS-safe mirrors (jsDelivr + three.js). Prefer proven URLs first.
const TEXTURE_URLS = {
  sun:        TEX + '2k_sun.jpg',
  mercury:    TEX + '2k_mercury.jpg',
  venus:      TEX + '2k_venus_surface.jpg',
  venusAtmo:  TEX + '2k_venus_atmosphere.jpg',
  // Earth: SSS daymap (true color continents/oceans) primary
  earth:      THREE_TEX_HTTP + 'earth_atmos_2048.jpg',
  earthClouds:THREE_TEX_HTTP + 'earth_clouds_1024.png',
  // note: SSS TEX maps remain in TEXTURE_FALLBACKS / EXTRA
  // Mars: SSS Viking-tuned map
  mars:       TEX2 + '2k_mars.jpg',
  jupiter:    TEX2 + '2k_jupiter.jpg',
  saturn:     TEX2 + '2k_saturn.jpg',
  saturnRing: TEX + '2k_saturn_ring_alpha.png',
  uranus:     TEX + '2k_uranus.jpg',
  neptune:    TEX + '2k_neptune.jpg',
  moon:       TEX2 + '2k_moon.jpg',
  skybox:     TEX + '2k_stars_milky_way.jpg',
  asteroid:   TEX + '2k_moon.jpg',
};
const TEXTURE_FALLBACKS = {
  sun:        TEX + '2k_sun.jpg',
  mercury:    TEX + '2k_mercury.jpg',
  venus:      NASA3D + 'Venus/Venus.jpg',
  venusAtmo:  TEX + '2k_venus_atmosphere.jpg',
  earth:      THREE_TEX_HTTP + 'earth_atmos_2048.jpg',
  earthClouds:THREE_TEX_HTTP + 'earth_clouds_1024.png',
  // note: SSS TEX maps remain in TEXTURE_FALLBACKS / EXTRA
  mars:       NASA3D + 'Mars/Mars.jpg',
  jupiter:    NASA3D + 'Jupiter/Jupiter.jpg',
  saturn:     NASA3D + 'Saturn/Saturn.jpg',
  saturnRing: TEX + '2k_saturn_ring_alpha.png',
  uranus:     TEX + '2k_uranus.jpg',
  neptune:    NASA3D + 'Neptune/Neptune.jpg',
  moon:       NASA3D + 'Moon/Moon.jpg',
  skybox:     TEX + '2k_stars.jpg',
  asteroid:   TEX + '2k_mercury.jpg',
};
const TEXTURE_EXTRA = {
  sun: [TEX2 + '2k_sun.jpg', TEX + '2k_sun.jpg'],
  mercury: [TEX2 + '2k_mercury.jpg', TEX + '2k_mercury.jpg'],
  venus: [TEX2 + '2k_venus_surface.jpg', TEX + '2k_venus_surface.jpg'],
  venusAtmo: [TEX2 + '2k_venus_atmosphere.jpg', TEX + '2k_venus_atmosphere.jpg'],
  earth: [
    TEX2 + '2k_earth_daymap.jpg',
    THREE_TEX_HTTP + 'earth_atmos_2048.jpg',
    THREE_TEX + 'earth_atmos_2048.jpg',
    TEX + '2k_earth_daymap.jpg'
  ],
  earthClouds: [
    TEX2 + '2k_earth_clouds.jpg',
    THREE_TEX_HTTP + 'earth_clouds_1024.png',
    THREE_TEX + 'earth_clouds_1024.png'
  ],
  mars: [TEX2 + '2k_mars.jpg', TEX + '2k_mars.jpg', NASA3D + 'Mars/Mars.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/OSIRIS_Mars_true_color.jpg/1024px-OSIRIS_Mars_true_color.jpg'],
  jupiter: [TEX2 + '2k_jupiter.jpg', TEX + '2k_jupiter.jpg', NASA3D + 'Jupiter/Jupiter.jpg'],
  saturn: [TEX2 + '2k_saturn.jpg', TEX + '2k_saturn.jpg', NASA3D + 'Saturn/Saturn.jpg'],
  saturnRing: [TEX2 + '2k_saturn_ring_alpha.png', TEX + '2k_saturn_ring_alpha.png', TEX2 + 'saturn_ring.png'],
  uranus: [TEX2 + '2k_uranus.jpg', TEX + '2k_uranus.jpg'],
  neptune: [TEX2 + '2k_neptune.jpg', NASA3D + 'Neptune/Neptune.jpg', TEX + '2k_neptune.jpg'],
  moon: [
    TEX2 + '2k_moon.jpg',
    TEX + '2k_moon.jpg',
    WIKI_SSS + '2/23/Solarsystemscope_texture_2k_moon.jpg',
    THREE_TEX + 'moon_1024.jpg',
    THREE_TEX_HTTP + 'moon_1024.jpg'
  ],
  skybox: [TEX2 + '2k_stars_milky_way.jpg', TEX2 + '2k_stars.jpg', TEX + '2k_stars_milky_way.jpg'],
  asteroid: [TEX2 + '2k_mercury.jpg', TEX + '2k_moon.jpg']
};
// 8K disabled for reliability (SSS often blocked / CORS) — use solid 2K cascade
const TEXTURE_8K = {};
// Major moon textures from NASA 3D Resources (PDS-derived spacecraft maps)
// Paths match github.com/nasa/NASA-3D-Resources folder names
const NASA_MOON_TEX = {
  'Moon': [
    TEX2 + '2k_moon.jpg', TEX + '2k_moon.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/2/23/Solarsystemscope_texture_2k_moon.jpg',
    THREE_TEX + 'moon_1024.jpg', THREE_TEX_HTTP + 'moon_1024.jpg'
  ],
  'Io': [
    NASA3D + 'Jupiter%20-%20Io%20(A)/Jupiter%20-%20Io%20(A).jpg',
    NASA3D + 'Jupiter%20-%20Io%20(B)/Jupiter%20-%20Io%20(B).jpg',
    TEX2 + '2k_mercury.jpg', TEX + '2k_mercury.jpg'
  ],
  'Europa': [
    NASA3D + 'Jupiter%20-%20Europa/Jupiter%20-%20Europa.jpg',
    TEX2 + '2k_uranus.jpg', TEX + '2k_uranus.jpg'
  ],
  'Ganymede': [
    NASA3D + 'Jupiter%20-%20Ganymede/Jupiter%20-%20Ganymede.jpg',
    TEX2 + '2k_moon.jpg', TEX + '2k_moon.jpg'
  ],
  'Callisto': [
    NASA3D + 'Jupiter%20-%20Callisto/Jupiter%20-%20Callisto.jpg',
    TEX2 + '2k_moon.jpg', TEX + '2k_moon.jpg'
  ],
  'Mimas': [NASA3D + 'Saturn%20-%20Mimas/Saturn%20-%20Mimas.jpg', TEX2 + '2k_moon.jpg', TEX + '2k_moon.jpg'],
  'Enceladus': [NASA3D + 'Saturn%20-%20Enceladus/Saturn%20-%20Enceladus.jpg', TEX2 + '2k_uranus.jpg', TEX + '2k_uranus.jpg'],
  'Tethys': [NASA3D + 'Saturn%20-%20Tethys/Saturn%20-%20Tethys.jpg', TEX2 + '2k_moon.jpg', TEX + '2k_moon.jpg'],
  'Dione': [NASA3D + 'Saturn%20-%20Dione/Saturn%20-%20Dione.jpg', TEX2 + '2k_moon.jpg', TEX + '2k_moon.jpg'],
  'Rhea': [NASA3D + 'Saturn%20-%20Rhea/Saturn%20-%20Rhea.jpg', TEX2 + '2k_moon.jpg', TEX + '2k_moon.jpg'],
  'Titan': [
    NASA3D + 'Saturn%20-%20Titan/Saturn%20-%20Titan.jpg',
    TEX2 + '2k_venus_atmosphere.jpg',
    TEX + '2k_venus_atmosphere.jpg',
    TEX2 + '2k_venus_surface.jpg',
    TEX + '2k_venus_surface.jpg'
  ],
  'Iapetus': [NASA3D + 'Saturn%20-%20Iapetus/Saturn%20-%20Iapetus.jpg', TEX2 + '2k_mercury.jpg', TEX + '2k_mercury.jpg'],
  'Miranda': [NASA3D + 'Uranus%20-%20Miranda/Uranus%20-%20Miranda.jpg', TEX2 + '2k_moon.jpg', TEX + '2k_moon.jpg'],
  'Ariel': [NASA3D + 'Uranus%20-%20Ariel/Uranus%20-%20Ariel.jpg', TEX2 + '2k_moon.jpg', TEX + '2k_moon.jpg'],
  'Umbriel': [NASA3D + 'Uranus%20-%20Umbriel/Uranus%20-%20Umbriel.jpg', TEX2 + '2k_mercury.jpg', TEX + '2k_mercury.jpg'],
  'Titania': [NASA3D + 'Uranus%20-%20Titania/Uranus%20-%20Titania.jpg', TEX2 + '2k_moon.jpg', TEX + '2k_moon.jpg'],
  'Oberon': [NASA3D + 'Uranus%20-%20Oberon/Uranus%20-%20Oberon.jpg', TEX2 + '2k_moon.jpg', TEX + '2k_moon.jpg'],
  'Triton': [NASA3D + 'Neptune%20-%20Triton/Neptune%20-%20Triton.jpg', TEX2 + '2k_uranus.jpg', TEX + '2k_uranus.jpg'],
  'Proteus': [TEX2 + '2k_mercury.jpg', TEX + '2k_moon.jpg'],
  'Phobos': [TEX2 + '2k_mercury.jpg', TEX + '2k_moon.jpg'],
  'Deimos': [TEX2 + '2k_mercury.jpg', TEX + '2k_moon.jpg']
};

const moonTexCache = {};
function loadMoonArchiveTexture(name, onReady){
  const list = NASA_MOON_TEX[name];
  if(!list || !list.length){ onReady(null); return; }
  if(moonTexCache[name]){ onReady(moonTexCache[name]); return; }
  let i = 0;
  function tryNext(){
    if(i >= list.length){ onReady(null); return; }
    const url = list[i++];
    textureLoader.load(url, function(tex){
      if(!tex || !tex.image || !tex.image.width){ tryNext(); return; }
      tex.encoding = THREE.sRGBEncoding;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.anisotropy = Math.min(8, maxAnisotropy || 1);
      moonTexCache[name] = tex;
      onReady(tex);
    }, undefined, function(){ tryNext(); });
  }
  tryNext();
}
const MOON_TEX_CASCADE = [TEX + '2k_moon.jpg', NASA3D + 'Moon/Moon.jpg', THREE_TEX + 'moon_1024.jpg'];

const loadingFill = document.getElementById('loading-fill');
const loadingFile = document.getElementById('loading-file');
const loadingScreen = document.getElementById('loading-screen');
let textureFailCount = 0;
let loadingHidden = false;

function hideLoadingScreen(){
  if(loadingHidden) return;
  loadingHidden = true;
  try {
    if(loadingFill) loadingFill.style.width = '100%';
    if(loadingFile) loadingFile.textContent = 'Ready';
    if(loadingScreen){
      loadingScreen.classList.add('loading-done', 'hide');
      loadingScreen.style.opacity = '0';
      loadingScreen.style.pointerEvents = 'none';
      loadingScreen.style.display = 'none';
    }
    const credit = document.getElementById('loading-credit');
    if(credit) credit.style.display = 'none';
    const st = document.getElementById('texture-status');
    if(st){
      st.classList.add('show', textureFailCount > 0 ? 'warn' : 'ok');
      st.textContent = textureFailCount > 0
        ? textureFailCount + ' texture fallback(s) — procedural maps active'
        : 'Simulator ready';
      setTimeout(function(){ try{ st.classList.remove('show'); }catch(e){} }, 4000);
    }
  } catch(e){
    console.warn('[hideLoading]', e);
    if(loadingScreen) loadingScreen.style.display = 'none';
  }
}

// Progress UI only (does NOT gate the sim)
function noteTextureProgress(label){
  if(loadingHidden || !loadingFile) return;
  try {
    loadingFile.classList.remove('tex-fail');
    loadingFile.classList.add('tex-ok');
    loadingFile.textContent = label || 'Loading…';
    if(loadingFill){
      const w = parseFloat(loadingFill.style.width) || 10;
      loadingFill.style.width = Math.min(95, w + 8) + '%';
    }
  } catch(e){}
}

// NEVER wait on network: force-open on a short timer
setTimeout(hideLoadingScreen, 1500);
setTimeout(hideLoadingScreen, 3000);
setTimeout(hideLoadingScreen, 5000);

// Texture loader WITHOUT LoadingManager — hung CDN requests cannot block onLoad forever
const textureLoader = new THREE.TextureLoader();
textureLoader.crossOrigin = 'anonymous';

// Optional manager for progress only (not used by textureLoader)
const loadingManager = {
  onProgress: function(){},
  onLoad: function(){ hideLoadingScreen(); },
  onError: function(){}
};


function showTextureErrorBanner(){
  let banner = document.getElementById('texture-error-banner');
  if(!banner){
    banner = document.createElement('div');
    banner.id = 'texture-error-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:200;background:#3a1414;color:#f2b8ac;'
      + 'font-family:ui-monospace,monospace;font-size:12px;padding:9px 16px;text-align:center;'
      + 'border-bottom:1px solid #7a3a30;';
    document.body.appendChild(banner);
  }
  banner.textContent = textureFailCount + ' texture(s) used a fallback map. Check network or ad-blockers if planets look flat.';
}

// Fallback: a tasteful procedural texture (not just a flat color) used only
// if the real photographic texture genuinely fails to load, so a network
// hiccup degrades gracefully instead of leaving a plain colored ball.
function makeFallbackTexture(hexColor){
  const cnv = document.createElement('canvas'); cnv.width = 512; cnv.height = 256;
  const cctx = cnv.getContext('2d');
  const c = new THREE.Color(hexColor);
  cctx.fillStyle = `rgb(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)})`;
  cctx.fillRect(0,0,512,256);
  for(let i=0;i<4000;i++){
    const x=Math.random()*512, y=Math.random()*256, r=0.5+Math.random()*1.8;
    cctx.fillStyle = Math.random()>0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.07)';
    cctx.beginPath(); cctx.arc(x,y,r,0,7); cctx.fill();
  }
  return new THREE.CanvasTexture(cnv);
}

// Robust multi-mirror texture loader. Primary → secondary → extra → procedural.
function loadColorTexture(urlOrKey, onImageReady, fallbackColor){
  let key = null;
  let queue = [];
  if(typeof urlOrKey === 'string' && TEXTURE_URLS[urlOrKey]){
    key = urlOrKey;
    queue.push(TEXTURE_URLS[urlOrKey]);
    if(TEXTURE_FALLBACKS[urlOrKey]) queue.push(TEXTURE_FALLBACKS[urlOrKey]);
    if(TEXTURE_EXTRA[urlOrKey]) queue = queue.concat(TEXTURE_EXTRA[urlOrKey]);
  } else if(typeof urlOrKey === 'string'){
    queue.push(urlOrKey);
  }
  // Deduplicate
  queue = queue.filter(function(u, i, a){ return u && a.indexOf(u) === i; });

  const tex = new THREE.Texture();
  tex.encoding = THREE.sRGBEncoding;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = Math.min(8, maxAnisotropy || 1);

  if(fallbackColor != null){
    const fb = makeFallbackTexture(fallbackColor);
    tex.image = fb.image;
    tex.needsUpdate = true;
  }

  function applyImage(img, label){
    try {
      if(!img || !img.width) return false;
      if(img.width > maxTextureSize || img.height > maxTextureSize){
        console.warn('[NCGSA tex] skip oversized', label, img.width);
        return false;
      }
      tex.image = img;
      tex.needsUpdate = true;
      if(onImageReady) onImageReady(tex);
      console.info('[NCGSA tex]', key || urlOrKey, '←', label, img.width + 'px');
      return true;
    } catch(err){
      console.warn('[NCGSA tex] apply failed', key, err);
      return false;
    }
  }

  let qi = 0;
  let settled = false;
  function tryNext(){
    if(qi >= queue.length){
      if(!settled && fallbackColor == null) textureFailCount++;
      return;
    }
    const u = queue[qi++];
    let timedOut = false;
    const timer = setTimeout(function(){
      timedOut = true;
      console.warn('[NCGSA tex] timeout', u);
      tryNext();
    }, 4000);
    textureLoader.load(
      u,
      function(loaded){
        if(timedOut) return;
        clearTimeout(timer);
        if(loaded && loaded.image && applyImage(loaded.image, u.split('/').pop())){
          settled = true;
          if(typeof noteTextureProgress === 'function') noteTextureProgress((key||'map') + ' loaded');
          if(key && TEXTURE_8K[key]){
            textureLoader.load(TEXTURE_8K[key], function(hi){
              if(hi && hi.image) applyImage(hi.image, '8K');
            }, undefined, function(){});
          }
        } else tryNext();
      },
      undefined,
      function(){
        if(timedOut) return;
        clearTimeout(timer);
        console.warn('[NCGSA tex] failed', u);
        textureFailCount++;
        tryNext();
      }
    );
  }
  tryNext();
  return tex;
}

// Build a real grayscale elevation map from a photographic texture's own pixel
// data (requires the CORS-clean load above). Downsized for perf — displacement
// only needs a coarse height signal, not full photographic resolution.
function deriveDisplacementTexture(loadedTex){
  try{
    const img = loadedTex.image;
    if(!img || !img.width) return null;
    const w = Math.min(img.width, 1024);
    const h = Math.max(1, Math.round(w * img.height / img.width));
    const cnv = document.createElement('canvas');
    cnv.width = w; cnv.height = h;
    const cctx = cnv.getContext('2d');
    cctx.drawImage(img, 0, 0, w, h);
    const frame = cctx.getImageData(0, 0, w, h);
    const px = frame.data;
    for(let i=0; i<px.length; i+=4){
      const lum = 0.299*px[i] + 0.587*px[i+1] + 0.114*px[i+2];
      px[i] = px[i+1] = px[i+2] = lum;
    }
    cctx.putImageData(frame, 0, 0);
    return new THREE.CanvasTexture(cnv);
  }catch(e){
    console.warn('Displacement derivation skipped (likely a CORS restriction):', e);
    return null;
  }
}

// Safe backdrop: solid space color first, then try Milky Way map asynchronously
scene.background = new THREE.Color(0x02040a);
scene.fog = null;
try {
  const skyboxTex = loadColorTexture('skybox', function(tex){
    try {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      scene.background = tex;
    } catch(e){ console.warn('[skybox apply]', e); }
  }, 0x02040a);
  if(skyboxTex){
    skyboxTex.mapping = THREE.EquirectangularReflectionMapping;
  }
} catch(e){ console.warn('[skybox]', e); }

function buildStarfield(){
  function addLayer(count, rMin, rMax, size, color, opacity){
    const positions = new Float32Array(count*3);
    const colors = new Float32Array(count*3);
    const c = new THREE.Color(color);
    for(let i=0;i<count;i++){
      const r = rMin + Math.random()*(rMax-rMin);
      const theta = Math.random()*Math.PI*2;
      const phi = Math.acos((Math.random()*2)-1);
      positions[i*3]=r*Math.sin(phi)*Math.cos(theta);
      positions[i*3+1]=r*Math.cos(phi);
      positions[i*3+2]=r*Math.sin(phi)*Math.sin(theta);
      // slight per-star color variation
      const j = 0.85 + Math.random()*0.3;
      colors[i*3]=Math.min(1,c.r*j); colors[i*3+1]=Math.min(1,c.g*j); colors[i*3+2]=Math.min(1,c.b*j);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions,3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors,3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
      size: size, sizeAttenuation:true, transparent:true, opacity: opacity,
      depthWrite:false, vertexColors:true, blending:THREE.AdditiveBlending
    })));
  }
  addLayer(7000, 320, 1000, 1.15, 0xffffff, 0.9);
  addLayer(5000, 800, 1600, 0.75, 0xa8c0e8, 0.55);
  addLayer(3000, 1100, 2000, 1.8, 0xffe0b0, 0.3);
  // Soft nebula patches for a deeper space feel
  for(let n=0;n<6;n++){
    const cnv=document.createElement('canvas'); cnv.width=cnv.height=128;
    const ctx=cnv.getContext('2d');
    const g=ctx.createRadialGradient(64,64,8,64,64,64);
    const hues=[[120,160,255],[255,140,180],[180,220,255],[255,200,140]];
    const h=hues[n%hues.length];
    g.addColorStop(0,'rgba('+h[0]+','+h[1]+','+h[2]+',0.35)');
    g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.fillRect(0,0,128,128);
    const mat=new THREE.SpriteMaterial({
      map:new THREE.CanvasTexture(cnv), transparent:true, depthWrite:false,
      blending:THREE.AdditiveBlending, opacity:0.22
    });
    const sp=new THREE.Sprite(mat);
    const R=900+Math.random()*600;
    const th=Math.random()*Math.PI*2, ph=Math.acos(Math.random()*2-1);
    sp.position.set(R*Math.sin(ph)*Math.cos(th), R*Math.cos(ph), R*Math.sin(ph)*Math.sin(th));
    sp.scale.set(180+Math.random()*120, 120+Math.random()*80, 1);
    scene.add(sp);
  }
}

// Soft particle texture (shared by belts, dust, Oort)
function makeSoftDotTexture(){
  const s=64, cnv=document.createElement('canvas'); cnv.width=cnv.height=s;
  const ctx=cnv.getContext('2d');
  const g=ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
  g.addColorStop(0,'rgba(255,255,255,1)');
  g.addColorStop(0.4,'rgba(255,255,255,0.65)');
  g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(s/2,s/2,s/2,0,Math.PI*2); ctx.fill();
  return new THREE.CanvasTexture(cnv);
}
var softDotTex = makeSoftDotTexture();

buildStarfield();

// Interplanetary / interstellar dust & faint nebula patches (visual atmosphere)
(function buildSpaceMatter(){ try {
  // Soft dust veil near ecliptic (zodiacal-light style)
  const dustCount = 1800;
  const dPos = new Float32Array(dustCount * 3);
  for(let i=0;i<dustCount;i++){
    const au = 0.5 + Math.random() * 45;
    const r = displayDistanceFromAU(au);
    const th = Math.random() * Math.PI * 2;
    const y = (Math.random() - 0.5) * r * 0.08;
    dPos[i*3] = r * Math.cos(th);
    dPos[i*3+1] = y;
    dPos[i*3+2] = r * Math.sin(th);
  }
  const dGeo = new THREE.BufferGeometry();
  dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  const dMat = new THREE.PointsMaterial({
    map: (typeof softDotTex!=="undefined"?softDotTex:null), color: 0xc8b898, size: 0.9, sizeAttenuation: true,
    transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending
  });
  scene.add(new THREE.Points(dGeo, dMat));

  // Distant nebula gas patches (billboards on sky sphere)
  function nebulaTex(c1, c2){
    const s = 256, cnv = document.createElement('canvas'); cnv.width = cnv.height = s;
    const ctx = cnv.getContext('2d');
    const g = ctx.createRadialGradient(s*0.5, s*0.5, 0, s*0.5, s*0.5, s*0.5);
    g.addColorStop(0, c1); g.addColorStop(0.45, c2); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0,0,s,s);
    const t = new THREE.CanvasTexture(cnv);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }
  const nebulae = [
    { color: ['rgba(120,80,160,0.55)','rgba(60,40,100,0.15)'], ra: 1.2, dec: 0.3 },
    { color: ['rgba(80,120,180,0.45)','rgba(30,50,90,0.12)'], ra: 3.8, dec: -0.4 },
    { color: ['rgba(160,90,70,0.4)','rgba(80,40,30,0.1)'], ra: 5.1, dec: 0.6 },
    { color: ['rgba(90,140,110,0.35)','rgba(30,60,50,0.1)'], ra: 0.4, dec: -0.7 },
    { color: ['rgba(100,100,160,0.4)','rgba(40,40,80,0.1)'], ra: 2.5, dec: 0.9 }
  ];
  const R = 520;
  nebulae.forEach(function(n){
    const sp = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: nebulaTex(n.color[0], n.color[1]),
        transparent: true, opacity: 0.55, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide
      })
    );
    sp.position.set(
      R * Math.cos(n.dec) * Math.cos(n.ra),
      R * Math.sin(n.dec),
      R * Math.cos(n.dec) * Math.sin(n.ra)
    );
    sp.scale.set(140 + Math.random()*80, 90 + Math.random()*50, 1);
    sp.lookAt(0,0,0);
    scene.add(sp);
  });
  } catch(err){ console.warn('[space matter]', err); }
})();


// Nearby stars beyond the Solar System (display positions on the sky sphere; not to scale distance)
// Nearby stars removed for a cleaner Solar System view.

// Constellation facts for click-to-learn (visibility from Islamabad ~33.7°N)
const CONSTELLATION_INFO = {
  Orion: { season:'Winter (Dec–Feb best)', where:'Southern sky on winter evenings from Pakistan', fact:'Hunter figure; contains Betelgeuse, Rigel, and the Orion Nebula (star-forming region).' },
  'Ursa Major': { season:'Year-round (circumpolar at mid-northern latitudes)', where:'Northern sky; Big Dipper asterism easy to find', fact:'Great Bear; pointer stars of the Dipper lead to Polaris.' },
  UrsaMajor: { season:'Year-round (circumpolar at mid-northern latitudes)', where:'Northern sky; Big Dipper asterism easy to find', fact:'Great Bear; pointer stars of the Dipper lead to Polaris.' },
  Cassiopeia: { season:'Year-round (circumpolar)', where:'Opposite the Big Dipper across the pole', fact:'W-shaped queen; useful for finding the pole and Andromeda.' },
  Scorpius: { season:'Summer (Jun–Aug)', where:'Southern sky near the Milky Way band', fact:'Contains Antares; rich in star clusters along the galactic plane.' },
  Cygnus: { season:'Summer–autumn', where:'Overhead / northern Milky Way', fact:'Northern Cross; Deneb is a vertex of the Summer Triangle.' },
  Crux: { season:'Best from southern hemisphere', where:'Not well seen from Islamabad (too far south)', fact:'Southern Cross; key navigation asterism in the south.' },
  Leo: { season:'Spring (Mar–May)', where:'Southern sky in spring evenings', fact:'The Lion; Regulus marks the heart.' },
  Taurus: { season:'Winter', where:'Southern sky near Orion', fact:'The Bull; includes Aldebaran and the Pleiades cluster.' },
  Gemini: { season:'Winter–spring', where:'High in the south after Orion', fact:'The Twins — Castor and Pollux.' },
  Aquila: { season:'Summer', where:'Milky Way, southern of Cygnus', fact:'The Eagle; Altair is a Summer Triangle star.' },
  Lyra: { season:'Summer', where:'Near zenith in summer evenings', fact:'The Lyre; Vega is one of the brightest stars in the sky.' },
  Andromeda: { season:'Autumn', where:'High NE–E in autumn evenings', fact:'Hosts the Andromeda Galaxy (M31), the nearest large spiral.' },
  Perseus: { season:'Autumn–winter', where:'Between Cassiopeia and Taurus', fact:'Contains the Double Cluster and the Demon Star Algol.' },
  Centaurus: { season:'Southern skies', where:'Low or below horizon from Islamabad', fact:'Includes Alpha Centauri, the nearest star system to the Sun.' },
  Aries: { season:'Autumn–winter', where:'Southern sky in late autumn evenings', fact:'The Ram; first sign of the zodiac.' },
  Cancer: { season:'Late winter–spring', where:'Southern sky between Gemini and Leo', fact:'The Crab; faint but hosts the Beehive Cluster (M44).' },
  Libra: { season:'Spring–summer', where:'Southern sky before Scorpius', fact:'The Scales; once part of Scorpius claws.' },
  Capricornus: { season:'Summer–autumn', where:'Southern sky in late summer evenings', fact:'The Sea-Goat; zodiac constellation in the southern sky.' },
  Aquarius: { season:'Autumn', where:'Southern sky in autumn evenings', fact:'The Water-Bearer; large zodiac constellation.' },
  Pisces: { season:'Autumn–winter', where:'Southern sky near the celestial equator', fact:'The Fishes; large faint zodiac constellation.' },
  Virgo: { season:'Spring', where:'Southern sky in spring evenings', fact:'The Maiden; hosts the bright star Spica and many galaxies.' },
  Carina: { season:'Southern skies', where:'Low or below horizon from Islamabad', fact:'The Keel; contains Canopus, the second-brightest star.' },
  Grus: { season:'Southern skies', where:'Very low south from Pakistan', fact:'The Crane; southern constellation with Alnair.' },
  'Triangulum Australe': { season:'Southern skies', where:'Not visible from Islamabad', fact:'Southern Triangle; small bright southern constellation.' }
};

const constellationHitMeshes = [];
// Background constellation stick-figures (from STAR_CATALOG / CONSTELLATION_LINES)
(function buildBackgroundConstellations(){
  if(typeof STAR_CATALOG === 'undefined' || typeof CONSTELLATION_LINES === 'undefined') return;
  const byName = {};
  STAR_CATALOG.forEach(function(s){ byName[s.n || s.name] = s; });
  const R = 520;
  function starPos(s){
    const ra = ((s.ra || 0) * Math.PI) / 180;
    const dec = ((s.dec || 0) * Math.PI) / 180;
    return new THREE.Vector3(
      R * Math.cos(dec) * Math.cos(ra),
      R * Math.sin(dec),
      R * Math.cos(dec) * Math.sin(ra)
    );
  }
  const lineMat = new THREE.LineBasicMaterial({ color:0x7fb8c4, transparent:true, opacity:0.32 });
  const pts = [];
  CONSTELLATION_LINES.forEach(function(pair){
    if(!pair || pair.length < 2) return;
    const a = byName[pair[0]], b = byName[pair[1]];
    if(a && b){ pts.push(starPos(a), starPos(b)); }
  });
  if(pts.length >= 2){
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    scene.add(new THREE.LineSegments(geo, lineMat));
  }
  const starPosArr = [];
  STAR_CATALOG.forEach(function(s){
    const p = starPos(s);
    starPosArr.push(p.x, p.y, p.z);
  });
  if(starPosArr.length){
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(starPosArr, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color:0xfff4d6, size:2.2, sizeAttenuation:true, transparent:true, opacity:0.95 })));
  }
  // Clickable centroids per constellation (from catalog 'con' field)
  const groups = {};
  STAR_CATALOG.forEach(function(s){
    const key = s.con || 'Unknown';
    if(!groups[key]) groups[key] = [];
    groups[key].push(starPos(s));
  });
  Object.keys(groups).forEach(function(name){
    const arr = groups[name];
    if(arr.length < 2) return;
    const c = new THREE.Vector3();
    arr.forEach(function(p){ c.add(p); });
    c.multiplyScalar(1/arr.length);
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(18, 8, 8),
      new THREE.MeshBasicMaterial({ transparent:true, opacity:0.001, depthWrite:false })
    );
    hit.position.copy(c);
    hit.userData.isConstellation = true;
    hit.userData.constellationName = name;
    scene.add(hit);
    constellationHitMeshes.push(hit);
  });
})();

function resolveConstellationInfo(name){
  if(!name) return null;
  if(CONSTELLATION_INFO[name]) return CONSTELLATION_INFO[name];
  const compact = name.replace(/\s/g,'');
  if(CONSTELLATION_INFO[compact]) return CONSTELLATION_INFO[compact];
  // case-insensitive match
  const keys = Object.keys(CONSTELLATION_INFO);
  for(let i=0;i<keys.length;i++){
    if(keys[i].toLowerCase() === name.toLowerCase()) return CONSTELLATION_INFO[keys[i]];
  }
  return null;
}

// Smooth constellation sky-pan state
constellationFocus = null; // { name, targetTheta, targetPhi, targetDist, highlightLines }
const constellationHighlightGroup = new THREE.Group();
scene.add(constellationHighlightGroup);

function clearConstellationHighlight(){
  while(constellationHighlightGroup.children.length){
    const c = constellationHighlightGroup.children[0];
    constellationHighlightGroup.remove(c);
    if(c.geometry) c.geometry.dispose();
    if(c.material) c.material.dispose();
  }
}

function buildConstellationHighlight(name){
  clearConstellationHighlight();
  const byName = {};
  STAR_CATALOG.forEach(function(s){ byName[s.n] = s; });
  const R = 520;
  function starPos(s){
    const ra = (s.ra * Math.PI) / 180;
    const dec = (s.dec * Math.PI) / 180;
    return new THREE.Vector3(
      R * Math.cos(dec) * Math.cos(ra),
      R * Math.sin(dec),
      R * Math.cos(dec) * Math.sin(ra)
    );
  }
  // Bright lines for this constellation only
  const pts = [];
  CONSTELLATION_LINES.forEach(function(pair){
    if(!pair || pair.length < 2) return;
    const a = byName[pair[0]], b = byName[pair[1]];
    if(!a || !b) return;
    const same =
      (a.con === name || (a.con||'').replace(/\s/g,'') === (name||'').replace(/\s/g,'')) ||
      (b.con === name || (b.con||'').replace(/\s/g,'') === (name||'').replace(/\s/g,''));
    if(!same) return;
    pts.push(starPos(a), starPos(b));
  });
  if(pts.length >= 2){
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    constellationHighlightGroup.add(new THREE.LineSegments(geo,
      new THREE.LineBasicMaterial({ color:0xc9a227, transparent:true, opacity:0.95 })));
  }
  // Glow spheres on member stars
  STAR_CATALOG.forEach(function(s){
    if((s.con||'') !== name && (s.con||'').replace(/\s/g,'') !== (name||'').replace(/\s/g,'')) return;
    const p = starPos(s);
    const size = Math.max(4, 14 - s.mag * 2.5);
    const sp = new THREE.Mesh(
      new THREE.SphereGeometry(size, 10, 10),
      new THREE.MeshBasicMaterial({ color:0xffe8a0, transparent:true, opacity:0.85 })
    );
    sp.position.copy(p);
    constellationHighlightGroup.add(sp);
  });
}

function focusConstellation(name){
  focusedPlanet = null;
  clearConstellationHighlight();
  buildConstellationHighlight(name);

  const hit = constellationHitMeshes.find(function(h){ return h.userData.constellationName === name; });
  let dir = null;
  if(hit){
    dir = hit.position.clone().normalize();
  } else {
    // Average RA/Dec of catalog stars in this constellation
    const members = STAR_CATALOG.filter(function(s){
      return (s.con||'') === name || (s.con||'').replace(/\s/g,'') === (name||'').replace(/\s/g,'');
    });
    if(members.length){
      let sx=0,sy=0,sz=0;
      members.forEach(function(s){
        const ra = (s.ra * Math.PI) / 180, dec = (s.dec * Math.PI) / 180;
        sx += Math.cos(dec)*Math.cos(ra);
        sy += Math.sin(dec);
        sz += Math.cos(dec)*Math.sin(ra);
      });
      dir = new THREE.Vector3(sx, sy, sz).normalize();
    }
  }

  if(dir){
    // Camera opposite the constellation so lookAt(origin) faces the pattern
    const targetTheta = Math.atan2(-dir.x, -dir.z);
    const targetPhi = Math.acos(Math.max(-0.92, Math.min(0.92, -dir.y)));
    focusedPlanet = null;
    focusedMoon = null;
    constellationFocus = { name: name }; // flag only; motion via cameraTween
    startCameraTween({
      target: ORIGIN.clone(),
      distance: 95,
      theta: targetTheta,
      phi: targetPhi,
      duration: 1.4
    });
  }

  openConstellationHud(name);
  const list = document.getElementById('constellation-list');
  if(list){
    list.querySelectorAll('button').forEach(function(b){
      b.classList.toggle('active', b.dataset.name === name);
    });
  }
  const cap = document.getElementById('teleport-caption');
  if(cap){
    cap.textContent = 'Viewing ' + name + ' — drag to look around · Full system to return';
    cap.classList.add('show');
    setTimeout(function(){ cap.classList.remove('show'); }, 2800);
  }
}

function openConstellationHud(name){
  const info = resolveConstellationInfo(name);
  currentHudPlanet = null;
  currentHudKind = 'constellation';
  document.getElementById('hud-type').textContent = 'Constellation';
  document.getElementById('hud-name').textContent = name;
  document.getElementById('hud-subtitle').textContent = 'Star pattern on the celestial sphere';
  document.getElementById('hud-diameter').textContent = '—';
  document.getElementById('hud-period').textContent = info ? info.season : 'Seasonal visibility varies';
  document.getElementById('hud-incl-row').style.display = 'none';
  document.getElementById('hud-distance-label').textContent = 'Where to look';
  document.getElementById('hud-distance').textContent = info ? info.where : 'Depends on latitude and season';
  document.getElementById('hud-ptype-label').textContent = 'From Islamabad';
  document.getElementById('hud-ptype').textContent = info ? info.where : 'Check a local sky chart for rise times';
  document.getElementById('hud-moons-row').style.display = 'none';
  document.getElementById('hud-gravity-row').style.display = 'none';
  document.getElementById('hud-temp-row').style.display = 'none';
  document.getElementById('hud-density-row').style.display = 'none';
  document.getElementById('hud-escape-row').style.display = 'none';
  document.getElementById('hud-atmo-row').style.display = 'none';
  document.getElementById('hud-surface-row').style.display = 'none';
  document.getElementById('hud-mag-row').style.display = 'none';
  // List catalog stars in this constellation with HD numbers
  const starsInCon = STAR_CATALOG.filter(function(s){
    return (s.con || '') === name || (s.con || '').replace(/\s/g,'') === name.replace(/\s/g,'');
  }).sort(function(a,b){ return a.mag - b.mag; });
  let starLines = info ? info.fact : 'A traditional grouping of bright stars used for navigation and storytelling.';
  if(starsInCon.length){
    starLines += '\n\nStars (J2000 · HD catalog):';
    starsInCon.slice(0, 12).forEach(function(s){
      starLines += '\n· ' + s.n + '  HD ' + (s.hd || '—') + '  mag ' + s.mag.toFixed(2)
        + '  RA ' + s.ra.toFixed(3) + '°  Dec ' + s.dec.toFixed(3) + '°';
    });
  }
  document.getElementById('hud-visibility').textContent = starLines;
  document.getElementById('hud-live-block').style.display = 'none';
  document.getElementById('hud-vis-block').style.display = '';
  document.getElementById('hud-disclaimer').style.display = 'none';
  document.getElementById('hud').classList.add('open');
}

// Populate left constellation sidebar (prefer catalog names that exist in the scene)
(function buildConstellationSidebar(){
  const list = document.getElementById('constellation-list');
  const toggle = document.getElementById('cp-toggle');
  const panel = document.getElementById('constellation-panel');
  if(!list || !panel) return;
  if(toggle){
    toggle.addEventListener('click', function(){
      panel.classList.toggle('collapsed');
      toggle.textContent = panel.classList.contains('collapsed') ? 'Show' : 'Hide';
    });
  }
  // Prefer names we have hit meshes for (actually in the scene), then known info keys
  const names = [];
  const seen = {};
  constellationHitMeshes.forEach(function(h){
    const n = h.userData.constellationName;
    if(n && !seen[n]){ seen[n] = true; names.push(n); }
  });
  Object.keys(CONSTELLATION_INFO).forEach(function(n){
    if(!seen[n] && n.indexOf(' ') === -1){ // skip pure aliases with spaces duplicates
      // only add if we don't already have a spaced variant that matches
      const hasSpaced = names.some(function(x){ return x.replace(/\s/g,'') === n || x === n; });
      if(!hasSpaced){ seen[n] = true; names.push(n); }
    }
  });
  names.sort(function(a,b){ return a.localeCompare(b); });
  names.forEach(function(name){
    const info = resolveConstellationInfo(name);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.name = name;
    btn.innerHTML = name + (info ? '<span class="cp-sub">' + info.season + '</span>' : '');
    btn.addEventListener('click', function(){ focusConstellation(name); });
    list.appendChild(btn);
  });
})();

function makeGlowTexture(inner, outer){
  const size=256;
  const cnv=document.createElement('canvas'); cnv.width=cnv.height=size;
  const ctx=cnv.getContext('2d');
  const grad=ctx.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);
  grad.addColorStop(0, inner); grad.addColorStop(0.4, outer); grad.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=grad; ctx.fillRect(0,0,size,size);
  return new THREE.CanvasTexture(cnv);
}

// ---- textured sun: granulation + sunspots + swirling spiral filaments, layered noise ----
// Higher-resolution canvas (was 512x256) so the surface reads crisp even at close teleport-adjacent zoom.
function makeSunTexture(){
  const w=2048, h=1024;
  const cnv=document.createElement('canvas'); cnv.width=w; cnv.height=h;
  const ctx=cnv.getContext('2d');

  const base = ctx.createLinearGradient(0,0,0,h);
  base.addColorStop(0,'#fff3c4');
  base.addColorStop(0.5,'#ffce6b');
  base.addColorStop(1,'#ff9d3d');
  ctx.fillStyle = base;
  ctx.fillRect(0,0,w,h);

  // differential-rotation spiral filaments — bands of granulation swept into gentle
  // logarithmic-spiral streaks, echoing how plasma actually shears across the photosphere
  for(let arm=0; arm<10; arm++){
    const armOffset = (arm/10)*Math.PI*2;
    ctx.save();
    ctx.globalAlpha = 0.16 + Math.random()*0.1;
    ctx.strokeStyle = arm%2===0 ? 'rgba(255,244,214,0.9)' : 'rgba(210,90,20,0.7)';
    ctx.lineWidth = 3 + Math.random()*5;
    ctx.beginPath();
    for(let t=0; t<=1; t+=0.01){
      const theta = armOffset + t*Math.PI*3.2;
      const x = (w/2) + (w*0.46) * t * Math.cos(theta*0.35) * ((t*w)%w)/w;
      const px = (t*w + arm*(w/10)) % w;
      const py = (h/2) + Math.sin(theta)*h*0.32*(0.3+t*0.7);
      if(t===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
    }
    ctx.stroke();
    ctx.restore();
  }

  // granulation: many small soft blobs
  for(let i=0;i<5200;i++){
    const x=Math.random()*w, y=Math.random()*h, r=4+Math.random()*10;
    const g = ctx.createRadialGradient(x,y,0,x,y,r);
    const bright = Math.random()>0.5;
    g.addColorStop(0, bright? 'rgba(255,255,235,0.35)':'rgba(200,90,20,0.28)');
    g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g;
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
  }
  // sunspot clusters
  for(let s=0;s<9;s++){
    const cx=Math.random()*w, cy=Math.random()*h, clusterR=20+Math.random()*60;
    for(let i=0;i<14;i++){
      const a=Math.random()*Math.PI*2, d=Math.random()*clusterR;
      const x=cx+Math.cos(a)*d, y=cy+Math.sin(a)*d, r=6+Math.random()*14;
      const g=ctx.createRadialGradient(x,y,0,x,y,r);
      g.addColorStop(0,'rgba(120,40,10,0.55)');
      g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=g;
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(cnv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}

// spiral corona overlay: a soft logarithmic-spiral swirl that continuously rotates around
// the sun, on top of the granulated surface — this is the visible "spiral" motion of the star
function makeSunSpiralTexture(){
  const size=1024;
  const cnv=document.createElement('canvas'); cnv.width=cnv.height=size;
  const ctx=cnv.getContext('2d');
  const cx=size/2, cy=size/2;
  ctx.globalCompositeOperation='lighter';
  for(let arm=0; arm<5; arm++){
    const armOffset=(arm/5)*Math.PI*2;
    ctx.beginPath();
    for(let t=0; t<=1; t+=0.004){
      const theta = armOffset + t*Math.PI*5.5;
      const r = t*size*0.49;
      const x = cx + Math.cos(theta)*r;
      const y = cy + Math.sin(theta)*r;
      if(t===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    const grad = ctx.createRadialGradient(cx,cy,0,cx,cy,size*0.5);
    grad.addColorStop(0,'rgba(255,236,190,0.0)');
    grad.addColorStop(0.35,'rgba(255,214,140,0.22)');
    grad.addColorStop(1,'rgba(255,150,60,0.0)');
    ctx.strokeStyle=grad;
    ctx.lineWidth = 30;
    ctx.lineCap='round';
    ctx.stroke();
  }
  return new THREE.CanvasTexture(cnv);
}

// ---- sun ----
const sunGroup = new THREE.Group();
// Sun: procedural photosphere first (never Earth). Photo map upgrades when CDN loads.
const sunProcedural = makeSunTexture();
sunProcedural.encoding = THREE.sRGBEncoding;
const sunTexA = sunProcedural.clone ? sunProcedural.clone() : sunProcedural;
sunTexA.image = sunProcedural.image;
sunTexA.needsUpdate = true;
sunTexA.anisotropy = maxAnisotropy;
sunTexA.encoding = THREE.sRGBEncoding;
const sunGeo = new THREE.SphereGeometry(5.4, 96, 96);
const sunMat = new THREE.MeshBasicMaterial({ map: sunTexA, color: 0xffffff });
const sunMesh = new THREE.Mesh(sunGeo, sunMat);
sunGroup.add(sunMesh);
const sunGeo2 = new THREE.SphereGeometry(5.44, 96, 96);
const sunMat2 = new THREE.MeshBasicMaterial({
  map: sunTexA, transparent:true, opacity:0.35,
  blending:THREE.AdditiveBlending, depthWrite:false
});
const sunMesh2 = new THREE.Mesh(sunGeo2, sunMat2);
sunGroup.add(sunMesh2);
// Load real sun map asynchronously; only replace if successful
loadColorTexture('sun', function(loaded){
  if(loaded && loaded.image && loaded.image.width >= 256){
    sunMat.map = loaded;
    sunMat.needsUpdate = true;
    sunMat2.map = loaded;
    sunMat2.needsUpdate = true;
  }
}, 0xffcc55);

// rotating spiral corona sprite — this is what makes the star visibly "spiral"
const sunSpiralSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: makeSunSpiralTexture(), transparent:true, depthWrite:false, blending:THREE.AdditiveBlending
}));
sunSpiralSprite.scale.set(15.5,15.5,1);
sunGroup.add(sunSpiralSprite);

const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: makeGlowTexture('rgba(255,220,150,0.9)','rgba(255,170,60,0.25)'),
  transparent:true, depthWrite:false
}));
glowSprite.scale.set(28,28,1);
sunGroup.add(glowSprite);
scene.add(sunGroup);

// =========================================================================
// SUN BARYCENTRIC WOBBLE — the Sun isn't fixed at the origin: the combined
// gravitational pull of the (mostly giant) planets tugs it in a small loop
// around the solar system's true center of mass. Real amplitude is only
// ~0.01 AU, so it's visually amplified here to read clearly at this scene's
// compressed scale — but the *direction* and *shape* of the path (a slow,
// looping, spiral-ish drift that tracks Jupiter and Saturn's positions) is
// physically grounded, not random.
// =========================================================================
const SUN_MASS_EARTH = 332946;
const SUN_WOBBLE_VISUAL_SCALE = 1450;
const SUN_WOBBLE_MAX = 13.5; // clamp so the loop stays a dramatic but readable orbit, not a flung-out sun
const sunWobbleVec = new THREE.Vector3();
function computeSunWobble(T){
  let wx=0, wy=0, wz=0;
  PLANETS.forEach(p=>{
    const h = heliocentric(p.key, T);
    const m = p.relMass || 1;
    wx += m*h.x; wy += m*h.y; wz += m*h.z;
  });
  const auX = -wx/SUN_MASS_EARTH, auY = -wy/SUN_MASS_EARTH, auZ = -wz/SUN_MASS_EARTH;
  // match the rest of the scene's axis convention: screenX=x, screenY=z, screenZ=y
  sunWobbleVec.set(auX, auZ, auY).multiplyScalar(SUN_WOBBLE_VISUAL_SCALE);
  if(sunWobbleVec.length() > SUN_WOBBLE_MAX) sunWobbleVec.setLength(SUN_WOBBLE_MAX);
  return sunWobbleVec;
}

function makePlanetTexture(hexColor, banded){
  const w=256,h=128;
  const cnv=document.createElement('canvas'); cnv.width=w; cnv.height=h;
  const ctx=cnv.getContext('2d');
  const c = new THREE.Color(hexColor);
  const base = `rgb(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)})`;
  ctx.fillStyle = base; ctx.fillRect(0,0,w,h);
  const bands = banded ? 10 : 5;
  for(let i=0;i<bands;i++){
    const y=(i/bands)*h, bh=h/bands, shade=(i%2===0)?1.08:0.92;
    ctx.fillStyle = `rgba(${Math.min(255,Math.round(c.r*255*shade))},${Math.min(255,Math.round(c.g*255*shade))},${Math.min(255,Math.round(c.b*255*shade))},0.5)`;
    ctx.fillRect(0,y,w,bh);
  }
  for(let i=0;i<420;i++){
    ctx.fillStyle = `rgba(0,0,0,${Math.random()*0.06})`;
    ctx.fillRect(Math.random()*w, Math.random()*h, 2, 2);
  }
  const tex = new THREE.CanvasTexture(cnv);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

// =========================================================================
// BUILD PLANETS + REAL ORBIT PATHS
// =========================================================================
const planetMeshes = [];
const orbitGroup = new THREE.Group();
scene.add(orbitGroup);

const nowT = centuriesSinceJ2000(toJulianDate(new Date()));

// Ecliptic + inclination visualization (toggleable, user-friendly)
const inclVizGroup = new THREE.Group();
inclVizGroup.name = 'inclinationViz';
orbitGroup.add(inclVizGroup);
let inclinationVisible = true;

(function buildEclipticPlane(){
  const r = displayDistanceFromAU(32);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(r * 0.08, r, 128),
    new THREE.MeshBasicMaterial({
      color: 0x4a6a8a, transparent: true, opacity: 0.07,
      side: THREE.DoubleSide, depthWrite: false
    })
  );
  ring.rotation.x = -Math.PI / 2;
  inclVizGroup.add(ring);
  const rimPts = [];
  for(let i=0;i<=96;i++){
    const a = (i/96)*Math.PI*2;
    rimPts.push(new THREE.Vector3(Math.cos(a)*r, 0, Math.sin(a)*r));
  }
  const rimLine = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(rimPts),
    new THREE.LineDashedMaterial({ color:0x6a90b0, transparent:true, opacity:0.35, dashSize:3, gapSize:2 })
  );
  if(rimLine.computeLineDistances) rimLine.computeLineDistances();
  inclVizGroup.add(rimLine);
  const cnv = document.createElement('canvas'); cnv.width=320; cnv.height=64;
  const ctx = cnv.getContext('2d');
  ctx.font = '18px Inter, sans-serif'; ctx.fillStyle = '#7fb8c4'; ctx.textAlign='center';
  ctx.fillText('Ecliptic plane (i = 0°)', 160, 40);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map:new THREE.CanvasTexture(cnv), transparent:true, depthWrite:false, opacity:0.75
  }));
  sp.scale.set(22, 4.5, 1);
  sp.position.set(r * 0.72, 1.5, 0);
  inclVizGroup.add(sp);
})();


// =========================================================================
// IMPROVED SHADERS — fresnel atmosphere rim + planet lighting boost
// =========================================================================
function makeAtmosphereShaderMaterial(colorHex, intensity){
  intensity = intensity != null ? intensity : 0.55;
  const col = new THREE.Color(colorHex);
  return new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: col },
      coefficient: { value: 0.55 },
      power: { value: 3.8 },
      intensity: { value: intensity },
      sunDir: { value: new THREE.Vector3(1, 0.2, 0.1).normalize() }
    },
    vertexShader: [
      'varying vec3 vNormal;',
      'varying vec3 vWorldPos;',
      'varying vec3 vViewPos;',
      'void main(){',
      '  vNormal = normalize(normalMatrix * normal);',
      '  vec4 wp = modelMatrix * vec4(position, 1.0);',
      '  vWorldPos = wp.xyz;',
      '  vViewPos = (modelViewMatrix * vec4(position, 1.0)).xyz;',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 glowColor;',
      'uniform float coefficient;',
      'uniform float power;',
      'uniform float intensity;',
      'uniform vec3 sunDir;',
      'varying vec3 vNormal;',
      'varying vec3 vWorldPos;',
      'varying vec3 vViewPos;',
      'void main(){',
      '  vec3 viewDir = normalize(cameraPosition - vWorldPos);',
      '  vec3 n = normalize(vNormal);',
      '  // Fresnel limb glow (atmosphere edge)',
      '  float ndotv = max(0.0, dot(n, viewDir));',
      '  float fresnel = pow(1.0 - ndotv, power);',
      '  fresnel = clamp(fresnel, 0.0, 1.0);',
      '  // Soft day-side scatter (approximate Rayleigh tint)',
      '  float ndotl = max(0.0, dot(n, normalize(sunDir)));',
      '  float scatter = pow(ndotl, 0.6) * 0.35;',
      '  float alpha = clamp(fresnel * intensity + scatter * intensity * 0.4, 0.0, 1.0);',
      '  vec3 col = glowColor * (0.75 + 0.25 * ndotl);',
      '  gl_FragColor = vec4(col, alpha);',
      '}'
    ].join('\n'),
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

function enhancePlanetMaterial(mat, p){
  if(!mat) return mat;
  // Richer PBR response
  if(mat.isMeshStandardMaterial){
    mat.roughness = mat.roughness != null ? mat.roughness : 0.75;
    mat.metalness = mat.metalness != null ? mat.metalness : 0.05;
    // Slight emissive so night side stays readable with textures
    if(!mat.emissive || mat.emissive.getHex() === 0){
      mat.emissive = new THREE.Color(p.emissive != null ? p.emissive : 0x333333);
      mat.emissiveIntensity = 0.16;
    }
  }
  return mat;
}

PLANETS.forEach(p => {
  const segs = 160;
  const pts = [];
  for(let i=0;i<=segs;i++){
    const Mdeg = (i/segs)*360;
    const h = heliocentricAtM(p.key, nowT, Mdeg);
    const f = displayDistanceFromAU(h.r)/h.r;
    pts.push(new THREE.Vector3(h.x*f, h.z*f, h.y*f));
  }
  const I0 = Math.abs((ELEMENTS[p.key] && ELEMENTS[p.key].I[0]) || 0);
  p.inclinationDeg = I0;
  const tI = Math.min(1, I0 / 7.5);
  const orbitColor = new THREE.Color().setHSL(0.12 - tI * 0.35, 0.65, 0.45 + tI * 0.15);
  const orbitGeo = new THREE.BufferGeometry().setFromPoints(pts);
  const orbitMat = new THREE.LineBasicMaterial({ color: orbitColor, transparent:true, opacity: 0.28 + tI * 0.28 });
  const orbitLine = new THREE.LineLoop(orbitGeo, orbitMat);
  orbitGroup.add(orbitLine);
  p.orbitLine = orbitLine;

  // Inclination markers (in toggle group) — only for planets with meaningful tilt
  if(I0 > 0.15){
    const hNode = heliocentricAtM(p.key, nowT, 0);
    const fN = displayDistanceFromAU(hNode.r)/hNode.r;
    const onOrbit = new THREE.Vector3(hNode.x*fN, hNode.z*fN, hNode.y*fN);
    const onEcliptic = new THREE.Vector3(onOrbit.x, 0, onOrbit.z);
    inclVizGroup.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([onEcliptic, onOrbit]),
      new THREE.LineBasicMaterial({ color: orbitColor, transparent:true, opacity:0.65 })
    ));
    const rad = Math.sqrt(onOrbit.x*onOrbit.x + onOrbit.z*onOrbit.z);
    if(rad > 0.5){
      const arcPts = [];
      const Irad = I0 * Math.PI / 180;
      for(let s=0;s<=14;s++){
        const ang = (s/14) * Irad;
        const az = Math.atan2(onOrbit.z, onOrbit.x);
        const rr = rad * 0.92;
        arcPts.push(new THREE.Vector3(
          Math.cos(az) * rr * Math.cos(ang),
          rr * Math.sin(ang),
          Math.sin(az) * rr * Math.cos(ang)
        ));
      }
      inclVizGroup.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(arcPts),
        new THREE.LineBasicMaterial({ color:0x7fb8c4, transparent:true, opacity:0.8 })
      ));
      // Floating degree label near the arc tip
      const lc = document.createElement('canvas'); lc.width=128; lc.height=48;
      const lctx = lc.getContext('2d');
      lctx.font = 'bold 22px Inter,sans-serif'; lctx.fillStyle = '#c9e8f0'; lctx.textAlign='center';
      lctx.fillText(I0.toFixed(1) + '°', 64, 32);
      const lsp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(lc), transparent:true, depthWrite:false, opacity:0.85
      }));
      const tip = arcPts[arcPts.length-1];
      lsp.position.set(tip.x, tip.y + 1.2, tip.z);
      lsp.scale.set(6, 2.2, 1);
      inclVizGroup.add(lsp);
    }
  }

  // =========================================================================
  // TERRAIN — for rocky worlds only. Gas/ice giants have no solid surface, so
  // we deliberately leave them smooth spheres (Jupiter/Saturn/Uranus/Neptune) —
  // "mountains" on a gas giant would be fiction, not detail. For the four
  // terrestrial planets, elevation is derived live from the real photographic
  // texture's own luminance (brighter/darker regions in these NASA-sourced
  // maps track real albedo & shading from actual terrain), then pushed out
  // as true vertex displacement — not fake bump shading — so canyons and
  // peaks are real 3D geometry, visible in silhouette from space. The height
  // is exaggerated (~80-100x true scale) purely for visual drama; real Everest
  // is only ~0.1% of Earth's radius.
  // =========================================================================
  const isTerrestrial = p.type === 'Terrestrial planet';
  const sphereSegs = isTerrestrial ? 176 : 48;
  const tex = loadColorTexture(p.key, function(loadedTex){
    mat.map = loadedTex;
    mat.needsUpdate = true;
    // Mild displacement only — Earth daymap is albedo, not DEM; keep subtle
    if(isTerrestrial && p.key !== 'earth'){
      const dispTex = deriveDisplacementTexture(loadedTex);
      if(dispTex){
        mat.displacementMap = dispTex;
        mat.displacementScale = p.displayRadius * 0.06;
        mat.displacementBias = -p.displayRadius * 0.03;
        mat.needsUpdate = true;
      }
    }
  }, p.color);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    color: 0xffffff,
    roughness: p.key === 'earth' ? 0.65 : 0.78,
    metalness: 0.02,
    emissive: p.emissive || 0x222222,
    emissiveIntensity: 0.22
  });
  const geo = new THREE.SphereGeometry(p.displayRadius, sphereSegs, Math.round(sphereSegs/2));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.planet = p;
  const system = new THREE.Group();
  system.userData.planet = p;
  system.add(mesh);
  scene.add(system);
  p.mesh = mesh;
  p.system = system;

  if(p.key === 'venus'){
    const cloudTex = loadColorTexture('venusAtmo');
    const cloudMat = new THREE.MeshStandardMaterial({ map:cloudTex, transparent:true, opacity:0.92, roughness:1, depthWrite:true });
    const cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(p.displayRadius*1.015, 48, 48), cloudMat);
    mesh.add(cloudMesh);
  }

  // Earth: cloud deck + soft atmosphere limb
  if(p.key === 'earth'){
    const cloudTex = loadColorTexture('earthClouds', function(ct){
      if(p.cloudMesh && p.cloudMesh.material){
        p.cloudMesh.material.map = ct;
        p.cloudMesh.material.needsUpdate = true;
      }
    });
    const cloudMat = new THREE.MeshStandardMaterial({
      map: cloudTex, transparent: true, opacity: 0.45, roughnessWrite: false, roughnessTest: false
    });
    const cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(p.displayRadius*1.018, 64, 48), cloudMat);
    mesh.add(cloudMesh);
    p.cloudMesh = cloudMesh;
    // Fresnel atmosphere rim (shader)
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(p.displayRadius * 1.055, 64, 48),
      makeAtmosphereShaderMaterial(0x6eb8ff, 0.85)
    );
    mesh.add(atmo);
    p.atmoMesh = atmo;
  }

  // Thin atmosphere / haze rims for other worlds
  if(p.key === 'mars'){
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(p.displayRadius * 1.04, 48, 32),
      makeAtmosphereShaderMaterial(0xd08050, 0.4)
    );
    mesh.add(atmo);
  }
  if(p.key === 'venus'){
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(p.displayRadius * 1.06, 48, 32),
      makeAtmosphereShaderMaterial(0xe8d090, 0.55)
    );
    mesh.add(atmo);
  }
  if(p.key === 'titan' || false){ /* placeholder */ }
  if(['jupiter','saturn','uranus','neptune'].includes(p.key)){
    const cols = { jupiter:0xc8b090, saturn:0xe0d0a0, uranus:0xa0d8e0, neptune:0x5080d0 };
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(p.displayRadius * 1.035, 48, 32),
      makeAtmosphereShaderMaterial(cols[p.key] || 0xa0c0ff, 0.32)
    );
    mesh.add(atmo);
  }

  // Planetary rings — clean geometry, correct UV, photographic alpha for Saturn
  if(p.ring || p.key === 'jupiter' || p.key === 'uranus' || p.key === 'neptune'){
    const ringGroup = new THREE.Group();
    function makeRingMesh(ri, ro, segments, mat){
      const geo = new THREE.RingGeometry(ri, ro, segments);
      // RingGeometry UVs are wrong for radial textures — rebuild as radial U
      const pos = geo.attributes.position;
      const uv = geo.attributes.uv;
      for(let i=0;i<pos.count;i++){
        const x = pos.getX(i), y = pos.getY(i);
        const dist = Math.sqrt(x*x + y*y);
        const u = (dist - ri) / Math.max(1e-6, ro - ri);
        uv.setXY(i, u, 0.5);
      }
      uv.needsUpdate = true;
      const meshR = new THREE.Mesh(geo, mat);
      meshR.rotation.x = -Math.PI / 2; // equatorial plane (XZ)
      meshR.renderOrder = 2;
      return meshR;
    }
    if(p.key === 'saturn'){
      // Multi-band Saturn rings: C, B, Cassini Division, A, F
      // Relative radii ≈ real Rs ratios (display-scaled)
      const R = p.displayRadius;
      function bandCanvas(opts){
        const cnv = document.createElement('canvas'); cnv.width = 2048; cnv.height = 8;
        const ctx = cnv.getContext('2d');
        for(let x=0;x<2048;x++){
          const t = x/2047;
          let a = opts.base;
          // fine ringlets
          a *= 0.7 + 0.3 * Math.sin(t * opts.freq + opts.phase);
          a *= 0.85 + 0.15 * Math.sin(t * opts.freq2);
          if(opts.edgeFade){
            a *= Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
          }
          ctx.fillStyle = 'rgba(255,245,220,' + Math.max(0, Math.min(1, a)).toFixed(3) + ')';
          ctx.fillRect(x, 0, 1, 8);
        }
        const tex = new THREE.CanvasTexture(cnv);
        tex.wrapS = THREE.ClampToEdgeWrapping;
        return tex;
      }
      // C ring (faint inner)
      ringGroup.add(makeRingMesh(R*1.22, R*1.52, 160, new THREE.MeshBasicMaterial({
        map: bandCanvas({ base:0.35, freq:90, freq2:200, phase:0, edgeFade:true }),
        color: 0xd0c0a0, side: THREE.DoubleSide, transparent: true, opacity: 0.38, depthWrite: false
      })));
      // B ring (brightest, densest)
      ringGroup.add(makeRingMesh(R*1.53, R*1.95, 192, new THREE.MeshBasicMaterial({
        map: bandCanvas({ base:0.92, freq:70, freq2:160, phase:1.2, edgeFade:false }),
        color: 0xe8dcc0, side: THREE.DoubleSide, transparent: true, opacity: 0.88, depthWrite: false
      })));
      // Cassini Division — intentional gap (no mesh) between 1.95 and 2.03
      // A ring
      ringGroup.add(makeRingMesh(R*2.03, R*2.27, 160, new THREE.MeshBasicMaterial({
        map: bandCanvas({ base:0.75, freq:110, freq2:240, phase:0.5, edgeFade:true }),
        color: 0xe0d0b0, side: THREE.DoubleSide, transparent: true, opacity: 0.8, depthWrite: false
      })));
      // F ring (thin outer)
      ringGroup.add(makeRingMesh(R*2.32, R*2.36, 96, new THREE.MeshBasicMaterial({
        color: 0xd8c8a8, side: THREE.DoubleSide, transparent: true, opacity: 0.4, depthWrite: false
      })));

      // Photographic alpha overlay across full ring system
      const ringTex = loadColorTexture('saturnRing', function(t){
        if(p.ringPhotoMat){ p.ringPhotoMat.map = t; p.ringPhotoMat.needsUpdate = true; }
      });
      const photoMat = new THREE.MeshBasicMaterial({
        map: ringTex, side: THREE.DoubleSide, transparent: true,
        opacity: 0.72, depthWrite: false, alphaTest: 0.02
      });
      p.ringPhotoMat = photoMat;
      ringGroup.add(makeRingMesh(R*1.22, R*2.36, 192, photoMat));
      // Slight tilt match to planet axial tilt is applied via parent mesh
    } else {
      const ringCfg = {
        jupiter: { inner:1.55, outer:1.85, opacity:0.22, color:0xc8b090 },
        uranus:  { inner:1.55, outer:1.95, opacity:0.4, color:0xa8c8d0 },
        neptune: { inner:1.45, outer:1.75, opacity:0.3, color:0x7090c0 }
      }[p.key] || { inner:1.4, outer:2.0, opacity:0.4, color:0xffffff };
      const cnv = document.createElement('canvas'); cnv.width = 512; cnv.height = 4;
      const ctx = cnv.getContext('2d');
      const grd = ctx.createLinearGradient(0,0,512,0);
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(0.2, 'rgba(255,255,255,0.5)');
      grd.addColorStop(0.5, 'rgba(255,255,255,0.85)');
      grd.addColorStop(0.8, 'rgba(255,255,255,0.45)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd; ctx.fillRect(0,0,512,4);
      const bandTex = new THREE.CanvasTexture(cnv);
      const ringMat = new THREE.MeshBasicMaterial({
        map: bandTex, color: ringCfg.color, side: THREE.DoubleSide,
        transparent: true, opacity: ringCfg.opacity, depthWrite: false
      });
      ringGroup.add(makeRingMesh(
        p.displayRadius * ringCfg.inner,
        p.displayRadius * ringCfg.outer,
        128, ringMat
      ));
    }
    mesh.add(ringGroup);
    p.ringMesh = ringGroup;
    p.ring = true;
  }
  // Axial tilt on the system group (Saturn ~26.7°, Earth ~23.4°, Uranus ~98°)
  // Rings (children of mesh) stay equatorial; moons parented to system stay in space
  if(p.axialTiltDeg != null){
    system.rotation.order = 'ZXY';
    system.rotation.z = (p.axialTiltDeg * Math.PI) / 180;
  }
  p.spinAngle = 0;
  planetMeshes.push(mesh);
  planetMeshes.push(system); // allow click hits on group children via recursive raycast
});

function setPlanetPosition(p, T){
  const h = heliocentric(p.key, T);
  const f = displayDistanceFromAU(h.r)/h.r;
  const target = p.system || p.mesh;
  target.position.set(h.x*f, h.z*f, h.y*f);
}
PLANETS.forEach(p => setPlanetPosition(p, nowT));

// =========================================================================
// MOONS — major real moons parented to their planets (approximate periods)
// =========================================================================
// Major moons — real diameters (km) & sidereal periods (days). Sources: NASA planetary fact sheets.
// radii/dists are display-scaled (much smaller & closer so they sit cleanly around parents).
// Moon catalog — diameters & sidereal periods from NASA Planetary Fact Sheets /
// JPL Solar System Dynamics. Display distances are compressed so moons sit close
// to their parents (true AU-scale separations are not legible in a single view).
// Moon catalog: NASA/JPL fact-sheet values + discovery metadata.
// dist = compressed display orbit (keeps moons readable next to parent sphere).
const MOONS = [
  // Earth radius ≈ 2.1 → Moon at ~2.7 (close companion)
  { parent:'earth', name:'Moon', radius:0.471, dist:1.85, periodDays:27.322, periodLabel:'27.3 days', diameterKm:3474, color:0xc8c4bc,
    discovered:'Prehistoric (known since antiquity)', discoverer:'—',
    fact:'Only natural satellite of Earth. Tidally locked — the same face always points toward us. Apollo 11 landed in 1969.' },
  // Mars radius ≈ 1.75 → Phobos/Deimos tight
  { parent:'mars', name:'Phobos', radius:0.028, dist:1.15, periodDays:0.319, periodLabel:'7.7 hours', diameterKm:22, color:0x9a8a78,
    discovered:'1877', discoverer:'Asaph Hall (USNO)',
    fact:'Orbits faster than Mars rotates, so it rises in the west and sets in the east. Spiraling inward; will eventually break up or impact Mars.' },
  { parent:'mars', name:'Deimos', radius:0.022, dist:1.45, periodDays:1.263, periodLabel:'1.26 days', diameterKm:12, color:0x8a7a6a,
    discovered:'1877', discoverer:'Asaph Hall (USNO)',
    fact:'Smaller, more distant Martian moon. From the surface of Mars it looks like a bright star.' },
  // Jupiter moons — display distance linear in real semi-major axis (NASA/JPL aKm)
  // Compress so Callisto sits near ~8.2 while ratios Io:Europa:Ganymede:Callisto match reality
  // Formula used after array: dist = jupiterLinearDist(aKm)
  { parent:'jupiter', name:'Metis', radius:0.022, dist:4.1, periodDays:0.2948, periodLabel:'7.07 hours', diameterKm:43, color:0x9a8a70,
    aKm:128000, e:0.001, iDeg:0.06, massKg:3.6e16,
    discovered:'1979', discoverer:'Synnott (Voyager 1)', fact:'Innermost known Jovian moon; orbits inside the main ring.' },
  { parent:'jupiter', name:'Adrastea', radius:0.02, dist:4.12, periodDays:0.2983, periodLabel:'7.16 hours', diameterKm:16, color:0x8a7a60,
    aKm:129000, e:0.002, iDeg:0.03, massKg:2e15,
    discovered:'1979', discoverer:'Jewitt / Danielson (Voyager 2)', fact:'Tiny inner moon that supplies dust to Jupiter\'s rings.' },
  { parent:'jupiter', name:'Amalthea', radius:0.035, dist:4.35, periodDays:0.498, periodLabel:'11.95 hours', diameterKm:167, color:0x8a6040,
    aKm:181400, e:0.003, iDeg:0.37, massKg:2.1e18,
    discovered:'1892', discoverer:'Edward Emerson Barnard', fact:'Largest of the inner moons; deep red color from sulfur. Barnard\'s last visual discovery of a moon.' },
  { parent:'jupiter', name:'Thebe', radius:0.028, dist:4.55, periodDays:0.6745, periodLabel:'16.19 hours', diameterKm:99, color:0x7a6850,
    aKm:221900, e:0.018, iDeg:1.08, massKg:4.3e17,
    discovered:'1979', discoverer:'Synnott (Voyager 1)', fact:'Irregular inner moon; contributes material to Jupiter\'s gossamer ring.' },
  { parent:'jupiter', name:'Io', radius:0.11, dist:5.2, periodDays:1.7691, periodLabel:'1.77 days', diameterKm:3643, color:0xd4b45a,
    aKm:421800, e:0.0041, iDeg:0.05, massKg:8.93e22, resonance:'Laplace 4:2:1 with Europa & Ganymede',
    discovered:'1610', discoverer:'Galileo Galilei',
    fact:'Most volcanically active world in the solar system. Tidal flexing from Jupiter pumps magma through hundreds of volcanoes.' },
  { parent:'jupiter', name:'Europa', radius:0.1, dist:5.95, periodDays:3.5512, periodLabel:'3.55 days', diameterKm:3122, color:0xc8d0e0,
    aKm:671100, e:0.009, iDeg:0.47, massKg:4.8e22, resonance:'Laplace 4:2:1',
    discovered:'1610', discoverer:'Galileo Galilei',
    fact:'Smooth ice shell over a global subsurface ocean — a top target in the search for life beyond Earth.' },
  { parent:'jupiter', name:'Ganymede', radius:0.125, dist:6.95, periodDays:7.1546, periodLabel:'7.15 days', diameterKm:5268, color:0xa09888,
    aKm:1070400, e:0.0013, iDeg:0.20, massKg:1.48e23, resonance:'Laplace 4:2:1',
    discovered:'1610', discoverer:'Galileo Galilei',
    fact:'Largest moon in the solar system (bigger than Mercury). Only moon known to have its own magnetic field.' },
  { parent:'jupiter', name:'Callisto', radius:0.115, dist:8.2, periodDays:16.689, periodLabel:'16.69 days', diameterKm:4821, color:0x6a6058,
    aKm:1882700, e:0.0074, iDeg:0.51, massKg:1.08e23,
    discovered:'1610', discoverer:'Galileo Galilei',
    fact:'Most heavily cratered large body known — its surface has barely been resurfaced for billions of years.' },
  { parent:'jupiter', name:'Himalia', radius:0.04, dist:9.0, periodDays:250.56, periodLabel:'250.6 days', diameterKm:170, color:0x8a8070,
    aKm:11461000, e:0.16, iDeg:27.5, massKg:6.7e18,
    discovered:'1904', discoverer:'Charles Dillon Perrine (Lick Observatory)',
    fact:'Largest irregular outer moon of Jupiter; leads the Himalia group of captured asteroids.' },
  { parent:'jupiter', name:'Elara', radius:0.03, dist:9.15, periodDays:259.64, periodLabel:'259.6 days', diameterKm:80, color:0x7a7060,
    aKm:11741000, e:0.22, iDeg:26.6, massKg:8.7e17,
    discovered:'1905', discoverer:'Charles Dillon Perrine', fact:'Member of the Himalia group of outer moons.' },
  { parent:'jupiter', name:'Pasiphae', radius:0.028, dist:9.45, periodDays:743.6, periodLabel:'743.6 days', diameterKm:58, color:0x6a6058,
    aKm:23624000, e:0.41, iDeg:151.4, massKg:3e17, retrograde:true,
    discovered:'1908', discoverer:'Philibert Jacques Melotte', fact:'Namesake of a large retrograde outer group of Jupiter moons.' },
  { parent:'jupiter', name:'Sinope', radius:0.024, dist:9.55, periodDays:758.9, periodLabel:'758.9 days', diameterKm:35, color:0x6a6050,
    aKm:23939000, e:0.25, iDeg:158.1, massKg:7.5e16, retrograde:true,
    discovered:'1914', discoverer:'Seth Barnes Nicholson', fact:'Outer retrograde moon; one of Nicholson\'s four Jovian discoveries.' },
  // Saturn — major moons just outside rings (ring outer ≈ 2.35×R ≈ 7.6)
  { parent:'saturn', name:'Mimas', radius:0.038, dist:8.0, periodDays:0.942, periodLabel:'22.6 hours', diameterKm:396, color:0xd0d0d0,
    discovered:'1789', discoverer:'William Herschel', fact:'Huge Herschel crater makes it look like the Death Star. Helps clear the Cassini Division.' },
  { parent:'saturn', name:'Enceladus', radius:0.042, dist:8.35, periodDays:1.370, periodLabel:'1.37 days', diameterKm:504, color:0xf0f4f8,
    discovered:'1789', discoverer:'William Herschel', fact:'South-polar water-ice geysers feed Saturn\'s E ring. Subsurface ocean is a prime astrobiology target.' },
  { parent:'saturn', name:'Tethys', radius:0.048, dist:8.7, periodDays:1.888, periodLabel:'1.89 days', diameterKm:1062, color:0xe8e8e0,
    discovered:'1684', discoverer:'Giovanni Domenico Cassini', fact:'Giant Ithaca Chasma canyon stretches ~3/4 of the way around the moon.' },
  { parent:'saturn', name:'Dione', radius:0.048, dist:9.05, periodDays:2.737, periodLabel:'2.74 days', diameterKm:1123, color:0xd8d4d0,
    discovered:'1684', discoverer:'Giovanni Domenico Cassini', fact:'Bright ice cliffs (\"wispy terrain\") on the trailing hemisphere.' },
  { parent:'saturn', name:'Rhea', radius:0.055, dist:9.5, periodDays:4.518, periodLabel:'4.52 days', diameterKm:1528, color:0xc8c4c0,
    discovered:'1672', discoverer:'Giovanni Domenico Cassini', fact:'Second-largest moon of Saturn; heavily cratered ice world.' },
  { parent:'saturn', name:'Titan', radius:0.12, dist:10.3, periodDays:15.945, periodLabel:'15.9 days', diameterKm:5150, color:0xd4a86a,
    discovered:'1655', discoverer:'Christiaan Huygens', fact:'Only moon with a thick atmosphere. Methane rivers and lakes — a weather cycle based on hydrocarbons.' },
  { parent:'saturn', name:'Hyperion', radius:0.032, dist:10.75, periodDays:21.28, periodLabel:'21.3 days', diameterKm:270, color:0xc0a888,
    discovered:'1848', discoverer:'William Cranch Bond / William Lassell', fact:'Chaotically rotating sponge-like ice moon near Titan.' },
  { parent:'saturn', name:'Iapetus', radius:0.055, dist:11.4, periodDays:79.33, periodLabel:'79.3 days', diameterKm:1470, color:0x8a7a68,
    discovered:'1671', discoverer:'Giovanni Domenico Cassini', fact:'Two-faced moon: dark Cassini Regio vs bright ice. Unique equatorial ridge ~20 km high. Discovered 1671 by G.D. Cassini.' },
  { parent:'saturn', name:'Phoebe', radius:0.032, dist:12.1, periodDays:550.3, periodLabel:'550 days', diameterKm:213, color:0x4a4038,
    discovered:'1899', discoverer:'William Henry Pickering', fact:'Retrograde outer moon; likely a captured Kuiper-belt object. Source of the dark material on Iapetus.' },
  // Uranus
  { parent:'uranus', name:'Miranda', radius:0.04, dist:2.2, periodDays:1.413, periodLabel:'1.41 days', diameterKm:472, color:0xc0c8d0,
    discovered:'1948', discoverer:'Gerard Kuiper', fact:'Extreme geology: giant fault canyons up to 20 km deep — among the tallest cliffs in the solar system.' },
  { parent:'uranus', name:'Ariel', radius:0.05, dist:2.55, periodDays:2.520, periodLabel:'2.52 days', diameterKm:1158, color:0xb8c0c8,
    discovered:'1851', discoverer:'William Lassell', fact:'Brightest major Uranian moon; young surfaces and rift valleys.' },
  { parent:'uranus', name:'Umbriel', radius:0.05, dist:2.9, periodDays:4.144, periodLabel:'4.14 days', diameterKm:1169, color:0x707880,
    discovered:'1851', discoverer:'William Lassell', fact:'Darkest major Uranian moon; ancient cratered surface.' },
  { parent:'uranus', name:'Titania', radius:0.065, dist:3.3, periodDays:8.706, periodLabel:'8.7 days', diameterKm:1578, color:0xb0c0c8,
    discovered:'1787', discoverer:'William Herschel', fact:'Largest moon of Uranus; huge fault systems from past expansion.' },
  { parent:'uranus', name:'Oberon', radius:0.06, dist:3.7, periodDays:13.46, periodLabel:'13.5 days', diameterKm:1523, color:0x9098a0,
    discovered:'1787', discoverer:'William Herschel', fact:'Outermost major Uranian moon; old, cratered ice-rock mix.' },
  // Neptune
  { parent:'neptune', name:'Proteus', radius:0.04, dist:2.15, periodDays:1.122, periodLabel:'1.12 days', diameterKm:420, color:0x6a7078,
    discovered:'1989', discoverer:'Voyager 2 (Stephen Synnott)', fact:'Second-largest Neptunian moon; irregular shape just under the hydrostatic-equilibrium limit.' },
  { parent:'neptune', name:'Triton', radius:0.09, dist:2.7, periodDays:5.877, periodLabel:'5.88 days', diameterKm:2707, color:0x90a0b0,
    discovered:'1846', discoverer:'William Lassell', fact:'Retrograde — almost certainly a captured Kuiper-belt object. Active nitrogen geysers.' },
  { parent:'neptune', name:'Nereid', radius:0.035, dist:3.6, periodDays:360.1, periodLabel:'360 days', diameterKm:340, color:0x808890,
    discovered:'1949', discoverer:'Gerard Kuiper', fact:'Most eccentric moon orbit known (e ≈ 0.75); distance varies by a factor of ~7.' },
];

// Additional irregular / small moons (NASA/JPL names). Display orbits compressed.
// Placeholder API layer stores discovery metadata for HUD; live endpoints optional.
(function addMoreMoons(){
  const jupOuter = [
    {n:'Lysithea', p:259, d:62, y:1938, by:'Nicholson'},
    {n:'Carme', p:734, d:46, y:1938, by:'Nicholson'},
    {n:'Ananke', p:630, d:28, y:1951, by:'Nicholson'},
    {n:'Leda', p:241, d:20, y:1974, by:'Kowal'},
    {n:'Callirrhoe', p:759, d:9, y:2000, by:'Spacewatch'},
    {n:'Themisto', p:130, d:9, y:2000, by:'Sheppard et al.'},
    {n:'Megaclite', p:753, d:5, y:2001, by:'Sheppard et al.'},
    {n:'Taygete', p:732, d:5, y:2001, by:'Sheppard et al.'},
    {n:'Chaldene', p:724, d:4, y:2001, by:'Sheppard et al.'},
    {n:'Harpalyke', p:623, d:4, y:2001, by:'Sheppard et al.'},
    {n:'Kalyke', p:743, d:5, y:2001, by:'Sheppard et al.'},
    {n:'Iocaste', p:632, d:5, y:2001, by:'Sheppard et al.'},
    {n:'Erinome', p:728, d:3, y:2001, by:'Sheppard et al.'},
    {n:'Isonoe', p:726, d:4, y:2001, by:'Sheppard et al.'},
    {n:'Praxidike', p:625, d:7, y:2001, by:'Sheppard et al.'},
    {n:'Autonoe', p:761, d:4, y:2002, by:'Sheppard et al.'},
    {n:'Thyone', p:627, d:4, y:2002, by:'Sheppard et al.'},
    {n:'Hermippe', p:634, d:4, y:2002, by:'Sheppard et al.'},
    {n:'Aitne', p:730, d:3, y:2002, by:'Sheppard et al.'},
    {n:'Eurydome', p:717, d:3, y:2002, by:'Sheppard et al.'},
    {n:'Euanthe', p:621, d:3, y:2002, by:'Sheppard et al.'},
    {n:'Euporie', p:551, d:2, y:2002, by:'Sheppard et al.'},
    {n:'Orthosie', p:623, d:2, y:2002, by:'Sheppard et al.'},
    {n:'Sponde', p:749, d:2, y:2002, by:'Sheppard et al.'},
    {n:'Kale', p:730, d:2, y:2002, by:'Sheppard et al.'},
    {n:'Pasithee', p:719, d:2, y:2002, by:'Sheppard et al.'},
    {n:'Hegemone', p:740, d:3, y:2003, by:'Sheppard et al.'},
    {n:'Mneme', p:620, d:2, y:2003, by:'Sheppard et al.'},
    {n:'Aoede', p:762, d:4, y:2003, by:'Sheppard et al.'},
    {n:'Thelxinoe', p:628, d:2, y:2004, by:'Sheppard et al.'},
    {n:'Arche', p:724, d:3, y:2002, by:'Sheppard et al.'},
    {n:'Kallichore', p:745, d:2, y:2003, by:'Sheppard et al.'},
    {n:'Helike', p:635, d:4, y:2003, by:'Sheppard et al.'},
    {n:'Carpo', p:456, d:3, y:2003, by:'Sheppard et al.'},
    {n:'Eukelade', p:735, d:4, y:2003, by:'Sheppard et al.'},
    {n:'Cyllene', p:738, d:2, y:2003, by:'Sheppard et al.'},
    {n:'Kore', p:779, d:2, y:2003, by:'Sheppard et al.'},
    {n:'Herse', p:715, d:2, y:2003, by:'Sheppard et al.'},
    {n:'Dia', p:287, d:4, y:2001, by:'Sheppard et al.'},
    {n:'Eirene', p:760, d:4, y:2003, by:'Sheppard et al.'},
    {n:'Philophrosyne', p:690, d:2, y:2003, by:'Sheppard et al.'},
    {n:'Eupheme', p:628, d:2, y:2003, by:'Sheppard et al.'},
    {n:'Valetudo', p:533, d:1, y:2016, by:'Sheppard et al.'}
  ];
  jupOuter.forEach(function(o, i){
    MOONS.push({
      parent:'jupiter', name:o.n, radius:0.012+((i%4)*0.002),
      dist: 8.6 + i*0.045,
      periodDays: o.p, periodLabel: o.p + ' days',
      diameterKm: Math.max(1, o.d), color:0x7a7068,
      discovered: String(o.y), discoverer: o.by,
      fact: 'Irregular outer moon of Jupiter (NASA/JPL). Display orbit compressed for visibility.'
    });
  });
  // Extra Jupiter moons — aim for ~80+ on-screen (named + provisional designations)
  const jupExtra = [
    'S/2003 J2','S/2003 J3','S/2003 J4','S/2003 J5','S/2003 J9','S/2003 J10',
    'S/2003 J12','S/2003 J15','S/2003 J16','S/2003 J18','S/2003 J19','S/2003 J23',
    'S/2010 J1','S/2010 J2','S/2011 J1','S/2011 J2','S/2016 J1','S/2017 J1',
    'S/2017 J2','S/2017 J3','S/2017 J5','S/2017 J6','S/2017 J7','S/2017 J8','S/2017 J9',
    'S/2018 J1','S/2018 J2','S/2018 J3','S/2018 J4','Jupiter LXI','Jupiter LXII',
    'S/2011 J3','S/2016 J2','S/2016 J3','S/2016 J4','S/2017 J4','S/2017 J10',
    'S/2018 J5','S/2018 J6','S/2018 J7','S/2018 J8','S/2018 J9','S/2018 J10',
    'S/2021 J1','S/2021 J2','S/2021 J3','S/2021 J4','S/2021 J5','S/2021 J6',
    'S/2022 J1','S/2022 J2','S/2022 J3'
  ];
  jupExtra.forEach(function(name, i){
    MOONS.push({
      parent:'jupiter', name:name, radius:0.01+((i%3)*0.0015),
      dist: 10.4 + i*0.04,
      periodDays: 540+i*11, periodLabel: '~'+(540+i*11)+' days',
      diameterKm: 1+((i*2)%10), color:0x6a6058,
      discovered: '2003–2022 surveys', discoverer: 'Sheppard / Gladman et al.',
      fact: 'Small irregular outer moon of Jupiter (IAU / NASA).'
    });
  });
  const satOuter = [
    'Janus','Epimetheus','Prometheus','Pandora','Atlas','Pan','Telesto','Calypso','Helene','Polydeuces',
    'Methone','Anthe','Pallene','Aegaeon','Kiviuq','Ijiraq','Paaliaq','Albiorix','Siarnaq','Tarvos',
    'Ymir','Mundilfari','Narvi','Bestla','Bergelmir','Farbauti','Fornjot','Hati','Hyrrokkin','Kari',
    'Loge','Skoll','Surtur','Jarnsaxa','Greip','Tarqeq','Aegir','Bebhionn','Fenrir','Skathi',
    'Thrymr','Gridr','Angrboda','Beli','Eggther','Gerd','Gunnlod','Skrymir','Suttungr','Thiazzi',
    'Alvaldi','Geirrod','S/2004 S7','S/2004 S12','S/2004 S13','S/2004 S17','S/2006 S1','S/2006 S3',
    'S/2007 S2','S/2007 S3','S/2009 S1','S/2019 S1','S/2020 S1','S/2020 S2',
    'S/2004 S21','S/2004 S24','S/2004 S28','S/2004 S31','S/2004 S36','S/2004 S37',
    'S/2004 S39','S/2006 S5','S/2006 S6','S/2006 S7','S/2006 S8','S/2006 S9',
    'S/2007 S5','S/2007 S6','S/2007 S7','S/2007 S8','S/2007 S9','S/2019 S2',
    'S/2019 S3','S/2019 S4','S/2019 S5','S/2019 S6','S/2019 S7','S/2020 S3',
    'S/2020 S4','S/2020 S5','S/2020 S6','S/2020 S7'
  ];
  satOuter.forEach(function(name, i){
    MOONS.push({
      parent:'saturn', name:name, radius:0.011+((i%4)*0.0015),
      dist: 12.3 + i*0.035,
      periodDays: 45+i*14, periodLabel: '~'+(45+i*14)+' days',
      diameterKm: 2+((i*3)%30), color:0x9a9080,
      discovered: i < 6 ? '1980 (Voyager 1)' : '2000–2020 surveys',
      discoverer: i < 6 ? 'Voyager / Earth-based' : 'Cassini / ground surveys',
      fact: 'Named or provisional moon of Saturn (NASA/JPL). Orbit outside the rings.'
    });
  });
  const uraOuter = ['Puck','Belinda','Rosalind','Portia','Juliet','Cressida','Desdemona','Bianca','Ophelia','Cordelia','Cupid','Mab','Margaret','Francisco','Ferdinand','Perdita','Setebos','Prospero','Sycorax','Caliban','Stephano','Trinculo'];
  uraOuter.forEach(function(name, i){
    MOONS.push({
      parent:'uranus', name:name, radius:0.018, dist:3.9+i*0.1,
      periodDays: 0.5+i*0.45, periodLabel: '~'+(0.5+i*0.45).toFixed(1)+' days',
      diameterKm: 18+i*8, color:0x889098,
      discovered: i < 10 ? '1986 (Voyager 2)' : '1997–2003',
      discoverer: i < 10 ? 'Voyager 2' : 'Gladman / Kavelaars et al.',
      fact: 'Moon of Uranus (NASA/JPL).'
    });
  });
  const nepOuter = ['Larissa','Galatea','Despina','Thalassa','Naiad','Halimede','Sao','Laomedeia','Psamathe','Neso','Hippocamp'];
  nepOuter.forEach(function(name, i){
    MOONS.push({
      parent:'neptune', name:name, radius:0.016, dist:2.0+i*0.12,
      periodDays: 0.3+i*0.3, periodLabel: '~'+(0.3+i*0.3).toFixed(1)+' days',
      diameterKm: 16+i*10, color:0x6a7888,
      discovered: i < 5 ? '1989 (Voyager 2)' : '2002–2013',
      discoverer: i < 5 ? 'Voyager 2' : 'Holman / Showalter et al.',
      fact: 'Moon of Neptune (NASA/JPL).'
    });
  });
})();

// Moon data API: embedded NASA/JPL fact-sheet + optional live endpoint
const MOON_API_DATA = {
  'Moon': { albedo:0.12, surfaceGravity:1.62, meanTempC:-20, textureHint:'lunar' },
  'Phobos': { albedo:0.07, surfaceGravity:0.0057, meanTempC:-40, textureHint:'rocky' },
  'Deimos': { albedo:0.07, surfaceGravity:0.003, meanTempC:-40, textureHint:'rocky' },
  'Io': { albedo:0.63, surfaceGravity:1.80, meanTempC:-130, textureHint:'volcanic' },
  'Europa': { albedo:0.67, surfaceGravity:1.31, meanTempC:-160, textureHint:'ice' },
  'Ganymede': { albedo:0.43, surfaceGravity:1.43, meanTempC:-160, textureHint:'ice' },
  'Callisto': { albedo:0.22, surfaceGravity:1.24, meanTempC:-140, textureHint:'ice' },
  'Titan': { albedo:0.22, surfaceGravity:1.35, meanTempC:-180, textureHint:'haze' },
  'Enceladus': { albedo:0.99, surfaceGravity:0.11, meanTempC:-200, textureHint:'ice' },
  'Triton': { albedo:0.76, surfaceGravity:0.78, meanTempC:-235, textureHint:'ice' },
  'Mimas': { albedo:0.6, surfaceGravity:0.06, meanTempC:-200, textureHint:'ice' },
  'Rhea': { albedo:0.95, surfaceGravity:0.26, meanTempC:-174, textureHint:'ice' },
  'Iapetus': { albedo:0.05, surfaceGravity:0.22, meanTempC:-143, textureHint:'twoface' }
};
const MOON_API = {
  // Optional live endpoint (e.g. a self-hosted JSON). Null = offline embedded only.
  endpoint: null,
  getLocal(name){
    const row = MOON_API_DATA[name];
    const m = MOONS.find(function(x){ return x.name === name; });
    if(!m && !row) return null;
    return Object.assign({
      name: name,
      diameterKm: m && m.diameterKm,
      periodDays: m && m.periodDays,
      discovered: m && m.discovered,
      discoverer: m && m.discoverer,
      fact: m && m.fact,
      aKm: m && m.aKm,
      e: m && m.e,
      iDeg: m && m.iDeg,
      massKg: m && m.massKg
    }, row || {});
  },
  async fetchMoon(name){
    const local = this.getLocal(name);
    if(!this.endpoint) return local;
    try {
      const r = await fetch(this.endpoint + encodeURIComponent(name));
      if(!r.ok) throw new Error('HTTP ' + r.status);
      return Object.assign({}, local || {}, await r.json());
    } catch(e){
      console.warn('[MOON_API] live fetch failed, using embedded data', name, e.message);
      return local;
    }
  }
};

// Equirectangular (2:1) crater maps — full sphere coverage (no half-blank moons)
function makeMoonTexture(hexColor){
  const w=1024, h=512;
  const cnv=document.createElement('canvas'); cnv.width=w; cnv.height=h;
  const ctx=cnv.getContext('2d');
  const r=(hexColor>>16)&255, g=(hexColor>>8)&255, b=hexColor&255;
  // Horizontal bands so longitude wraps cleanly around the sphere
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgb('+Math.max(0,r-30)+','+Math.max(0,g-28)+','+Math.max(0,b-22)+')');
  grad.addColorStop(0.5, 'rgb('+r+','+g+','+b+')');
  grad.addColorStop(1, 'rgb('+Math.max(0,r-30)+','+Math.max(0,g-28)+','+Math.max(0,b-22)+')');
  ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);
  // Mare / dark plains across full width
  for(let i=0;i<14;i++){
    const x=Math.random()*w, y=Math.random()*h, rad=30+Math.random()*70;
    ctx.beginPath(); ctx.ellipse(x,y,rad*1.4,rad*0.7,0,0,Math.PI*2);
    ctx.fillStyle='rgba('+(r*0.5|0)+','+(g*0.5|0)+','+(b*0.5|0)+',0.4)';
    ctx.fill();
  }
  // Procedural crater field (power-law sizes, bowl+rim+ejecta)
  if(typeof stampCraterField === 'function'){
    stampCraterField(ctx, w, h, 40, 100);
  } else {
    for(let i=0;i<180;i++){
      const x=Math.random()*w, y=Math.random()*h, rad=1.5+Math.random()*16;
      const shade=0.45+Math.random()*0.4;
      ctx.beginPath(); ctx.arc(x,y,rad,0,Math.PI*2);
      ctx.fillStyle='rgba('+(r*shade|0)+','+(g*shade|0)+','+(b*shade|0)+',0.75)';
      ctx.fill();
    }
  }
  for(let i=0;i<240;i++){
    ctx.fillStyle='rgba(255,255,255,'+(0.03+Math.random()*0.1)+')';
    ctx.fillRect(Math.random()*w, Math.random()*h, 1+Math.random()*4, 1);
  }
  const tex=new THREE.CanvasTexture(cnv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = Math.min(4, maxAnisotropy||1);
  tex.needsUpdate = true;
  return tex;
}

const moonMeshes = [];
// Earth's Moon photographic map (jsDelivr 2K)
const sharedMoonMap = loadColorTexture('moon', null, 0xc8c4bc);

// Body-specific tinted maps for major moons (photo base + color grade)
function makeTypedMoonMap(hexColor, hint){
  const base = makeMoonTexture(hexColor);
  // Extra visual cues by type
  try {
    const img = base.image;
    if(img && img.getContext){
      const ctx = img.getContext('2d');
      if(hint === 'volcanic'){
        ctx.fillStyle = 'rgba(220,80,20,0.12)';
        for(let i=0;i<40;i++){ ctx.beginPath(); ctx.arc(Math.random()*img.width, Math.random()*img.height, 2+Math.random()*8, 0, 7); ctx.fill(); }
      } else if(hint === 'ice'){
        // Bright icy crust + subtle blue-white streaks (Uranian/Neptunian moons)
        ctx.fillStyle = 'rgba(210,230,250,0.22)';
        ctx.fillRect(0,0,img.width,img.height);
        for(let i=0;i<80;i++){
          const x=Math.random()*img.width, y=Math.random()*img.height;
          ctx.strokeStyle = 'rgba(255,255,255,'+(0.08+Math.random()*0.2)+')';
          ctx.lineWidth = 1+Math.random()*2;
          ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+20+Math.random()*40,y+Math.random()*6-3); ctx.stroke();
        }
        // Darker crater floors
        for(let i=0;i<60;i++){
          const x=Math.random()*img.width, y=Math.random()*img.height, r=2+Math.random()*12;
          ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
          ctx.fillStyle='rgba(40,50,70,0.25)'; ctx.fill();
        }
      } else if(hint === 'haze'){
        ctx.fillStyle = 'rgba(200,150,80,0.2)';
        ctx.fillRect(0,0,img.width,img.height);
      } else if(hint === 'twoface'){
        // Iapetus: Cassini Regio (dark) vs bright icy trailing side + equatorial ridge
        const w = img.width, h = img.height;
        // Dark leading hemisphere (~albedo 0.05) — Cassini Regio
        const dark = ctx.createLinearGradient(0,0,w*0.55,0);
        dark.addColorStop(0, 'rgba(15,12,10,0.72)');
        dark.addColorStop(0.85, 'rgba(25,20,16,0.55)');
        dark.addColorStop(1, 'rgba(25,20,16,0)');
        ctx.fillStyle = dark;
        ctx.fillRect(0,0,w*0.55,h);
        // Bright trailing ice (~albedo 0.5)
        ctx.fillStyle = 'rgba(220,215,205,0.25)';
        ctx.fillRect(w*0.5,0,w*0.5,h);
        // Equatorial ridge (unique to Iapetus — up to 20 km high)
        ctx.fillStyle = 'rgba(180,170,160,0.35)';
        ctx.fillRect(0, h*0.48, w, h*0.04);
        // Craters on both faces
        for(let i=0;i<40;i++){
          const x=Math.random()*w, y=Math.random()*h, r=2+Math.random()*10;
          ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
          ctx.fillStyle = x < w*0.5 ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.12)';
          ctx.fill();
        }
      }
      base.needsUpdate = true;
    }
  } catch(e){}
  return base;
}

focusedMoon = null;
const _moonWorld = new THREE.Vector3();

// Gravitational constant in display units (tuned so circular orbits match periodDays)
// For circular orbit: v = 2π r / T , GM = v² r = 4π² r³ / T²
function moonGM(m){
  const r = m.dist;
  const T = Math.max(0.05, m.periodDays);
  return 4 * Math.PI * Math.PI * r * r * r / (T * T);
}

// Map real Jupiter moon a (km) → display distance, linear in semi-major axis
// Jupiter R ≈ 69911 km. Compress so Callisto (26.9 Rj) lands near ~8.2 display units.
(function applyJupiterLinearDistances(){
  const JUP_R_KM = 69911;
  const CALLISTO_A = 1882700;
  const jup = PLANETS.find(function(p){ return p.key === 'jupiter'; });
  const R = jup ? jup.displayRadius : 6.7;
  // Callisto at ~2.8 R so Galileans sit clearly outside the planet
  const callistoTarget = R * 2.85;
  const compress = callistoTarget / (CALLISTO_A / JUP_R_KM);
  const table = {
    Metis: 128000, Adrastea: 129000, Amalthea: 181400, Thebe: 221900,
    Io: 421800, Europa: 671100, Ganymede: 1070400, Callisto: 1882700,
    Himalia: 11461000, Elara: 11741000, Pasiphae: 23624000, Sinope: 23939000
  };
  MOONS.forEach(function(m){
    if(m.parent !== 'jupiter') return;
    const aKm = m.aKm || table[m.name];
    if(aKm){
      const aRj = aKm / JUP_R_KM;
      m.dist = Math.max(R + m.radius + 0.8, aRj * compress);
    } else {
      m.dist = Math.max(R + m.radius + 1.2, m.dist || R * 1.5);
    }
  });
})();

// Outer ring factor — moons stay outside ring mesh (Jupiter rings are thin; keep Galileans readable)
const RING_OUTER_FACTOR = {
  saturn: 2.40,  // just beyond F-ring
  jupiter: 1.35, // main ring only — Galileans stay at designed distances
  uranus: 2.0,
  neptune: 1.8
};
// Inner moons allowed slightly inside faint ring envelope when flagged
const INNER_RING_MOONS = { Metis:1, Adrastea:1, Amalthea:1, Thebe:1, Pan:1, Atlas:1, Prometheus:1, Pandora:1 };


// Keep moons outside enlarged linear planet radii + rings
(function rescaleMoonDistances(){
  MOONS.forEach(function(m){
    const parent = PLANETS.find(function(p){ return p.key === m.parent; });
    if(!parent) return;
    const R = parent.displayRadius;
    const ringF = (typeof RING_OUTER_FACTOR !== 'undefined' && RING_OUTER_FACTOR[parent.key]) ? RING_OUTER_FACTOR[parent.key] : 1.15;
    const minDist = Math.max(R + (m.radius || 0.05) + 0.6, R * ringF + 0.3);
    if(!(m.dist > minDist)) m.dist = minDist + (m.periodDays ? Math.min(8, m.periodDays * 0.04) : 0.5);
    if(parent.key === 'earth' && m.name === 'Moon') m.dist = Math.max(R + 1.8, m.dist);
    if(parent.key === 'saturn'){
      // Titan and major moons outside rings (~2.4 R)
      const satMin = R * 2.45 + (m.radius || 0.05);
      if(m.dist < satMin) m.dist = satMin + (m.name === 'Titan' ? 2.5 : (m.periodDays || 5) * 0.08);
    }
  });
})();

MOONS.forEach(m => {
  const parent = PLANETS.find(pp => pp.key === m.parent);
  if(!parent) return;
  if(INNER_RING_MOONS[m.name]){
    // Keep just outside planet surface
    const minDist = parent.displayRadius + m.radius + 0.35;
    if(m.dist < minDist) m.dist = minDist;
  } else {
    const ringOuter = parent.displayRadius * (RING_OUTER_FACTOR[parent.key] || 1.0);
    const minDist = Math.max(parent.displayRadius + m.radius + 0.55, ringOuter + m.radius + 0.35);
    if(m.dist < minDist) m.dist = minDist;
  }
  const segs = m.radius > 0.08 ? 64 : (m.radius > 0.04 ? 40 : 24);
  const geo = new THREE.SphereGeometry(m.radius, segs, segs);
  const apiRow = MOON_API_DATA[m.name];
  const hint = (apiRow && apiRow.textureHint) || (m.name === 'Titan' ? 'haze' : (m.radius >= 0.08 ? 'ice' : 'rocky'));
  // Placeholder until NASA archive loads
  let moonMap;
  if(m.name === 'Moon'){
    moonMap = sharedMoonMap || makeMoonTexture(0xc8c4bc);
  } else if(m.radius >= 0.05){
    moonMap = makeTypedMoonMap(m.color, hint);
  } else {
    moonMap = makeMoonTexture(m.color);
  }
  // All moons: Lambert + emissive fill so the FULL texture stays visible
  // (Phong/Standard leave the night hemisphere black under a single sun light)
  const isLuna = m.name === 'Moon';
  const iceLike = hint === 'ice' || m.parent === 'uranus' || m.parent === 'neptune';
  const fill = new THREE.Color(m.color || 0xa0a8b0);
  fill.r = Math.min(1, fill.r * 0.55 + 0.2);
  fill.g = Math.min(1, fill.g * 0.55 + 0.2);
  fill.b = Math.min(1, fill.b * 0.55 + 0.22);
  let mat = new THREE.MeshLambertMaterial({
    map: moonMap,
    color: 0xffffff,
    emissive: fill,
    emissiveIntensity: (m.name === "Titan" ? 0.45 : (iceLike ? 0.55 : 0.48))
  });
  if(isLuna){
    loadColorTexture('moon', function(tex){
      if(!tex) return;
      tex.encoding = THREE.sRGBEncoding;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      mat.map = tex;
      mat.emissive.setHex(0x4a4844);
      mat.emissiveIntensity = 0.48;
      mat.needsUpdate = true;
    }, 0xc8c4bc);
    if(typeof loadMoonArchiveTexture === 'function'){
      loadMoonArchiveTexture('Moon', function(tex){
        if(!tex) return;
        tex.encoding = THREE.sRGBEncoding;
        mat.map = tex;
        mat.needsUpdate = true;
      });
    }
  } else if(typeof loadMoonArchiveTexture === 'function'){
    loadMoonArchiveTexture(m.name, function(tex){
      if(!tex) return;
      tex.encoding = THREE.sRGBEncoding;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      mat.map = tex;
      mat.color.setHex(0xffffff);
      mat.emissive.copy(fill);
      mat.emissiveIntensity = iceLike ? 0.58 : 0.5;
      mat.needsUpdate = true;
    });
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.moon = m;
  mesh.userData.isMoon = true;
  // Larger hit radius for easier clicking (invisible proxy)
  mesh.raycast = mesh.raycast; // keep default
  (parent.system || parent.mesh).add(mesh);
  // Invisible larger hit sphere for small moons
  if(m.radius < 0.08){
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(0.18, m.radius * 3.5), 8, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.userData.moon = m;
    hit.userData.isMoon = true;
    mesh.add(hit);
  }
  m.mesh = mesh;
  m.parentPlanet = parent;
  m.angle0 = Math.random()*Math.PI*2;
  m.inc0 = 0.02 + (m.radius < 0.05 ? 0.05*Math.sin(m.angle0) : 0.012);
  // Initialize gravitational state (parent-local coords)
  const ang = m.angle0;
  const x = Math.cos(ang) * m.dist;
  const y = Math.sin(ang) * m.inc0 * m.dist;
  const z = Math.sin(ang) * m.dist;
  m.pos = new THREE.Vector3(x, y, z);
  // Circular-orbit velocity perpendicular to radius in XZ, with small vertical component
  const speed = (2 * Math.PI * m.dist) / Math.max(0.05, m.periodDays); // display-units per day
  m.vel = new THREE.Vector3(-Math.sin(ang) * speed, 0, Math.cos(ang) * speed);
  m.gm = moonGM(m);
  mesh.position.copy(m.pos);
  moonMeshes.push(mesh);

  // Orbit path only for a few flagship moons — avoids clumped rings around gas giants
  const ORBIT_LINE_MOONS = {
    Moon:1, Io:1, Europa:1, Ganymede:1, Callisto:1,
    Titan:1, Triton:1, Phobos:1
  };
  if(ORBIT_LINE_MOONS[m.name]){
    const segsO = 64;
    const opts = [];
    for(let i=0;i<=segsO;i++){
      const a = (i/segsO)*Math.PI*2;
      opts.push(new THREE.Vector3(Math.cos(a)*m.dist, Math.sin(a)*m.inc0*m.dist*0.35, Math.sin(a)*m.dist));
    }
    const oGeo = new THREE.BufferGeometry().setFromPoints(opts);
    const oMat = new THREE.LineBasicMaterial({
      color: 0xc9a227, transparent:true, opacity:0.28
    });
    const oLine = new THREE.LineLoop(oGeo, oMat);
    (parent.system || parent.mesh).add(oLine);
    m.orbitLine = oLine;
  }
});

// Keplerian moon motion (primary) + optional soft n-body for large siblings
const GRAVITY_ENABLED = true;
// Kepler's laws for moon orbits:
// 1) Elliptical path with parent at one focus (via e, true anomaly)
// 2) Equal areas in equal times (encoded in mean anomaly advance ∝ time)
// 3) Period² ∝ a³ — we use published sidereal periodDays (already satisfies this)
function updateMoons(simDays){
  if(typeof updateMoons._last === 'undefined') updateMoons._last = simDays;
  let dtDays = simDays - updateMoons._last;
  updateMoons._last = simDays;
  if(!isFinite(dtDays) || Math.abs(dtDays) > 30) dtDays = 0;

  // Laplace resonance: Io:Europa:Ganymede mean-motion ≈ 4:2:1
  const laplacePhase = { Io: 0, Europa: Math.PI * 0.5, Ganymede: Math.PI };

  MOONS.forEach(function(m){
    if(!m.mesh || !m.pos) return;
    // Keplerian elements (small e for nearly circular display orbits)
    const e = (m.e != null) ? Math.min(0.25, m.e) : 0.008;
    const iDeg = (m.iDeg != null) ? m.iDeg : ((m.inc0 || 0.02) * 180 / Math.PI);
    const node = (m.angle0 || 0) * 180 / Math.PI;
    const peri = node + (m.w0 || 20);
    // Mean motion n = 360° / period  (Kepler 2nd law via uniform M advance)
    let Mdeg = ((simDays / Math.max(0.01, m.periodDays)) * 360 + (m.angle0 || 0) * 180 / Math.PI) % 360;
    if(laplacePhase[m.name] != null){
      Mdeg = (Mdeg + laplacePhase[m.name] * 180 / Math.PI) % 360;
    }
    if(m.retrograde) Mdeg = (360 - (Mdeg % 360)) % 360;

    // True anomaly solved inside keplerianXYZ (Newton–Raphson on Kepler's equation)
    const iScale = Math.min(12, Math.abs(iDeg)) * 0.12; // readable tilt, still proportional
    const st = keplerianXYZ(m.dist, e, iScale, node, peri, Mdeg);
    m.pos.set(st.x, st.z, st.y);

    m.mesh.position.copy(m.pos);
    // Slow axial spin (tidally locked moons would face parent; approximate)
    if(m.name === 'Moon' || m.radius >= 0.08){
      m.mesh.rotation.y = (Mdeg * Math.PI / 180) * (m.retrograde ? -1 : 1);
    } else {
      m.mesh.rotation.y += 0.002;
    }
  });
}


// Lunar surface observation — stand on the Moon and see the night sky
moonSurfaceActive = false;

// =========================================================================
// MARS ATMOSPHERIC ENTRY SEQUENCE (educational EDL)
// =========================================================================
let marsEntryActive = false;
let marsEntryRaf = 0;
function startMarsEntrySequence(){
  const mars = PLANETS.find(function(pp){ return pp.key === 'mars'; });
  if(!mars) return;
  marsEntryActive = true;
  focusedPlanet = mars;
  focusedMoon = null;
  focusedDwarf = null;
  document.getElementById('hud').classList.remove('open');

  const cap = document.getElementById('teleport-caption');
  const stages = [
    { t:0,    msg:'Approach — cruise stage jettisoned ·  entry interface ~125 km' },
    { t:2.2,  msg:'Entry — hypersonic plasma blackout · peak heating' },
    { t:4.5,  msg:'Parachute deploy — ~Mach 1.7 · heat shield jettison' },
    { t:7.0,  msg:'Powered descent — retro rockets · sky crane / landing legs' },
    { t:9.5,  msg:'Touchdown — wheels on Mars · EDL complete' }
  ];
  let stageIdx = 0;
  if(cap){ cap.textContent = stages[0].msg; cap.classList.add('show'); }

  // Camera starts high above Mars, dives toward surface
  const pos = (mars.system || mars.mesh).position.clone();
  const R = mars.displayRadius;
  camTarget.copy(pos);
  desiredDistance = R * 12;
  camDistance = desiredDistance;
  camPhi = 0.55;
  startCameraTween({
    target: pos.clone(),
    distance: R * 12,
    phi: 0.55,
    duration: 0.8
  });

  const t0 = performance.now();
  const duration = 11000;
  function tick(now){
    if(!marsEntryActive) return;
    const elapsed = (now - t0) / 1000;
    // Advance stage captions
    while(stageIdx < stages.length - 1 && elapsed >= stages[stageIdx + 1].t){
      stageIdx++;
      if(cap){ cap.textContent = stages[stageIdx].msg; cap.classList.add('show'); }
    }
    // Ease camera from high altitude to near surface
    const u = Math.min(1, elapsed / (duration/1000));
    const ease = u * u * (3 - 2 * u);
    desiredDistance = R * 12 * (1 - ease) + R * 2.4 * ease;
    camDistance = desiredDistance;
    camPhi = 0.55 + ease * 0.5;
    camTarget.copy(pos);
    updateCameraPosition();

    // Simple plasma / atmosphere glow on Mars mesh during peak heating
    if(mars.mesh && mars.mesh.material){
      const heat = Math.sin(Math.min(1, Math.max(0, (elapsed - 1.5) / 3)) * Math.PI);
      if(mars.mesh.material.emissive){
        mars.mesh.material.emissive.setRGB(0.4 * heat, 0.12 * heat, 0.02 * heat);
        mars.mesh.material.emissiveIntensity = 0.15 + heat * 0.85;
      }
    }

    if(elapsed < duration/1000){
      marsEntryRaf = requestAnimationFrame(tick);
    } else {
      marsEntryActive = false;
      if(mars.mesh && mars.mesh.material && mars.mesh.material.emissive){
        mars.mesh.material.emissiveIntensity = 0.12;
        mars.mesh.material.emissive.setHex(mars.emissive || 0x1f0d05);
      }
      if(cap){
        cap.textContent = 'On the surface of Mars — drag to orbit · open HUD for rovers';
        setTimeout(function(){ cap.classList.remove('show'); }, 3500);
      }
      // Open Mars HUD with rover panel
      if(typeof selectPlanet === 'function') selectPlanet('mars');
    }
  }
  marsEntryRaf = requestAnimationFrame(tick);
}
function cancelMarsEntry(){
  marsEntryActive = false;
  if(marsEntryRaf) cancelAnimationFrame(marsEntryRaf);
}

function startMoonSurfaceView(){
  // Surface teleport to the Moon removed per request.
  console.info("[NCGSA] Moon surface teleport is disabled.");
}


// =========================================================================
// RECOVERY APPENDIX — belts, dwarfs, UI, camera, animate
// =========================================================================

focusedDwarf = null;
var majorAsteroidMeshes = [];

// Soft belt particle field
// softDotTex already defined earlier

function buildBelt(innerAU, outerAU, count, size, color, opacity, opts){
  opts = opts || {};
  const positions = new Float32Array(count*3);
  const auArr = new Float32Array(count);
  const thetaArr = new Float32Array(count);
  const incArr = new Float32Array(count);
  const speedArr = new Float32Array(count);
  let placed = 0, attempts = 0;
  while(placed < count && attempts < count * 4){
    attempts++;
    let au = innerAU + Math.random()*(outerAU-innerAU);
    if(opts.kirkwood){
      if(Math.abs(au-2.50)<0.06 && Math.random()<0.85) continue;
      if(Math.abs(au-2.82)<0.05 && Math.random()<0.8) continue;
      if(Math.abs(au-3.28)<0.05 && Math.random()<0.75) continue;
    }
    const theta = Math.random()*Math.PI*2;
    const inc = (Math.random()-0.5)*(opts.incSpread || 0.12);
    const r = displayDistanceFromAU(au);
    const periodDays = Math.pow(au, 1.5) * 365.25;
    positions[placed*3]   = r * Math.cos(theta);
    positions[placed*3+1] = r * Math.sin(inc) * 0.4;
    positions[placed*3+2] = r * Math.sin(theta);
    auArr[placed] = au; thetaArr[placed] = theta; incArr[placed] = inc;
    speedArr[placed] = (Math.PI * 2) / periodDays;
    placed++;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    map: softDotTex, color: color, size: size, sizeAttenuation: true,
    transparent: true, opacity: opacity, depthWrite: false
  });
  const pts = new THREE.Points(geo, mat);
  pts.userData.belt = { au: auArr, theta: thetaArr, inc: incArr, speed: speedArr, count: placed };
  scene.add(pts);
  return pts;
}
function updateBeltParticles(pts, simDaysDelta){
  if(!pts || !pts.userData.belt) return;
  const b = pts.userData.belt;
  const pos = pts.geometry.attributes.position.array;
  for(let i=0;i<b.count;i++){
    b.theta[i] += b.speed[i] * simDaysDelta;
    const r = displayDistanceFromAU(b.au[i]);
    const th = b.theta[i], inc = b.inc[i];
    pos[i*3] = r*Math.cos(th); pos[i*3+1] = r*Math.sin(inc)*0.4; pos[i*3+2] = r*Math.sin(th);
  }
  pts.geometry.attributes.position.needsUpdate = true;
}

const asteroidBelt = buildBelt(2.1, 3.3, 12000, 0.45, 0xd4c4ac, 0.93, { kirkwood:true, incSpread:0.2 });
const kuiperBelt   = buildBelt(30, 55, 9000, 0.95, 0xb8d8f0, 0.8, { incSpread:0.28 });

// =========================================================================
// OORT CLOUD — distant spherical shell of icy planetesimals
// Real extent ~2,000–100,000 AU; display-compressed beyond Kuiper for visibility
// =========================================================================
function buildOortCloud(count){
  count = count || 6000;
  const positions = new Float32Array(count * 3);
  const auArr = new Float32Array(count);
  const thetaArr = new Float32Array(count);
  const phiArr = new Float32Array(count);
  const speedArr = new Float32Array(count);
  // Display mapping: compress 2000–50000 AU into readable outer sphere
  function oortDisplayR(au){
    // place beyond Kuiper (~55 AU display zone) up to ~220 display units
    const t = (Math.log(au) - Math.log(2000)) / (Math.log(50000) - Math.log(2000));
    const kuiperOuter = displayDistanceFromAU(55);
    return kuiperOuter * 1.35 + t * 95;
  }
  for(let i=0;i<count;i++){
    // Power-law-ish radial sample (more at outer edge educationally visible)
    const u = Math.random();
    const au = 2000 * Math.pow(50000/2000, u); // log-uniform 2k–50k AU
    const th = Math.random() * Math.PI * 2;
    // Isotropic shell (not a flat disk)
    const cosP = Math.random() * 2 - 1;
    const phi = Math.acos(cosP);
    const r = oortDisplayR(au);
    positions[i*3]   = r * Math.sin(phi) * Math.cos(th);
    positions[i*3+1] = r * Math.cos(phi);
    positions[i*3+2] = r * Math.sin(phi) * Math.sin(th);
    auArr[i] = au;
    thetaArr[i] = th;
    phiArr[i] = phi;
    // Extremely slow mean motion (P ∝ a^1.5 → millennia)
    const periodDays = Math.pow(au, 1.5) * 365.25;
    speedArr[i] = (Math.PI * 2) / periodDays;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    map: softDotTex,
    color: 0xd0e4f0,
    size: 0.95,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const pts = new THREE.Points(geo, mat);
  pts.renderOrder = 0;
  pts.userData.oort = { au: auArr, theta: thetaArr, phi: phiArr, speed: speedArr, count: count };
  scene.add(pts);
  return pts;
}
function updateOortCloud(pts, simDaysDelta){
  if(!pts || !pts.userData.oort) return;
  // Only advance when time warp is significant (otherwise motion is imperceptible)
  if(Math.abs(simDaysDelta) < 1) return;
  const o = pts.userData.oort;
  const pos = pts.geometry.attributes.position.array;
  function oortDisplayR(au){
    const t = (Math.log(au) - Math.log(2000)) / (Math.log(50000) - Math.log(2000));
    const kuiperOuter = displayDistanceFromAU(55);
    return kuiperOuter * 1.35 + t * 95;
  }
  for(let i=0;i<o.count;i++){
    o.theta[i] += o.speed[i] * simDaysDelta;
    const r = oortDisplayR(o.au[i]);
    const th = o.theta[i], phi = o.phi[i];
    pos[i*3]   = r * Math.sin(phi) * Math.cos(th);
    pos[i*3+1] = r * Math.cos(phi);
    pos[i*3+2] = r * Math.sin(phi) * Math.sin(th);
  }
  pts.geometry.attributes.position.needsUpdate = true;
}
const oortCloud = buildOortCloud(8000);
const oortLabelEl = makeBeltLabel('Oort cloud');
oortLabelEl.style.color = '#9eb8c8';


// Belt labels
function makeBeltLabel(text){
  const el = document.createElement('div');
  el.className = 'planet-label';
  el.style.pointerEvents = 'none';
  el.style.opacity = '0.85';
  el.style.fontSize = '11px';
  el.style.letterSpacing = '0.08em';
  el.style.textTransform = 'uppercase';
  el.style.color = '#c9a227';
  el.textContent = text;
  (document.getElementById('labels-layer')||document.body).appendChild(el);
  return el;
}
const asteroidLabelEl = makeBeltLabel('Asteroid belt');
const kuiperLabelEl = makeBeltLabel('Kuiper belt');
function updateBeltLabels(){
  const vec = new THREE.Vector3();
  const aR = displayDistanceFromAU(2.7);
  vec.set(aR, 0, 0).project(camera);
  if(vec.z < 1){
    asteroidLabelEl.style.display = 'block';
    asteroidLabelEl.style.left = ((vec.x*0.5+0.5)*window.innerWidth)+'px';
    asteroidLabelEl.style.top = ((-vec.y*0.5+0.5)*window.innerHeight)+'px';
  } else asteroidLabelEl.style.display = 'none';
  const kR = displayDistanceFromAU(40);
  vec.set(kR, 0, 0).project(camera);
  if(vec.z < 1){
    kuiperLabelEl.style.display = 'block';
    kuiperLabelEl.style.left = ((vec.x*0.5+0.5)*window.innerWidth)+'px';
    kuiperLabelEl.style.top = ((-vec.y*0.5+0.5)*window.innerHeight)+'px';
  } else kuiperLabelEl.style.display = 'none';
  if(typeof oortLabelEl !== 'undefined' && oortLabelEl){
    // Place label on outer shell
    const kuiperOuter = displayDistanceFromAU(55);
    const oR = kuiperOuter * 1.35 + 45;
    vec.set(oR, oR * 0.25, 0).project(camera);
    if(vec.z < 1){
      oortLabelEl.style.display = 'block';
      oortLabelEl.style.left = ((vec.x*0.5+0.5)*window.innerWidth)+'px';
      oortLabelEl.style.top = ((-vec.y*0.5+0.5)*window.innerHeight)+'px';
    } else oortLabelEl.style.display = 'none';
  }
}

// 3D asteroids (instanced)
const ASTEROID_COUNT = 700;
const asteroidOrbitR = new Float32Array(ASTEROID_COUNT);
const asteroidOrbitTheta = new Float32Array(ASTEROID_COUNT);
const asteroidOrbitInc = new Float32Array(ASTEROID_COUNT);
const asteroidOrbitSpeed = new Float32Array(ASTEROID_COUNT);
const asteroidScaleX = new Float32Array(ASTEROID_COUNT);
const asteroidScaleY = new Float32Array(ASTEROID_COUNT);
const asteroidScaleZ = new Float32Array(ASTEROID_COUNT);
const asteroidSpinX = new Float32Array(ASTEROID_COUNT);
const asteroidSpinY = new Float32Array(ASTEROID_COUNT);
const asteroidSpinZ = new Float32Array(ASTEROID_COUNT);
const asteroidSpinRate = new Float32Array(ASTEROID_COUNT);
const _asteroidDummy = new THREE.Object3D();
const _asteroidColor = new THREE.Color();
let asteroidInstanced = null;

// =========================================================================
// Procedural crater generation · regolith scattering · HF normal noise
// =========================================================================
/** Power-law crater radii (many small, few large) — classic impact-size distribution */
function sampleCraterRadius(rMin, rMax, alpha){
  alpha = alpha != null ? alpha : 2.2;
  rMin = Math.max(0.5, rMin || 1);
  rMax = Math.max(rMin + 0.1, rMax || rMin + 1);
  const u = Math.random();
  // Safe power-law sample
  try {
    const a = 1 - alpha;
    if(Math.abs(a) < 1e-6) return rMin + u * (rMax - rMin);
    const r = Math.pow(u * (Math.pow(rMax, a) - Math.pow(rMin, a)) + Math.pow(rMin, a), 1 / a);
    if(!isFinite(r)) return rMin + u * (rMax - rMin);
    return Math.max(rMin, Math.min(rMax, r));
  } catch(e){
    return rMin + u * (rMax - rMin);
  }
}

/**
 * Draw a single impact crater onto albedo canvas.
 * Bowl floor + raised rim + soft ejecta blanket (Melosh-style schematic).
 */
function drawProceduralCrater(ctx, cx, cy, R, opts){
  opts = opts || {};
  const depth = opts.depth != null ? opts.depth : 0.75;
  // Ejecta blanket
  const ej = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.55);
  ej.addColorStop(0, 'rgba(130,125,118,0.0)');
  ej.addColorStop(0.35, 'rgba(140,135,128,' + (0.18 * depth) + ')');
  ej.addColorStop(1, 'rgba(100,96,90,0)');
  ctx.beginPath(); ctx.arc(cx, cy, R * 1.55, 0, Math.PI * 2); ctx.fillStyle = ej; ctx.fill();
  // Rim highlight ring
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(210,205,195,' + (0.28 + 0.2 * depth) + ')';
  ctx.lineWidth = Math.max(1.2, R * 0.07); ctx.stroke();
  // Bowl (darker center)
  const bowl = ctx.createRadialGradient(cx - R * 0.12, cy - R * 0.12, 0, cx, cy, R * 0.95);
  bowl.addColorStop(0, 'rgba(45,42,38,' + (0.55 * depth) + ')');
  bowl.addColorStop(0.55, 'rgba(35,33,30,' + (0.72 * depth) + ')');
  bowl.addColorStop(0.85, 'rgba(50,48,44,' + (0.35 * depth) + ')');
  bowl.addColorStop(1, 'rgba(30,28,26,0)');
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.95, 0, Math.PI * 2); ctx.fillStyle = bowl; ctx.fill();
  // Central peak for large simple/complex transition
  if(R > 16){
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(170,165,158,0.4)'; ctx.fill();
  }
}

/** Stamp a population of craters (power-law sizes) onto a canvas context */
function stampCraterField(ctx, w, h, countLarge, countSmall){
  for(let i = 0; i < countLarge; i++){
    drawProceduralCrater(ctx, Math.random() * w, Math.random() * h,
      sampleCraterRadius(8, Math.min(w, h) * 0.08, 2.0), { depth: 0.7 + Math.random() * 0.3 });
  }
  for(let i = 0; i < countSmall; i++){
    drawProceduralCrater(ctx, Math.random() * w, Math.random() * h,
      sampleCraterRadius(1.5, 9, 2.4), { depth: 0.45 + Math.random() * 0.4 });
  }
}

/**
 * Build a normal map from a height buffer with high-frequency noise.
 * Height: 0..1 float array length w*h. Output RGB normal texture.
 * HF noise adds micro-regolith grit (planetary surface scatter look).
 */
function heightToNormalMap(height, w, h, strength, hfAmp){
  strength = strength != null ? strength : 2.2;
  hfAmp = hfAmp != null ? hfAmp : 0.08;
  const cnv = document.createElement('canvas'); cnv.width = w; cnv.height = h;
  const ctx = cnv.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  function H(x, y){
    x = ((x % w) + w) % w; y = ((y % h) + h) % h;
    let v = height[y * w + x];
    // High-frequency noise (value noise-ish)
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    const hf = (n - Math.floor(n)) * 2 - 1;
    const n2 = Math.sin(x * 47.1 + y * 19.7) * 23421.1;
    const hf2 = (n2 - Math.floor(n2)) * 2 - 1;
    return v + hfAmp * (0.65 * hf + 0.35 * hf2);
  }
  for(let y = 0; y < h; y++){
    for(let x = 0; x < w; x++){
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      // Normal from height gradient
      let nx = -dx, ny = -dy, nz = 1.0;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= len; ny /= len; nz /= len;
      const i = (y * w + x) * 4;
      d[i]     = (nx * 0.5 + 0.5) * 255;
      d[i + 1] = (ny * 0.5 + 0.5) * 255;
      d[i + 2] = (nz * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cnv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Height field from crater stamps (for normals) */
function buildCraterHeightField(w, h, craterList){
  const height = new Float32Array(w * h);
  // Base undulation
  for(let y = 0; y < h; y++){
    for(let x = 0; x < w; x++){
      height[y * w + x] = 0.5
        + 0.03 * Math.sin(x * 0.04) * Math.cos(y * 0.035)
        + 0.02 * Math.sin(x * 0.11 + y * 0.07);
    }
  }
  craterList.forEach(function(c){
    const R = c.r, cx = c.x, cy = c.y, depth = c.depth || 0.7;
    const r2 = R * R;
    const x0 = Math.max(0, Math.floor(cx - R * 1.2));
    const x1 = Math.min(w - 1, Math.ceil(cx + R * 1.2));
    const y0 = Math.max(0, Math.floor(cy - R * 1.2));
    const y1 = Math.min(h - 1, Math.ceil(cy + R * 1.2));
    for(let y = y0; y <= y1; y++){
      for(let x = x0; x <= x1; x++){
        const dx = x - cx, dy = y - cy;
        const d2 = dx * dx + dy * dy;
        if(d2 > r2 * 1.44) continue;
        const d = Math.sqrt(d2) / R;
        // Bowl profile: parabolic floor, raised rim near d~1
        let dh = 0;
        if(d < 0.85){
          dh = -depth * (1 - (d / 0.85) * (d / 0.85));
        } else if(d < 1.15){
          const t = (d - 0.85) / 0.3;
          dh = 0.15 * depth * Math.sin(t * Math.PI);
        }
        height[y * w + x] += dh;
      }
    }
  });
  return height;
}

/**
 * Regolith-like material settings (Hapke/Oren-Nayar inspired for real-time):
 * very high roughness, near-zero metalness, slight emissive fill so night side readable.
 */
function applyRegolithMaterial(mat){
  if(!mat) return mat;
  mat.roughness = 0.98;
  mat.metalness = 0.0;
  if(mat.emissiveIntensity == null || mat.emissiveIntensity < 0.08){
    mat.emissiveIntensity = 0.1;
  }
  try { mat.envMapIntensity = 0.15; } catch(e){}
  return mat;
}

(function buildAsteroidRocks(){ try {
  // Built synchronously but kept lightweight (256 maps)
  const rockColors = [0x8a8580,0x7a7570,0x9a948c,0x6e6a64,0x858078,0x949088];
  // SOLID closed mesh — mild potato shape only (no deep holes / empty interiors)
  const geo = new THREE.IcosahedronGeometry(1, 4);
  const pos = geo.attributes.position;
  for(let i=0;i<pos.count;i++){
    let x=pos.getX(i), y=pos.getY(i), z=pos.getZ(i);
    const len = Math.sqrt(x*x+y*y+z*z)||1;
    x/=len; y/=len; z/=len;
    // Keep r in a tight range so the body stays filled and solid
    let r = 0.94
      + 0.06 * Math.sin(x*3.1 + y*2.4)
      + 0.04 * Math.sin(y*5.2 - z*2.8)
      + 0.03 * Math.sin(z*7.0 + x*4.0);
    r = Math.max(0.82, Math.min(1.05, r));
    pos.setXYZ(i, x*r, y*r*0.92, z*r);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  // --- Albedo: base regolith + procedural crater field ---
  const AW = 256, AH = 256; // 256 keeps load fast; HF noise still visible
  const cnv = document.createElement('canvas'); cnv.width = AW; cnv.height = AH;
  const ctx = cnv.getContext('2d');
  const g0 = ctx.createRadialGradient(AW/2, AH/2, 20, AW/2, AH/2, 380);
  g0.addColorStop(0, '#8c8882'); g0.addColorStop(1, '#5a5650');
  ctx.fillStyle = g0; ctx.fillRect(0, 0, AW, AH);
  // Micro-grain (regolith scatter look)
  for(let i = 0; i < 20000; i++){
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.05)';
    ctx.fillRect(Math.random()*AW, Math.random()*AH, 1 + Math.random()*2, 1 + Math.random()*2);
  }
  // Shared crater list for albedo + height/normal
  const craterList = [];
  for(let i = 0; i < 48; i++){
    craterList.push({
      x: Math.random() * AW, y: Math.random() * AH,
      r: sampleCraterRadius(8, 36, 2.0),
      depth: 0.65 + Math.random() * 0.35
    });
  }
  for(let i = 0; i < 140; i++){
    craterList.push({
      x: Math.random() * AW, y: Math.random() * AH,
      r: sampleCraterRadius(1.5, 9, 2.5),
      depth: 0.4 + Math.random() * 0.4
    });
  }
  craterList.forEach(function(c){
    drawProceduralCrater(ctx, c.x, c.y, c.r, { depth: c.depth });
  });
  const rockMap = new THREE.CanvasTexture(cnv);
  rockMap.wrapS = rockMap.wrapT = THREE.RepeatWrapping;
  rockMap.encoding = THREE.sRGBEncoding;

  // --- Normal map from height + high-frequency noise ---
  const height = buildCraterHeightField(AW, AH, craterList);
  const normalMap = heightToNormalMap(height, AW, AH, 2.8, 0.09);

  // Roughness map: slightly lower in crater floors (compacted)
  const rCnv = document.createElement('canvas'); rCnv.width = AW; rCnv.height = AH;
  const rctx = rCnv.getContext('2d');
  rctx.fillStyle = '#f0f0f0'; rctx.fillRect(0, 0, AW, AH);
  craterList.forEach(function(c){
    const rg = rctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
    rg.addColorStop(0, '#c8c8c8'); rg.addColorStop(1, '#f0f0f0');
    rctx.beginPath(); rctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); rctx.fillStyle = rg; rctx.fill();
  });
  const roughMap = new THREE.CanvasTexture(rCnv);
  roughMap.wrapS = roughMap.wrapT = THREE.RepeatWrapping;

  const mat = new THREE.MeshStandardMaterial({
    map: rockMap,
    normalMap: normalMap,
    normalScale: new THREE.Vector2(1.1, 1.1),
    roughnessMap: roughMap,
    color: 0xffffff,
    roughness: 0.98,
    metalness: 0.0,
    emissive: 0x12100e,
    emissiveIntensity: 0.1
  });
  applyRegolithMaterial(mat);

  asteroidInstanced = new THREE.InstancedMesh(geo, mat, ASTEROID_COUNT);
  asteroidInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  asteroidInstanced.frustumCulled = false;
  for(let i=0;i<ASTEROID_COUNT;i++){
    let au = 2.12 + Math.random()*1.15;
    if(Math.abs(au-2.50)<0.06) au += 0.14;
    if(Math.abs(au-2.82)<0.05) au += 0.12;
    const theta = Math.random()*Math.PI*2;
    const inc = (Math.random()-0.5)*0.16;
    const r = displayDistanceFromAU(au);
    // Near-spherical solid scale — avoid ultra-flat "empty" axes
    const size = Math.pow(Math.random(),1.15)*0.45 + 0.16;
    asteroidOrbitR[i]=r; asteroidOrbitTheta[i]=theta; asteroidOrbitInc[i]=inc;
    asteroidOrbitSpeed[i]=(Math.PI*2)/(Math.pow(au,1.5)*365.25);
    asteroidScaleX[i]=size*(0.85+Math.random()*0.25);
    asteroidScaleY[i]=size*(0.78+Math.random()*0.28);
    asteroidScaleZ[i]=size*(0.85+Math.random()*0.25);
    asteroidSpinX[i]=Math.random()*6; asteroidSpinY[i]=Math.random()*6; asteroidSpinZ[i]=Math.random()*6;
    asteroidSpinRate[i]=0.15+Math.random()*0.9;
    _asteroidDummy.position.set(r*Math.cos(theta), r*Math.sin(inc)*0.5, r*Math.sin(theta));
    _asteroidDummy.rotation.set(asteroidSpinX[i], asteroidSpinY[i], asteroidSpinZ[i]);
    _asteroidDummy.scale.set(asteroidScaleX[i], asteroidScaleY[i], asteroidScaleZ[i]);
    _asteroidDummy.updateMatrix();
    asteroidInstanced.setMatrixAt(i, _asteroidDummy.matrix);
    if(asteroidInstanced.setColorAt){
      _asteroidColor.setHex(rockColors[i%rockColors.length]);
      asteroidInstanced.setColorAt(i, _asteroidColor);
    }
  }
  asteroidInstanced.instanceMatrix.needsUpdate = true;
  if(asteroidInstanced.instanceColor) asteroidInstanced.instanceColor.needsUpdate = true;
  scene.add(asteroidInstanced);
  } catch(err){ console.error('[asteroids]', err); }
})();

function updateAsteroidRocks(dt){
  if(!asteroidInstanced) return;
  const simDaysDelta = (typeof daysPerSecond === 'number' ? daysPerSecond : 1/86400) * dt;
  for(let i=0;i<ASTEROID_COUNT;i++){
    asteroidOrbitTheta[i] += asteroidOrbitSpeed[i] * simDaysDelta;
    const spin = asteroidSpinRate[i];
    asteroidSpinX[i] += dt*spin*0.6; asteroidSpinY[i] += dt*spin*0.4;
    const r=asteroidOrbitR[i], th=asteroidOrbitTheta[i], inc=asteroidOrbitInc[i];
    _asteroidDummy.position.set(r*Math.cos(th), r*Math.sin(inc)*0.5, r*Math.sin(th));
    _asteroidDummy.rotation.set(asteroidSpinX[i], asteroidSpinY[i], asteroidSpinZ[i]);
    _asteroidDummy.scale.set(asteroidScaleX[i], asteroidScaleY[i], asteroidScaleZ[i]);
    _asteroidDummy.updateMatrix();
    asteroidInstanced.setMatrixAt(i, _asteroidDummy.matrix);
  }
  asteroidInstanced.instanceMatrix.needsUpdate = true;
}

// Major asteroids + dwarf planets
const MAJOR_ASTEROIDS = [
  { name:'Ceres', type:'Dwarf planet', au:2.77, periodDays:1680, radius:0.28, color:0xb0a090, theta0:0.4,
    diameterKm:939, discovered:'1801', discoverer:'Giuseppe Piazzi',
    fact:'Largest object in the asteroid belt. Only dwarf planet in the inner solar system.' },
  { name:'Vesta', type:'Asteroid', au:2.36, periodDays:1325, radius:0.18, color:0xc8b8a0, theta0:1.8,
    diameterKm:525, discovered:'1807', discoverer:'Heinrich Olbers',
    fact:'Second-most massive body in the belt; source of many HED meteorites.' },
  { name:'Pallas', type:'Asteroid', au:2.77, periodDays:1686, radius:0.15, color:0x9a8a78, theta0:3.5,
    diameterKm:512, discovered:'1802', discoverer:'Heinrich Olbers',
    fact:'Highly inclined orbit (~35°). Third-largest asteroid.' },
  { name:'Hygiea', type:'Asteroid', au:3.14, periodDays:2030, radius:0.14, color:0x8a7a68, theta0:5.1,
    diameterKm:434, discovered:'1849', discoverer:'Annibale de Gasparis',
    fact:'Fourth-largest asteroid; nearly spherical.' }
];
const DWARF_PLANETS = [
  { name:'Pluto', type:'Dwarf planet · KBO', au:39.5, periodDays:90560, radius:0.32, color:0xc4a882, theta0:0.9,
    diameterKm:2377, discovered:'1930', discoverer:'Clyde Tombaugh',
    fact:'Largest known Kuiper-belt object. Nitrogen ice plains (Sputnik Planitia). Five moons.' },
  { name:'Eris', type:'Dwarf planet · scattered disk', au:67.9, periodDays:203830, radius:0.30, color:0xd0d4d8, theta0:2.1,
    diameterKm:2326, discovered:'2005', discoverer:'Brown / Trujillo / Rabinowitz',
    fact:'Comparable in mass to Pluto; high-albedo methane ice. Moon: Dysnomia.' },
  { name:'Haumea', type:'Dwarf planet · KBO', au:43.1, periodDays:103468, radius:0.24, color:0xe8e4d8, theta0:3.8,
    diameterKm:1560, discovered:'2004', discoverer:'Brown / Ortiz teams',
    fact:'Rapid rotator (~3.9 h) — elongated shape. Ring system and moons Hiʻiaka and Namaka.' },
  { name:'Makemake', type:'Dwarf planet · cubewano', au:45.5, periodDays:112897, radius:0.22, color:0xd4b090, theta0:5.2,
    diameterKm:1430, discovered:'2005', discoverer:'Brown / Trujillo / Rabinowitz',
    fact:'Second-brightest KBO after Pluto. Methane ice surface.' },
  { name:'Gonggong', type:'Dwarf candidate · scattered disk', au:67.5, periodDays:202740, radius:0.18, color:0xb08070, theta0:1.4,
    diameterKm:1230, discovered:'2007', discoverer:'Schwamb / Brown / Rabinowitz',
    fact:'Reddish scattered-disk object. Moon: Xiangliu.' },
  { name:'Quaoar', type:'Dwarf candidate · cubewano', au:43.7, periodDays:105450, radius:0.17, color:0xc09080, theta0:4.4,
    diameterKm:1110, discovered:'2002', discoverer:'Brown / Trujillo',
    fact:'Large classical KBO with a ring and moon Weywot.' },
  { name:'Varuna', type:'Cubewano', au:43.0, periodDays:103000, radius:0.13, color:0xb09070, theta0:1.1,
    diameterKm:700, discovered:'2000', discoverer:'R. McMillan (Spacewatch)',
    fact:'Rapid rotator with a strong light curve — likely elongated.' },
  { name:'Sedna', type:'Detached object', au:506, periodDays:4.15e6, radius:0.16, color:0xc07050, theta0:2.8,
    diameterKm:995, discovered:'2003', discoverer:'Brown / Trujillo / Rabinowitz',
    fact:'Extreme orbit; may be linked to the inner Oort cloud.' }
];


function makeDwarfSurfaceMap(name, hexColor){
  const cnv = document.createElement('canvas');
  cnv.width = 1024; cnv.height = 512;
  const ctx = cnv.getContext('2d');
  const c = new THREE.Color(hexColor);
  const r = (c.r*255)|0, g = (c.g*255)|0, b = (c.b*255)|0;
  // Base gradient
  const grad = ctx.createLinearGradient(0,0,0,256);
  grad.addColorStop(0, 'rgb('+Math.min(255,r+25)+','+Math.min(255,g+20)+','+Math.min(255,b+15)+')');
  grad.addColorStop(0.5, 'rgb('+r+','+g+','+b+')');
  grad.addColorStop(1, 'rgb('+Math.max(0,r-30)+','+Math.max(0,g-25)+','+Math.max(0,b-20)+')');
  ctx.fillStyle = grad; ctx.fillRect(0,0,1024,512);
  const n = name || '';
  if(/Pluto/i.test(n)){
    // Heart-shaped bright plain (Sputnik-like)
    ctx.fillStyle = 'rgba(240,220,190,0.45)';
    ctx.beginPath(); ctx.ellipse(220, 140, 55, 40, -0.3, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(180,100,70,0.25)';
    ctx.beginPath(); ctx.ellipse(340, 100, 40, 50, 0.2, 0, Math.PI*2); ctx.fill();
  } else if(/Eris/i.test(n)){
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(0,0,512,256);
    for(let i=0;i<80;i++){
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath(); ctx.arc(Math.random()*512, Math.random()*256, 2+Math.random()*8, 0, 7); ctx.fill();
    }
  } else if(/Haumea/i.test(n)){
    // Elongated bright ice streaks
    for(let i=0;i<12;i++){
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(0, 20+i*18, 512, 4+Math.random()*6);
    }
  } else if(/Makemake|Gonggong|Sedna/i.test(n)){
    // Reddish mottling
    for(let i=0;i<60;i++){
      ctx.fillStyle = 'rgba(160,60,40,0.15)';
      ctx.beginPath(); ctx.arc(Math.random()*512, Math.random()*256, 5+Math.random()*20, 0, 7); ctx.fill();
    }
  } else if(/Ceres/i.test(n)){
    // Bright spots
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.arc(260, 110, 6, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(268, 118, 3, 0, 7); ctx.fill();
    for(let i=0;i<100;i++){
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath(); ctx.arc(Math.random()*512, Math.random()*256, 1+Math.random()*5, 0, 7); ctx.fill();
    }
  } else {
    for(let i=0;i<120;i++){
      ctx.fillStyle = Math.random()>0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)';
      ctx.beginPath(); ctx.arc(Math.random()*512, Math.random()*256, 1+Math.random()*6, 0, 7); ctx.fill();
    }
  }
  // Soft noise
  for(let i=0;i<800;i++){
    ctx.fillStyle = 'rgba(0,0,0,0.04)';
    ctx.fillRect(Math.random()*512, Math.random()*256, 1, 1);
  }
  const tex = new THREE.CanvasTexture(cnv);
  tex.encoding = THREE.sRGBEncoding;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function buildSmallBody(a, opts){
  opts = opts || {};
  const geo = opts.sphere
    ? new THREE.SphereGeometry(a.radius, 28, 20)
    : new THREE.IcosahedronGeometry(a.radius, 1);
  if(!opts.sphere){
    const pos = geo.attributes.position;
    for(let i=0;i<pos.count;i++){
      const n = 0.85 + Math.random()*0.3;
      pos.setXYZ(i, pos.getX(i)*n, pos.getY(i)*n*0.9, pos.getZ(i)*n);
    }
    pos.needsUpdate = true; geo.computeVertexNormals();
  }
  const scaleBoost = opts.dwarf ? 1.4 : 1.2;
  if(opts.sphere) geo.scale(scaleBoost, scaleBoost, scaleBoost);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.82, metalness: 0.04,
    emissive: new THREE.Color(a.color).multiplyScalar(0.25),
    emissiveIntensity: 0.3
  });
  // Distinct surface texture by body
  if(typeof makeDwarfSurfaceMap === 'function') mat.map = makeDwarfSurfaceMap(a.name, a.color);
  // Try real photo map for Ceres / Pluto when CDN has it
  (function tryDwarfPhoto(bodyName, urls){
    if(!urls || !urls.length) return;
    let i = 0;
    const loader = new THREE.TextureLoader();
    function next(){
      if(i >= urls.length) return;
      const url = urls[i++];
      loader.load(url, function(tex){
        if(!tex || !tex.image){ next(); return; }
        tex.encoding = THREE.sRGBEncoding;
        mat.map = tex; mat.color.setHex(0xffffff); mat.needsUpdate = true;
      }, undefined, function(){ next(); });
    }
    next();
  })(a.name, (function(){
    if(a.name === 'Ceres') return [
      (typeof TEX2!=='undefined'?TEX2:'') + '2k_ceres_fictional.jpg',
      'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/moon_1024.jpg'
    ];
    if(a.name === 'Pluto') return [
      (typeof TEX2!=='undefined'?TEX2:'') + '2k_pluto.jpg',
      (typeof TEX!=='undefined'?TEX:'') + '2k_pluto.jpg',
      (typeof TEX2!=='undefined'?TEX2:'') + '2k_moon.jpg'
    ];
    if(a.name === 'Eris' || a.name === 'Haumea' || a.name === 'Makemake') return [
      (typeof TEX2!=='undefined'?TEX2:'') + '2k_uranus.jpg',
      (typeof TEX2!=='undefined'?TEX2:'') + '2k_moon.jpg'
    ];
    return [(typeof TEX2!=='undefined'?TEX2:'') + '2k_moon.jpg'];
  })());
  if(!mat.map && typeof makeTypedMoonMap === 'function'){
    const hint = /Pluto|Eris|Haumea|Makemake|Quaoar|Sedna/i.test(a.name) ? 'ice' : 'rocky';
    mat.map = makeTypedMoonMap(a.color, hint);
  }
  if(!mat.map && typeof makeMoonTexture === 'function') mat.map = makeMoonTexture(a.color);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.majorAsteroid = a;
  mesh.userData.isDwarf = !!opts.dwarf;
  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(Math.max(0.7, a.radius * scaleBoost * 2.8), 8, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.userData.majorAsteroid = a;
  mesh.add(hit);
  // Position from AU
  const r = displayDistanceFromAU(a.au);
  const th = a.theta0 || 0;
  mesh.position.set(r * Math.cos(th), 0, r * Math.sin(th));
  scene.add(mesh);
  majorAsteroidMeshes.push(mesh);
  // Interactive label
  const el = document.createElement('div');
  el.className = 'planet-label dwarf-label';
  el.setAttribute('role', 'button');
  el.title = 'Observe ' + a.name;
  el.innerHTML = '<span class="pl-name">' + a.name + '</span>';
  el.style.pointerEvents = 'auto';
  el.style.cursor = 'pointer';
  el.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); openSmallBodyHud(a); });
  (document.getElementById('labels-layer')||document.body).appendChild(el);
  a.labelEl = el;
  a.mesh = mesh;
  return mesh;
}
MAJOR_ASTEROIDS.forEach(function(a){ buildSmallBody(a, { sphere: a.name === 'Ceres', dwarf: a.name === 'Ceres' }); });
DWARF_PLANETS.forEach(function(a){ buildSmallBody(a, { dwarf: true, sphere: true }); });

function openSmallBodyHud(a){
  focusedPlanet = null;
  focusedMoon = null;
  focusedDwarf = a;
  constellationFocus = null;
  cameraTween = null;
  PLANETS.forEach(function(pp){ if(pp.chipEl) pp.chipEl.classList.remove('active'); });
  const ml = document.getElementById('hud-moon-list');
  if(ml){ ml.innerHTML=''; ml.style.display='none'; }
  const vb2 = document.getElementById('hud-moon-visit');
  if(vb2){ vb2.style.display='none'; vb2.onclick=null; }
  document.getElementById('hud-type').textContent = a.type || 'Small body';
  document.getElementById('hud-name').textContent = a.name;
  document.getElementById('hud-subtitle').textContent = a.discovered
    ? ('Discovered ' + a.discovered + (a.discoverer ? ' · ' + a.discoverer : '')) : '';
  document.getElementById('hud-diameter').textContent = a.diameterKm ? (a.diameterKm + ' km') : '—';
  document.getElementById('hud-period').textContent = a.periodDays ? ((a.periodDays/365.25).toFixed(1) + ' years') : '—';
  const incl = document.getElementById('hud-incl-row'); if(incl) incl.style.display='none';
  document.getElementById('hud-distance').textContent = a.au != null ? (a.au + ' AU') : '—';
  document.getElementById('hud-distance-label').textContent = 'Semi-major axis';
  document.getElementById('hud-ptype').textContent = a.type || '—';
  const rows = ['hud-moons-row','hud-gravity-row','hud-temp-row','hud-density-row','hud-escape-row','hud-atmo-row','hud-surface-row','hud-mag-row'];
  rows.forEach(function(id){ const el=document.getElementById(id); if(el) el.style.display='none'; });
  const vis = document.getElementById('hud-visibility');
  if(vis) vis.textContent = a.fact || '';
  const vb = document.getElementById('hud-vis-block'); if(vb) vb.style.display='';
  const lb = document.getElementById('hud-live-block'); if(lb) lb.style.display='none';
  document.getElementById('hud').classList.add('open');
  // Teleport / close observe
  const mesh = majorAsteroidMeshes.find(function(m){ return m.userData.majorAsteroid === a; });
  if(mesh){
    const dist = Math.max(2.5, a.radius * 10 + 2.0);
    if(typeof startCameraTween === 'function'){
      startCameraTween({
        target: mesh.position.clone(),
        distance: dist,
        phi: Math.min(Math.max(camPhi, 0.5), Math.PI - 0.5),
        duration: 1.35
      });
    } else {
      camTarget.copy(mesh.position);
      desiredDistance = dist;
    }
  }
  const cap = document.getElementById('teleport-caption');
  if(cap){
    cap.textContent = 'Observing ' + a.name + ' — drag to orbit · scroll to zoom · Full system to exit';
    cap.classList.add('show');
    setTimeout(function(){ cap.classList.remove('show'); }, 2800);
  }
}

function updateMajorAsteroids(simDays){
  majorAsteroidMeshes.forEach(function(mesh){
    const a = mesh.userData.majorAsteroid;
    if(!a || !a.periodDays) return;
    const ang = (a.theta0 || 0) + (simDays / a.periodDays) * Math.PI * 2;
    const r = displayDistanceFromAU(a.au);
    mesh.position.set(r * Math.cos(ang), 0, r * Math.sin(ang));
    mesh.rotation.y += 0.01;
  });
}

function updateDwarfLabels(){
  const vec = new THREE.Vector3();
  const placed = [];
  function overlaps(x,y){
    for(let i=0;i<placed.length;i++){
      if(Math.abs(placed[i].x-x)<78 && Math.abs(placed[i].y-y)<20) return true;
    }
    return false;
  }
  const bodies = MAJOR_ASTEROIDS.concat(DWARF_PLANETS);
  bodies.forEach(function(a){
    if(!a.labelEl) return;
    const mesh = a.mesh || majorAsteroidMeshes.find(function(m){ return m.userData.majorAsteroid===a; });
    if(!mesh){ a.labelEl.style.display='none'; return; }
    mesh.getWorldPosition(vec);
    const proj = vec.clone().project(camera);
    let x = (proj.x*0.5+0.5)*window.innerWidth;
    let y = (-proj.y*0.5+0.5)*window.innerHeight;
    if(!(proj.z<1 && x>-30 && x<window.innerWidth+30)){ a.labelEl.style.display='none'; return; }
    let tries=0;
    while(overlaps(x,y) && tries<10){ y += 18; tries++; }
    placed.push({x:x,y:y});
    a.labelEl.style.display='block';
    a.labelEl.style.left=x+'px';
    a.labelEl.style.top=y+'px';
    a.labelEl.classList.toggle('active', focusedDwarf===a);
  });
}

// Planet labels
const labelsLayer = document.getElementById('labels-layer');
PLANETS.forEach(function(p){
  if(p.labelEl) return;
  const el = document.createElement('div');
  el.className = 'planet-label';
  el.setAttribute('role','button');
  const hex = '#' + (p.color != null ? p.color.toString(16).padStart(6,'0') : 'c9a227');
  const moonTxt = (p.moonCount > 0) ? (p.moonCount + (p.moonCount===1?' moon':' moons')) : 'No moons';
  el.innerHTML = '<span class="pl-dot" style="background:'+hex+'"></span><span class="pl-name">'+p.name+'</span>'+
    '<span class="pl-meta">'+(p.type||'')+' · '+(p.distanceAU!=null?p.distanceAU+' AU':'')+' · '+moonTxt+'</span>';
  el.addEventListener('click', function(ev){ ev.preventDefault(); if(typeof selectPlanet==='function') selectPlanet(p.key); });
  labelsLayer.appendChild(el);
  p.labelEl = el;
});
function updateLabels(){
  const vec = new THREE.Vector3();
  PLANETS.forEach(function(p){
    if(!p.labelEl || !p.mesh) return;
    (p.system||p.mesh).getWorldPosition(vec);
    const proj = vec.clone().project(camera);
    const x=(proj.x*0.5+0.5)*window.innerWidth;
    const y=(-proj.y*0.5+0.5)*window.innerHeight;
    const visible = proj.z<1;
    p.labelEl.style.display = visible?'block':'none';
    p.labelEl.style.left=x+'px'; p.labelEl.style.top=y+'px';
    p.labelEl.classList.toggle('active', !!(focusedPlanet && focusedPlanet.key===p.key));
  });
}

// Chips
const chipsEl = document.getElementById('chips');
if(chipsEl && !chipsEl.dataset.built){
  chipsEl.dataset.built='1';
  PLANETS.forEach(function(p){
    const b = document.createElement('button');
    b.className = 'chip';
    b.innerHTML = '<span class="dot" style="background:#'+(p.color!=null?p.color.toString(16).padStart(6,'0'):'aaa')+'"></span>'+p.name;
    b.addEventListener('click', function(){ selectPlanet(p.key); });
    chipsEl.appendChild(b);
    p.chipEl = b;
  });
}

function selectPlanet(key){
  const p = PLANETS.find(function(pp){ return pp.key===key; });
  if(!p) return;
  focusedPlanet = p; focusedMoon = null; focusedDwarf = null;
  PLANETS.forEach(function(pp){ if(pp.chipEl) pp.chipEl.classList.toggle('active', pp===p); });
  var _ht=document.getElementById('hud-type'); if(_ht) _ht.textContent = p.type || 'Planet';
  document.getElementById('hud-name').textContent = p.name;
  document.getElementById('hud-subtitle').textContent = p.periodLabel || '';
  document.getElementById('hud-diameter').textContent = p.diameterKm ? (p.diameterKm.toLocaleString()+' km') : '—';
  document.getElementById('hud-period').textContent = p.periodLabel || '—';
  document.getElementById('hud-distance').textContent = (p.distanceAU!=null?p.distanceAU+' AU':'—');
  document.getElementById('hud-ptype').textContent = p.type || '—';
  // Moons in this simulation (click to focus)
  const simMoons = (typeof MOONS !== 'undefined')
    ? MOONS.filter(function(m){ return m.parent === p.key && m.mesh; })
    : [];
  document.getElementById('hud-moons').textContent = String(simMoons.length) + (p.moonCount && p.moonCount > simMoons.length ? ' shown · ' + p.moonCount + ' known' : '');
  const mr = document.getElementById('hud-moons-row'); if(mr) mr.style.display='';
  const ml = document.getElementById('hud-moon-list');
  if(ml){
    ml.innerHTML = '';
    if(simMoons.length){
      ml.style.display = 'block';
      // Minimal header
      const head = document.createElement('div');
      head.style.cssText = 'font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);margin:0 0 6px;';
      head.textContent = 'Moons in view — click to focus';
      ml.appendChild(head);
      simMoons.forEach(function(m){
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'moon-chip';
        chip.textContent = m.name;
        chip.title = 'Focus on ' + m.name;
        chip.addEventListener('click', function(ev){
          ev.preventDefault();
          ev.stopPropagation();
          if(typeof focusMoon === 'function') focusMoon(m);
        });
        ml.appendChild(chip);
      });
    } else {
      ml.style.display = 'none';
    }
  }
  const visit = document.getElementById('hud-moon-visit');
  if(visit){ visit.style.display='none'; visit.onclick=null; }
  document.getElementById('hud').classList.add('open');
  const dist = Math.max(8, p.displayRadius * 3.2 + 6);
  if(typeof startCameraTween==='function'){
    startCameraTween({
      target: (p.system||p.mesh).position.clone(),
      distance: dist,
      phi: Math.min(Math.max(camPhi,0.4), Math.PI-0.4),
      duration: 1.2
    });
  }
  desiredDistance = dist;
}

// Raycasting click
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Asteroid / Kuiper belt information (click label or belt region)
const BELT_INFO = {
  asteroid: {
    name: 'Asteroid belt',
    type: 'Main belt · rocky bodies',
    au: '2.1 – 3.3 AU',
    fact: 'Located between Mars and Jupiter. Millions of rocky and metallic bodies. Kirkwood gaps mark orbital resonances with Jupiter. Total mass is only a few percent of the Moon. Ceres is the largest member and a dwarf planet.',
    discovered: 'First asteroid (Ceres) found 1801 by Giuseppe Piazzi',
    composition: 'C-type (carbonaceous), S-type (silicate), M-type (metallic)'
  },
  kuiper: {
    name: 'Kuiper belt',
    type: 'Trans-Neptunian · icy bodies',
    au: '30 – 55 AU',
    fact: 'A disk of icy planetesimals beyond Neptune. Source of many short-period comets. Home to Pluto, Makemake, Haumea, and hundreds of thousands of smaller KBOs. Similar in concept to the asteroid belt but far colder and more massive in aggregate.',
    discovered: 'Predicted mid-20th century; confirmed 1990s',
    composition: 'Water ice, methane, ammonia, organic ices'
  },
  oort: {
    name: 'Oort cloud',
    type: 'Spherical shell · icy planetesimals',
    au: '~2,000 – 100,000 AU (display compressed)',
    fact: 'FORMATION: Leftover icy planetesimals from the early Solar System were scattered outward by the giant planets into a vast spherical cloud. MOTION: Orbits are extremely slow (periods of millions of years); at real-time scale motion is imperceptible — use high Simulation speed to see drift. DISTURBANCES: Galactic tides and passing stars can nudge objects inward, producing long-period comets. Proposed by Jan Oort (1950). Not a flat disk — it surrounds the system in all directions.',
    discovered: 'Proposed 1950 by Jan Hendrik Oort (theoretical)',
    composition: 'Water ice, CO, CO2, methane, ammonia ices'
  }
};

function openBeltHud(kind){
  const info = BELT_INFO[kind];
  if(!info) return;
  focusedPlanet = null; focusedMoon = null; focusedDwarf = null;
  const ml = document.getElementById('hud-moon-list');
  if(ml){ ml.innerHTML=''; ml.style.display='none'; }
  const vb2 = document.getElementById('hud-moon-visit');
  if(vb2){ vb2.style.display='none'; }
  document.getElementById('hud-type').textContent = info.type;
  document.getElementById('hud-name').textContent = info.name;
  document.getElementById('hud-subtitle').textContent = info.discovered || '';
  document.getElementById('hud-diameter').textContent = '—';
  document.getElementById('hud-period').textContent = 'Various (Keplerian)';
  const incl = document.getElementById('hud-incl-row'); if(incl) incl.style.display='none';
  document.getElementById('hud-distance').textContent = info.au;
  document.getElementById('hud-distance-label').textContent = 'Radial extent';
  document.getElementById('hud-ptype').textContent = info.composition || info.type;
  ['hud-moons-row','hud-gravity-row','hud-temp-row','hud-density-row','hud-escape-row','hud-atmo-row','hud-surface-row','hud-mag-row'].forEach(function(id){
    const el = document.getElementById(id); if(el) el.style.display='none';
  });
  const vis = document.getElementById('hud-visibility');
  if(vis) vis.textContent = info.fact;
  const vb = document.getElementById('hud-vis-block'); if(vb) vb.style.display='';
  const lb = document.getElementById('hud-live-block'); if(lb) lb.style.display='none';
  document.getElementById('hud').classList.add('open');
  // Frame the belt
  let midAU = 2.7, dist = 35;
  if(kind === 'kuiper'){ midAU = 40; dist = 90; }
  if(kind === 'oort'){ midAU = 55; dist = 160; }
  const r = kind === 'oort'
    ? (displayDistanceFromAU(55) * 1.35 + 45)
    : displayDistanceFromAU(midAU);
  if(typeof startCameraTween === 'function'){
    startCameraTween({
      target: new THREE.Vector3(r * 0.7, kind === 'oort' ? r * 0.2 : 0, 0),
      distance: dist,
      duration: 1.5
    });
  }
}

// Make belt labels clickable
if(typeof asteroidLabelEl !== 'undefined' && asteroidLabelEl){
  asteroidLabelEl.style.pointerEvents = 'auto';
  asteroidLabelEl.style.cursor = 'pointer';
  asteroidLabelEl.title = 'About the asteroid belt';
  asteroidLabelEl.addEventListener('click', function(ev){ ev.stopPropagation(); openBeltHud('asteroid'); });
}
if(typeof kuiperLabelEl !== 'undefined' && kuiperLabelEl){
  kuiperLabelEl.style.pointerEvents = 'auto';
  kuiperLabelEl.style.cursor = 'pointer';
  kuiperLabelEl.title = 'About the Kuiper belt';
  kuiperLabelEl.addEventListener('click', function(ev){ ev.stopPropagation(); openBeltHud('kuiper'); });
}
if(typeof oortLabelEl !== 'undefined' && oortLabelEl){
  oortLabelEl.style.pointerEvents = 'auto';
  oortLabelEl.style.cursor = 'pointer';
  oortLabelEl.title = 'About the Oort cloud';
  oortLabelEl.addEventListener('click', function(ev){ ev.stopPropagation(); openBeltHud('oort'); });
}

function onPointerClick(ev){
  if(typeof teleportActive !== 'undefined' && teleportActive) return;
  mouse.x = (ev.clientX / window.innerWidth)*2 - 1;
  mouse.y = -(ev.clientY / window.innerHeight)*2 + 1;
  raycaster.setFromCamera(mouse, camera);
  if(majorAsteroidMeshes.length){
    const ah = raycaster.intersectObjects(majorAsteroidMeshes, true);
    if(ah.length){
      const obj = ah[0].object;
      const a = obj.userData.majorAsteroid || (obj.parent && obj.parent.userData.majorAsteroid);
      if(a){ openSmallBodyHud(a); return; }
    }
  }
  // Click 3D asteroid instance → belt info
  if(typeof asteroidInstanced !== 'undefined' && asteroidInstanced){
    const ar = raycaster.intersectObject(asteroidInstanced, false);
    if(ar.length){ openBeltHud('asteroid'); return; }
  }

  if(typeof moonMeshes !== 'undefined' && moonMeshes.length){
    const mh = raycaster.intersectObjects(moonMeshes, true);
    if(mh.length){
      const m = mh[0].object.userData.moon || (mh[0].object.parent && mh[0].object.parent.userData.moon);
      if(m && typeof focusMoon === 'function'){ focusMoon(m); return; }
    }
  }
  const planetMeshes = PLANETS.map(function(pp){ return pp.mesh; }).filter(Boolean);
  const ph = raycaster.intersectObjects(planetMeshes, false);
  if(ph.length && ph[0].object.userData.planet){
    selectPlanet(ph[0].object.userData.planet.key);
  }
}
window.addEventListener('click', onPointerClick);

function focusMoon(m){
  if(!m || !m.mesh) return;
  focusedMoon = m; focusedPlanet = null; focusedDwarf = null;
  document.getElementById('hud-type').textContent = 'Moon of ' + (m.parent||'');
  document.getElementById('hud-name').textContent = m.name;
  document.getElementById('hud-subtitle').textContent = m.periodLabel || '';
  document.getElementById('hud-diameter').textContent = m.diameterKm ? (m.diameterKm+' km') : '—';
  document.getElementById('hud-period').textContent = m.periodLabel || '—';
  document.getElementById('hud-distance').textContent = 'Orbiting ' + m.parent;
  document.getElementById('hud-ptype').textContent = 'Natural satellite';
  document.getElementById('hud').classList.add('open');
  const visit = document.getElementById('hud-moon-visit');
  if(visit){ visit.style.display='none'; } // Moon surface teleport removed
  m.mesh.getWorldPosition(_moonWorld);
  if(typeof startCameraTween==='function'){
    startCameraTween({
      target: _moonWorld.clone(),
      distance: Math.max(0.35, m.radius*4.5+0.25),
      duration: 1.2
    });
  }
}

// UI buttons
const homebtn = document.getElementById('homebtn');
if(homebtn) homebtn.addEventListener('click', function(){
  focusedPlanet=null; focusedMoon=null; focusedDwarf=null;
  document.getElementById('hud').classList.remove('open');
  desiredDistance = 120;
  camTarget.set(0,0,0);
  PLANETS.forEach(function(pp){ if(pp.chipEl) pp.chipEl.classList.remove('active'); });
});
const hudClose = document.getElementById('hud-close');
if(hudClose) hudClose.addEventListener('click', function(){ document.getElementById('hud').classList.remove('open'); });
const hudExit = document.getElementById('hud-exit');
if(hudExit) hudExit.addEventListener('click', function(){
  focusedPlanet=null; focusedMoon=null; focusedDwarf=null;
  document.getElementById('hud').classList.remove('open');
  desiredDistance = 120; camTarget.set(0,0,0);
});

// Speed control
const speedSlider = document.getElementById('speedRange') || document.getElementById('speed');
if(speedSlider){
  function applySimSpeed(){
    const v = parseFloat(speedSlider.value) || 0;
    // v=0 → real-time (1 sec = 1 sec); v=60 → ~1 year/sec educational warp
    // daysPerSecond: real-time = 1/86400; at v=60 ≈ 365.25 days/sec
    if(v <= 0.001){
      daysPerSecond = 1/86400;
    } else {
      // smooth curve from realtime to fast
      const t = Math.min(1, v / 60);
      const realtime = 1/86400;
      const maxDays = 365.25; // 1 year per real second at max
      daysPerSecond = realtime * Math.pow(maxDays / realtime, t);
    }
    const lab = document.getElementById('speedVal');
    if(lab){
      if(v < 0.05) lab.textContent = '1× real-time';
      else if(daysPerSecond < 1) lab.textContent = (daysPerSecond*86400).toFixed(1) + '× real-time';
      else if(daysPerSecond < 30) lab.textContent = daysPerSecond.toFixed(2) + ' days/s';
      else lab.textContent = (daysPerSecond/365.25).toFixed(2) + ' yr/s';
    }
  }
  speedSlider.addEventListener('input', applySimSpeed);
  applySimSpeed();
}

// Play/pause
const playBtn = document.getElementById('playbtn');
if(playBtn) playBtn.addEventListener('click', function(){
  playing = !playing;
  const ip = document.getElementById('icon-pause');
  const iy = document.getElementById('icon-play');
  if(ip) ip.style.display = playing ? 'block' : 'none';
  if(iy) iy.style.display = playing ? 'none' : 'block';
});

// Camera orbit controls (simple)
let isDragging=false, prevX=0, prevY=0;
window.addEventListener('mousedown', function(e){ if(e.button===0){ isDragging=true; prevX=e.clientX; prevY=e.clientY; }});
window.addEventListener('mouseup', function(){ isDragging=false; });
window.addEventListener('mousemove', function(e){
  if(!isDragging) return;
  const dx=e.clientX-prevX, dy=e.clientY-prevY;
  prevX=e.clientX; prevY=e.clientY;
  camTheta -= dx*0.005;
  camPhi = Math.min(Math.PI-0.05, Math.max(0.05, camPhi + dy*0.005));
});
window.addEventListener('wheel', function(e){
  desiredDistance = Math.min(500, Math.max(0.12, desiredDistance * (e.deltaY>0 ? 1.1 : 0.9)));
}, {passive:true});

// updateCameraPosition defined earlier — keep single implementation

// Animate
var lastTime = performance.now();
var frameCount = 0;
function animate(now){
  requestAnimationFrame(animate);
  const dt = Math.min((now-lastTime)/1000, 0.1);
  lastTime = now;
  frameCount++;
  if(playing){
    const safeDt = Math.min(dt, 0.05);
    simulatedDate = new Date(simulatedDate.getTime() + daysPerSecond*safeDt*86400000);
    const T = centuriesSinceJ2000(toJulianDate(simulatedDate));
    const simDays = simulatedDate.getTime()/86400000;
    const timeScale = daysPerSecond * 86400;
    const spinVisual = Math.min(timeScale, 120);
    PLANETS.forEach(function(p){
      setPlanetPosition(p, T);
      const hours = p.rotationHours || 24;
      const spinRate = (2*Math.PI)/(Math.abs(hours)*3600);
      const dir = hours < 0 ? -1 : 1;
      p.spinAngle = (p.spinAngle||0) + dir * spinRate * safeDt * spinVisual;
      if(p.mesh) p.mesh.rotation.y = p.spinAngle;
    });
    if(typeof updateMoons === 'function') updateMoons(simDays);
    if(typeof updateAsteroidRocks === 'function') updateAsteroidRocks(dt);
    const simDaysDelta = daysPerSecond * dt;
    updateBeltParticles(asteroidBelt, simDaysDelta);
    updateBeltParticles(kuiperBelt, simDaysDelta);
    if(typeof updateOortCloud === 'function' && typeof oortCloud !== 'undefined') updateOortCloud(oortCloud, simDaysDelta);
    updateMajorAsteroids(simDays);
    PLANETS.forEach(function(p){ if(p.cloudMesh) p.cloudMesh.rotation.y += Math.min(dt,0.05)*0.04; });
    if(typeof sunMesh !== 'undefined') sunMesh.rotation.y += Math.min(dt,0.05)*0.04;
    if(typeof sunLight !== 'undefined') sunLight.position.set(0,0,0);
  }
  updateLabels();
  updateDwarfLabels();
  updateBeltLabels();
  if(typeof cameraTween !== 'undefined' && cameraTween && typeof updateCameraTween === 'function'){
    updateCameraTween(dt);
  } else {
    if(focusedMoon && focusedMoon.mesh){
      focusedMoon.mesh.getWorldPosition(_moonWorld);
      camTarget.lerp(_moonWorld, 0.2);
    } else if(focusedDwarf && focusedDwarf.mesh){
      camTarget.lerp(focusedDwarf.mesh.position, 0.2);
    } else if(focusedPlanet){
      camTarget.lerp((focusedPlanet.system||focusedPlanet.mesh).position, 0.15);
    }
    camDistance += (desiredDistance - camDistance) * 0.12;
  }
  updateCameraPosition();
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

// Hide loading
setTimeout(function(){ try { hideLoadingScreen(); } catch(e){} }, 500);
setTimeout(function(){
  var ls = document.getElementById('loading-screen');
  if(ls){ ls.style.cssText = 'display:none!important;opacity:0;pointer-events:none;'; }
}, 2000);

window.addEventListener('resize', function(){
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

console.info('[Solar System Simulator] Recovery appendix loaded — belts, dwarfs, observe mode ready.');

