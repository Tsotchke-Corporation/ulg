(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin===`use-credentials`?t.credentials=`include`:e.crossOrigin===`anonymous`?t.credentials=`omit`:t.credentials=`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e={LEFT:0,MIDDLE:1,RIGHT:2,ROTATE:0,DOLLY:1,PAN:2},t={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},n=1e3,r=1001,i=1002,a=1003,o=1004,s=1005,c=1006,l=1007,u=1008,d=1009,f=1010,p=1011,m=1012,h=1013,g=1014,_=1015,v=1016,y=1017,b=1018,x=1020,S=35902,C=35899,w=1021,T=1022,E=1023,D=1026,O=1027,k=1028,A=1029,j=1030,M=1031,N=1033,P=33776,F=33777,I=33778,ee=33779,L=35840,te=35841,R=35842,z=35843,ne=36196,re=37492,ie=37496,ae=37488,oe=37489,se=37490,ce=37491,le=37808,ue=37809,de=37810,fe=37811,pe=37812,me=37813,he=37814,ge=37815,_e=37816,ve=37817,ye=37818,be=37819,xe=37820,Se=37821,Ce=36492,we=36494,Te=36495,B=36283,Ee=36284,De=36285,Oe=36286,V=2300,ke=2301,H=2302,U=2303,Ae=2400,je=2401,Me=2402,Ne=3200,Pe=`srgb`,Fe=`srgb-linear`,Ie=`linear`,Le=`srgb`,Re=7680,ze=35044,Be=35048,Ve=2e3;function He(e){for(let t=e.length-1;t>=0;--t)if(e[t]>=65535)return!0;return!1}function Ue(e){return ArrayBuffer.isView(e)&&!(e instanceof DataView)}function We(e){return document.createElementNS(`http://www.w3.org/1999/xhtml`,e)}function Ge(){let e=We(`canvas`);return e.style.display=`block`,e}var Ke={},qe=null;function Je(...e){let t=`THREE.`+e.shift();qe?qe(`log`,t,...e):console.log(t,...e)}function Ye(e){let t=e[0];if(typeof t==`string`&&t.startsWith(`TSL:`)){let t=e[1];t&&t.isStackTrace?e[0]+=` `+t.getLocation():e[1]=`Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.`}return e}function W(...e){e=Ye(e);let t=`THREE.`+e.shift();if(qe)qe(`warn`,t,...e);else{let n=e[0];n&&n.isStackTrace?console.warn(n.getError(t)):console.warn(t,...e)}}function G(...e){e=Ye(e);let t=`THREE.`+e.shift();if(qe)qe(`error`,t,...e);else{let n=e[0];n&&n.isStackTrace?console.error(n.getError(t)):console.error(t,...e)}}function Xe(...e){let t=e.join(` `);t in Ke||(Ke[t]=!0,W(...e))}function Ze(e,t,n){return new Promise(function(r,i){function a(){switch(e.clientWaitSync(t,e.SYNC_FLUSH_COMMANDS_BIT,0)){case e.WAIT_FAILED:i();break;case e.TIMEOUT_EXPIRED:setTimeout(a,n);break;default:r()}}setTimeout(a,n)})}var Qe={0:1,2:6,4:7,3:5,1:0,6:2,7:4,5:3},$e=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){let n=this._listeners;return n===void 0?!1:n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){let n=this._listeners;if(n===void 0)return;let r=n[e];if(r!==void 0){let e=r.indexOf(t);e!==-1&&r.splice(e,1)}}dispatchEvent(e){let t=this._listeners;if(t===void 0)return;let n=t[e.type];if(n!==void 0){e.target=this;let t=n.slice(0);for(let n=0,r=t.length;n<r;n++)t[n].call(this,e);e.target=null}}},et=`00.01.02.03.04.05.06.07.08.09.0a.0b.0c.0d.0e.0f.10.11.12.13.14.15.16.17.18.19.1a.1b.1c.1d.1e.1f.20.21.22.23.24.25.26.27.28.29.2a.2b.2c.2d.2e.2f.30.31.32.33.34.35.36.37.38.39.3a.3b.3c.3d.3e.3f.40.41.42.43.44.45.46.47.48.49.4a.4b.4c.4d.4e.4f.50.51.52.53.54.55.56.57.58.59.5a.5b.5c.5d.5e.5f.60.61.62.63.64.65.66.67.68.69.6a.6b.6c.6d.6e.6f.70.71.72.73.74.75.76.77.78.79.7a.7b.7c.7d.7e.7f.80.81.82.83.84.85.86.87.88.89.8a.8b.8c.8d.8e.8f.90.91.92.93.94.95.96.97.98.99.9a.9b.9c.9d.9e.9f.a0.a1.a2.a3.a4.a5.a6.a7.a8.a9.aa.ab.ac.ad.ae.af.b0.b1.b2.b3.b4.b5.b6.b7.b8.b9.ba.bb.bc.bd.be.bf.c0.c1.c2.c3.c4.c5.c6.c7.c8.c9.ca.cb.cc.cd.ce.cf.d0.d1.d2.d3.d4.d5.d6.d7.d8.d9.da.db.dc.dd.de.df.e0.e1.e2.e3.e4.e5.e6.e7.e8.e9.ea.eb.ec.ed.ee.ef.f0.f1.f2.f3.f4.f5.f6.f7.f8.f9.fa.fb.fc.fd.fe.ff`.split(`.`),tt=1234567,nt=Math.PI/180,rt=180/Math.PI;function it(){let e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0,r=Math.random()*4294967295|0;return(et[e&255]+et[e>>8&255]+et[e>>16&255]+et[e>>24&255]+`-`+et[t&255]+et[t>>8&255]+`-`+et[t>>16&15|64]+et[t>>24&255]+`-`+et[n&63|128]+et[n>>8&255]+`-`+et[n>>16&255]+et[n>>24&255]+et[r&255]+et[r>>8&255]+et[r>>16&255]+et[r>>24&255]).toLowerCase()}function K(e,t,n){return Math.max(t,Math.min(n,e))}function at(e,t){return(e%t+t)%t}function ot(e,t,n,r,i){return r+(e-t)*(i-r)/(n-t)}function st(e,t,n){return e===t?0:(n-e)/(t-e)}function ct(e,t,n){return(1-n)*e+n*t}function lt(e,t,n,r){return ct(e,t,1-Math.exp(-n*r))}function ut(e,t=1){return t-Math.abs(at(e,t*2)-t)}function dt(e,t,n){return e<=t?0:e>=n?1:(e=(e-t)/(n-t),e*e*(3-2*e))}function ft(e,t,n){return e<=t?0:e>=n?1:(e=(e-t)/(n-t),e*e*e*(e*(e*6-15)+10))}function pt(e,t){return e+Math.floor(Math.random()*(t-e+1))}function mt(e,t){return e+Math.random()*(t-e)}function ht(e){return e*(.5-Math.random())}function gt(e){e!==void 0&&(tt=e);let t=tt+=1831565813;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}function _t(e){return e*nt}function vt(e){return e*rt}function yt(e){return(e&e-1)==0&&e!==0}function bt(e){return 2**Math.ceil(Math.log(e)/Math.LN2)}function xt(e){return 2**Math.floor(Math.log(e)/Math.LN2)}function St(e,t,n,r,i){let a=Math.cos,o=Math.sin,s=a(n/2),c=o(n/2),l=a((t+r)/2),u=o((t+r)/2),d=a((t-r)/2),f=o((t-r)/2),p=a((r-t)/2),m=o((r-t)/2);switch(i){case`XYX`:e.set(s*u,c*d,c*f,s*l);break;case`YZY`:e.set(c*f,s*u,c*d,s*l);break;case`ZXZ`:e.set(c*d,c*f,s*u,s*l);break;case`XZX`:e.set(s*u,c*m,c*p,s*l);break;case`YXY`:e.set(c*p,s*u,c*m,s*l);break;case`ZYZ`:e.set(c*m,c*p,s*u,s*l);break;default:W(`MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: `+i)}}function Ct(e,t){switch(t.constructor){case Float32Array:return e;case Uint32Array:return e/4294967295;case Uint16Array:return e/65535;case Uint8Array:return e/255;case Int32Array:return Math.max(e/2147483647,-1);case Int16Array:return Math.max(e/32767,-1);case Int8Array:return Math.max(e/127,-1);default:throw Error(`Invalid component type.`)}}function wt(e,t){switch(t.constructor){case Float32Array:return e;case Uint32Array:return Math.round(e*4294967295);case Uint16Array:return Math.round(e*65535);case Uint8Array:return Math.round(e*255);case Int32Array:return Math.round(e*2147483647);case Int16Array:return Math.round(e*32767);case Int8Array:return Math.round(e*127);default:throw Error(`Invalid component type.`)}}var Tt={DEG2RAD:nt,RAD2DEG:rt,generateUUID:it,clamp:K,euclideanModulo:at,mapLinear:ot,inverseLerp:st,lerp:ct,damp:lt,pingpong:ut,smoothstep:dt,smootherstep:ft,randInt:pt,randFloat:mt,randFloatSpread:ht,seededRandom:gt,degToRad:_t,radToDeg:vt,isPowerOfTwo:yt,ceilPowerOfTwo:bt,floorPowerOfTwo:xt,setQuaternionFromProperEuler:St,normalize:wt,denormalize:Ct},q=class e{static{e.prototype.isVector2=!0}constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw Error(`index is out of range: `+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw Error(`index is out of range: `+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,n=this.y,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6],this.y=r[1]*t+r[4]*n+r[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=K(this.x,e.x,t.x),this.y=K(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=K(this.x,e,t),this.y=K(this.y,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(K(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(K(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let n=Math.cos(t),r=Math.sin(t),i=this.x-e.x,a=this.y-e.y;return this.x=i*n-a*r+e.x,this.y=i*r+a*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},Et=class{constructor(e=0,t=0,n=0,r=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=r}static slerpFlat(e,t,n,r,i,a,o){let s=n[r+0],c=n[r+1],l=n[r+2],u=n[r+3],d=i[a+0],f=i[a+1],p=i[a+2],m=i[a+3];if(u!==m||s!==d||c!==f||l!==p){let e=s*d+c*f+l*p+u*m;e<0&&(d=-d,f=-f,p=-p,m=-m,e=-e);let t=1-o;if(e<.9995){let n=Math.acos(e),r=Math.sin(n);t=Math.sin(t*n)/r,o=Math.sin(o*n)/r,s=s*t+d*o,c=c*t+f*o,l=l*t+p*o,u=u*t+m*o}else{s=s*t+d*o,c=c*t+f*o,l=l*t+p*o,u=u*t+m*o;let e=1/Math.sqrt(s*s+c*c+l*l+u*u);s*=e,c*=e,l*=e,u*=e}}e[t]=s,e[t+1]=c,e[t+2]=l,e[t+3]=u}static multiplyQuaternionsFlat(e,t,n,r,i,a){let o=n[r],s=n[r+1],c=n[r+2],l=n[r+3],u=i[a],d=i[a+1],f=i[a+2],p=i[a+3];return e[t]=o*p+l*u+s*f-c*d,e[t+1]=s*p+l*d+c*u-o*f,e[t+2]=c*p+l*f+o*d-s*u,e[t+3]=l*p-o*u-s*d-c*f,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,r){return this._x=e,this._y=t,this._z=n,this._w=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let n=e._x,r=e._y,i=e._z,a=e._order,o=Math.cos,s=Math.sin,c=o(n/2),l=o(r/2),u=o(i/2),d=s(n/2),f=s(r/2),p=s(i/2);switch(a){case`XYZ`:this._x=d*l*u+c*f*p,this._y=c*f*u-d*l*p,this._z=c*l*p+d*f*u,this._w=c*l*u-d*f*p;break;case`YXZ`:this._x=d*l*u+c*f*p,this._y=c*f*u-d*l*p,this._z=c*l*p-d*f*u,this._w=c*l*u+d*f*p;break;case`ZXY`:this._x=d*l*u-c*f*p,this._y=c*f*u+d*l*p,this._z=c*l*p+d*f*u,this._w=c*l*u-d*f*p;break;case`ZYX`:this._x=d*l*u-c*f*p,this._y=c*f*u+d*l*p,this._z=c*l*p-d*f*u,this._w=c*l*u+d*f*p;break;case`YZX`:this._x=d*l*u+c*f*p,this._y=c*f*u+d*l*p,this._z=c*l*p-d*f*u,this._w=c*l*u-d*f*p;break;case`XZY`:this._x=d*l*u-c*f*p,this._y=c*f*u-d*l*p,this._z=c*l*p+d*f*u,this._w=c*l*u+d*f*p;break;default:W(`Quaternion: .setFromEuler() encountered an unknown order: `+a)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){let n=t/2,r=Math.sin(n);return this._x=e.x*r,this._y=e.y*r,this._z=e.z*r,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,n=t[0],r=t[4],i=t[8],a=t[1],o=t[5],s=t[9],c=t[2],l=t[6],u=t[10],d=n+o+u;if(d>0){let e=.5/Math.sqrt(d+1);this._w=.25/e,this._x=(l-s)*e,this._y=(i-c)*e,this._z=(a-r)*e}else if(n>o&&n>u){let e=2*Math.sqrt(1+n-o-u);this._w=(l-s)/e,this._x=.25*e,this._y=(r+a)/e,this._z=(i+c)/e}else if(o>u){let e=2*Math.sqrt(1+o-n-u);this._w=(i-c)/e,this._x=(r+a)/e,this._y=.25*e,this._z=(s+l)/e}else{let e=2*Math.sqrt(1+u-n-o);this._w=(a-r)/e,this._x=(i+c)/e,this._y=(s+l)/e,this._z=.25*e}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<1e-8?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(K(this.dot(e),-1,1)))}rotateTowards(e,t){let n=this.angleTo(e);if(n===0)return this;let r=Math.min(1,t/n);return this.slerp(e,r),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x*=e,this._y*=e,this._z*=e,this._w*=e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let n=e._x,r=e._y,i=e._z,a=e._w,o=t._x,s=t._y,c=t._z,l=t._w;return this._x=n*l+a*o+r*c-i*s,this._y=r*l+a*s+i*o-n*c,this._z=i*l+a*c+n*s-r*o,this._w=a*l-n*o-r*s-i*c,this._onChangeCallback(),this}slerp(e,t){let n=e._x,r=e._y,i=e._z,a=e._w,o=this.dot(e);o<0&&(n=-n,r=-r,i=-i,a=-a,o=-o);let s=1-t;if(o<.9995){let e=Math.acos(o),c=Math.sin(e);s=Math.sin(s*e)/c,t=Math.sin(t*e)/c,this._x=this._x*s+n*t,this._y=this._y*s+r*t,this._z=this._z*s+i*t,this._w=this._w*s+a*t,this._onChangeCallback()}else this._x=this._x*s+n*t,this._y=this._y*s+r*t,this._z=this._z*s+i*t,this._w=this._w*s+a*t,this.normalize();return this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){let e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),r=Math.sqrt(1-n),i=Math.sqrt(n);return this.set(r*Math.sin(e),r*Math.cos(e),i*Math.sin(t),i*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},J=class e{static{e.prototype.isVector3=!0}constructor(e=0,t=0,n=0){this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw Error(`index is out of range: `+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw Error(`index is out of range: `+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(Ot.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(Ot.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,n=this.y,r=this.z,i=e.elements;return this.x=i[0]*t+i[3]*n+i[6]*r,this.y=i[1]*t+i[4]*n+i[7]*r,this.z=i[2]*t+i[5]*n+i[8]*r,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,n=this.y,r=this.z,i=e.elements,a=1/(i[3]*t+i[7]*n+i[11]*r+i[15]);return this.x=(i[0]*t+i[4]*n+i[8]*r+i[12])*a,this.y=(i[1]*t+i[5]*n+i[9]*r+i[13])*a,this.z=(i[2]*t+i[6]*n+i[10]*r+i[14])*a,this}applyQuaternion(e){let t=this.x,n=this.y,r=this.z,i=e.x,a=e.y,o=e.z,s=e.w,c=2*(a*r-o*n),l=2*(o*t-i*r),u=2*(i*n-a*t);return this.x=t+s*c+a*u-o*l,this.y=n+s*l+o*c-i*u,this.z=r+s*u+i*l-a*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,n=this.y,r=this.z,i=e.elements;return this.x=i[0]*t+i[4]*n+i[8]*r,this.y=i[1]*t+i[5]*n+i[9]*r,this.z=i[2]*t+i[6]*n+i[10]*r,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=K(this.x,e.x,t.x),this.y=K(this.y,e.y,t.y),this.z=K(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=K(this.x,e,t),this.y=K(this.y,e,t),this.z=K(this.z,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(K(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let n=e.x,r=e.y,i=e.z,a=t.x,o=t.y,s=t.z;return this.x=r*s-i*o,this.y=i*a-n*s,this.z=n*o-r*a,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return Dt.copy(this).projectOnVector(e),this.sub(Dt)}reflect(e){return this.sub(Dt.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(K(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y,r=this.z-e.z;return t*t+n*n+r*r}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){let r=Math.sin(t)*e;return this.x=r*Math.sin(n),this.y=Math.cos(t)*e,this.z=r*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),r=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=r,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},Dt=new J,Ot=new Et,Y=class e{static{e.prototype.isMatrix3=!0}constructor(e,t,n,r,i,a,o,s,c){this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,r,i,a,o,s,c)}set(e,t,n,r,i,a,o,s,c){let l=this.elements;return l[0]=e,l[1]=r,l[2]=o,l[3]=t,l[4]=i,l[5]=s,l[6]=n,l[7]=a,l[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,r=t.elements,i=this.elements,a=n[0],o=n[3],s=n[6],c=n[1],l=n[4],u=n[7],d=n[2],f=n[5],p=n[8],m=r[0],h=r[3],g=r[6],_=r[1],v=r[4],y=r[7],b=r[2],x=r[5],S=r[8];return i[0]=a*m+o*_+s*b,i[3]=a*h+o*v+s*x,i[6]=a*g+o*y+s*S,i[1]=c*m+l*_+u*b,i[4]=c*h+l*v+u*x,i[7]=c*g+l*y+u*S,i[2]=d*m+f*_+p*b,i[5]=d*h+f*v+p*x,i[8]=d*g+f*y+p*S,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[1],r=e[2],i=e[3],a=e[4],o=e[5],s=e[6],c=e[7],l=e[8];return t*a*l-t*o*c-n*i*l+n*o*s+r*i*c-r*a*s}invert(){let e=this.elements,t=e[0],n=e[1],r=e[2],i=e[3],a=e[4],o=e[5],s=e[6],c=e[7],l=e[8],u=l*a-o*c,d=o*s-l*i,f=c*i-a*s,p=t*u+n*d+r*f;if(p===0)return this.set(0,0,0,0,0,0,0,0,0);let m=1/p;return e[0]=u*m,e[1]=(r*c-l*n)*m,e[2]=(o*n-r*a)*m,e[3]=d*m,e[4]=(l*t-r*s)*m,e[5]=(r*i-o*t)*m,e[6]=f*m,e[7]=(n*s-c*t)*m,e[8]=(a*t-n*i)*m,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,r,i,a,o){let s=Math.cos(i),c=Math.sin(i);return this.set(n*s,n*c,-n*(s*a+c*o)+a+e,-r*c,r*s,-r*(-c*a+s*o)+o+t,0,0,1),this}scale(e,t){return this.premultiply(kt.makeScale(e,t)),this}rotate(e){return this.premultiply(kt.makeRotation(-e)),this}translate(e,t){return this.premultiply(kt.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,n=e.elements;for(let e=0;e<9;e++)if(t[e]!==n[e])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}},kt=new Y,At=new Y().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),jt=new Y().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function Mt(){let e={enabled:!0,workingColorSpace:Fe,spaces:{},convert:function(e,t,n){return this.enabled===!1||t===n||!t||!n?e:(this.spaces[t].transfer===`srgb`&&(e.r=Pt(e.r),e.g=Pt(e.g),e.b=Pt(e.b)),this.spaces[t].primaries!==this.spaces[n].primaries&&(e.applyMatrix3(this.spaces[t].toXYZ),e.applyMatrix3(this.spaces[n].fromXYZ)),this.spaces[n].transfer===`srgb`&&(e.r=Ft(e.r),e.g=Ft(e.g),e.b=Ft(e.b)),e)},workingToColorSpace:function(e,t){return this.convert(e,this.workingColorSpace,t)},colorSpaceToWorking:function(e,t){return this.convert(e,t,this.workingColorSpace)},getPrimaries:function(e){return this.spaces[e].primaries},getTransfer:function(e){return e===``?Ie:this.spaces[e].transfer},getToneMappingMode:function(e){return this.spaces[e].outputColorSpaceConfig.toneMappingMode||`standard`},getLuminanceCoefficients:function(e,t=this.workingColorSpace){return e.fromArray(this.spaces[t].luminanceCoefficients)},define:function(e){Object.assign(this.spaces,e)},_getMatrix:function(e,t,n){return e.copy(this.spaces[t].toXYZ).multiply(this.spaces[n].fromXYZ)},_getDrawingBufferColorSpace:function(e){return this.spaces[e].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(e=this.workingColorSpace){return this.spaces[e].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(t,n){return Xe(`ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace().`),e.workingToColorSpace(t,n)},toWorkingColorSpace:function(t,n){return Xe(`ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking().`),e.colorSpaceToWorking(t,n)}},t=[.64,.33,.3,.6,.15,.06],n=[.2126,.7152,.0722],r=[.3127,.329];return e.define({[Fe]:{primaries:t,whitePoint:r,transfer:Ie,toXYZ:At,fromXYZ:jt,luminanceCoefficients:n,workingColorSpaceConfig:{unpackColorSpace:Pe},outputColorSpaceConfig:{drawingBufferColorSpace:Pe}},[Pe]:{primaries:t,whitePoint:r,transfer:Le,toXYZ:At,fromXYZ:jt,luminanceCoefficients:n,outputColorSpaceConfig:{drawingBufferColorSpace:Pe}}}),e}var Nt=Mt();function Pt(e){return e<.04045?e*.0773993808:(e*.9478672986+.0521327014)**2.4}function Ft(e){return e<.0031308?e*12.92:1.055*e**.41666-.055}var It,Lt=class{static getDataURL(e,t=`image/png`){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>`u`)return e.src;let n;if(e instanceof HTMLCanvasElement)n=e;else{It===void 0&&(It=We(`canvas`)),It.width=e.width,It.height=e.height;let t=It.getContext(`2d`);e instanceof ImageData?t.putImageData(e,0,0):t.drawImage(e,0,0,e.width,e.height),n=It}return n.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<`u`&&e instanceof HTMLCanvasElement||typeof ImageBitmap<`u`&&e instanceof ImageBitmap){let t=We(`canvas`);t.width=e.width,t.height=e.height;let n=t.getContext(`2d`);n.drawImage(e,0,0,e.width,e.height);let r=n.getImageData(0,0,e.width,e.height),i=r.data;for(let e=0;e<i.length;e++)i[e]=Pt(i[e]/255)*255;return n.putImageData(r,0,0),t}else if(e.data){let t=e.data.slice(0);for(let e=0;e<t.length;e++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[e]=Math.floor(Pt(t[e]/255)*255):t[e]=Pt(t[e]);return{data:t,width:e.width,height:e.height}}else return W(`ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied.`),e}},Rt=0,zt=class{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:Rt++}),this.uuid=it(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){let t=this.data;return typeof HTMLVideoElement<`u`&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame<`u`&&t instanceof VideoFrame?e.set(t.displayWidth,t.displayHeight,0):t===null?e.set(0,0,0):e.set(t.width,t.height,t.depth||0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){let t=e===void 0||typeof e==`string`;if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let n={uuid:this.uuid,url:``},r=this.data;if(r!==null){let e;if(Array.isArray(r)){e=[];for(let t=0,n=r.length;t<n;t++)r[t].isDataTexture?e.push(Bt(r[t].image)):e.push(Bt(r[t]))}else e=Bt(r);n.url=e}return t||(e.images[this.uuid]=n),n}};function Bt(e){return typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<`u`&&e instanceof HTMLCanvasElement||typeof ImageBitmap<`u`&&e instanceof ImageBitmap?Lt.getDataURL(e):e.data?{data:Array.from(e.data),width:e.width,height:e.height,type:e.data.constructor.name}:(W(`Texture: Unable to serialize Texture.`),{})}var Vt=0,Ht=new J,Ut=class e extends $e{constructor(t=e.DEFAULT_IMAGE,n=e.DEFAULT_MAPPING,i=r,a=r,o=c,s=u,l=E,f=d,p=e.DEFAULT_ANISOTROPY,m=``){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Vt++}),this.uuid=it(),this.name=``,this.source=new zt(t),this.mipmaps=[],this.mapping=n,this.channel=0,this.wrapS=i,this.wrapT=a,this.magFilter=o,this.minFilter=s,this.anisotropy=p,this.format=l,this.internalFormat=null,this.type=f,this.offset=new q(0,0),this.repeat=new q(1,1),this.center=new q(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Y,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=m,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(t&&t.depth&&t.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(Ht).x}get height(){return this.source.getSize(Ht).y}get depth(){return this.source.getSize(Ht).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(let t in e){let n=e[t];if(n===void 0){W(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}let r=this[t];if(r===void 0){W(`Texture.setValues(): property '${t}' does not exist.`);continue}r&&n&&r.isVector2&&n.isVector2||r&&n&&r.isVector3&&n.isVector3||r&&n&&r.isMatrix3&&n.isMatrix3?r.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e==`string`;if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let n={metadata:{version:4.7,type:`Texture`,generator:`Texture.toJSON`},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:`dispose`})}transformUv(e){if(this.mapping!==300)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case n:e.x-=Math.floor(e.x);break;case r:e.x=e.x<0?0:1;break;case i:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x-=Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case n:e.y-=Math.floor(e.y);break;case r:e.y=e.y<0?0:1;break;case i:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y-=Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}};Ut.DEFAULT_IMAGE=null,Ut.DEFAULT_MAPPING=300,Ut.DEFAULT_ANISOTROPY=1;var Wt=class e{static{e.prototype.isVector4=!0}constructor(e=0,t=0,n=0,r=1){this.x=e,this.y=t,this.z=n,this.w=r}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,r){return this.x=e,this.y=t,this.z=n,this.w=r,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw Error(`index is out of range: `+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw Error(`index is out of range: `+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w===void 0?1:e.w,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,n=this.y,r=this.z,i=this.w,a=e.elements;return this.x=a[0]*t+a[4]*n+a[8]*r+a[12]*i,this.y=a[1]*t+a[5]*n+a[9]*r+a[13]*i,this.z=a[2]*t+a[6]*n+a[10]*r+a[14]*i,this.w=a[3]*t+a[7]*n+a[11]*r+a[15]*i,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,r,i,a=.01,o=.1,s=e.elements,c=s[0],l=s[4],u=s[8],d=s[1],f=s[5],p=s[9],m=s[2],h=s[6],g=s[10];if(Math.abs(l-d)<a&&Math.abs(u-m)<a&&Math.abs(p-h)<a){if(Math.abs(l+d)<o&&Math.abs(u+m)<o&&Math.abs(p+h)<o&&Math.abs(c+f+g-3)<o)return this.set(1,0,0,0),this;t=Math.PI;let e=(c+1)/2,s=(f+1)/2,_=(g+1)/2,v=(l+d)/4,y=(u+m)/4,b=(p+h)/4;return e>s&&e>_?e<a?(n=0,r=.707106781,i=.707106781):(n=Math.sqrt(e),r=v/n,i=y/n):s>_?s<a?(n=.707106781,r=0,i=.707106781):(r=Math.sqrt(s),n=v/r,i=b/r):_<a?(n=.707106781,r=.707106781,i=0):(i=Math.sqrt(_),n=y/i,r=b/i),this.set(n,r,i,t),this}let _=Math.sqrt((h-p)*(h-p)+(u-m)*(u-m)+(d-l)*(d-l));return Math.abs(_)<.001&&(_=1),this.x=(h-p)/_,this.y=(u-m)/_,this.z=(d-l)/_,this.w=Math.acos((c+f+g-1)/2),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=K(this.x,e.x,t.x),this.y=K(this.y,e.y,t.y),this.z=K(this.z,e.z,t.z),this.w=K(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=K(this.x,e,t),this.y=K(this.y,e,t),this.z=K(this.z,e,t),this.w=K(this.w,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(K(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},Gt=class extends $e{constructor(e=1,t=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:c,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1},n),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=n.depth,this.scissor=new Wt(0,0,e,t),this.scissorTest=!1,this.viewport=new Wt(0,0,e,t),this.textures=[];let r=new Ut({width:e,height:t,depth:n.depth}),i=n.count;for(let e=0;e<i;e++)this.textures[e]=r.clone(),this.textures[e].isRenderTargetTexture=!0,this.textures[e].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview}_setTextureOptions(e={}){let t={minFilter:c,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let e=0;e<this.textures.length;e++)this.textures[e].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),e!==null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let r=0,i=this.textures.length;r<i;r++)this.textures[r].image.width=e,this.textures[r].image.height=t,this.textures[r].image.depth=n,this.textures[r].isData3DTexture!==!0&&(this.textures[r].isArrayTexture=this.textures[r].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,n=e.textures.length;t<n;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;let n=Object.assign({},e.textures[t].image);this.textures[t].source=new zt(n)}return this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this.multiview=e.multiview,this}dispose(){this.dispatchEvent({type:`dispose`})}},Kt=class extends Gt{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}},qt=class extends Ut{constructor(e=null,t=1,n=1,i=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:i},this.magFilter=a,this.minFilter=a,this.wrapR=r,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}},Jt=class extends Ut{constructor(e=null,t=1,n=1,i=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:i},this.magFilter=a,this.minFilter=a,this.wrapR=r,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}},Yt=class e{static{e.prototype.isMatrix4=!0}constructor(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m,h){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m,h)}set(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m,h){let g=this.elements;return g[0]=e,g[4]=t,g[8]=n,g[12]=r,g[1]=i,g[5]=a,g[9]=o,g[13]=s,g[2]=c,g[6]=l,g[10]=u,g[14]=d,g[3]=f,g[7]=p,g[11]=m,g[15]=h,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new e().fromArray(this.elements)}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){let t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return this.determinant()===0?(e.set(1,0,0),t.set(0,1,0),n.set(0,0,1),this):(e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this)}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){if(e.determinant()===0)return this.identity();let t=this.elements,n=e.elements,r=1/Xt.setFromMatrixColumn(e,0).length(),i=1/Xt.setFromMatrixColumn(e,1).length(),a=1/Xt.setFromMatrixColumn(e,2).length();return t[0]=n[0]*r,t[1]=n[1]*r,t[2]=n[2]*r,t[3]=0,t[4]=n[4]*i,t[5]=n[5]*i,t[6]=n[6]*i,t[7]=0,t[8]=n[8]*a,t[9]=n[9]*a,t[10]=n[10]*a,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,n=e.x,r=e.y,i=e.z,a=Math.cos(n),o=Math.sin(n),s=Math.cos(r),c=Math.sin(r),l=Math.cos(i),u=Math.sin(i);if(e.order===`XYZ`){let e=a*l,n=a*u,r=o*l,i=o*u;t[0]=s*l,t[4]=-s*u,t[8]=c,t[1]=n+r*c,t[5]=e-i*c,t[9]=-o*s,t[2]=i-e*c,t[6]=r+n*c,t[10]=a*s}else if(e.order===`YXZ`){let e=s*l,n=s*u,r=c*l,i=c*u;t[0]=e+i*o,t[4]=r*o-n,t[8]=a*c,t[1]=a*u,t[5]=a*l,t[9]=-o,t[2]=n*o-r,t[6]=i+e*o,t[10]=a*s}else if(e.order===`ZXY`){let e=s*l,n=s*u,r=c*l,i=c*u;t[0]=e-i*o,t[4]=-a*u,t[8]=r+n*o,t[1]=n+r*o,t[5]=a*l,t[9]=i-e*o,t[2]=-a*c,t[6]=o,t[10]=a*s}else if(e.order===`ZYX`){let e=a*l,n=a*u,r=o*l,i=o*u;t[0]=s*l,t[4]=r*c-n,t[8]=e*c+i,t[1]=s*u,t[5]=i*c+e,t[9]=n*c-r,t[2]=-c,t[6]=o*s,t[10]=a*s}else if(e.order===`YZX`){let e=a*s,n=a*c,r=o*s,i=o*c;t[0]=s*l,t[4]=i-e*u,t[8]=r*u+n,t[1]=u,t[5]=a*l,t[9]=-o*l,t[2]=-c*l,t[6]=n*u+r,t[10]=e-i*u}else if(e.order===`XZY`){let e=a*s,n=a*c,r=o*s,i=o*c;t[0]=s*l,t[4]=-u,t[8]=c*l,t[1]=e*u+i,t[5]=a*l,t[9]=n*u-r,t[2]=r*u-n,t[6]=o*l,t[10]=i*u+e}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(Qt,e,$t)}lookAt(e,t,n){let r=this.elements;return nn.subVectors(e,t),nn.lengthSq()===0&&(nn.z=1),nn.normalize(),en.crossVectors(n,nn),en.lengthSq()===0&&(Math.abs(n.z)===1?nn.x+=1e-4:nn.z+=1e-4,nn.normalize(),en.crossVectors(n,nn)),en.normalize(),tn.crossVectors(nn,en),r[0]=en.x,r[4]=tn.x,r[8]=nn.x,r[1]=en.y,r[5]=tn.y,r[9]=nn.y,r[2]=en.z,r[6]=tn.z,r[10]=nn.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,r=t.elements,i=this.elements,a=n[0],o=n[4],s=n[8],c=n[12],l=n[1],u=n[5],d=n[9],f=n[13],p=n[2],m=n[6],h=n[10],g=n[14],_=n[3],v=n[7],y=n[11],b=n[15],x=r[0],S=r[4],C=r[8],w=r[12],T=r[1],E=r[5],D=r[9],O=r[13],k=r[2],A=r[6],j=r[10],M=r[14],N=r[3],P=r[7],F=r[11],I=r[15];return i[0]=a*x+o*T+s*k+c*N,i[4]=a*S+o*E+s*A+c*P,i[8]=a*C+o*D+s*j+c*F,i[12]=a*w+o*O+s*M+c*I,i[1]=l*x+u*T+d*k+f*N,i[5]=l*S+u*E+d*A+f*P,i[9]=l*C+u*D+d*j+f*F,i[13]=l*w+u*O+d*M+f*I,i[2]=p*x+m*T+h*k+g*N,i[6]=p*S+m*E+h*A+g*P,i[10]=p*C+m*D+h*j+g*F,i[14]=p*w+m*O+h*M+g*I,i[3]=_*x+v*T+y*k+b*N,i[7]=_*S+v*E+y*A+b*P,i[11]=_*C+v*D+y*j+b*F,i[15]=_*w+v*O+y*M+b*I,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[4],r=e[8],i=e[12],a=e[1],o=e[5],s=e[9],c=e[13],l=e[2],u=e[6],d=e[10],f=e[14],p=e[3],m=e[7],h=e[11],g=e[15],_=s*f-c*d,v=o*f-c*u,y=o*d-s*u,b=a*f-c*l,x=a*d-s*l,S=a*u-o*l;return t*(m*_-h*v+g*y)-n*(p*_-h*b+g*x)+r*(p*v-m*b+g*S)-i*(p*y-m*x+h*S)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){let r=this.elements;return e.isVector3?(r[12]=e.x,r[13]=e.y,r[14]=e.z):(r[12]=e,r[13]=t,r[14]=n),this}invert(){let e=this.elements,t=e[0],n=e[1],r=e[2],i=e[3],a=e[4],o=e[5],s=e[6],c=e[7],l=e[8],u=e[9],d=e[10],f=e[11],p=e[12],m=e[13],h=e[14],g=e[15],_=t*o-n*a,v=t*s-r*a,y=t*c-i*a,b=n*s-r*o,x=n*c-i*o,S=r*c-i*s,C=l*m-u*p,w=l*h-d*p,T=l*g-f*p,E=u*h-d*m,D=u*g-f*m,O=d*g-f*h,k=_*O-v*D+y*E+b*T-x*w+S*C;if(k===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let A=1/k;return e[0]=(o*O-s*D+c*E)*A,e[1]=(r*D-n*O-i*E)*A,e[2]=(m*S-h*x+g*b)*A,e[3]=(d*x-u*S-f*b)*A,e[4]=(s*T-a*O-c*w)*A,e[5]=(t*O-r*T+i*w)*A,e[6]=(h*y-p*S-g*v)*A,e[7]=(l*S-d*y+f*v)*A,e[8]=(a*D-o*T+c*C)*A,e[9]=(n*T-t*D-i*C)*A,e[10]=(p*x-m*y+g*_)*A,e[11]=(u*y-l*x-f*_)*A,e[12]=(o*w-a*E-s*C)*A,e[13]=(t*E-n*w+r*C)*A,e[14]=(m*v-p*b-h*_)*A,e[15]=(l*b-u*v+d*_)*A,this}scale(e){let t=this.elements,n=e.x,r=e.y,i=e.z;return t[0]*=n,t[4]*=r,t[8]*=i,t[1]*=n,t[5]*=r,t[9]*=i,t[2]*=n,t[6]*=r,t[10]*=i,t[3]*=n,t[7]*=r,t[11]*=i,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],r=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,r))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){let t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let n=Math.cos(t),r=Math.sin(t),i=1-n,a=e.x,o=e.y,s=e.z,c=i*a,l=i*o;return this.set(c*a+n,c*o-r*s,c*s+r*o,0,c*o+r*s,l*o+n,l*s-r*a,0,c*s-r*o,l*s+r*a,i*s*s+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,r,i,a){return this.set(1,n,i,0,e,1,a,0,t,r,1,0,0,0,0,1),this}compose(e,t,n){let r=this.elements,i=t._x,a=t._y,o=t._z,s=t._w,c=i+i,l=a+a,u=o+o,d=i*c,f=i*l,p=i*u,m=a*l,h=a*u,g=o*u,_=s*c,v=s*l,y=s*u,b=n.x,x=n.y,S=n.z;return r[0]=(1-(m+g))*b,r[1]=(f+y)*b,r[2]=(p-v)*b,r[3]=0,r[4]=(f-y)*x,r[5]=(1-(d+g))*x,r[6]=(h+_)*x,r[7]=0,r[8]=(p+v)*S,r[9]=(h-_)*S,r[10]=(1-(d+m))*S,r[11]=0,r[12]=e.x,r[13]=e.y,r[14]=e.z,r[15]=1,this}decompose(e,t,n){let r=this.elements;e.x=r[12],e.y=r[13],e.z=r[14];let i=this.determinant();if(i===0)return n.set(1,1,1),t.identity(),this;let a=Xt.set(r[0],r[1],r[2]).length(),o=Xt.set(r[4],r[5],r[6]).length(),s=Xt.set(r[8],r[9],r[10]).length();i<0&&(a=-a),Zt.copy(this);let c=1/a,l=1/o,u=1/s;return Zt.elements[0]*=c,Zt.elements[1]*=c,Zt.elements[2]*=c,Zt.elements[4]*=l,Zt.elements[5]*=l,Zt.elements[6]*=l,Zt.elements[8]*=u,Zt.elements[9]*=u,Zt.elements[10]*=u,t.setFromRotationMatrix(Zt),n.x=a,n.y=o,n.z=s,this}makePerspective(e,t,n,r,i,a,o=Ve,s=!1){let c=this.elements,l=2*i/(t-e),u=2*i/(n-r),d=(t+e)/(t-e),f=(n+r)/(n-r),p,m;if(s)p=i/(a-i),m=a*i/(a-i);else if(o===2e3)p=-(a+i)/(a-i),m=-2*a*i/(a-i);else if(o===2001)p=-a/(a-i),m=-a*i/(a-i);else throw Error(`THREE.Matrix4.makePerspective(): Invalid coordinate system: `+o);return c[0]=l,c[4]=0,c[8]=d,c[12]=0,c[1]=0,c[5]=u,c[9]=f,c[13]=0,c[2]=0,c[6]=0,c[10]=p,c[14]=m,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,n,r,i,a,o=Ve,s=!1){let c=this.elements,l=2/(t-e),u=2/(n-r),d=-(t+e)/(t-e),f=-(n+r)/(n-r),p,m;if(s)p=1/(a-i),m=a/(a-i);else if(o===2e3)p=-2/(a-i),m=-(a+i)/(a-i);else if(o===2001)p=-1/(a-i),m=-i/(a-i);else throw Error(`THREE.Matrix4.makeOrthographic(): Invalid coordinate system: `+o);return c[0]=l,c[4]=0,c[8]=0,c[12]=d,c[1]=0,c[5]=u,c[9]=0,c[13]=f,c[2]=0,c[6]=0,c[10]=p,c[14]=m,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){let t=this.elements,n=e.elements;for(let e=0;e<16;e++)if(t[e]!==n[e])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}},Xt=new J,Zt=new Yt,Qt=new J(0,0,0),$t=new J(1,1,1),en=new J,tn=new J,nn=new J,rn=new Yt,an=new Et,on=class e{constructor(t=0,n=0,r=0,i=e.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=n,this._z=r,this._order=i}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,r=this._order){return this._x=e,this._y=t,this._z=n,this._order=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){let r=e.elements,i=r[0],a=r[4],o=r[8],s=r[1],c=r[5],l=r[9],u=r[2],d=r[6],f=r[10];switch(t){case`XYZ`:this._y=Math.asin(K(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-l,f),this._z=Math.atan2(-a,i)):(this._x=Math.atan2(d,c),this._z=0);break;case`YXZ`:this._x=Math.asin(-K(l,-1,1)),Math.abs(l)<.9999999?(this._y=Math.atan2(o,f),this._z=Math.atan2(s,c)):(this._y=Math.atan2(-u,i),this._z=0);break;case`ZXY`:this._x=Math.asin(K(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-u,f),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(s,i));break;case`ZYX`:this._y=Math.asin(-K(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(d,f),this._z=Math.atan2(s,i)):(this._x=0,this._z=Math.atan2(-a,c));break;case`YZX`:this._z=Math.asin(K(s,-1,1)),Math.abs(s)<.9999999?(this._x=Math.atan2(-l,c),this._y=Math.atan2(-u,i)):(this._x=0,this._y=Math.atan2(o,f));break;case`XZY`:this._z=Math.asin(-K(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(o,i)):(this._x=Math.atan2(-l,f),this._y=0);break;default:W(`Euler: .setFromRotationMatrix() encountered an unknown order: `+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return rn.makeRotationFromQuaternion(e),this.setFromRotationMatrix(rn,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return an.setFromEuler(this),this.setFromQuaternion(an,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};on.DEFAULT_ORDER=`XYZ`;var sn=class{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!=0}},cn=0,ln=new J,un=new Et,dn=new Yt,fn=new J,pn=new J,mn=new J,hn=new Et,gn=new J(1,0,0),_n=new J(0,1,0),vn=new J(0,0,1),yn={type:`added`},bn={type:`removed`},xn={type:`childadded`,child:null},Sn={type:`childremoved`,child:null},Cn=class e extends $e{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:cn++}),this.uuid=it(),this.name=``,this.type=`Object3D`,this.parent=null,this.children=[],this.up=e.DEFAULT_UP.clone();let t=new J,n=new on,r=new Et,i=new J(1,1,1);function a(){r.setFromEuler(n,!1)}function o(){n.setFromQuaternion(r,void 0,!1)}n._onChange(a),r._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:n},quaternion:{configurable:!0,enumerable:!0,value:r},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new Yt},normalMatrix:{value:new Y}}),this.matrix=new Yt,this.matrixWorld=new Yt,this.matrixAutoUpdate=e.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=e.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new sn,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return un.setFromAxisAngle(e,t),this.quaternion.multiply(un),this}rotateOnWorldAxis(e,t){return un.setFromAxisAngle(e,t),this.quaternion.premultiply(un),this}rotateX(e){return this.rotateOnAxis(gn,e)}rotateY(e){return this.rotateOnAxis(_n,e)}rotateZ(e){return this.rotateOnAxis(vn,e)}translateOnAxis(e,t){return ln.copy(e).applyQuaternion(this.quaternion),this.position.add(ln.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(gn,e)}translateY(e){return this.translateOnAxis(_n,e)}translateZ(e){return this.translateOnAxis(vn,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(dn.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?fn.copy(e):fn.set(e,t,n);let r=this.parent;this.updateWorldMatrix(!0,!1),pn.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?dn.lookAt(pn,fn,this.up):dn.lookAt(fn,pn,this.up),this.quaternion.setFromRotationMatrix(dn),r&&(dn.extractRotation(r.matrixWorld),un.setFromRotationMatrix(dn),this.quaternion.premultiply(un.invert()))}add(e){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return e===this?(G(`Object3D.add: object can't be added as a child of itself.`,e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(yn),xn.child=e,this.dispatchEvent(xn),xn.child=null):G(`Object3D.add: object not an instance of THREE.Object3D.`,e),this)}remove(e){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.remove(arguments[e]);return this}let t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(bn),Sn.child=e,this.dispatchEvent(Sn),Sn.child=null),this}removeFromParent(){let e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),dn.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),dn.multiply(e.parent.matrixWorld)),e.applyMatrix4(dn),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(yn),xn.child=e,this.dispatchEvent(xn),xn.child=null,this}getObjectById(e){return this.getObjectByProperty(`id`,e)}getObjectByName(e){return this.getObjectByProperty(`name`,e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,r=this.children.length;n<r;n++){let r=this.children[n].getObjectByProperty(e,t);if(r!==void 0)return r}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);let r=this.children;for(let i=0,a=r.length;i<a;i++)r[i].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(pn,e,mn),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(pn,hn,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].traverseVisible(e)}traverseAncestors(e){let t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let e=this.pivot;if(e!==null){let t=e.x,n=e.y,r=e.z,i=this.matrix.elements;i[12]+=t-i[0]*t-i[4]*n-i[8]*r,i[13]+=n-i[1]*t-i[5]*n-i[9]*r,i[14]+=r-i[2]*t-i[6]*n-i[10]*r}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t){let n=this.parent;if(e===!0&&n!==null&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),t===!0){let e=this.children;for(let t=0,n=e.length;t<n;t++)e[t].updateWorldMatrix(!1,!0)}}toJSON(e){let t=e===void 0||typeof e==`string`,n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:`Object`,generator:`Object3D.toJSON`});let r={};r.uuid=this.uuid,r.type=this.type,this.name!==``&&(r.name=this.name),this.castShadow===!0&&(r.castShadow=!0),this.receiveShadow===!0&&(r.receiveShadow=!0),this.visible===!1&&(r.visible=!1),this.frustumCulled===!1&&(r.frustumCulled=!1),this.renderOrder!==0&&(r.renderOrder=this.renderOrder),this.static!==!1&&(r.static=this.static),Object.keys(this.userData).length>0&&(r.userData=this.userData),r.layers=this.layers.mask,r.matrix=this.matrix.toArray(),r.up=this.up.toArray(),this.pivot!==null&&(r.pivot=this.pivot.toArray()),this.matrixAutoUpdate===!1&&(r.matrixAutoUpdate=!1),this.morphTargetDictionary!==void 0&&(r.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(r.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(r.type=`InstancedMesh`,r.count=this.count,r.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(r.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(r.type=`BatchedMesh`,r.perObjectFrustumCulled=this.perObjectFrustumCulled,r.sortObjects=this.sortObjects,r.drawRanges=this._drawRanges,r.reservedRanges=this._reservedRanges,r.geometryInfo=this._geometryInfo.map(e=>({...e,boundingBox:e.boundingBox?e.boundingBox.toJSON():void 0,boundingSphere:e.boundingSphere?e.boundingSphere.toJSON():void 0})),r.instanceInfo=this._instanceInfo.map(e=>({...e})),r.availableInstanceIds=this._availableInstanceIds.slice(),r.availableGeometryIds=this._availableGeometryIds.slice(),r.nextIndexStart=this._nextIndexStart,r.nextVertexStart=this._nextVertexStart,r.geometryCount=this._geometryCount,r.maxInstanceCount=this._maxInstanceCount,r.maxVertexCount=this._maxVertexCount,r.maxIndexCount=this._maxIndexCount,r.geometryInitialized=this._geometryInitialized,r.matricesTexture=this._matricesTexture.toJSON(e),r.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(r.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(r.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(r.boundingBox=this.boundingBox.toJSON()));function i(t,n){return t[n.uuid]===void 0&&(t[n.uuid]=n.toJSON(e)),n.uuid}if(this.isScene)this.background&&(this.background.isColor?r.background=this.background.toJSON():this.background.isTexture&&(r.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(r.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){r.geometry=i(e.geometries,this.geometry);let t=this.geometry.parameters;if(t!==void 0&&t.shapes!==void 0){let n=t.shapes;if(Array.isArray(n))for(let t=0,r=n.length;t<r;t++){let r=n[t];i(e.shapes,r)}else i(e.shapes,n)}}if(this.isSkinnedMesh&&(r.bindMode=this.bindMode,r.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(i(e.skeletons,this.skeleton),r.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let t=[];for(let n=0,r=this.material.length;n<r;n++)t.push(i(e.materials,this.material[n]));r.material=t}else r.material=i(e.materials,this.material);if(this.children.length>0){r.children=[];for(let t=0;t<this.children.length;t++)r.children.push(this.children[t].toJSON(e).object)}if(this.animations.length>0){r.animations=[];for(let t=0;t<this.animations.length;t++){let n=this.animations[t];r.animations.push(i(e.animations,n))}}if(t){let t=a(e.geometries),r=a(e.materials),i=a(e.textures),o=a(e.images),s=a(e.shapes),c=a(e.skeletons),l=a(e.animations),u=a(e.nodes);t.length>0&&(n.geometries=t),r.length>0&&(n.materials=r),i.length>0&&(n.textures=i),o.length>0&&(n.images=o),s.length>0&&(n.shapes=s),c.length>0&&(n.skeletons=c),l.length>0&&(n.animations=l),u.length>0&&(n.nodes=u)}return n.object=r,n;function a(e){let t=[];for(let n in e){let r=e[n];delete r.metadata,t.push(r)}return t}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot===null?null:e.pivot.clone(),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let t=0;t<e.children.length;t++){let n=e.children[t];this.add(n.clone())}return this}};Cn.DEFAULT_UP=new J(0,1,0),Cn.DEFAULT_MATRIX_AUTO_UPDATE=!0,Cn.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var wn=class extends Cn{constructor(){super(),this.isGroup=!0,this.type=`Group`}},Tn={type:`move`},En=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new wn,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new wn,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new J,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new J),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new wn,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new J,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new J,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:`connected`,data:e}),this}disconnect(e){return this.dispatchEvent({type:`disconnected`,data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let r=null,i=null,a=null,o=this._targetRay,s=this._grip,c=this._hand;if(e&&t.session.visibilityState!==`visible-blurred`){if(c&&e.hand){a=!0;for(let r of e.hand.values()){let e=t.getJointPose(r,n),i=this._getHandJoint(c,r);e!==null&&(i.matrix.fromArray(e.transform.matrix),i.matrix.decompose(i.position,i.rotation,i.scale),i.matrixWorldNeedsUpdate=!0,i.jointRadius=e.radius),i.visible=e!==null}let r=c.joints[`index-finger-tip`],i=c.joints[`thumb-tip`],o=r.position.distanceTo(i.position);c.inputState.pinching&&o>.025?(c.inputState.pinching=!1,this.dispatchEvent({type:`pinchend`,handedness:e.handedness,target:this})):!c.inputState.pinching&&o<=.015&&(c.inputState.pinching=!0,this.dispatchEvent({type:`pinchstart`,handedness:e.handedness,target:this}))}else s!==null&&e.gripSpace&&(i=t.getPose(e.gripSpace,n),i!==null&&(s.matrix.fromArray(i.transform.matrix),s.matrix.decompose(s.position,s.rotation,s.scale),s.matrixWorldNeedsUpdate=!0,i.linearVelocity?(s.hasLinearVelocity=!0,s.linearVelocity.copy(i.linearVelocity)):s.hasLinearVelocity=!1,i.angularVelocity?(s.hasAngularVelocity=!0,s.angularVelocity.copy(i.angularVelocity)):s.hasAngularVelocity=!1,s.eventsEnabled&&s.dispatchEvent({type:`gripUpdated`,data:e,target:this})));o!==null&&(r=t.getPose(e.targetRaySpace,n),r===null&&i!==null&&(r=i),r!==null&&(o.matrix.fromArray(r.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,r.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(r.linearVelocity)):o.hasLinearVelocity=!1,r.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(r.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(Tn)))}return o!==null&&(o.visible=r!==null),s!==null&&(s.visible=i!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let n=new wn;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}},Dn={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},On={h:0,s:0,l:0},kn={h:0,s:0,l:0};function An(e,t,n){return n<0&&(n+=1),n>1&&--n,n<1/6?e+(t-e)*6*n:n<1/2?t:n<2/3?e+(t-e)*6*(2/3-n):e}var X=class{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){let t=e;t&&t.isColor?this.copy(t):typeof t==`number`?this.setHex(t):typeof t==`string`&&this.setStyle(t)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=Pe){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,Nt.colorSpaceToWorking(this,t),this}setRGB(e,t,n,r=Nt.workingColorSpace){return this.r=e,this.g=t,this.b=n,Nt.colorSpaceToWorking(this,r),this}setHSL(e,t,n,r=Nt.workingColorSpace){if(e=at(e,1),t=K(t,0,1),n=K(n,0,1),t===0)this.r=this.g=this.b=n;else{let r=n<=.5?n*(1+t):n+t-n*t,i=2*n-r;this.r=An(i,r,e+1/3),this.g=An(i,r,e),this.b=An(i,r,e-1/3)}return Nt.colorSpaceToWorking(this,r),this}setStyle(e,t=Pe){function n(t){t!==void 0&&parseFloat(t)<1&&W(`Color: Alpha component of `+e+` will be ignored.`)}let r;if(r=/^(\w+)\(([^\)]*)\)/.exec(e)){let i,a=r[1],o=r[2];switch(a){case`rgb`:case`rgba`:if(i=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(i[4]),this.setRGB(Math.min(255,parseInt(i[1],10))/255,Math.min(255,parseInt(i[2],10))/255,Math.min(255,parseInt(i[3],10))/255,t);if(i=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(i[4]),this.setRGB(Math.min(100,parseInt(i[1],10))/100,Math.min(100,parseInt(i[2],10))/100,Math.min(100,parseInt(i[3],10))/100,t);break;case`hsl`:case`hsla`:if(i=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(i[4]),this.setHSL(parseFloat(i[1])/360,parseFloat(i[2])/100,parseFloat(i[3])/100,t);break;default:W(`Color: Unknown color model `+e)}}else if(r=/^\#([A-Fa-f\d]+)$/.exec(e)){let n=r[1],i=n.length;if(i===3)return this.setRGB(parseInt(n.charAt(0),16)/15,parseInt(n.charAt(1),16)/15,parseInt(n.charAt(2),16)/15,t);if(i===6)return this.setHex(parseInt(n,16),t);W(`Color: Invalid hex color `+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=Pe){let n=Dn[e.toLowerCase()];return n===void 0?W(`Color: Unknown color `+e):this.setHex(n,t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=Pt(e.r),this.g=Pt(e.g),this.b=Pt(e.b),this}copyLinearToSRGB(e){return this.r=Ft(e.r),this.g=Ft(e.g),this.b=Ft(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=Pe){return Nt.workingToColorSpace(jn.copy(this),e),Math.round(K(jn.r*255,0,255))*65536+Math.round(K(jn.g*255,0,255))*256+Math.round(K(jn.b*255,0,255))}getHexString(e=Pe){return(`000000`+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=Nt.workingColorSpace){Nt.workingToColorSpace(jn.copy(this),t);let n=jn.r,r=jn.g,i=jn.b,a=Math.max(n,r,i),o=Math.min(n,r,i),s,c,l=(o+a)/2;if(o===a)s=0,c=0;else{let e=a-o;switch(c=l<=.5?e/(a+o):e/(2-a-o),a){case n:s=(r-i)/e+(r<i?6:0);break;case r:s=(i-n)/e+2;break;case i:s=(n-r)/e+4;break}s/=6}return e.h=s,e.s=c,e.l=l,e}getRGB(e,t=Nt.workingColorSpace){return Nt.workingToColorSpace(jn.copy(this),t),e.r=jn.r,e.g=jn.g,e.b=jn.b,e}getStyle(e=Pe){Nt.workingToColorSpace(jn.copy(this),e);let t=jn.r,n=jn.g,r=jn.b;return e===`srgb`?`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(r*255)})`:`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${r.toFixed(3)})`}offsetHSL(e,t,n){return this.getHSL(On),this.setHSL(On.h+e,On.s+t,On.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(On),e.getHSL(kn);let n=ct(On.h,kn.h,t),r=ct(On.s,kn.s,t),i=ct(On.l,kn.l,t);return this.setHSL(n,r,i),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,n=this.g,r=this.b,i=e.elements;return this.r=i[0]*t+i[3]*n+i[6]*r,this.g=i[1]*t+i[4]*n+i[7]*r,this.b=i[2]*t+i[5]*n+i[8]*r,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},jn=new X;X.NAMES=Dn;var Mn=class extends Cn{constructor(){super(),this.isScene=!0,this.type=`Scene`,this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new on,this.environmentIntensity=1,this.environmentRotation=new on,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<`u`&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent(`observe`,{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(t.object.environmentIntensity=this.environmentIntensity),t.object.environmentRotation=this.environmentRotation.toArray(),t}},Nn=new J,Pn=new J,Fn=new J,In=new J,Ln=new J,Rn=new J,zn=new J,Bn=new J,Vn=new J,Hn=new J,Un=new Wt,Wn=new Wt,Gn=new Wt,Kn=class e{constructor(e=new J,t=new J,n=new J){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,r){r.subVectors(n,t),Nn.subVectors(e,t),r.cross(Nn);let i=r.lengthSq();return i>0?r.multiplyScalar(1/Math.sqrt(i)):r.set(0,0,0)}static getBarycoord(e,t,n,r,i){Nn.subVectors(r,t),Pn.subVectors(n,t),Fn.subVectors(e,t);let a=Nn.dot(Nn),o=Nn.dot(Pn),s=Nn.dot(Fn),c=Pn.dot(Pn),l=Pn.dot(Fn),u=a*c-o*o;if(u===0)return i.set(0,0,0),null;let d=1/u,f=(c*s-o*l)*d,p=(a*l-o*s)*d;return i.set(1-f-p,p,f)}static containsPoint(e,t,n,r){return this.getBarycoord(e,t,n,r,In)===null?!1:In.x>=0&&In.y>=0&&In.x+In.y<=1}static getInterpolation(e,t,n,r,i,a,o,s){return this.getBarycoord(e,t,n,r,In)===null?(s.x=0,s.y=0,`z`in s&&(s.z=0),`w`in s&&(s.w=0),null):(s.setScalar(0),s.addScaledVector(i,In.x),s.addScaledVector(a,In.y),s.addScaledVector(o,In.z),s)}static getInterpolatedAttribute(e,t,n,r,i,a){return Un.setScalar(0),Wn.setScalar(0),Gn.setScalar(0),Un.fromBufferAttribute(e,t),Wn.fromBufferAttribute(e,n),Gn.fromBufferAttribute(e,r),a.setScalar(0),a.addScaledVector(Un,i.x),a.addScaledVector(Wn,i.y),a.addScaledVector(Gn,i.z),a}static isFrontFacing(e,t,n,r){return Nn.subVectors(n,t),Pn.subVectors(e,t),Nn.cross(Pn).dot(r)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,r){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[r]),this}setFromAttributeAndIndices(e,t,n,r){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,r),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return Nn.subVectors(this.c,this.b),Pn.subVectors(this.a,this.b),Nn.cross(Pn).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return e.getNormal(this.a,this.b,this.c,t)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,n){return e.getBarycoord(t,this.a,this.b,this.c,n)}getInterpolation(t,n,r,i,a){return e.getInterpolation(t,this.a,this.b,this.c,n,r,i,a)}containsPoint(t){return e.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return e.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let n=this.a,r=this.b,i=this.c,a,o;Ln.subVectors(r,n),Rn.subVectors(i,n),Bn.subVectors(e,n);let s=Ln.dot(Bn),c=Rn.dot(Bn);if(s<=0&&c<=0)return t.copy(n);Vn.subVectors(e,r);let l=Ln.dot(Vn),u=Rn.dot(Vn);if(l>=0&&u<=l)return t.copy(r);let d=s*u-l*c;if(d<=0&&s>=0&&l<=0)return a=s/(s-l),t.copy(n).addScaledVector(Ln,a);Hn.subVectors(e,i);let f=Ln.dot(Hn),p=Rn.dot(Hn);if(p>=0&&f<=p)return t.copy(i);let m=f*c-s*p;if(m<=0&&c>=0&&p<=0)return o=c/(c-p),t.copy(n).addScaledVector(Rn,o);let h=l*p-f*u;if(h<=0&&u-l>=0&&f-p>=0)return zn.subVectors(i,r),o=(u-l)/(u-l+(f-p)),t.copy(r).addScaledVector(zn,o);let g=1/(h+m+d);return a=m*g,o=d*g,t.copy(n).addScaledVector(Ln,a).addScaledVector(Rn,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}},qn=class{constructor(e=new J(1/0,1/0,1/0),t=new J(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(Yn.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(Yn.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let n=Yn.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let n=e.geometry;if(n!==void 0){let r=n.getAttribute(`position`);if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0)for(let t=0,n=r.count;t<n;t++)e.isMesh===!0?e.getVertexPosition(t,Yn):Yn.fromBufferAttribute(r,t),Yn.applyMatrix4(e.matrixWorld),this.expandByPoint(Yn);else e.boundingBox===void 0?(n.boundingBox===null&&n.computeBoundingBox(),Xn.copy(n.boundingBox)):(e.boundingBox===null&&e.computeBoundingBox(),Xn.copy(e.boundingBox)),Xn.applyMatrix4(e.matrixWorld),this.union(Xn)}let r=e.children;for(let e=0,n=r.length;e<n;e++)this.expandByObject(r[e],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,Yn),Yn.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(rr),ir.subVectors(this.max,rr),Zn.subVectors(e.a,rr),Qn.subVectors(e.b,rr),$n.subVectors(e.c,rr),er.subVectors(Qn,Zn),tr.subVectors($n,Qn),nr.subVectors(Zn,$n);let t=[0,-er.z,er.y,0,-tr.z,tr.y,0,-nr.z,nr.y,er.z,0,-er.x,tr.z,0,-tr.x,nr.z,0,-nr.x,-er.y,er.x,0,-tr.y,tr.x,0,-nr.y,nr.x,0];return!sr(t,Zn,Qn,$n,ir)||(t=[1,0,0,0,1,0,0,0,1],!sr(t,Zn,Qn,$n,ir))?!1:(ar.crossVectors(er,tr),t=[ar.x,ar.y,ar.z],sr(t,Zn,Qn,$n,ir))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,Yn).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(Yn).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(Jn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),Jn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),Jn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),Jn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),Jn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),Jn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),Jn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),Jn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(Jn),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}},Jn=[new J,new J,new J,new J,new J,new J,new J,new J],Yn=new J,Xn=new qn,Zn=new J,Qn=new J,$n=new J,er=new J,tr=new J,nr=new J,rr=new J,ir=new J,ar=new J,or=new J;function sr(e,t,n,r,i){for(let a=0,o=e.length-3;a<=o;a+=3){or.fromArray(e,a);let o=i.x*Math.abs(or.x)+i.y*Math.abs(or.y)+i.z*Math.abs(or.z),s=t.dot(or),c=n.dot(or),l=r.dot(or);if(Math.max(-Math.max(s,c,l),Math.min(s,c,l))>o)return!1}return!0}var cr=new J,lr=new q,ur=0,dr=class extends $e{constructor(e,t,n=!1){if(super(),Array.isArray(e))throw TypeError(`THREE.BufferAttribute: array should be a Typed Array.`);this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:ur++}),this.name=``,this.array=e,this.itemSize=t,this.count=e===void 0?0:e.length/t,this.normalized=n,this.usage=ze,this.updateRanges=[],this.gpuType=_,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let r=0,i=this.itemSize;r<i;r++)this.array[e+r]=t.array[n+r];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)lr.fromBufferAttribute(this,t),lr.applyMatrix3(e),this.setXY(t,lr.x,lr.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)cr.fromBufferAttribute(this,t),cr.applyMatrix3(e),this.setXYZ(t,cr.x,cr.y,cr.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)cr.fromBufferAttribute(this,t),cr.applyMatrix4(e),this.setXYZ(t,cr.x,cr.y,cr.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)cr.fromBufferAttribute(this,t),cr.applyNormalMatrix(e),this.setXYZ(t,cr.x,cr.y,cr.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)cr.fromBufferAttribute(this,t),cr.transformDirection(e),this.setXYZ(t,cr.x,cr.y,cr.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=Ct(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=wt(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=Ct(t,this.array)),t}setX(e,t){return this.normalized&&(t=wt(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=Ct(t,this.array)),t}setY(e,t){return this.normalized&&(t=wt(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=Ct(t,this.array)),t}setZ(e,t){return this.normalized&&(t=wt(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=Ct(t,this.array)),t}setW(e,t){return this.normalized&&(t=wt(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=wt(t,this.array),n=wt(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,r){return e*=this.itemSize,this.normalized&&(t=wt(t,this.array),n=wt(n,this.array),r=wt(r,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=r,this}setXYZW(e,t,n,r,i){return e*=this.itemSize,this.normalized&&(t=wt(t,this.array),n=wt(n,this.array),r=wt(r,this.array),i=wt(i,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=r,this.array[e+3]=i,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==``&&(e.name=this.name),this.usage!==35044&&(e.usage=this.usage),e}dispose(){this.dispatchEvent({type:`dispose`})}},fr=class extends dr{constructor(e,t,n){super(new Uint16Array(e),t,n)}},pr=class extends dr{constructor(e,t,n){super(new Uint32Array(e),t,n)}},mr=class extends dr{constructor(e,t,n){super(new Float32Array(e),t,n)}},hr=new qn,gr=new J,_r=new J,vr=class{constructor(e=new J,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let n=this.center;t===void 0?hr.setFromPoints(e).getCenter(n):n.copy(t);let r=0;for(let t=0,i=e.length;t<i;t++)r=Math.max(r,n.distanceToSquared(e[t]));return this.radius=Math.sqrt(r),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius*=e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;gr.subVectors(e,this.center);let t=gr.lengthSq();if(t>this.radius*this.radius){let e=Math.sqrt(t),n=(e-this.radius)*.5;this.center.addScaledVector(gr,n/e),this.radius+=n}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(_r.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(gr.copy(e.center).add(_r)),this.expandByPoint(gr.copy(e.center).sub(_r))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}},yr=0,br=new Yt,xr=new Cn,Sr=new J,Cr=new qn,wr=new qn,Tr=new J,Er=class e extends $e{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:yr++}),this.uuid=it(),this.name=``,this.type=`BufferGeometry`,this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(He(e)?pr:fr)(e,1):this.index=e,this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let t=new Y().getNormalMatrix(e);n.applyNormalMatrix(t),n.needsUpdate=!0}let r=this.attributes.tangent;return r!==void 0&&(r.transformDirection(e),r.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(e){return br.makeRotationFromQuaternion(e),this.applyMatrix4(br),this}rotateX(e){return br.makeRotationX(e),this.applyMatrix4(br),this}rotateY(e){return br.makeRotationY(e),this.applyMatrix4(br),this}rotateZ(e){return br.makeRotationZ(e),this.applyMatrix4(br),this}translate(e,t,n){return br.makeTranslation(e,t,n),this.applyMatrix4(br),this}scale(e,t,n){return br.makeScale(e,t,n),this.applyMatrix4(br),this}lookAt(e){return xr.lookAt(e),xr.updateMatrix(),this.applyMatrix4(xr.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Sr).negate(),this.translate(Sr.x,Sr.y,Sr.z),this}setFromPoints(e){let t=this.getAttribute(`position`);if(t===void 0){let t=[];for(let n=0,r=e.length;n<r;n++){let r=e[n];t.push(r.x,r.y,r.z||0)}this.setAttribute(`position`,new mr(t,3))}else{let n=Math.min(e.length,t.count);for(let r=0;r<n;r++){let n=e[r];t.setXYZ(r,n.x,n.y,n.z||0)}e.length>t.count&&W(`BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry.`),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new qn);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){G(`BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.`,this),this.boundingBox.set(new J(-1/0,-1/0,-1/0),new J(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let e=0,n=t.length;e<n;e++){let n=t[e];Cr.setFromBufferAttribute(n),this.morphTargetsRelative?(Tr.addVectors(this.boundingBox.min,Cr.min),this.boundingBox.expandByPoint(Tr),Tr.addVectors(this.boundingBox.max,Cr.max),this.boundingBox.expandByPoint(Tr)):(this.boundingBox.expandByPoint(Cr.min),this.boundingBox.expandByPoint(Cr.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&G(`BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.`,this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new vr);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){G(`BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.`,this),this.boundingSphere.set(new J,1/0);return}if(e){let n=this.boundingSphere.center;if(Cr.setFromBufferAttribute(e),t)for(let e=0,n=t.length;e<n;e++){let n=t[e];wr.setFromBufferAttribute(n),this.morphTargetsRelative?(Tr.addVectors(Cr.min,wr.min),Cr.expandByPoint(Tr),Tr.addVectors(Cr.max,wr.max),Cr.expandByPoint(Tr)):(Cr.expandByPoint(wr.min),Cr.expandByPoint(wr.max))}Cr.getCenter(n);let r=0;for(let t=0,i=e.count;t<i;t++)Tr.fromBufferAttribute(e,t),r=Math.max(r,n.distanceToSquared(Tr));if(t)for(let i=0,a=t.length;i<a;i++){let a=t[i],o=this.morphTargetsRelative;for(let t=0,i=a.count;t<i;t++)Tr.fromBufferAttribute(a,t),o&&(Sr.fromBufferAttribute(e,t),Tr.add(Sr)),r=Math.max(r,n.distanceToSquared(Tr))}this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&G(`BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.`,this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){G(`BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)`);return}let n=t.position,r=t.normal,i=t.uv;this.hasAttribute(`tangent`)===!1&&this.setAttribute(`tangent`,new dr(new Float32Array(4*n.count),4));let a=this.getAttribute(`tangent`),o=[],s=[];for(let e=0;e<n.count;e++)o[e]=new J,s[e]=new J;let c=new J,l=new J,u=new J,d=new q,f=new q,p=new q,m=new J,h=new J;function g(e,t,r){c.fromBufferAttribute(n,e),l.fromBufferAttribute(n,t),u.fromBufferAttribute(n,r),d.fromBufferAttribute(i,e),f.fromBufferAttribute(i,t),p.fromBufferAttribute(i,r),l.sub(c),u.sub(c),f.sub(d),p.sub(d);let a=1/(f.x*p.y-p.x*f.y);isFinite(a)&&(m.copy(l).multiplyScalar(p.y).addScaledVector(u,-f.y).multiplyScalar(a),h.copy(u).multiplyScalar(f.x).addScaledVector(l,-p.x).multiplyScalar(a),o[e].add(m),o[t].add(m),o[r].add(m),s[e].add(h),s[t].add(h),s[r].add(h))}let _=this.groups;_.length===0&&(_=[{start:0,count:e.count}]);for(let t=0,n=_.length;t<n;++t){let n=_[t],r=n.start,i=n.count;for(let t=r,n=r+i;t<n;t+=3)g(e.getX(t+0),e.getX(t+1),e.getX(t+2))}let v=new J,y=new J,b=new J,x=new J;function S(e){b.fromBufferAttribute(r,e),x.copy(b);let t=o[e];v.copy(t),v.sub(b.multiplyScalar(b.dot(t))).normalize(),y.crossVectors(x,t);let n=y.dot(s[e])<0?-1:1;a.setXYZW(e,v.x,v.y,v.z,n)}for(let t=0,n=_.length;t<n;++t){let n=_[t],r=n.start,i=n.count;for(let t=r,n=r+i;t<n;t+=3)S(e.getX(t+0)),S(e.getX(t+1)),S(e.getX(t+2))}}computeVertexNormals(){let e=this.index,t=this.getAttribute(`position`);if(t!==void 0){let n=this.getAttribute(`normal`);if(n===void 0)n=new dr(new Float32Array(t.count*3),3),this.setAttribute(`normal`,n);else for(let e=0,t=n.count;e<t;e++)n.setXYZ(e,0,0,0);let r=new J,i=new J,a=new J,o=new J,s=new J,c=new J,l=new J,u=new J;if(e)for(let d=0,f=e.count;d<f;d+=3){let f=e.getX(d+0),p=e.getX(d+1),m=e.getX(d+2);r.fromBufferAttribute(t,f),i.fromBufferAttribute(t,p),a.fromBufferAttribute(t,m),l.subVectors(a,i),u.subVectors(r,i),l.cross(u),o.fromBufferAttribute(n,f),s.fromBufferAttribute(n,p),c.fromBufferAttribute(n,m),o.add(l),s.add(l),c.add(l),n.setXYZ(f,o.x,o.y,o.z),n.setXYZ(p,s.x,s.y,s.z),n.setXYZ(m,c.x,c.y,c.z)}else for(let e=0,o=t.count;e<o;e+=3)r.fromBufferAttribute(t,e+0),i.fromBufferAttribute(t,e+1),a.fromBufferAttribute(t,e+2),l.subVectors(a,i),u.subVectors(r,i),l.cross(u),n.setXYZ(e+0,l.x,l.y,l.z),n.setXYZ(e+1,l.x,l.y,l.z),n.setXYZ(e+2,l.x,l.y,l.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)Tr.fromBufferAttribute(e,t),Tr.normalize(),e.setXYZ(t,Tr.x,Tr.y,Tr.z)}toNonIndexed(){function t(e,t){let n=e.array,r=e.itemSize,i=e.normalized,a=new n.constructor(t.length*r),o=0,s=0;for(let i=0,c=t.length;i<c;i++){o=e.isInterleavedBufferAttribute?t[i]*e.data.stride+e.offset:t[i]*r;for(let e=0;e<r;e++)a[s++]=n[o++]}return new dr(a,r,i)}if(this.index===null)return W(`BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed.`),this;let n=new e,r=this.index.array,i=this.attributes;for(let e in i){let a=i[e],o=t(a,r);n.setAttribute(e,o)}let a=this.morphAttributes;for(let e in a){let i=[],o=a[e];for(let e=0,n=o.length;e<n;e++){let n=o[e],a=t(n,r);i.push(a)}n.morphAttributes[e]=i}n.morphTargetsRelative=this.morphTargetsRelative;let o=this.groups;for(let e=0,t=o.length;e<t;e++){let t=o[e];n.addGroup(t.start,t.count,t.materialIndex)}return n}toJSON(){let e={metadata:{version:4.7,type:`BufferGeometry`,generator:`BufferGeometry.toJSON`}};if(e.uuid=this.uuid,e.type=this.type,this.name!==``&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0){let t=this.parameters;for(let n in t)t[n]!==void 0&&(e[n]=t[n]);return e}e.data={attributes:{}};let t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});let n=this.attributes;for(let t in n){let r=n[t];e.data.attributes[t]=r.toJSON(e.data)}let r={},i=!1;for(let t in this.morphAttributes){let n=this.morphAttributes[t],a=[];for(let t=0,r=n.length;t<r;t++){let r=n[t];a.push(r.toJSON(e.data))}a.length>0&&(r[t]=a,i=!0)}i&&(e.data.morphAttributes=r,e.data.morphTargetsRelative=this.morphTargetsRelative);let a=this.groups;a.length>0&&(e.data.groups=JSON.parse(JSON.stringify(a)));let o=this.boundingSphere;return o!==null&&(e.data.boundingSphere=o.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let n=e.index;n!==null&&this.setIndex(n.clone());let r=e.attributes;for(let e in r){let n=r[e];this.setAttribute(e,n.clone(t))}let i=e.morphAttributes;for(let e in i){let n=[],r=i[e];for(let e=0,i=r.length;e<i;e++)n.push(r[e].clone(t));this.morphAttributes[e]=n}this.morphTargetsRelative=e.morphTargetsRelative;let a=e.groups;for(let e=0,t=a.length;e<t;e++){let t=a[e];this.addGroup(t.start,t.count,t.materialIndex)}let o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());let s=e.boundingSphere;return s!==null&&(this.boundingSphere=s.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this}dispose(){this.dispatchEvent({type:`dispose`})}},Dr=0,Or=class extends $e{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Dr++}),this.uuid=it(),this.name=``,this.type=`Material`,this.blending=1,this.side=0,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=204,this.blendDst=205,this.blendEquation=100,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new X(0,0,0),this.blendAlpha=0,this.depthFunc=3,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=519,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Re,this.stencilZFail=Re,this.stencilZPass=Re,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(let t in e){let n=e[t];if(n===void 0){W(`Material: parameter '${t}' has value of undefined.`);continue}let r=this[t];if(r===void 0){W(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}r&&r.isColor?r.set(n):r&&r.isVector3&&n&&n.isVector3?r.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e==`string`;t&&(e={textures:{},images:{}});let n={metadata:{version:4.7,type:`Material`,generator:`Material.toJSON`}};n.uuid=this.uuid,n.type=this.type,this.name!==``&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==1&&(n.blending=this.blending),this.side!==0&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==204&&(n.blendSrc=this.blendSrc),this.blendDst!==205&&(n.blendDst=this.blendDst),this.blendEquation!==100&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==3&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==519&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==7680&&(n.stencilFail=this.stencilFail),this.stencilZFail!==7680&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==7680&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.allowOverride===!1&&(n.allowOverride=!1),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!==`round`&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!==`round`&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function r(e){let t=[];for(let n in e){let r=e[n];delete r.metadata,t.push(r)}return t}if(t){let t=r(e.textures),i=r(e.images);t.length>0&&(n.textures=t),i.length>0&&(n.images=i)}return n}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,n=null;if(t!==null){let e=t.length;n=Array(e);for(let r=0;r!==e;++r)n[r]=t[r].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:`dispose`})}set needsUpdate(e){e===!0&&this.version++}},kr=new J,Ar=new J,jr=new J,Mr=new J,Nr=new J,Pr=new J,Fr=new J,Ir=class{constructor(e=new J,t=new J(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,kr)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=kr.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(kr.copy(this.origin).addScaledVector(this.direction,t),kr.distanceToSquared(e))}distanceSqToSegment(e,t,n,r){Ar.copy(e).add(t).multiplyScalar(.5),jr.copy(t).sub(e).normalize(),Mr.copy(this.origin).sub(Ar);let i=e.distanceTo(t)*.5,a=-this.direction.dot(jr),o=Mr.dot(this.direction),s=-Mr.dot(jr),c=Mr.lengthSq(),l=Math.abs(1-a*a),u,d,f,p;if(l>0)if(u=a*s-o,d=a*o-s,p=i*l,u>=0)if(d>=-p)if(d<=p){let e=1/l;u*=e,d*=e,f=u*(u+a*d+2*o)+d*(a*u+d+2*s)+c}else d=i,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*s)+c;else d=-i,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*s)+c;else d<=-p?(u=Math.max(0,-(-a*i+o)),d=u>0?-i:Math.min(Math.max(-i,-s),i),f=-u*u+d*(d+2*s)+c):d<=p?(u=0,d=Math.min(Math.max(-i,-s),i),f=d*(d+2*s)+c):(u=Math.max(0,-(a*i+o)),d=u>0?i:Math.min(Math.max(-i,-s),i),f=-u*u+d*(d+2*s)+c);else d=a>0?-i:i,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*s)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,u),r&&r.copy(Ar).addScaledVector(jr,d),f}intersectSphere(e,t){kr.subVectors(e.center,this.origin);let n=kr.dot(this.direction),r=kr.dot(kr)-n*n,i=e.radius*e.radius;if(r>i)return null;let a=Math.sqrt(i-r),o=n-a,s=n+a;return s<0?null:o<0?this.at(s,t):this.at(o,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){let n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,r,i,a,o,s,c=1/this.direction.x,l=1/this.direction.y,u=1/this.direction.z,d=this.origin;return c>=0?(n=(e.min.x-d.x)*c,r=(e.max.x-d.x)*c):(n=(e.max.x-d.x)*c,r=(e.min.x-d.x)*c),l>=0?(i=(e.min.y-d.y)*l,a=(e.max.y-d.y)*l):(i=(e.max.y-d.y)*l,a=(e.min.y-d.y)*l),n>a||i>r||((i>n||isNaN(n))&&(n=i),(a<r||isNaN(r))&&(r=a),u>=0?(o=(e.min.z-d.z)*u,s=(e.max.z-d.z)*u):(o=(e.max.z-d.z)*u,s=(e.min.z-d.z)*u),n>s||o>r)||((o>n||n!==n)&&(n=o),(s<r||r!==r)&&(r=s),r<0)?null:this.at(n>=0?n:r,t)}intersectsBox(e){return this.intersectBox(e,kr)!==null}intersectTriangle(e,t,n,r,i){Nr.subVectors(t,e),Pr.subVectors(n,e),Fr.crossVectors(Nr,Pr);let a=this.direction.dot(Fr),o;if(a>0){if(r)return null;o=1}else if(a<0)o=-1,a=-a;else return null;Mr.subVectors(this.origin,e);let s=o*this.direction.dot(Pr.crossVectors(Mr,Pr));if(s<0)return null;let c=o*this.direction.dot(Nr.cross(Mr));if(c<0||s+c>a)return null;let l=-o*Mr.dot(Fr);return l<0?null:this.at(l/a,i)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},Lr=class extends Or{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type=`MeshBasicMaterial`,this.color=new X(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new on,this.combine=0,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap=`round`,this.wireframeLinejoin=`round`,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}},Rr=new Yt,zr=new Ir,Br=new vr,Vr=new J,Hr=new J,Ur=new J,Wr=new J,Gr=new J,Kr=new J,qr=new J,Jr=new J,Yr=class extends Cn{constructor(e=new Er,t=new Lr){super(),this.isMesh=!0,this.type=`Mesh`,this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let e=this.geometry.morphAttributes,t=Object.keys(e);if(t.length>0){let n=e[t[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let e=0,t=n.length;e<t;e++){let t=n[e].name||String(e);this.morphTargetInfluences.push(0),this.morphTargetDictionary[t]=e}}}}getVertexPosition(e,t){let n=this.geometry,r=n.attributes.position,i=n.morphAttributes.position,a=n.morphTargetsRelative;t.fromBufferAttribute(r,e);let o=this.morphTargetInfluences;if(i&&o){Kr.set(0,0,0);for(let n=0,r=i.length;n<r;n++){let r=o[n],s=i[n];r!==0&&(Gr.fromBufferAttribute(s,e),a?Kr.addScaledVector(Gr,r):Kr.addScaledVector(Gr.sub(t),r))}t.add(Kr)}return t}raycast(e,t){let n=this.geometry,r=this.material,i=this.matrixWorld;r!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),Br.copy(n.boundingSphere),Br.applyMatrix4(i),zr.copy(e.ray).recast(e.near),!(Br.containsPoint(zr.origin)===!1&&(zr.intersectSphere(Br,Vr)===null||zr.origin.distanceToSquared(Vr)>(e.far-e.near)**2))&&(Rr.copy(i).invert(),zr.copy(e.ray).applyMatrix4(Rr),!(n.boundingBox!==null&&zr.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(e,t,zr)))}_computeIntersections(e,t,n){let r,i=this.geometry,a=this.material,o=i.index,s=i.attributes.position,c=i.attributes.uv,l=i.attributes.uv1,u=i.attributes.normal,d=i.groups,f=i.drawRange;if(o!==null)if(Array.isArray(a))for(let i=0,s=d.length;i<s;i++){let s=d[i],p=a[s.materialIndex],m=Math.max(s.start,f.start),h=Math.min(o.count,Math.min(s.start+s.count,f.start+f.count));for(let i=m,a=h;i<a;i+=3){let a=o.getX(i),d=o.getX(i+1),f=o.getX(i+2);r=Zr(this,p,e,n,c,l,u,a,d,f),r&&(r.faceIndex=Math.floor(i/3),r.face.materialIndex=s.materialIndex,t.push(r))}}else{let i=Math.max(0,f.start),s=Math.min(o.count,f.start+f.count);for(let d=i,f=s;d<f;d+=3){let i=o.getX(d),s=o.getX(d+1),f=o.getX(d+2);r=Zr(this,a,e,n,c,l,u,i,s,f),r&&(r.faceIndex=Math.floor(d/3),t.push(r))}}else if(s!==void 0)if(Array.isArray(a))for(let i=0,o=d.length;i<o;i++){let o=d[i],p=a[o.materialIndex],m=Math.max(o.start,f.start),h=Math.min(s.count,Math.min(o.start+o.count,f.start+f.count));for(let i=m,a=h;i<a;i+=3){let a=i,s=i+1,d=i+2;r=Zr(this,p,e,n,c,l,u,a,s,d),r&&(r.faceIndex=Math.floor(i/3),r.face.materialIndex=o.materialIndex,t.push(r))}}else{let i=Math.max(0,f.start),o=Math.min(s.count,f.start+f.count);for(let s=i,d=o;s<d;s+=3){let i=s,o=s+1,d=s+2;r=Zr(this,a,e,n,c,l,u,i,o,d),r&&(r.faceIndex=Math.floor(s/3),t.push(r))}}}};function Xr(e,t,n,r,i,a,o,s){let c;if(c=t.side===1?r.intersectTriangle(o,a,i,!0,s):r.intersectTriangle(i,a,o,t.side===0,s),c===null)return null;Jr.copy(s),Jr.applyMatrix4(e.matrixWorld);let l=n.ray.origin.distanceTo(Jr);return l<n.near||l>n.far?null:{distance:l,point:Jr.clone(),object:e}}function Zr(e,t,n,r,i,a,o,s,c,l){e.getVertexPosition(s,Hr),e.getVertexPosition(c,Ur),e.getVertexPosition(l,Wr);let u=Xr(e,t,n,r,Hr,Ur,Wr,qr);if(u){let e=new J;Kn.getBarycoord(qr,Hr,Ur,Wr,e),i&&(u.uv=Kn.getInterpolatedAttribute(i,s,c,l,e,new q)),a&&(u.uv1=Kn.getInterpolatedAttribute(a,s,c,l,e,new q)),o&&(u.normal=Kn.getInterpolatedAttribute(o,s,c,l,e,new J),u.normal.dot(r.direction)>0&&u.normal.multiplyScalar(-1));let t={a:s,b:c,c:l,normal:new J,materialIndex:0};Kn.getNormal(Hr,Ur,Wr,t.normal),u.face=t,u.barycoord=e}return u}var Qr=class extends Ut{constructor(e=null,t=1,n=1,r,i,o,s,c,l=a,u=a,d,f){super(null,o,s,c,l,u,r,i,d,f),this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}},$r=class extends dr{constructor(e,t,n,r=1){super(e,t,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=r}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){let e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}},ei=new Yt,ti=new Yt,ni=[],ri=new qn,ii=new Yt,ai=new Yr,oi=new vr,si=class extends Yr{constructor(e,t,n){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new $r(new Float32Array(n*16),16),this.previousInstanceMatrix=null,this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let e=0;e<n;e++)this.setMatrixAt(e,ii)}computeBoundingBox(){let e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new qn),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,ei),ri.copy(e.boundingBox).applyMatrix4(ei),this.boundingBox.union(ri)}computeBoundingSphere(){let e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new vr),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,ei),oi.copy(e.boundingSphere).applyMatrix4(ei),this.boundingSphere.union(oi)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.previousInstanceMatrix!==null&&(this.previousInstanceMatrix=e.previousInstanceMatrix.clone()),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone()),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){return this.instanceColor===null?t.setRGB(1,1,1):t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){return t.fromArray(this.instanceMatrix.array,e*16)}getMorphAt(e,t){let n=t.morphTargetInfluences,r=this.morphTexture.source.data.data,i=e*(n.length+1)+1;for(let e=0;e<n.length;e++)n[e]=r[i+e]}raycast(e,t){let n=this.matrixWorld,r=this.count;if(ai.geometry=this.geometry,ai.material=this.material,ai.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),oi.copy(this.boundingSphere),oi.applyMatrix4(n),e.ray.intersectsSphere(oi)!==!1))for(let i=0;i<r;i++){this.getMatrixAt(i,ei),ti.multiplyMatrices(n,ei),ai.matrixWorld=ti,ai.raycast(e,ni);for(let e=0,n=ni.length;e<n;e++){let n=ni[e];n.instanceId=i,n.object=this,t.push(n)}ni.length=0}}setColorAt(e,t){return this.instanceColor===null&&(this.instanceColor=new $r(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),t.toArray(this.instanceColor.array,e*3),this}setMatrixAt(e,t){return t.toArray(this.instanceMatrix.array,e*16),this}setMorphAt(e,t){let n=t.morphTargetInfluences,r=n.length+1;this.morphTexture===null&&(this.morphTexture=new Qr(new Float32Array(r*this.count),r,this.count,k,_));let i=this.morphTexture.source.data.data,a=0;for(let e=0;e<n.length;e++)a+=n[e];let o=this.geometry.morphTargetsRelative?1:1-a,s=r*e;return i[s]=o,i.set(n,s+1),this}updateMorphTargets(){}dispose(){this.dispatchEvent({type:`dispose`}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}},ci=new J,li=new J,ui=new Y,di=class{constructor(e=new J(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,r){return this.normal.set(e,t,n),this.constant=r,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){let r=ci.subVectors(n,t).cross(li.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(r,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,n=!0){let r=e.delta(ci),i=this.normal.dot(r);if(i===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;let a=-(e.start.dot(this.normal)+this.constant)/i;return n===!0&&(a<0||a>1)?null:t.copy(e.start).addScaledVector(r,a)}intersectsLine(e){let t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let n=t||ui.getNormalMatrix(e),r=this.coplanarPoint(ci).applyMatrix4(e),i=this.normal.applyMatrix3(n).normalize();return this.constant=-r.dot(i),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}},fi=new vr,pi=new q(.5,.5),mi=new J,hi=class{constructor(e=new di,t=new di,n=new di,r=new di,i=new di,a=new di){this.planes=[e,t,n,r,i,a]}set(e,t,n,r,i,a){let o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(n),o[3].copy(r),o[4].copy(i),o[5].copy(a),this}copy(e){let t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=Ve,n=!1){let r=this.planes,i=e.elements,a=i[0],o=i[1],s=i[2],c=i[3],l=i[4],u=i[5],d=i[6],f=i[7],p=i[8],m=i[9],h=i[10],g=i[11],_=i[12],v=i[13],y=i[14],b=i[15];if(r[0].setComponents(c-a,f-l,g-p,b-_).normalize(),r[1].setComponents(c+a,f+l,g+p,b+_).normalize(),r[2].setComponents(c+o,f+u,g+m,b+v).normalize(),r[3].setComponents(c-o,f-u,g-m,b-v).normalize(),n)r[4].setComponents(s,d,h,y).normalize(),r[5].setComponents(c-s,f-d,g-h,b-y).normalize();else if(r[4].setComponents(c-s,f-d,g-h,b-y).normalize(),t===2e3)r[5].setComponents(c+s,f+d,g+h,b+y).normalize();else if(t===2001)r[5].setComponents(s,d,h,y).normalize();else throw Error(`THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: `+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),fi.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{let t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),fi.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(fi)}intersectsSprite(e){return fi.center.set(0,0,0),fi.radius=.7071067811865476+pi.distanceTo(e.center),fi.applyMatrix4(e.matrixWorld),this.intersectsSphere(fi)}intersectsSphere(e){let t=this.planes,n=e.center,r=-e.radius;for(let e=0;e<6;e++)if(t[e].distanceToPoint(n)<r)return!1;return!0}intersectsBox(e){let t=this.planes;for(let n=0;n<6;n++){let r=t[n];if(mi.x=r.normal.x>0?e.max.x:e.min.x,mi.y=r.normal.y>0?e.max.y:e.min.y,mi.z=r.normal.z>0?e.max.z:e.min.z,r.distanceToPoint(mi)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}},gi=class extends Or{constructor(e){super(),this.isLineBasicMaterial=!0,this.type=`LineBasicMaterial`,this.color=new X(16777215),this.map=null,this.linewidth=1,this.linecap=`round`,this.linejoin=`round`,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}},_i=new J,vi=new J,yi=new Yt,bi=new Ir,xi=new vr,Si=new J,Ci=new J,wi=class extends Cn{constructor(e=new Er,t=new gi){super(),this.isLine=!0,this.type=`Line`,this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,n=[0];for(let e=1,r=t.count;e<r;e++)_i.fromBufferAttribute(t,e-1),vi.fromBufferAttribute(t,e),n[e]=n[e-1],n[e]+=_i.distanceTo(vi);e.setAttribute(`lineDistance`,new mr(n,1))}else W(`Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.`);return this}raycast(e,t){let n=this.geometry,r=this.matrixWorld,i=e.params.Line.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),xi.copy(n.boundingSphere),xi.applyMatrix4(r),xi.radius+=i,e.ray.intersectsSphere(xi)===!1)return;yi.copy(r).invert(),bi.copy(e.ray).applyMatrix4(yi);let o=i/((this.scale.x+this.scale.y+this.scale.z)/3),s=o*o,c=this.isLineSegments?2:1,l=n.index,u=n.attributes.position;if(l!==null){let n=Math.max(0,a.start),r=Math.min(l.count,a.start+a.count);for(let i=n,a=r-1;i<a;i+=c){let n=l.getX(i),r=l.getX(i+1),a=Ti(this,e,bi,s,n,r,i);a&&t.push(a)}if(this.isLineLoop){let i=l.getX(r-1),a=l.getX(n),o=Ti(this,e,bi,s,i,a,r-1);o&&t.push(o)}}else{let n=Math.max(0,a.start),r=Math.min(u.count,a.start+a.count);for(let i=n,a=r-1;i<a;i+=c){let n=Ti(this,e,bi,s,i,i+1,i);n&&t.push(n)}if(this.isLineLoop){let i=Ti(this,e,bi,s,r-1,n,r-1);i&&t.push(i)}}}updateMorphTargets(){let e=this.geometry.morphAttributes,t=Object.keys(e);if(t.length>0){let n=e[t[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let e=0,t=n.length;e<t;e++){let t=n[e].name||String(e);this.morphTargetInfluences.push(0),this.morphTargetDictionary[t]=e}}}}};function Ti(e,t,n,r,i,a,o){let s=e.geometry.attributes.position;if(_i.fromBufferAttribute(s,i),vi.fromBufferAttribute(s,a),n.distanceSqToSegment(_i,vi,Si,Ci)>r)return;Si.applyMatrix4(e.matrixWorld);let c=t.ray.origin.distanceTo(Si);if(!(c<t.near||c>t.far))return{distance:c,point:Ci.clone().applyMatrix4(e.matrixWorld),index:o,face:null,faceIndex:null,barycoord:null,object:e}}var Ei=new J,Di=new J,Oi=class extends wi{constructor(e,t){super(e,t),this.isLineSegments=!0,this.type=`LineSegments`}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,n=[];for(let e=0,r=t.count;e<r;e+=2)Ei.fromBufferAttribute(t,e),Di.fromBufferAttribute(t,e+1),n[e]=e===0?0:n[e-1],n[e+1]=n[e]+Ei.distanceTo(Di);e.setAttribute(`lineDistance`,new mr(n,1))}else W(`LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.`);return this}},ki=class extends Ut{constructor(e=[],t=301,n,r,i,a,o,s,c,l){super(e,t,n,r,i,a,o,s,c,l),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}},Ai=class extends Ut{constructor(e,t,n=g,r,i,o,s=a,c=a,l,u=D,d=1){if(u!==1026&&u!==1027)throw Error(`DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat`);super({width:e,height:t,depth:d},r,i,o,s,c,u,n,l),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new zt(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}},ji=class extends Ai{constructor(e,t=g,n=301,r,i,o=a,s=a,c,l=D){let u={width:e,height:e,depth:1},d=[u,u,u,u,u,u];super(e,e,t,n,r,i,o,s,c,l),this.image=d,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}},Mi=class extends Ut{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}},Ni=class e extends Er{constructor(e=1,t=1,n=1,r=1,i=1,a=1){super(),this.type=`BoxGeometry`,this.parameters={width:e,height:t,depth:n,widthSegments:r,heightSegments:i,depthSegments:a};let o=this;r=Math.floor(r),i=Math.floor(i),a=Math.floor(a);let s=[],c=[],l=[],u=[],d=0,f=0;p(`z`,`y`,`x`,-1,-1,n,t,e,a,i,0),p(`z`,`y`,`x`,1,-1,n,t,-e,a,i,1),p(`x`,`z`,`y`,1,1,e,n,t,r,a,2),p(`x`,`z`,`y`,1,-1,e,n,-t,r,a,3),p(`x`,`y`,`z`,1,-1,e,t,n,r,i,4),p(`x`,`y`,`z`,-1,-1,e,t,-n,r,i,5),this.setIndex(s),this.setAttribute(`position`,new mr(c,3)),this.setAttribute(`normal`,new mr(l,3)),this.setAttribute(`uv`,new mr(u,2));function p(e,t,n,r,i,a,p,m,h,g,_){let v=a/h,y=p/g,b=a/2,x=p/2,S=m/2,C=h+1,w=g+1,T=0,E=0,D=new J;for(let a=0;a<w;a++){let o=a*y-x;for(let s=0;s<C;s++)D[e]=(s*v-b)*r,D[t]=o*i,D[n]=S,c.push(D.x,D.y,D.z),D[e]=0,D[t]=0,D[n]=m>0?1:-1,l.push(D.x,D.y,D.z),u.push(s/h),u.push(1-a/g),T+=1}for(let e=0;e<g;e++)for(let t=0;t<h;t++){let n=d+t+C*e,r=d+t+C*(e+1),i=d+(t+1)+C*(e+1),a=d+(t+1)+C*e;s.push(n,r,a),s.push(r,i,a),E+=6}o.addGroup(f,E,_),f+=E,d+=T}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}},Pi=new J,Fi=new J,Ii=new J,Li=new Kn,Ri=class extends Er{constructor(e=null,t=1){if(super(),this.type=`EdgesGeometry`,this.parameters={geometry:e,thresholdAngle:t},e!==null){let n=10**4,r=Math.cos(nt*t),i=e.getIndex(),a=e.getAttribute(`position`),o=i?i.count:a.count,s=[0,0,0],c=[`a`,`b`,`c`],l=[,,,],u={},d=[];for(let e=0;e<o;e+=3){i?(s[0]=i.getX(e),s[1]=i.getX(e+1),s[2]=i.getX(e+2)):(s[0]=e,s[1]=e+1,s[2]=e+2);let{a:t,b:o,c:f}=Li;if(t.fromBufferAttribute(a,s[0]),o.fromBufferAttribute(a,s[1]),f.fromBufferAttribute(a,s[2]),Li.getNormal(Ii),l[0]=`${Math.round(t.x*n)},${Math.round(t.y*n)},${Math.round(t.z*n)}`,l[1]=`${Math.round(o.x*n)},${Math.round(o.y*n)},${Math.round(o.z*n)}`,l[2]=`${Math.round(f.x*n)},${Math.round(f.y*n)},${Math.round(f.z*n)}`,!(l[0]===l[1]||l[1]===l[2]||l[2]===l[0]))for(let e=0;e<3;e++){let t=(e+1)%3,n=l[e],i=l[t],a=Li[c[e]],o=Li[c[t]],f=`${n}_${i}`,p=`${i}_${n}`;p in u&&u[p]?(Ii.dot(u[p].normal)<=r&&(d.push(a.x,a.y,a.z),d.push(o.x,o.y,o.z)),u[p]=null):f in u||(u[f]={index0:s[e],index1:s[t],normal:Ii.clone()})}}for(let e in u)if(u[e]){let{index0:t,index1:n}=u[e];Pi.fromBufferAttribute(a,t),Fi.fromBufferAttribute(a,n),d.push(Pi.x,Pi.y,Pi.z),d.push(Fi.x,Fi.y,Fi.z)}this.setAttribute(`position`,new mr(d,3))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}},zi=class e extends Er{constructor(e=1,t=1,n=1,r=1){super(),this.type=`PlaneGeometry`,this.parameters={width:e,height:t,widthSegments:n,heightSegments:r};let i=e/2,a=t/2,o=Math.floor(n),s=Math.floor(r),c=o+1,l=s+1,u=e/o,d=t/s,f=[],p=[],m=[],h=[];for(let e=0;e<l;e++){let t=e*d-a;for(let n=0;n<c;n++){let r=n*u-i;p.push(r,-t,0),m.push(0,0,1),h.push(n/o),h.push(1-e/s)}}for(let e=0;e<s;e++)for(let t=0;t<o;t++){let n=t+c*e,r=t+c*(e+1),i=t+1+c*(e+1),a=t+1+c*e;f.push(n,r,a),f.push(r,i,a)}this.setIndex(f),this.setAttribute(`position`,new mr(p,3)),this.setAttribute(`normal`,new mr(m,3)),this.setAttribute(`uv`,new mr(h,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.width,t.height,t.widthSegments,t.heightSegments)}};function Bi(e){let t={};for(let n in e){t[n]={};for(let r in e[n]){let i=e[n][r];if(Hi(i))i.isRenderTargetTexture?(W(`UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms().`),t[n][r]=null):t[n][r]=i.clone();else if(Array.isArray(i))if(Hi(i[0])){let e=[];for(let t=0,n=i.length;t<n;t++)e[t]=i[t].clone();t[n][r]=e}else t[n][r]=i.slice();else t[n][r]=i}}return t}function Vi(e){let t={};for(let n=0;n<e.length;n++){let r=Bi(e[n]);for(let e in r)t[e]=r[e]}return t}function Hi(e){return e&&(e.isColor||e.isMatrix3||e.isMatrix4||e.isVector2||e.isVector3||e.isVector4||e.isTexture||e.isQuaternion)}function Ui(e){let t=[];for(let n=0;n<e.length;n++)t.push(e[n].clone());return t}function Wi(e){let t=e.getRenderTarget();return t===null?e.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:Nt.workingColorSpace}var Gi={clone:Bi,merge:Vi},Ki=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,qi=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,Ji=class extends Or{constructor(e){super(),this.isShaderMaterial=!0,this.type=`ShaderMaterial`,this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Ki,this.fragmentShader=qi,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Bi(e.uniforms),this.uniformsGroups=Ui(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let n in this.uniforms){let r=this.uniforms[n].value;r&&r.isTexture?t.uniforms[n]={type:`t`,value:r.toJSON(e).uuid}:r&&r.isColor?t.uniforms[n]={type:`c`,value:r.getHex()}:r&&r.isVector2?t.uniforms[n]={type:`v2`,value:r.toArray()}:r&&r.isVector3?t.uniforms[n]={type:`v3`,value:r.toArray()}:r&&r.isVector4?t.uniforms[n]={type:`v4`,value:r.toArray()}:r&&r.isMatrix3?t.uniforms[n]={type:`m3`,value:r.toArray()}:r&&r.isMatrix4?t.uniforms[n]={type:`m4`,value:r.toArray()}:t.uniforms[n]={value:r}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let n={};for(let e in this.extensions)this.extensions[e]===!0&&(n[e]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}},Yi=class extends Ji{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type=`RawShaderMaterial`}},Xi=class extends Or{constructor(e){super(),this.isMeshStandardMaterial=!0,this.type=`MeshStandardMaterial`,this.defines={STANDARD:``},this.color=new X(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new X(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=0,this.normalScale=new q(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new on,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap=`round`,this.wireframeLinejoin=`round`,this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:``},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},Zi=class extends Xi{constructor(e){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:``,PHYSICAL:``},this.type=`MeshPhysicalMaterial`,this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new q(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return K(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(e){this.ior=(1+.4*e)/(1-.4*e)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new X(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new X(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new X(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._sheen=0,this._transmission=0,this.setValues(e)}get anisotropy(){return this._anisotropy}set anisotropy(e){this._anisotropy>0!=e>0&&this.version++,this._anisotropy=e}get clearcoat(){return this._clearcoat}set clearcoat(e){this._clearcoat>0!=e>0&&this.version++,this._clearcoat=e}get iridescence(){return this._iridescence}set iridescence(e){this._iridescence>0!=e>0&&this.version++,this._iridescence=e}get dispersion(){return this._dispersion}set dispersion(e){this._dispersion>0!=e>0&&this.version++,this._dispersion=e}get sheen(){return this._sheen}set sheen(e){this._sheen>0!=e>0&&this.version++,this._sheen=e}get transmission(){return this._transmission}set transmission(e){this._transmission>0!=e>0&&this.version++,this._transmission=e}copy(e){return super.copy(e),this.defines={STANDARD:``,PHYSICAL:``},this.anisotropy=e.anisotropy,this.anisotropyRotation=e.anisotropyRotation,this.anisotropyMap=e.anisotropyMap,this.clearcoat=e.clearcoat,this.clearcoatMap=e.clearcoatMap,this.clearcoatRoughness=e.clearcoatRoughness,this.clearcoatRoughnessMap=e.clearcoatRoughnessMap,this.clearcoatNormalMap=e.clearcoatNormalMap,this.clearcoatNormalScale.copy(e.clearcoatNormalScale),this.dispersion=e.dispersion,this.ior=e.ior,this.iridescence=e.iridescence,this.iridescenceMap=e.iridescenceMap,this.iridescenceIOR=e.iridescenceIOR,this.iridescenceThicknessRange=[...e.iridescenceThicknessRange],this.iridescenceThicknessMap=e.iridescenceThicknessMap,this.sheen=e.sheen,this.sheenColor.copy(e.sheenColor),this.sheenColorMap=e.sheenColorMap,this.sheenRoughness=e.sheenRoughness,this.sheenRoughnessMap=e.sheenRoughnessMap,this.transmission=e.transmission,this.transmissionMap=e.transmissionMap,this.thickness=e.thickness,this.thicknessMap=e.thicknessMap,this.attenuationDistance=e.attenuationDistance,this.attenuationColor.copy(e.attenuationColor),this.specularIntensity=e.specularIntensity,this.specularIntensityMap=e.specularIntensityMap,this.specularColor.copy(e.specularColor),this.specularColorMap=e.specularColorMap,this}},Qi=class extends Or{constructor(e){super(),this.isMeshLambertMaterial=!0,this.type=`MeshLambertMaterial`,this.color=new X(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new X(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=0,this.normalScale=new q(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new on,this.combine=0,this.reflectivity=1,this.envMapIntensity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap=`round`,this.wireframeLinejoin=`round`,this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.envMapIntensity=e.envMapIntensity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},$i=class extends Or{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type=`MeshDepthMaterial`,this.depthPacking=Ne,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}},ea=class extends Or{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type=`MeshDistanceMaterial`,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}};function ta(e,t){return!e||e.constructor===t?e:typeof t.BYTES_PER_ELEMENT==`number`?new t(e):Array.prototype.slice.call(e)}var na=class{constructor(e,t,n,r){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=r===void 0?new t.constructor(n):r,this.sampleValues=t,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,n=this._cachedIndex,r=t[n],i=t[n-1];validate_interval:{seek:{let a;linear_scan:{forward_scan:if(!(e<r)){for(let a=n+2;;){if(r===void 0){if(e<i)break forward_scan;return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===a)break;if(i=r,r=t[++n],e<r)break seek}a=t.length;break linear_scan}if(!(e>=i)){let o=t[1];e<o&&(n=2,i=o);for(let a=n-2;;){if(i===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===a)break;if(r=i,i=t[--n-1],e>=i)break seek}a=n,n=0;break linear_scan}break validate_interval}for(;n<a;){let r=n+a>>>1;e<t[r]?a=r:n=r+1}if(r=t[n],i=t[n-1],i===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(r===void 0)return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,i,r)}return this.interpolate_(n,i,e,r)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,n=this.sampleValues,r=this.valueSize,i=e*r;for(let e=0;e!==r;++e)t[e]=n[i+e];return t}interpolate_(){throw Error(`call to abstract method`)}intervalChanged_(){}},ra=class extends na{constructor(e,t,n,r){super(e,t,n,r),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:Ae,endingEnd:Ae}}intervalChanged_(e,t,n){let r=this.parameterPositions,i=e-2,a=e+1,o=r[i],s=r[a];if(o===void 0)switch(this.getSettings_().endingStart){case je:i=e,o=2*t-n;break;case Me:i=r.length-2,o=t+r[i]-r[i+1];break;default:i=e,o=n}if(s===void 0)switch(this.getSettings_().endingEnd){case je:a=e,s=2*n-t;break;case Me:a=1,s=n+r[1]-r[0];break;default:a=e-1,s=t}let c=(n-t)*.5,l=this.valueSize;this._weightPrev=c/(t-o),this._weightNext=c/(s-n),this._offsetPrev=i*l,this._offsetNext=a*l}interpolate_(e,t,n,r){let i=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=e*o,c=s-o,l=this._offsetPrev,u=this._offsetNext,d=this._weightPrev,f=this._weightNext,p=(n-t)/(r-t),m=p*p,h=m*p,g=-d*h+2*d*m-d*p,_=(1+d)*h+(-1.5-2*d)*m+(-.5+d)*p+1,v=(-1-f)*h+(1.5+f)*m+.5*p,y=f*h-f*m;for(let e=0;e!==o;++e)i[e]=g*a[l+e]+_*a[c+e]+v*a[s+e]+y*a[u+e];return i}},ia=class extends na{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e,t,n,r){let i=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=e*o,c=s-o,l=(n-t)/(r-t),u=1-l;for(let e=0;e!==o;++e)i[e]=a[c+e]*u+a[s+e]*l;return i}},aa=class extends na{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e){return this.copySampleValue_(e-1)}},oa=class extends na{interpolate_(e,t,n,r){let i=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=e*o,c=s-o,l=this.settings||this.DefaultSettings_,u=l.inTangents,d=l.outTangents;if(!u||!d){let e=(n-t)/(r-t),l=1-e;for(let t=0;t!==o;++t)i[t]=a[c+t]*l+a[s+t]*e;return i}let f=o*2,p=e-1;for(let l=0;l!==o;++l){let o=a[c+l],m=a[s+l],h=p*f+l*2,g=d[h],_=d[h+1],v=e*f+l*2,y=u[v],b=u[v+1],x=(n-t)/(r-t),S,C,w,T,E;for(let e=0;e<8;e++){S=x*x,C=S*x,w=1-x,T=w*w,E=T*w;let e=E*t+3*T*x*g+3*w*S*y+C*r-n;if(Math.abs(e)<1e-10)break;let i=3*T*(g-t)+6*w*x*(y-g)+3*S*(r-y);if(Math.abs(i)<1e-10)break;x-=e/i,x=Math.max(0,Math.min(1,x))}i[l]=E*o+3*T*x*_+3*w*S*b+C*m}return i}},sa=class{constructor(e,t,n,r){if(e===void 0)throw Error(`THREE.KeyframeTrack: track name is undefined`);if(t===void 0||t.length===0)throw Error(`THREE.KeyframeTrack: no keyframes in track named `+e);this.name=e,this.times=ta(t,this.TimeBufferType),this.values=ta(n,this.ValueBufferType),this.setInterpolation(r||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,n;if(t.toJSON!==this.toJSON)n=t.toJSON(e);else{n={name:e.name,times:ta(e.times,Array),values:ta(e.values,Array)};let t=e.getInterpolation();t!==e.DefaultInterpolation&&(n.interpolation=t)}return n.type=e.ValueTypeName,n}InterpolantFactoryMethodDiscrete(e){return new aa(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new ia(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new ra(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodBezier(e){let t=new oa(this.times,this.values,this.getValueSize(),e);return this.settings&&(t.settings=this.settings),t}setInterpolation(e){let t;switch(e){case V:t=this.InterpolantFactoryMethodDiscrete;break;case ke:t=this.InterpolantFactoryMethodLinear;break;case H:t=this.InterpolantFactoryMethodSmooth;break;case U:t=this.InterpolantFactoryMethodBezier;break}if(t===void 0){let t=`unsupported interpolation for `+this.ValueTypeName+` keyframe track named `+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw Error(t);return W(`KeyframeTrack:`,t),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return V;case this.InterpolantFactoryMethodLinear:return ke;case this.InterpolantFactoryMethodSmooth:return H;case this.InterpolantFactoryMethodBezier:return U}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let n=0,r=t.length;n!==r;++n)t[n]+=e}return this}scale(e){if(e!==1){let t=this.times;for(let n=0,r=t.length;n!==r;++n)t[n]*=e}return this}trim(e,t){let n=this.times,r=n.length,i=0,a=r-1;for(;i!==r&&n[i]<e;)++i;for(;a!==-1&&n[a]>t;)--a;if(++a,i!==0||a!==r){i>=a&&(a=Math.max(a,1),i=a-1);let e=this.getValueSize();this.times=n.slice(i,a),this.values=this.values.slice(i*e,a*e)}return this}validate(){let e=!0,t=this.getValueSize();t-Math.floor(t)!==0&&(G(`KeyframeTrack: Invalid value size in track.`,this),e=!1);let n=this.times,r=this.values,i=n.length;i===0&&(G(`KeyframeTrack: Track is empty.`,this),e=!1);let a=null;for(let t=0;t!==i;t++){let r=n[t];if(typeof r==`number`&&isNaN(r)){G(`KeyframeTrack: Time is not a valid number.`,this,t,r),e=!1;break}if(a!==null&&a>r){G(`KeyframeTrack: Out of order keys.`,this,t,r,a),e=!1;break}a=r}if(r!==void 0&&Ue(r))for(let t=0,n=r.length;t!==n;++t){let n=r[t];if(isNaN(n)){G(`KeyframeTrack: Value is not a valid number.`,this,t,n),e=!1;break}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),n=this.getValueSize(),r=this.getInterpolation()===H,i=e.length-1,a=1;for(let o=1;o<i;++o){let i=!1,s=e[o];if(s!==e[o+1]&&(o!==1||s!==e[0]))if(r)i=!0;else{let e=o*n,r=e-n,a=e+n;for(let o=0;o!==n;++o){let n=t[e+o];if(n!==t[r+o]||n!==t[a+o]){i=!0;break}}}if(i){if(o!==a){e[a]=e[o];let r=o*n,i=a*n;for(let e=0;e!==n;++e)t[i+e]=t[r+e]}++a}}if(i>0){e[a]=e[i];for(let e=i*n,r=a*n,o=0;o!==n;++o)t[r+o]=t[e+o];++a}return a===e.length?(this.times=e,this.values=t):(this.times=e.slice(0,a),this.values=t.slice(0,a*n)),this}clone(){let e=this.times.slice(),t=this.values.slice(),n=this.constructor,r=new n(this.name,e,t);return r.createInterpolant=this.createInterpolant,r}};sa.prototype.ValueTypeName=``,sa.prototype.TimeBufferType=Float32Array,sa.prototype.ValueBufferType=Float32Array,sa.prototype.DefaultInterpolation=ke;var ca=class extends sa{constructor(e,t,n){super(e,t,n)}};ca.prototype.ValueTypeName=`bool`,ca.prototype.ValueBufferType=Array,ca.prototype.DefaultInterpolation=V,ca.prototype.InterpolantFactoryMethodLinear=void 0,ca.prototype.InterpolantFactoryMethodSmooth=void 0;var la=class extends sa{constructor(e,t,n,r){super(e,t,n,r)}};la.prototype.ValueTypeName=`color`;var ua=class extends sa{constructor(e,t,n,r){super(e,t,n,r)}};ua.prototype.ValueTypeName=`number`;var da=class extends na{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e,t,n,r){let i=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=(n-t)/(r-t),c=e*o;for(let e=c+o;c!==e;c+=4)Et.slerpFlat(i,0,a,c-o,a,c,s);return i}},fa=class extends sa{constructor(e,t,n,r){super(e,t,n,r)}InterpolantFactoryMethodLinear(e){return new da(this.times,this.values,this.getValueSize(),e)}};fa.prototype.ValueTypeName=`quaternion`,fa.prototype.InterpolantFactoryMethodSmooth=void 0;var pa=class extends sa{constructor(e,t,n){super(e,t,n)}};pa.prototype.ValueTypeName=`string`,pa.prototype.ValueBufferType=Array,pa.prototype.DefaultInterpolation=V,pa.prototype.InterpolantFactoryMethodLinear=void 0,pa.prototype.InterpolantFactoryMethodSmooth=void 0;var ma=class extends sa{constructor(e,t,n,r){super(e,t,n,r)}};ma.prototype.ValueTypeName=`vector`;var ha=new class{constructor(e,t,n){let r=this,i=!1,a=0,o=0,s,c=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=n,this._abortController=null,this.itemStart=function(e){o++,i===!1&&r.onStart!==void 0&&r.onStart(e,a,o),i=!0},this.itemEnd=function(e){a++,r.onProgress!==void 0&&r.onProgress(e,a,o),a===o&&(i=!1,r.onLoad!==void 0&&r.onLoad())},this.itemError=function(e){r.onError!==void 0&&r.onError(e)},this.resolveURL=function(e){return s?s(e):e},this.setURLModifier=function(e){return s=e,this},this.addHandler=function(e,t){return c.push(e,t),this},this.removeHandler=function(e){let t=c.indexOf(e);return t!==-1&&c.splice(t,2),this},this.getHandler=function(e){for(let t=0,n=c.length;t<n;t+=2){let n=c[t],r=c[t+1];if(n.global&&(n.lastIndex=0),n.test(e))return r}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||=new AbortController,this._abortController}},ga=class{constructor(e){this.manager=e===void 0?ha:e,this.crossOrigin=`anonymous`,this.withCredentials=!1,this.path=``,this.resourcePath=``,this.requestHeader={},typeof __THREE_DEVTOOLS__<`u`&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent(`observe`,{detail:this}))}load(){}loadAsync(e,t){let n=this;return new Promise(function(r,i){n.load(e,r,t,i)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}};ga.DEFAULT_MATERIAL_NAME=`__DEFAULT`;var _a=class extends Cn{constructor(e,t=1){super(),this.isLight=!0,this.type=`Light`,this.color=new X(e),this.intensity=t}dispose(){this.dispatchEvent({type:`dispose`})}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){let t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,t}},va=class extends _a{constructor(e,t,n){super(e,n),this.isHemisphereLight=!0,this.type=`HemisphereLight`,this.position.copy(Cn.DEFAULT_UP),this.updateMatrix(),this.groundColor=new X(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}toJSON(e){let t=super.toJSON(e);return t.object.groundColor=this.groundColor.getHex(),t}},ya=new Yt,ba=new J,xa=new J,Sa=class{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new q(512,512),this.mapType=d,this.map=null,this.mapPass=null,this.matrix=new Yt,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new hi,this._frameExtents=new q(1,1),this._viewportCount=1,this._viewports=[new Wt(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){let t=this.camera,n=this.matrix;ba.setFromMatrixPosition(e.matrixWorld),t.position.copy(ba),xa.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(xa),t.updateMatrixWorld(),ya.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(ya,t.coordinateSystem,t.reversedDepth),t.coordinateSystem===2001||t.reversedDepth?n.set(.5,0,0,.5,0,.5,0,.5,0,0,1,0,0,0,0,1):n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(ya)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this.biasNode=e.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){let e={};return this.intensity!==1&&(e.intensity=this.intensity),this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}},Ca=new J,wa=new Et,Ta=new J,Ea=class extends Cn{constructor(){super(),this.isCamera=!0,this.type=`Camera`,this.matrixWorldInverse=new Yt,this.projectionMatrix=new Yt,this.projectionMatrixInverse=new Yt,this.coordinateSystem=Ve,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose(Ca,wa,Ta),Ta.x===1&&Ta.y===1&&Ta.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Ca,wa,Ta.set(1,1,1)).invert()}updateWorldMatrix(e,t){super.updateWorldMatrix(e,t),this.matrixWorld.decompose(Ca,wa,Ta),Ta.x===1&&Ta.y===1&&Ta.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Ca,wa,Ta.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},Da=new J,Oa=new q,ka=new q,Aa=class extends Ea{constructor(e=50,t=1,n=.1,r=2e3){super(),this.isPerspectiveCamera=!0,this.type=`PerspectiveCamera`,this.fov=e,this.zoom=1,this.near=n,this.far=r,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=.5*this.getFilmHeight()/e;this.fov=rt*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(nt*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return rt*2*Math.atan(Math.tan(nt*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){Da.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(Da.x,Da.y).multiplyScalar(-e/Da.z),Da.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(Da.x,Da.y).multiplyScalar(-e/Da.z)}getViewSize(e,t){return this.getViewBounds(e,Oa,ka),t.subVectors(ka,Oa)}setViewOffset(e,t,n,r,i,a){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=r,this.view.width=i,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(nt*.5*this.fov)/this.zoom,n=2*t,r=this.aspect*n,i=-.5*r,a=this.view;if(this.view!==null&&this.view.enabled){let e=a.fullWidth,o=a.fullHeight;i+=a.offsetX*r/e,t-=a.offsetY*n/o,r*=a.width/e,n*=a.height/o}let o=this.filmOffset;o!==0&&(i+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(i,i+r,t,t-n,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}},ja=class extends Sa{constructor(){super(new Aa(90,1,.5,500)),this.isPointLightShadow=!0}},Ma=class extends _a{constructor(e,t,n=0,r=2){super(e,t),this.isPointLight=!0,this.type=`PointLight`,this.distance=n,this.decay=r,this.shadow=new ja}get power(){return this.intensity*4*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}dispose(){super.dispose(),this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.distance=this.distance,t.object.decay=this.decay,t.object.shadow=this.shadow.toJSON(),t}},Na=class extends Ea{constructor(e=-1,t=1,n=1,r=-1,i=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type=`OrthographicCamera`,this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=r,this.near=i,this.far=a,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,r,i,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=r,this.view.width=i,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,r=(this.top+this.bottom)/2,i=n-e,a=n+e,o=r+t,s=r-t;if(this.view!==null&&this.view.enabled){let e=(this.right-this.left)/this.view.fullWidth/this.zoom,t=(this.top-this.bottom)/this.view.fullHeight/this.zoom;i+=e*this.view.offsetX,a=i+e*this.view.width,o-=t*this.view.offsetY,s=o-t*this.view.height}this.projectionMatrix.makeOrthographic(i,a,o,s,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}},Pa=class extends Sa{constructor(){super(new Na(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},Fa=class extends _a{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type=`DirectionalLight`,this.position.copy(Cn.DEFAULT_UP),this.updateMatrix(),this.target=new Cn,this.shadow=new Pa}dispose(){super.dispose(),this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.shadow=this.shadow.toJSON(),t.object.target=this.target.uuid,t}},Ia=class extends _a{constructor(e,t){super(e,t),this.isAmbientLight=!0,this.type=`AmbientLight`}},La=-90,Ra=1,za=class extends Cn{constructor(e,t,n){super(),this.type=`CubeCamera`,this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let r=new Aa(La,Ra,e,t);r.layers=this.layers,this.add(r);let i=new Aa(La,Ra,e,t);i.layers=this.layers,this.add(i);let a=new Aa(La,Ra,e,t);a.layers=this.layers,this.add(a);let o=new Aa(La,Ra,e,t);o.layers=this.layers,this.add(o);let s=new Aa(La,Ra,e,t);s.layers=this.layers,this.add(s);let c=new Aa(La,Ra,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[n,r,i,a,o,s]=t;for(let e of t)this.remove(e);if(e===2e3)n.up.set(0,1,0),n.lookAt(1,0,0),r.up.set(0,1,0),r.lookAt(-1,0,0),i.up.set(0,0,-1),i.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),s.up.set(0,1,0),s.lookAt(0,0,-1);else if(e===2001)n.up.set(0,-1,0),n.lookAt(-1,0,0),r.up.set(0,-1,0),r.lookAt(1,0,0),i.up.set(0,0,1),i.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),s.up.set(0,-1,0),s.lookAt(0,0,-1);else throw Error(`THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: `+e);for(let e of t)this.add(e),e.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:r}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());let[i,a,o,s,c,l]=this.children,u=e.getRenderTarget(),d=e.getActiveCubeFace(),f=e.getActiveMipmapLevel(),p=e.xr.enabled;e.xr.enabled=!1;let m=n.texture.generateMipmaps;n.texture.generateMipmaps=!1;let h=!1;h=e.isWebGLRenderer===!0?e.state.buffers.depth.getReversed():e.reversedDepthBuffer,e.setRenderTarget(n,0,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,i),e.setRenderTarget(n,1,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,a),e.setRenderTarget(n,2,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,o),e.setRenderTarget(n,3,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,s),e.setRenderTarget(n,4,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,c),n.texture.generateMipmaps=m,e.setRenderTarget(n,5,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,l),e.setRenderTarget(u,d,f),e.xr.enabled=p,n.texture.needsPMREMUpdate=!0}},Ba=class extends Aa{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}},Va=`\\[\\]\\.:\\/`,Ha=RegExp(`[\\[\\]\\.:\\/]`,`g`),Ua=`[^\\[\\]\\.:\\/]`,Wa=`[^`+Va.replace(`\\.`,``)+`]`,Ga=`((?:WC+[\\/:])*)`.replace(`WC`,Ua),Ka=`(WCOD+)?`.replace(`WCOD`,Wa),qa=`(?:\\.(WC+)(?:\\[(.+)\\])?)?`.replace(`WC`,Ua),Ja=`\\.(WC+)(?:\\[(.+)\\])?`.replace(`WC`,Ua),Ya=RegExp(`^`+Ga+Ka+qa+Ja+`$`),Xa=[`material`,`materials`,`bones`,`map`],Za=class{constructor(e,t,n){let r=n||Qa.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,r)}getValue(e,t){this.bind();let n=this._targetGroup.nCachedObjects_,r=this._bindings[n];r!==void 0&&r.getValue(e,t)}setValue(e,t){let n=this._bindings;for(let r=this._targetGroup.nCachedObjects_,i=n.length;r!==i;++r)n[r].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].unbind()}},Qa=class e{constructor(t,n,r){this.path=n,this.parsedPath=r||e.parseTrackName(n),this.node=e.findNode(t,this.parsedPath.nodeName),this.rootNode=t,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(t,n,r){return t&&t.isAnimationObjectGroup?new e.Composite(t,n,r):new e(t,n,r)}static sanitizeNodeName(e){return e.replace(/\s/g,`_`).replace(Ha,``)}static parseTrackName(e){let t=Ya.exec(e);if(t===null)throw Error(`PropertyBinding: Cannot parse trackName: `+e);let n={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},r=n.nodeName&&n.nodeName.lastIndexOf(`.`);if(r!==void 0&&r!==-1){let e=n.nodeName.substring(r+1);Xa.indexOf(e)!==-1&&(n.nodeName=n.nodeName.substring(0,r),n.objectName=e)}if(n.propertyName===null||n.propertyName.length===0)throw Error(`PropertyBinding: can not parse propertyName from trackName: `+e);return n}static findNode(e,t){if(t===void 0||t===``||t===`.`||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let n=e.skeleton.getBoneByName(t);if(n!==void 0)return n}if(e.children){let n=function(e){for(let r=0;r<e.length;r++){let i=e[r];if(i.name===t||i.uuid===t)return i;let a=n(i.children);if(a)return a}return null},r=n(e.children);if(r)return r}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let n=this.resolvedProperty;for(let r=0,i=n.length;r!==i;++r)e[t++]=n[r]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let n=this.resolvedProperty;for(let r=0,i=n.length;r!==i;++r)n[r]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let n=this.resolvedProperty;for(let r=0,i=n.length;r!==i;++r)n[r]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let n=this.resolvedProperty;for(let r=0,i=n.length;r!==i;++r)n[r]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let t=this.node,n=this.parsedPath,r=n.objectName,i=n.propertyName,a=n.propertyIndex;if(t||(t=e.findNode(this.rootNode,n.nodeName),this.node=t),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!t){W(`PropertyBinding: No target node found for track: `+this.path+`.`);return}if(r){let e=n.objectIndex;switch(r){case`materials`:if(!t.material){G(`PropertyBinding: Can not bind to material as node does not have a material.`,this);return}if(!t.material.materials){G(`PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.`,this);return}t=t.material.materials;break;case`bones`:if(!t.skeleton){G(`PropertyBinding: Can not bind to bones as node does not have a skeleton.`,this);return}t=t.skeleton.bones;for(let n=0;n<t.length;n++)if(t[n].name===e){e=n;break}break;case`map`:if(`map`in t){t=t.map;break}if(!t.material){G(`PropertyBinding: Can not bind to material as node does not have a material.`,this);return}if(!t.material.map){G(`PropertyBinding: Can not bind to material.map as node.material does not have a map.`,this);return}t=t.material.map;break;default:if(t[r]===void 0){G(`PropertyBinding: Can not bind to objectName of node undefined.`,this);return}t=t[r]}if(e!==void 0){if(t[e]===void 0){G(`PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.`,this,t);return}t=t[e]}}let o=t[i];if(o===void 0){let e=n.nodeName;G(`PropertyBinding: Trying to update property for track: `+e+`.`+i+` but it wasn't found.`,t);return}let s=this.Versioning.None;this.targetObject=t,t.isMaterial===!0?s=this.Versioning.NeedsUpdate:t.isObject3D===!0&&(s=this.Versioning.MatrixWorldNeedsUpdate);let c=this.BindingType.Direct;if(a!==void 0){if(i===`morphTargetInfluences`){if(!t.geometry){G(`PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.`,this);return}if(!t.geometry.morphAttributes){G(`PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.`,this);return}t.morphTargetDictionary[a]!==void 0&&(a=t.morphTargetDictionary[a])}c=this.BindingType.ArrayElement,this.resolvedProperty=o,this.propertyIndex=a}else o.fromArray!==void 0&&o.toArray!==void 0?(c=this.BindingType.HasFromToArray,this.resolvedProperty=o):Array.isArray(o)?(c=this.BindingType.EntireArray,this.resolvedProperty=o):this.propertyName=i;this.getValue=this.GetterByBindingType[c],this.setValue=this.SetterByBindingTypeAndVersioning[c][s]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};Qa.Composite=Za,Qa.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3},Qa.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2},Qa.prototype.GetterByBindingType=[Qa.prototype._getValue_direct,Qa.prototype._getValue_array,Qa.prototype._getValue_arrayElement,Qa.prototype._getValue_toArray],Qa.prototype.SetterByBindingTypeAndVersioning=[[Qa.prototype._setValue_direct,Qa.prototype._setValue_direct_setNeedsUpdate,Qa.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[Qa.prototype._setValue_array,Qa.prototype._setValue_array_setNeedsUpdate,Qa.prototype._setValue_array_setMatrixWorldNeedsUpdate],[Qa.prototype._setValue_arrayElement,Qa.prototype._setValue_arrayElement_setNeedsUpdate,Qa.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[Qa.prototype._setValue_fromArray,Qa.prototype._setValue_fromArray_setNeedsUpdate,Qa.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var $a=class{constructor(e=1,t=0,n=0){this.radius=e,this.phi=t,this.theta=n}set(e,t,n){return this.radius=e,this.phi=t,this.theta=n,this}copy(e){return this.radius=e.radius,this.phi=e.phi,this.theta=e.theta,this}makeSafe(){let e=1e-6;return this.phi=K(this.phi,e,Math.PI-e),this}setFromVector3(e){return this.setFromCartesianCoords(e.x,e.y,e.z)}setFromCartesianCoords(e,t,n){return this.radius=Math.sqrt(e*e+t*t+n*n),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(e,n),this.phi=Math.acos(K(t/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}};(class e{static{e.prototype.isMatrix2=!0}constructor(e,t,n,r){this.elements=[1,0,0,1],e!==void 0&&this.set(e,t,n,r)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let n=0;n<4;n++)this.elements[n]=e[n+t];return this}set(e,t,n,r){let i=this.elements;return i[0]=e,i[2]=t,i[1]=n,i[3]=r,this}});var eo=class extends Oi{constructor(e=10,t=10,n=4473924,r=8947848){n=new X(n),r=new X(r);let i=t/2,a=e/t,o=e/2,s=[],c=[];for(let e=0,l=0,u=-o;e<=t;e++,u+=a){s.push(-o,0,u,o,0,u),s.push(u,0,-o,u,0,o);let t=e===i?n:r;t.toArray(c,l),l+=3,t.toArray(c,l),l+=3,t.toArray(c,l),l+=3,t.toArray(c,l),l+=3}let l=new Er;l.setAttribute(`position`,new mr(s,3)),l.setAttribute(`color`,new mr(c,3));let u=new gi({vertexColors:!0,toneMapped:!1});super(l,u),this.type=`GridHelper`}dispose(){this.geometry.dispose(),this.material.dispose()}},to=class extends $e{constructor(e,t=null){super(),this.object=e,this.domElement=t,this.enabled=!0,this.state=-1,this.keys={},this.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:null},this.touches={ONE:null,TWO:null}}connect(e){if(e===void 0){W(`Controls: connect() now requires an element.`);return}this.domElement!==null&&this.disconnect(),this.domElement=e}disconnect(){}dispose(){}update(){}};function no(e,t,n,r){let i=ro(r);switch(n){case w:return e*t;case k:return e*t/i.components*i.byteLength;case A:return e*t/i.components*i.byteLength;case j:return e*t*2/i.components*i.byteLength;case M:return e*t*2/i.components*i.byteLength;case T:return e*t*3/i.components*i.byteLength;case E:return e*t*4/i.components*i.byteLength;case N:return e*t*4/i.components*i.byteLength;case P:case F:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*8;case I:case ee:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case te:case z:return Math.max(e,16)*Math.max(t,8)/4;case L:case R:return Math.max(e,8)*Math.max(t,8)/2;case ne:case re:case ae:case oe:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*8;case ie:case se:case ce:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case le:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case ue:return Math.floor((e+4)/5)*Math.floor((t+3)/4)*16;case de:return Math.floor((e+4)/5)*Math.floor((t+4)/5)*16;case fe:return Math.floor((e+5)/6)*Math.floor((t+4)/5)*16;case pe:return Math.floor((e+5)/6)*Math.floor((t+5)/6)*16;case me:return Math.floor((e+7)/8)*Math.floor((t+4)/5)*16;case he:return Math.floor((e+7)/8)*Math.floor((t+5)/6)*16;case ge:return Math.floor((e+7)/8)*Math.floor((t+7)/8)*16;case _e:return Math.floor((e+9)/10)*Math.floor((t+4)/5)*16;case ve:return Math.floor((e+9)/10)*Math.floor((t+5)/6)*16;case ye:return Math.floor((e+9)/10)*Math.floor((t+7)/8)*16;case be:return Math.floor((e+9)/10)*Math.floor((t+9)/10)*16;case xe:return Math.floor((e+11)/12)*Math.floor((t+9)/10)*16;case Se:return Math.floor((e+11)/12)*Math.floor((t+11)/12)*16;case Ce:case we:case Te:return Math.ceil(e/4)*Math.ceil(t/4)*16;case B:case Ee:return Math.ceil(e/4)*Math.ceil(t/4)*8;case De:case Oe:return Math.ceil(e/4)*Math.ceil(t/4)*16}throw Error(`Unable to determine texture byte length for ${n} format.`)}function ro(e){switch(e){case d:case f:return{byteLength:1,components:1};case m:case p:case v:return{byteLength:2,components:1};case y:case b:return{byteLength:2,components:4};case g:case h:case _:return{byteLength:4,components:1};case S:case C:return{byteLength:4,components:3}}throw Error(`Unknown texture type ${e}.`)}typeof __THREE_DEVTOOLS__<`u`&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent(`register`,{detail:{revision:`184`}})),typeof window<`u`&&(window.__THREE__?W(`WARNING: Multiple instances of Three.js being imported.`):window.__THREE__=`184`);function io(){let e=null,t=!1,n=null,r=null;function i(t,a){n(t,a),r=e.requestAnimationFrame(i)}return{start:function(){t!==!0&&n!==null&&e!==null&&(r=e.requestAnimationFrame(i),t=!0)},stop:function(){e!==null&&e.cancelAnimationFrame(r),t=!1},setAnimationLoop:function(e){n=e},setContext:function(t){e=t}}}function ao(e){let t=new WeakMap;function n(t,n){let r=t.array,i=t.usage,a=r.byteLength,o=e.createBuffer();e.bindBuffer(n,o),e.bufferData(n,r,i),t.onUploadCallback();let s;if(r instanceof Float32Array)s=e.FLOAT;else if(typeof Float16Array<`u`&&r instanceof Float16Array)s=e.HALF_FLOAT;else if(r instanceof Uint16Array)s=t.isFloat16BufferAttribute?e.HALF_FLOAT:e.UNSIGNED_SHORT;else if(r instanceof Int16Array)s=e.SHORT;else if(r instanceof Uint32Array)s=e.UNSIGNED_INT;else if(r instanceof Int32Array)s=e.INT;else if(r instanceof Int8Array)s=e.BYTE;else if(r instanceof Uint8Array)s=e.UNSIGNED_BYTE;else if(r instanceof Uint8ClampedArray)s=e.UNSIGNED_BYTE;else throw Error(`THREE.WebGLAttributes: Unsupported buffer data format: `+r);return{buffer:o,type:s,bytesPerElement:r.BYTES_PER_ELEMENT,version:t.version,size:a}}function r(t,n,r){let i=n.array,a=n.updateRanges;if(e.bindBuffer(r,t),a.length===0)e.bufferSubData(r,0,i);else{a.sort((e,t)=>e.start-t.start);let t=0;for(let e=1;e<a.length;e++){let n=a[t],r=a[e];r.start<=n.start+n.count+1?n.count=Math.max(n.count,r.start+r.count-n.start):(++t,a[t]=r)}a.length=t+1;for(let t=0,n=a.length;t<n;t++){let n=a[t];e.bufferSubData(r,n.start*i.BYTES_PER_ELEMENT,i,n.start,n.count)}n.clearUpdateRanges()}n.onUploadCallback()}function i(e){return e.isInterleavedBufferAttribute&&(e=e.data),t.get(e)}function a(n){n.isInterleavedBufferAttribute&&(n=n.data);let r=t.get(n);r&&(e.deleteBuffer(r.buffer),t.delete(n))}function o(e,i){if(e.isInterleavedBufferAttribute&&(e=e.data),e.isGLBufferAttribute){let n=t.get(e);(!n||n.version<e.version)&&t.set(e,{buffer:e.buffer,type:e.type,bytesPerElement:e.elementSize,version:e.version});return}let a=t.get(e);if(a===void 0)t.set(e,n(e,i));else if(a.version<e.version){if(a.size!==e.array.byteLength)throw Error(`THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.`);r(a.buffer,e,i),a.version=e.version}}return{get:i,remove:a,update:o}}var Z={alphahash_fragment:`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,alphahash_pars_fragment:`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,alphamap_fragment:`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,alphamap_pars_fragment:`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,alphatest_fragment:`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,alphatest_pars_fragment:`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,aomap_fragment:`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,aomap_pars_fragment:`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,batching_pars_vertex:`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,batching_vertex:`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,begin_vertex:`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,beginnormal_vertex:`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,bsdfs:`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,iridescence_fragment:`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,bumpmap_pars_fragment:`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,clipping_planes_fragment:`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,clipping_planes_pars_fragment:`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,clipping_planes_pars_vertex:`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,clipping_planes_vertex:`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,color_fragment:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,color_pars_fragment:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,color_pars_vertex:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,color_vertex:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,common:`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,cube_uv_reflection_fragment:`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,defaultnormal_vertex:`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,displacementmap_pars_vertex:`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,displacementmap_vertex:`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,emissivemap_fragment:`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,emissivemap_pars_fragment:`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,colorspace_fragment:`gl_FragColor = linearToOutputTexel( gl_FragColor );`,colorspace_pars_fragment:`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,envmap_fragment:`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,envmap_common_pars_fragment:`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,envmap_pars_fragment:`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,envmap_pars_vertex:`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,envmap_physical_pars_fragment:`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,envmap_vertex:`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,fog_vertex:`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,fog_pars_vertex:`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,fog_fragment:`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,fog_pars_fragment:`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,gradientmap_pars_fragment:`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,lightmap_pars_fragment:`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,lights_lambert_fragment:`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,lights_lambert_pars_fragment:`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,lights_pars_begin:`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,lights_toon_fragment:`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,lights_toon_pars_fragment:`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,lights_phong_fragment:`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,lights_phong_pars_fragment:`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,lights_physical_fragment:`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,lights_physical_pars_fragment:`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
		vec3 iridescenceFresnelDielectric;
		vec3 iridescenceFresnelMetallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
vec3 BRDF_GGX_Multiscatter( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 singleScatter = BRDF_GGX( lightDir, viewDir, normal, material );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 dfgV = texture2D( dfgLUT, vec2( material.roughness, dotNV ) ).rg;
	vec2 dfgL = texture2D( dfgLUT, vec2( material.roughness, dotNL ) ).rg;
	vec3 FssEss_V = material.specularColorBlended * dfgV.x + material.specularF90 * dfgV.y;
	vec3 FssEss_L = material.specularColorBlended * dfgL.x + material.specularF90 * dfgL.y;
	float Ess_V = dfgV.x + dfgV.y;
	float Ess_L = dfgL.x + dfgL.y;
	float Ems_V = 1.0 - Ess_V;
	float Ems_L = 1.0 - Ess_L;
	vec3 Favg = material.specularColorBlended + ( 1.0 - material.specularColorBlended ) * 0.047619;
	vec3 Fms = FssEss_V * FssEss_L * Favg / ( 1.0 - Ems_V * Ems_L * Favg + EPSILON );
	float compensationFactor = Ems_V * Ems_L;
	vec3 multiScatter = Fms * compensationFactor;
	return singleScatter + multiScatter;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX_Multiscatter( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnelDielectric, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceFresnelMetallic, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,lights_fragment_begin:`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( material.iridescenceFresnelDielectric, material.iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = inverseTransformDirection( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,lights_fragment_maps:`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,lights_fragment_end:`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,lightprobes_pars_fragment:`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,logdepthbuf_fragment:`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,logdepthbuf_pars_fragment:`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,logdepthbuf_pars_vertex:`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,logdepthbuf_vertex:`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,map_fragment:`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,map_pars_fragment:`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,map_particle_fragment:`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,map_particle_pars_fragment:`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,metalnessmap_fragment:`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,metalnessmap_pars_fragment:`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,morphinstance_vertex:`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,morphcolor_vertex:`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,morphnormal_vertex:`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,morphtarget_pars_vertex:`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,morphtarget_vertex:`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,normal_fragment_begin:`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,normal_fragment_maps:`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,normal_pars_fragment:`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,normal_pars_vertex:`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,normal_vertex:`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,normalmap_pars_fragment:`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,clearcoat_normal_fragment_begin:`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,clearcoat_normal_fragment_maps:`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,clearcoat_pars_fragment:`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,iridescence_pars_fragment:`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,opaque_fragment:`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,packing:`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,premultiplied_alpha_fragment:`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,project_vertex:`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,dithering_fragment:`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,dithering_pars_fragment:`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,roughnessmap_fragment:`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,roughnessmap_pars_fragment:`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,shadowmap_pars_fragment:`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,shadowmap_pars_vertex:`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,shadowmap_vertex:`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,shadowmask_pars_fragment:`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,skinbase_vertex:`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,skinning_pars_vertex:`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,skinning_vertex:`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,skinnormal_vertex:`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,specularmap_fragment:`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,specularmap_pars_fragment:`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,tonemapping_fragment:`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,tonemapping_pars_fragment:`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,transmission_fragment:`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,transmission_pars_fragment:`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,uv_pars_fragment:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,uv_pars_vertex:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,uv_vertex:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,worldpos_vertex:`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,background_vert:`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,background_frag:`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,backgroundCube_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,backgroundCube_frag:`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,cube_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,cube_frag:`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,depth_vert:`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,depth_frag:`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,distance_vert:`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,distance_frag:`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,equirect_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,equirect_frag:`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,linedashed_vert:`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,linedashed_frag:`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,meshbasic_vert:`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,meshbasic_frag:`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshlambert_vert:`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshlambert_frag:`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshmatcap_vert:`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,meshmatcap_frag:`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshnormal_vert:`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,meshnormal_frag:`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,meshphong_vert:`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshphong_frag:`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshphysical_vert:`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,meshphysical_frag:`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshtoon_vert:`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshtoon_frag:`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,points_vert:`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,points_frag:`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,shadow_vert:`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,shadow_frag:`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,sprite_vert:`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,sprite_frag:`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`},Q={common:{diffuse:{value:new X(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Y},alphaMap:{value:null},alphaMapTransform:{value:new Y},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Y}},envmap:{envMap:{value:null},envMapRotation:{value:new Y},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Y}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Y}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Y},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Y},normalScale:{value:new q(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Y},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Y}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Y}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Y}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new X(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new J},probesMax:{value:new J},probesResolution:{value:new J}},points:{diffuse:{value:new X(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Y},alphaTest:{value:0},uvTransform:{value:new Y}},sprite:{diffuse:{value:new X(16777215)},opacity:{value:1},center:{value:new q(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Y},alphaMap:{value:null},alphaMapTransform:{value:new Y},alphaTest:{value:0}}},oo={basic:{uniforms:Vi([Q.common,Q.specularmap,Q.envmap,Q.aomap,Q.lightmap,Q.fog]),vertexShader:Z.meshbasic_vert,fragmentShader:Z.meshbasic_frag},lambert:{uniforms:Vi([Q.common,Q.specularmap,Q.envmap,Q.aomap,Q.lightmap,Q.emissivemap,Q.bumpmap,Q.normalmap,Q.displacementmap,Q.fog,Q.lights,{emissive:{value:new X(0)},envMapIntensity:{value:1}}]),vertexShader:Z.meshlambert_vert,fragmentShader:Z.meshlambert_frag},phong:{uniforms:Vi([Q.common,Q.specularmap,Q.envmap,Q.aomap,Q.lightmap,Q.emissivemap,Q.bumpmap,Q.normalmap,Q.displacementmap,Q.fog,Q.lights,{emissive:{value:new X(0)},specular:{value:new X(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:Z.meshphong_vert,fragmentShader:Z.meshphong_frag},standard:{uniforms:Vi([Q.common,Q.envmap,Q.aomap,Q.lightmap,Q.emissivemap,Q.bumpmap,Q.normalmap,Q.displacementmap,Q.roughnessmap,Q.metalnessmap,Q.fog,Q.lights,{emissive:{value:new X(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Z.meshphysical_vert,fragmentShader:Z.meshphysical_frag},toon:{uniforms:Vi([Q.common,Q.aomap,Q.lightmap,Q.emissivemap,Q.bumpmap,Q.normalmap,Q.displacementmap,Q.gradientmap,Q.fog,Q.lights,{emissive:{value:new X(0)}}]),vertexShader:Z.meshtoon_vert,fragmentShader:Z.meshtoon_frag},matcap:{uniforms:Vi([Q.common,Q.bumpmap,Q.normalmap,Q.displacementmap,Q.fog,{matcap:{value:null}}]),vertexShader:Z.meshmatcap_vert,fragmentShader:Z.meshmatcap_frag},points:{uniforms:Vi([Q.points,Q.fog]),vertexShader:Z.points_vert,fragmentShader:Z.points_frag},dashed:{uniforms:Vi([Q.common,Q.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Z.linedashed_vert,fragmentShader:Z.linedashed_frag},depth:{uniforms:Vi([Q.common,Q.displacementmap]),vertexShader:Z.depth_vert,fragmentShader:Z.depth_frag},normal:{uniforms:Vi([Q.common,Q.bumpmap,Q.normalmap,Q.displacementmap,{opacity:{value:1}}]),vertexShader:Z.meshnormal_vert,fragmentShader:Z.meshnormal_frag},sprite:{uniforms:Vi([Q.sprite,Q.fog]),vertexShader:Z.sprite_vert,fragmentShader:Z.sprite_frag},background:{uniforms:{uvTransform:{value:new Y},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Z.background_vert,fragmentShader:Z.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Y}},vertexShader:Z.backgroundCube_vert,fragmentShader:Z.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Z.cube_vert,fragmentShader:Z.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Z.equirect_vert,fragmentShader:Z.equirect_frag},distance:{uniforms:Vi([Q.common,Q.displacementmap,{referencePosition:{value:new J},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Z.distance_vert,fragmentShader:Z.distance_frag},shadow:{uniforms:Vi([Q.lights,Q.fog,{color:{value:new X(0)},opacity:{value:1}}]),vertexShader:Z.shadow_vert,fragmentShader:Z.shadow_frag}};oo.physical={uniforms:Vi([oo.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Y},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Y},clearcoatNormalScale:{value:new q(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Y},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Y},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Y},sheen:{value:0},sheenColor:{value:new X(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Y},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Y},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Y},transmissionSamplerSize:{value:new q},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Y},attenuationDistance:{value:0},attenuationColor:{value:new X(0)},specularColor:{value:new X(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Y},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Y},anisotropyVector:{value:new q},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Y}}]),vertexShader:Z.meshphysical_vert,fragmentShader:Z.meshphysical_frag};var so={r:0,b:0,g:0},co=new Yt,lo=new Y;lo.set(-1,0,0,0,1,0,0,0,1);function uo(e,t,n,r,i,a){let o=new X(0),s=i===!0?0:1,c,l,u=null,d=0,f=null;function p(e){let n=e.isScene===!0?e.background:null;if(n&&n.isTexture){let r=e.backgroundBlurriness>0;n=t.get(n,r)}return n}function m(t){let r=!1,i=p(t);i===null?g(o,s):i&&i.isColor&&(g(i,1),r=!0);let c=e.xr.getEnvironmentBlendMode();c===`additive`?n.buffers.color.setClear(0,0,0,1,a):c===`alpha-blend`&&n.buffers.color.setClear(0,0,0,0,a),(e.autoClear||r)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil))}function h(t,n){let i=p(n);i&&(i.isCubeTexture||i.mapping===306)?(l===void 0&&(l=new Yr(new Ni(1,1,1),new Ji({name:`BackgroundCubeMaterial`,uniforms:Bi(oo.backgroundCube.uniforms),vertexShader:oo.backgroundCube.vertexShader,fragmentShader:oo.backgroundCube.fragmentShader,side:1,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute(`normal`),l.geometry.deleteAttribute(`uv`),l.onBeforeRender=function(e,t,n){this.matrixWorld.copyPosition(n.matrixWorld)},Object.defineProperty(l.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),r.update(l)),l.material.uniforms.envMap.value=i,l.material.uniforms.backgroundBlurriness.value=n.backgroundBlurriness,l.material.uniforms.backgroundIntensity.value=n.backgroundIntensity,l.material.uniforms.backgroundRotation.value.setFromMatrix4(co.makeRotationFromEuler(n.backgroundRotation)).transpose(),i.isCubeTexture&&i.isRenderTargetTexture===!1&&l.material.uniforms.backgroundRotation.value.premultiply(lo),l.material.toneMapped=Nt.getTransfer(i.colorSpace)!==Le,(u!==i||d!==i.version||f!==e.toneMapping)&&(l.material.needsUpdate=!0,u=i,d=i.version,f=e.toneMapping),l.layers.enableAll(),t.unshift(l,l.geometry,l.material,0,0,null)):i&&i.isTexture&&(c===void 0&&(c=new Yr(new zi(2,2),new Ji({name:`BackgroundMaterial`,uniforms:Bi(oo.background.uniforms),vertexShader:oo.background.vertexShader,fragmentShader:oo.background.fragmentShader,side:0,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute(`normal`),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),r.update(c)),c.material.uniforms.t2D.value=i,c.material.uniforms.backgroundIntensity.value=n.backgroundIntensity,c.material.toneMapped=Nt.getTransfer(i.colorSpace)!==Le,i.matrixAutoUpdate===!0&&i.updateMatrix(),c.material.uniforms.uvTransform.value.copy(i.matrix),(u!==i||d!==i.version||f!==e.toneMapping)&&(c.material.needsUpdate=!0,u=i,d=i.version,f=e.toneMapping),c.layers.enableAll(),t.unshift(c,c.geometry,c.material,0,0,null))}function g(t,r){t.getRGB(so,Wi(e)),n.buffers.color.setClear(so.r,so.g,so.b,r,a)}function _(){l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0),c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0)}return{getClearColor:function(){return o},setClearColor:function(e,t=1){o.set(e),s=t,g(o,s)},getClearAlpha:function(){return s},setClearAlpha:function(e){s=e,g(o,s)},render:m,addToRenderList:h,dispose:_}}function fo(e,t){let n=e.getParameter(e.MAX_VERTEX_ATTRIBS),r={},i=f(null),a=i,o=!1;function s(n,r,i,s,c){let u=!1,f=d(n,s,i,r);a!==f&&(a=f,l(a.object)),u=p(n,s,i,c),u&&m(n,s,i,c),c!==null&&t.update(c,e.ELEMENT_ARRAY_BUFFER),(u||o)&&(o=!1,b(n,r,i,s),c!==null&&e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,t.get(c).buffer))}function c(){return e.createVertexArray()}function l(t){return e.bindVertexArray(t)}function u(t){return e.deleteVertexArray(t)}function d(e,t,n,i){let a=i.wireframe===!0,o=r[t.id];o===void 0&&(o={},r[t.id]=o);let s=e.isInstancedMesh===!0?e.id:0,l=o[s];l===void 0&&(l={},o[s]=l);let u=l[n.id];u===void 0&&(u={},l[n.id]=u);let d=u[a];return d===void 0&&(d=f(c()),u[a]=d),d}function f(e){let t=[],r=[],i=[];for(let e=0;e<n;e++)t[e]=0,r[e]=0,i[e]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:t,enabledAttributes:r,attributeDivisors:i,object:e,attributes:{},index:null}}function p(e,t,n,r){let i=a.attributes,o=t.attributes,s=0,c=n.getAttributes();for(let t in c)if(c[t].location>=0){let n=i[t],r=o[t];if(r===void 0&&(t===`instanceMatrix`&&e.instanceMatrix&&(r=e.instanceMatrix),t===`instanceColor`&&e.instanceColor&&(r=e.instanceColor)),n===void 0||n.attribute!==r||r&&n.data!==r.data)return!0;s++}return a.attributesNum!==s||a.index!==r}function m(e,t,n,r){let i={},o=t.attributes,s=0,c=n.getAttributes();for(let t in c)if(c[t].location>=0){let n=o[t];n===void 0&&(t===`instanceMatrix`&&e.instanceMatrix&&(n=e.instanceMatrix),t===`instanceColor`&&e.instanceColor&&(n=e.instanceColor));let r={};r.attribute=n,n&&n.data&&(r.data=n.data),i[t]=r,s++}a.attributes=i,a.attributesNum=s,a.index=r}function h(){let e=a.newAttributes;for(let t=0,n=e.length;t<n;t++)e[t]=0}function g(e){_(e,0)}function _(t,n){let r=a.newAttributes,i=a.enabledAttributes,o=a.attributeDivisors;r[t]=1,i[t]===0&&(e.enableVertexAttribArray(t),i[t]=1),o[t]!==n&&(e.vertexAttribDivisor(t,n),o[t]=n)}function v(){let t=a.newAttributes,n=a.enabledAttributes;for(let r=0,i=n.length;r<i;r++)n[r]!==t[r]&&(e.disableVertexAttribArray(r),n[r]=0)}function y(t,n,r,i,a,o,s){s===!0?e.vertexAttribIPointer(t,n,r,a,o):e.vertexAttribPointer(t,n,r,i,a,o)}function b(n,r,i,a){h();let o=a.attributes,s=i.getAttributes(),c=r.defaultAttributeValues;for(let r in s){let i=s[r];if(i.location>=0){let s=o[r];if(s===void 0&&(r===`instanceMatrix`&&n.instanceMatrix&&(s=n.instanceMatrix),r===`instanceColor`&&n.instanceColor&&(s=n.instanceColor)),s!==void 0){let r=s.normalized,o=s.itemSize,c=t.get(s);if(c===void 0)continue;let l=c.buffer,u=c.type,d=c.bytesPerElement,f=u===e.INT||u===e.UNSIGNED_INT||s.gpuType===1013;if(s.isInterleavedBufferAttribute){let t=s.data,c=t.stride,p=s.offset;if(t.isInstancedInterleavedBuffer){for(let e=0;e<i.locationSize;e++)_(i.location+e,t.meshPerAttribute);n.isInstancedMesh!==!0&&a._maxInstanceCount===void 0&&(a._maxInstanceCount=t.meshPerAttribute*t.count)}else for(let e=0;e<i.locationSize;e++)g(i.location+e);e.bindBuffer(e.ARRAY_BUFFER,l);for(let e=0;e<i.locationSize;e++)y(i.location+e,o/i.locationSize,u,r,c*d,(p+o/i.locationSize*e)*d,f)}else{if(s.isInstancedBufferAttribute){for(let e=0;e<i.locationSize;e++)_(i.location+e,s.meshPerAttribute);n.isInstancedMesh!==!0&&a._maxInstanceCount===void 0&&(a._maxInstanceCount=s.meshPerAttribute*s.count)}else for(let e=0;e<i.locationSize;e++)g(i.location+e);e.bindBuffer(e.ARRAY_BUFFER,l);for(let e=0;e<i.locationSize;e++)y(i.location+e,o/i.locationSize,u,r,o*d,o/i.locationSize*e*d,f)}}else if(c!==void 0){let t=c[r];if(t!==void 0)switch(t.length){case 2:e.vertexAttrib2fv(i.location,t);break;case 3:e.vertexAttrib3fv(i.location,t);break;case 4:e.vertexAttrib4fv(i.location,t);break;default:e.vertexAttrib1fv(i.location,t)}}}}v()}function x(){T();for(let e in r){let t=r[e];for(let e in t){let n=t[e];for(let e in n){let t=n[e];for(let e in t)u(t[e].object),delete t[e];delete n[e]}}delete r[e]}}function S(e){if(r[e.id]===void 0)return;let t=r[e.id];for(let e in t){let n=t[e];for(let e in n){let t=n[e];for(let e in t)u(t[e].object),delete t[e];delete n[e]}}delete r[e.id]}function C(e){for(let t in r){let n=r[t];for(let t in n){let r=n[t];if(r[e.id]===void 0)continue;let i=r[e.id];for(let e in i)u(i[e].object),delete i[e];delete r[e.id]}}}function w(e){for(let t in r){let n=r[t],i=e.isInstancedMesh===!0?e.id:0,a=n[i];if(a!==void 0){for(let e in a){let t=a[e];for(let e in t)u(t[e].object),delete t[e];delete a[e]}delete n[i],Object.keys(n).length===0&&delete r[t]}}}function T(){E(),o=!0,a!==i&&(a=i,l(a.object))}function E(){i.geometry=null,i.program=null,i.wireframe=!1}return{setup:s,reset:T,resetDefaultState:E,dispose:x,releaseStatesOfGeometry:S,releaseStatesOfObject:w,releaseStatesOfProgram:C,initAttributes:h,enableAttribute:g,disableUnusedAttributes:v}}function po(e,t,n){let r;function i(e){r=e}function a(t,i){e.drawArrays(r,t,i),n.update(i,r,1)}function o(t,i,a){a!==0&&(e.drawArraysInstanced(r,t,i,a),n.update(i,r,a))}function s(e,i,a){if(a===0)return;t.get(`WEBGL_multi_draw`).multiDrawArraysWEBGL(r,e,0,i,0,a);let o=0;for(let e=0;e<a;e++)o+=i[e];n.update(o,r,1)}this.setMode=i,this.render=a,this.renderInstances=o,this.renderMultiDraw=s}function mo(e,t,n,r){let i;function a(){if(i!==void 0)return i;if(t.has(`EXT_texture_filter_anisotropic`)===!0){let n=t.get(`EXT_texture_filter_anisotropic`);i=e.getParameter(n.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else i=0;return i}function o(t){return!(t!==1023&&r.convert(t)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_FORMAT))}function s(n){let i=n===1016&&(t.has(`EXT_color_buffer_half_float`)||t.has(`EXT_color_buffer_float`));return!(n!==1009&&r.convert(n)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_TYPE)&&n!==1015&&!i)}function c(t){if(t===`highp`){if(e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.HIGH_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.HIGH_FLOAT).precision>0)return`highp`;t=`mediump`}return t===`mediump`&&e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.MEDIUM_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_FLOAT).precision>0?`mediump`:`lowp`}let l=n.precision===void 0?`highp`:n.precision,u=c(l);u!==l&&(W(`WebGLRenderer:`,l,`not supported, using`,u,`instead.`),l=u);let d=n.logarithmicDepthBuffer===!0,f=n.reversedDepthBuffer===!0&&t.has(`EXT_clip_control`);n.reversedDepthBuffer===!0&&f===!1&&W(`WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.`);let p=e.getParameter(e.MAX_TEXTURE_IMAGE_UNITS),m=e.getParameter(e.MAX_VERTEX_TEXTURE_IMAGE_UNITS),h=e.getParameter(e.MAX_TEXTURE_SIZE),g=e.getParameter(e.MAX_CUBE_MAP_TEXTURE_SIZE),_=e.getParameter(e.MAX_VERTEX_ATTRIBS),v=e.getParameter(e.MAX_VERTEX_UNIFORM_VECTORS),y=e.getParameter(e.MAX_VARYING_VECTORS),b=e.getParameter(e.MAX_FRAGMENT_UNIFORM_VECTORS),x=e.getParameter(e.MAX_SAMPLES),S=e.getParameter(e.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:a,getMaxPrecision:c,textureFormatReadable:o,textureTypeReadable:s,precision:l,logarithmicDepthBuffer:d,reversedDepthBuffer:f,maxTextures:p,maxVertexTextures:m,maxTextureSize:h,maxCubemapSize:g,maxAttributes:_,maxVertexUniforms:v,maxVaryings:y,maxFragmentUniforms:b,maxSamples:x,samples:S}}function ho(e){let t=this,n=null,r=0,i=!1,a=!1,o=new di,s=new Y,c={value:null,needsUpdate:!1};this.uniform=c,this.numPlanes=0,this.numIntersection=0,this.init=function(e,t){let n=e.length!==0||t||r!==0||i;return i=t,r=e.length,n},this.beginShadows=function(){a=!0,u(null)},this.endShadows=function(){a=!1},this.setGlobalState=function(e,t){n=u(e,t,0)},this.setState=function(t,o,s){let d=t.clippingPlanes,f=t.clipIntersection,p=t.clipShadows,m=e.get(t);if(!i||d===null||d.length===0||a&&!p)a?u(null):l();else{let e=a?0:r,t=e*4,i=m.clippingState||null;c.value=i,i=u(d,o,t,s);for(let e=0;e!==t;++e)i[e]=n[e];m.clippingState=i,this.numIntersection=f?this.numPlanes:0,this.numPlanes+=e}};function l(){c.value!==n&&(c.value=n,c.needsUpdate=r>0),t.numPlanes=r,t.numIntersection=0}function u(e,n,r,i){let a=e===null?0:e.length,l=null;if(a!==0){if(l=c.value,i!==!0||l===null){let t=r+a*4,i=n.matrixWorldInverse;s.getNormalMatrix(i),(l===null||l.length<t)&&(l=new Float32Array(t));for(let t=0,n=r;t!==a;++t,n+=4)o.copy(e[t]).applyMatrix4(i,s),o.normal.toArray(l,n),l[n+3]=o.constant}c.value=l,c.needsUpdate=!0}return t.numPlanes=a,t.numIntersection=0,l}}var go=4,_o=[.125,.215,.35,.446,.526,.582],vo=20,yo=256,bo=new Na,xo=new X,So=null,Co=0,wo=0,To=!1,Eo=new J,Do=class{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._sigmas=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,n=.1,r=100,i={}){let{size:a=256,position:o=Eo}=i;So=this._renderer.getRenderTarget(),Co=this._renderer.getActiveCubeFace(),wo=this._renderer.getActiveMipmapLevel(),To=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(a);let s=this._allocateTargets();return s.depthBuffer=!0,this._sceneToCubeUV(e,n,r,s,o),t>0&&this._blur(s,0,0,t),this._applyPMREM(s),this._cleanup(s),s}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Po(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=No(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=2**this._lodMax}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(So,Co,wo),this._renderer.xr.enabled=To,e.scissorTest=!1,Ao(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===301||e.mapping===302?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),So=this._renderer.getRenderTarget(),Co=this._renderer.getActiveCubeFace(),wo=this._renderer.getActiveMipmapLevel(),To=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:c,minFilter:c,generateMipmaps:!1,type:v,format:E,colorSpace:Fe,depthBuffer:!1},r=ko(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=ko(e,t,n);let{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods,sigmas:this._sigmas}=Oo(r)),this._blurMaterial=Mo(r,e,t),this._ggxMaterial=jo(r,e,t)}return r}_compileMaterial(e){let t=new Yr(new Er,e);this._renderer.compile(t,bo)}_sceneToCubeUV(e,t,n,r,i){let a=new Aa(90,1,t,n),o=[1,-1,1,1,1,1],s=[1,1,1,-1,-1,-1],c=this._renderer,l=c.autoClear,u=c.toneMapping;c.getClearColor(xo),c.toneMapping=0,c.autoClear=!1,c.state.buffers.depth.getReversed()&&(c.setRenderTarget(r),c.clearDepth(),c.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new Yr(new Ni,new Lr({name:`PMREM.Background`,side:1,depthWrite:!1,depthTest:!1})));let d=this._backgroundBox,f=d.material,p=!1,m=e.background;m?m.isColor&&(f.color.copy(m),e.background=null,p=!0):(f.color.copy(xo),p=!0);for(let t=0;t<6;t++){let n=t%3;n===0?(a.up.set(0,o[t],0),a.position.set(i.x,i.y,i.z),a.lookAt(i.x+s[t],i.y,i.z)):n===1?(a.up.set(0,0,o[t]),a.position.set(i.x,i.y,i.z),a.lookAt(i.x,i.y+s[t],i.z)):(a.up.set(0,o[t],0),a.position.set(i.x,i.y,i.z),a.lookAt(i.x,i.y,i.z+s[t]));let l=this._cubeSize;Ao(r,n*l,t>2?l:0,l,l),c.setRenderTarget(r),p&&c.render(d,a),c.render(e,a)}c.toneMapping=u,c.autoClear=l,e.background=m}_textureToCubeUV(e,t){let n=this._renderer,r=e.mapping===301||e.mapping===302;r?(this._cubemapMaterial===null&&(this._cubemapMaterial=Po()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=No());let i=r?this._cubemapMaterial:this._equirectMaterial,a=this._lodMeshes[0];a.material=i;let o=i.uniforms;o.envMap.value=e;let s=this._cubeSize;Ao(t,0,0,3*s,2*s),n.setRenderTarget(t),n.render(a,bo)}_applyPMREM(e){let t=this._renderer,n=t.autoClear;t.autoClear=!1;let r=this._lodMeshes.length;for(let t=1;t<r;t++)this._applyGGXFilter(e,t-1,t);t.autoClear=n}_applyGGXFilter(e,t,n){let r=this._renderer,i=this._pingPongRenderTarget,a=this._ggxMaterial,o=this._lodMeshes[n];o.material=a;let s=a.uniforms,c=n/(this._lodMeshes.length-1),l=t/(this._lodMeshes.length-1),u=Math.sqrt(c*c-l*l)*(0+c*1.25),{_lodMax:d}=this,f=this._sizeLods[n],p=3*f*(n>d-go?n-d+go:0),m=4*(this._cubeSize-f);s.envMap.value=e.texture,s.roughness.value=u,s.mipInt.value=d-t,Ao(i,p,m,3*f,2*f),r.setRenderTarget(i),r.render(o,bo),s.envMap.value=i.texture,s.roughness.value=0,s.mipInt.value=d-n,Ao(e,p,m,3*f,2*f),r.setRenderTarget(e),r.render(o,bo)}_blur(e,t,n,r,i){let a=this._pingPongRenderTarget;this._halfBlur(e,a,t,n,r,`latitudinal`,i),this._halfBlur(a,e,n,n,r,`longitudinal`,i)}_halfBlur(e,t,n,r,i,a,o){let s=this._renderer,c=this._blurMaterial;a!==`latitudinal`&&a!==`longitudinal`&&G(`blur direction must be either latitudinal or longitudinal!`);let l=this._lodMeshes[r];l.material=c;let u=c.uniforms,d=this._sizeLods[n]-1,f=isFinite(i)?Math.PI/(2*d):2*Math.PI/(2*vo-1),p=i/f,m=isFinite(i)?1+Math.floor(3*p):vo;m>vo&&W(`sigmaRadians, ${i}, is too large and will clip, as it requested ${m} samples when the maximum is set to ${vo}`);let h=[],g=0;for(let e=0;e<vo;++e){let t=e/p,n=Math.exp(-t*t/2);h.push(n),e===0?g+=n:e<m&&(g+=2*n)}for(let e=0;e<h.length;e++)h[e]=h[e]/g;u.envMap.value=e.texture,u.samples.value=m,u.weights.value=h,u.latitudinal.value=a===`latitudinal`,o&&(u.poleAxis.value=o);let{_lodMax:_}=this;u.dTheta.value=f,u.mipInt.value=_-n;let v=this._sizeLods[r];Ao(t,3*v*(r>_-go?r-_+go:0),4*(this._cubeSize-v),3*v,2*v),s.setRenderTarget(t),s.render(l,bo)}};function Oo(e){let t=[],n=[],r=[],i=e,a=e-go+1+_o.length;for(let o=0;o<a;o++){let a=2**i;t.push(a);let s=1/a;o>e-go?s=_o[o-e+go-1]:o===0&&(s=0),n.push(s);let c=1/(a-2),l=-c,u=1+c,d=[l,l,u,l,u,u,l,l,u,u,l,u],f=new Float32Array(108),p=new Float32Array(72),m=new Float32Array(36);for(let e=0;e<6;e++){let t=e%3*2/3-1,n=e>2?0:-1,r=[t,n,0,t+2/3,n,0,t+2/3,n+1,0,t,n,0,t+2/3,n+1,0,t,n+1,0];f.set(r,18*e),p.set(d,12*e);let i=[e,e,e,e,e,e];m.set(i,6*e)}let h=new Er;h.setAttribute(`position`,new dr(f,3)),h.setAttribute(`uv`,new dr(p,2)),h.setAttribute(`faceIndex`,new dr(m,1)),r.push(new Yr(h,null)),i>go&&i--}return{lodMeshes:r,sizeLods:t,sigmas:n}}function ko(e,t,n){let r=new Kt(e,t,n);return r.texture.mapping=306,r.texture.name=`PMREM.cubeUv`,r.scissorTest=!0,r}function Ao(e,t,n,r,i){e.viewport.set(t,n,r,i),e.scissor.set(t,n,r,i)}function jo(e,t,n){return new Ji({name:`PMREMGGXConvolution`,defines:{GGX_SAMPLES:yo,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:Fo(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function Mo(e,t,n){let r=new Float32Array(vo),i=new J(0,1,0);return new Ji({name:`SphericalGaussianBlur`,defines:{n:vo,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:r},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:i}},vertexShader:Fo(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function No(){return new Ji({name:`EquirectangularToCubeUV`,uniforms:{envMap:{value:null}},vertexShader:Fo(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function Po(){return new Ji({name:`CubemapToCubeUV`,uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Fo(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function Fo(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}var Io=class extends Kt{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let n={width:e,height:e,depth:1},r=[n,n,n,n,n,n];this.texture=new ki(r),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},r=new Ni(5,5,5),i=new Ji({name:`CubemapFromEquirect`,uniforms:Bi(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:1,blending:0});i.uniforms.tEquirect.value=t;let a=new Yr(r,i),o=t.minFilter;return t.minFilter===1008&&(t.minFilter=c),new za(1,10,this).update(e,a),t.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(e,t=!0,n=!0,r=!0){let i=e.getRenderTarget();for(let i=0;i<6;i++)e.setRenderTarget(this,i),e.clear(t,n,r);e.setRenderTarget(i)}};function Lo(e){let t=new WeakMap,n=new WeakMap,r=null;function i(e,t=!1){return e==null?null:t?o(e):a(e)}function a(n){if(n&&n.isTexture){let r=n.mapping;if(r===303||r===304)if(t.has(n)){let e=t.get(n).texture;return s(e,n.mapping)}else{let r=n.image;if(r&&r.height>0){let i=new Io(r.height);return i.fromEquirectangularTexture(e,n),t.set(n,i),n.addEventListener(`dispose`,l),s(i.texture,n.mapping)}else return null}}return n}function o(t){if(t&&t.isTexture){let i=t.mapping,a=i===303||i===304,o=i===301||i===302;if(a||o){let i=n.get(t),s=i===void 0?0:i.texture.pmremVersion;if(t.isRenderTargetTexture&&t.pmremVersion!==s)return r===null&&(r=new Do(e)),i=a?r.fromEquirectangular(t,i):r.fromCubemap(t,i),i.texture.pmremVersion=t.pmremVersion,n.set(t,i),i.texture;if(i!==void 0)return i.texture;{let s=t.image;return a&&s&&s.height>0||o&&s&&c(s)?(r===null&&(r=new Do(e)),i=a?r.fromEquirectangular(t):r.fromCubemap(t),i.texture.pmremVersion=t.pmremVersion,n.set(t,i),t.addEventListener(`dispose`,u),i.texture):null}}}return t}function s(e,t){return t===303?e.mapping=301:t===304&&(e.mapping=302),e}function c(e){let t=0;for(let n=0;n<6;n++)e[n]!==void 0&&t++;return t===6}function l(e){let n=e.target;n.removeEventListener(`dispose`,l);let r=t.get(n);r!==void 0&&(t.delete(n),r.dispose())}function u(e){let t=e.target;t.removeEventListener(`dispose`,u);let r=n.get(t);r!==void 0&&(n.delete(t),r.dispose())}function d(){t=new WeakMap,n=new WeakMap,r!==null&&(r.dispose(),r=null)}return{get:i,dispose:d}}function Ro(e){let t={};function n(n){if(t[n]!==void 0)return t[n];let r=e.getExtension(n);return t[n]=r,r}return{has:function(e){return n(e)!==null},init:function(){n(`EXT_color_buffer_float`),n(`WEBGL_clip_cull_distance`),n(`OES_texture_float_linear`),n(`EXT_color_buffer_half_float`),n(`WEBGL_multisampled_render_to_texture`),n(`WEBGL_render_shared_exponent`)},get:function(e){let t=n(e);return t===null&&Xe(`WebGLRenderer: `+e+` extension not supported.`),t}}}function zo(e,t,n,r){let i={},a=new WeakMap;function o(e){let s=e.target;s.index!==null&&t.remove(s.index);for(let e in s.attributes)t.remove(s.attributes[e]);s.removeEventListener(`dispose`,o),delete i[s.id];let c=a.get(s);c&&(t.remove(c),a.delete(s)),r.releaseStatesOfGeometry(s),s.isInstancedBufferGeometry===!0&&delete s._maxInstanceCount,n.memory.geometries--}function s(e,t){return i[t.id]===!0?t:(t.addEventListener(`dispose`,o),i[t.id]=!0,n.memory.geometries++,t)}function c(n){let r=n.attributes;for(let n in r)t.update(r[n],e.ARRAY_BUFFER)}function l(e){let n=[],r=e.index,i=e.attributes.position,o=0;if(i===void 0)return;if(r!==null){let e=r.array;o=r.version;for(let t=0,r=e.length;t<r;t+=3){let r=e[t+0],i=e[t+1],a=e[t+2];n.push(r,i,i,a,a,r)}}else{let e=i.array;o=i.version;for(let t=0,r=e.length/3-1;t<r;t+=3){let e=t+0,r=t+1,i=t+2;n.push(e,r,r,i,i,e)}}let s=new(i.count>=65535?pr:fr)(n,1);s.version=o;let c=a.get(e);c&&t.remove(c),a.set(e,s)}function u(e){let t=a.get(e);if(t){let n=e.index;n!==null&&t.version<n.version&&l(e)}else l(e);return a.get(e)}return{get:s,update:c,getWireframeAttribute:u}}function Bo(e,t,n){let r;function i(e){r=e}let a,o;function s(e){a=e.type,o=e.bytesPerElement}function c(t,i){e.drawElements(r,i,a,t*o),n.update(i,r,1)}function l(t,i,s){s!==0&&(e.drawElementsInstanced(r,i,a,t*o,s),n.update(i,r,s))}function u(e,i,o){if(o===0)return;t.get(`WEBGL_multi_draw`).multiDrawElementsWEBGL(r,i,0,a,e,0,o);let s=0;for(let e=0;e<o;e++)s+=i[e];n.update(s,r,1)}this.setMode=i,this.setIndex=s,this.render=c,this.renderInstances=l,this.renderMultiDraw=u}function Vo(e){let t={geometries:0,textures:0},n={frame:0,calls:0,triangles:0,points:0,lines:0};function r(t,r,i){switch(n.calls++,r){case e.TRIANGLES:n.triangles+=t/3*i;break;case e.LINES:n.lines+=t/2*i;break;case e.LINE_STRIP:n.lines+=i*(t-1);break;case e.LINE_LOOP:n.lines+=i*t;break;case e.POINTS:n.points+=i*t;break;default:G(`WebGLInfo: Unknown draw mode:`,r);break}}function i(){n.calls=0,n.triangles=0,n.points=0,n.lines=0}return{memory:t,render:n,programs:null,autoReset:!0,reset:i,update:r}}function Ho(e,t,n){let r=new WeakMap,i=new Wt;function a(a,o,s){let c=a.morphTargetInfluences,l=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,u=l===void 0?0:l.length,d=r.get(o);if(d===void 0||d.count!==u){d!==void 0&&d.texture.dispose();let e=o.morphAttributes.position!==void 0,n=o.morphAttributes.normal!==void 0,a=o.morphAttributes.color!==void 0,s=o.morphAttributes.position||[],c=o.morphAttributes.normal||[],l=o.morphAttributes.color||[],f=0;e===!0&&(f=1),n===!0&&(f=2),a===!0&&(f=3);let p=o.attributes.position.count*f,m=1;p>t.maxTextureSize&&(m=Math.ceil(p/t.maxTextureSize),p=t.maxTextureSize);let h=new Float32Array(p*m*4*u),g=new qt(h,p,m,u);g.type=_,g.needsUpdate=!0;let v=f*4;for(let t=0;t<u;t++){let r=s[t],o=c[t],u=l[t],d=p*m*4*t;for(let t=0;t<r.count;t++){let s=t*v;e===!0&&(i.fromBufferAttribute(r,t),h[d+s+0]=i.x,h[d+s+1]=i.y,h[d+s+2]=i.z,h[d+s+3]=0),n===!0&&(i.fromBufferAttribute(o,t),h[d+s+4]=i.x,h[d+s+5]=i.y,h[d+s+6]=i.z,h[d+s+7]=0),a===!0&&(i.fromBufferAttribute(u,t),h[d+s+8]=i.x,h[d+s+9]=i.y,h[d+s+10]=i.z,h[d+s+11]=u.itemSize===4?i.w:1)}}d={count:u,texture:g,size:new q(p,m)},r.set(o,d);function y(){g.dispose(),r.delete(o),o.removeEventListener(`dispose`,y)}o.addEventListener(`dispose`,y)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)s.getUniforms().setValue(e,`morphTexture`,a.morphTexture,n);else{let t=0;for(let e=0;e<c.length;e++)t+=c[e];let n=o.morphTargetsRelative?1:1-t;s.getUniforms().setValue(e,`morphTargetBaseInfluence`,n),s.getUniforms().setValue(e,`morphTargetInfluences`,c)}s.getUniforms().setValue(e,`morphTargetsTexture`,d.texture,n),s.getUniforms().setValue(e,`morphTargetsTextureSize`,d.size)}return{update:a}}function Uo(e,t,n,r,i){let a=new WeakMap;function o(r){let o=i.render.frame,s=r.geometry,l=t.get(r,s);if(a.get(l)!==o&&(t.update(l),a.set(l,o)),r.isInstancedMesh&&(r.hasEventListener(`dispose`,c)===!1&&r.addEventListener(`dispose`,c),a.get(r)!==o&&(n.update(r.instanceMatrix,e.ARRAY_BUFFER),r.instanceColor!==null&&n.update(r.instanceColor,e.ARRAY_BUFFER),a.set(r,o))),r.isSkinnedMesh){let e=r.skeleton;a.get(e)!==o&&(e.update(),a.set(e,o))}return l}function s(){a=new WeakMap}function c(e){let t=e.target;t.removeEventListener(`dispose`,c),r.releaseStatesOfObject(t),n.remove(t.instanceMatrix),t.instanceColor!==null&&n.remove(t.instanceColor)}return{update:o,dispose:s}}var Wo={1:`LINEAR_TONE_MAPPING`,2:`REINHARD_TONE_MAPPING`,3:`CINEON_TONE_MAPPING`,4:`ACES_FILMIC_TONE_MAPPING`,6:`AGX_TONE_MAPPING`,7:`NEUTRAL_TONE_MAPPING`,5:`CUSTOM_TONE_MAPPING`};function Go(e,t,n,r,i){let a=new Kt(t,n,{type:e,depthBuffer:r,stencilBuffer:i,depthTexture:r?new Ai(t,n):void 0}),o=new Kt(t,n,{type:v,depthBuffer:!1,stencilBuffer:!1}),s=new Er;s.setAttribute(`position`,new mr([-1,3,0,-1,-1,0,3,-1,0],3)),s.setAttribute(`uv`,new mr([0,2,0,0,2,0],2));let c=new Yi({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),l=new Yr(s,c),u=new Na(-1,1,1,-1,0,1),d=null,f=null,p=!1,m,h=null,g=[],_=!1;this.setSize=function(e,t){a.setSize(e,t),o.setSize(e,t);for(let n=0;n<g.length;n++){let r=g[n];r.setSize&&r.setSize(e,t)}},this.setEffects=function(e){g=e,_=g.length>0&&g[0].isRenderPass===!0;let t=a.width,n=a.height;for(let e=0;e<g.length;e++){let r=g[e];r.setSize&&r.setSize(t,n)}},this.begin=function(e,t){if(p||e.toneMapping===0&&g.length===0)return!1;if(h=t,t!==null){let e=t.width,n=t.height;(a.width!==e||a.height!==n)&&this.setSize(e,n)}return _===!1&&e.setRenderTarget(a),m=e.toneMapping,e.toneMapping=0,!0},this.hasRenderPass=function(){return _},this.end=function(e,t){e.toneMapping=m,p=!0;let n=a,r=o;for(let i=0;i<g.length;i++){let a=g[i];if(a.enabled!==!1&&(a.render(e,r,n,t),a.needsSwap!==!1)){let e=n;n=r,r=e}}if(d!==e.outputColorSpace||f!==e.toneMapping){d=e.outputColorSpace,f=e.toneMapping,c.defines={},Nt.getTransfer(d)===`srgb`&&(c.defines.SRGB_TRANSFER=``);let t=Wo[f];t&&(c.defines[t]=``),c.needsUpdate=!0}c.uniforms.tDiffuse.value=n.texture,e.setRenderTarget(h),e.render(l,u),h=null,p=!1},this.isCompositing=function(){return p},this.dispose=function(){a.depthTexture&&a.depthTexture.dispose(),a.dispose(),o.dispose(),s.dispose(),c.dispose()}}var Ko=new Ut,qo=new Ai(1,1),Jo=new qt,Yo=new Jt,Xo=new ki,Zo=[],Qo=[],$o=new Float32Array(16),es=new Float32Array(9),ts=new Float32Array(4);function ns(e,t,n){let r=e[0];if(r<=0||r>0)return e;let i=t*n,a=Zo[i];if(a===void 0&&(a=new Float32Array(i),Zo[i]=a),t!==0){r.toArray(a,0);for(let r=1,i=0;r!==t;++r)i+=n,e[r].toArray(a,i)}return a}function rs(e,t){if(e.length!==t.length)return!1;for(let n=0,r=e.length;n<r;n++)if(e[n]!==t[n])return!1;return!0}function is(e,t){for(let n=0,r=t.length;n<r;n++)e[n]=t[n]}function as(e,t){let n=Qo[t];n===void 0&&(n=new Int32Array(t),Qo[t]=n);for(let r=0;r!==t;++r)n[r]=e.allocateTextureUnit();return n}function os(e,t){let n=this.cache;n[0]!==t&&(e.uniform1f(this.addr,t),n[0]=t)}function ss(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2f(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(rs(n,t))return;e.uniform2fv(this.addr,t),is(n,t)}}function cs(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3f(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else if(t.r!==void 0)(n[0]!==t.r||n[1]!==t.g||n[2]!==t.b)&&(e.uniform3f(this.addr,t.r,t.g,t.b),n[0]=t.r,n[1]=t.g,n[2]=t.b);else{if(rs(n,t))return;e.uniform3fv(this.addr,t),is(n,t)}}function ls(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4f(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(rs(n,t))return;e.uniform4fv(this.addr,t),is(n,t)}}function us(e,t){let n=this.cache,r=t.elements;if(r===void 0){if(rs(n,t))return;e.uniformMatrix2fv(this.addr,!1,t),is(n,t)}else{if(rs(n,r))return;ts.set(r),e.uniformMatrix2fv(this.addr,!1,ts),is(n,r)}}function ds(e,t){let n=this.cache,r=t.elements;if(r===void 0){if(rs(n,t))return;e.uniformMatrix3fv(this.addr,!1,t),is(n,t)}else{if(rs(n,r))return;es.set(r),e.uniformMatrix3fv(this.addr,!1,es),is(n,r)}}function fs(e,t){let n=this.cache,r=t.elements;if(r===void 0){if(rs(n,t))return;e.uniformMatrix4fv(this.addr,!1,t),is(n,t)}else{if(rs(n,r))return;$o.set(r),e.uniformMatrix4fv(this.addr,!1,$o),is(n,r)}}function ps(e,t){let n=this.cache;n[0]!==t&&(e.uniform1i(this.addr,t),n[0]=t)}function ms(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2i(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(rs(n,t))return;e.uniform2iv(this.addr,t),is(n,t)}}function hs(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3i(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else{if(rs(n,t))return;e.uniform3iv(this.addr,t),is(n,t)}}function gs(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4i(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(rs(n,t))return;e.uniform4iv(this.addr,t),is(n,t)}}function _s(e,t){let n=this.cache;n[0]!==t&&(e.uniform1ui(this.addr,t),n[0]=t)}function vs(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2ui(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(rs(n,t))return;e.uniform2uiv(this.addr,t),is(n,t)}}function ys(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3ui(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else{if(rs(n,t))return;e.uniform3uiv(this.addr,t),is(n,t)}}function bs(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4ui(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(rs(n,t))return;e.uniform4uiv(this.addr,t),is(n,t)}}function xs(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i);let a;this.type===e.SAMPLER_2D_SHADOW?(qo.compareFunction=n.isReversedDepthBuffer()?518:515,a=qo):a=Ko,n.setTexture2D(t||a,i)}function Ss(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i),n.setTexture3D(t||Yo,i)}function Cs(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i),n.setTextureCube(t||Xo,i)}function ws(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i),n.setTexture2DArray(t||Jo,i)}function Ts(e){switch(e){case 5126:return os;case 35664:return ss;case 35665:return cs;case 35666:return ls;case 35674:return us;case 35675:return ds;case 35676:return fs;case 5124:case 35670:return ps;case 35667:case 35671:return ms;case 35668:case 35672:return hs;case 35669:case 35673:return gs;case 5125:return _s;case 36294:return vs;case 36295:return ys;case 36296:return bs;case 35678:case 36198:case 36298:case 36306:case 35682:return xs;case 35679:case 36299:case 36307:return Ss;case 35680:case 36300:case 36308:case 36293:return Cs;case 36289:case 36303:case 36311:case 36292:return ws}}function Es(e,t){e.uniform1fv(this.addr,t)}function Ds(e,t){let n=ns(t,this.size,2);e.uniform2fv(this.addr,n)}function Os(e,t){let n=ns(t,this.size,3);e.uniform3fv(this.addr,n)}function ks(e,t){let n=ns(t,this.size,4);e.uniform4fv(this.addr,n)}function As(e,t){let n=ns(t,this.size,4);e.uniformMatrix2fv(this.addr,!1,n)}function js(e,t){let n=ns(t,this.size,9);e.uniformMatrix3fv(this.addr,!1,n)}function Ms(e,t){let n=ns(t,this.size,16);e.uniformMatrix4fv(this.addr,!1,n)}function Ns(e,t){e.uniform1iv(this.addr,t)}function Ps(e,t){e.uniform2iv(this.addr,t)}function Fs(e,t){e.uniform3iv(this.addr,t)}function Is(e,t){e.uniform4iv(this.addr,t)}function Ls(e,t){e.uniform1uiv(this.addr,t)}function Rs(e,t){e.uniform2uiv(this.addr,t)}function zs(e,t){e.uniform3uiv(this.addr,t)}function Bs(e,t){e.uniform4uiv(this.addr,t)}function Vs(e,t,n){let r=this.cache,i=t.length,a=as(n,i);rs(r,a)||(e.uniform1iv(this.addr,a),is(r,a));let o;o=this.type===e.SAMPLER_2D_SHADOW?qo:Ko;for(let e=0;e!==i;++e)n.setTexture2D(t[e]||o,a[e])}function Hs(e,t,n){let r=this.cache,i=t.length,a=as(n,i);rs(r,a)||(e.uniform1iv(this.addr,a),is(r,a));for(let e=0;e!==i;++e)n.setTexture3D(t[e]||Yo,a[e])}function Us(e,t,n){let r=this.cache,i=t.length,a=as(n,i);rs(r,a)||(e.uniform1iv(this.addr,a),is(r,a));for(let e=0;e!==i;++e)n.setTextureCube(t[e]||Xo,a[e])}function Ws(e,t,n){let r=this.cache,i=t.length,a=as(n,i);rs(r,a)||(e.uniform1iv(this.addr,a),is(r,a));for(let e=0;e!==i;++e)n.setTexture2DArray(t[e]||Jo,a[e])}function Gs(e){switch(e){case 5126:return Es;case 35664:return Ds;case 35665:return Os;case 35666:return ks;case 35674:return As;case 35675:return js;case 35676:return Ms;case 5124:case 35670:return Ns;case 35667:case 35671:return Ps;case 35668:case 35672:return Fs;case 35669:case 35673:return Is;case 5125:return Ls;case 36294:return Rs;case 36295:return zs;case 36296:return Bs;case 35678:case 36198:case 36298:case 36306:case 35682:return Vs;case 35679:case 36299:case 36307:return Hs;case 35680:case 36300:case 36308:case 36293:return Us;case 36289:case 36303:case 36311:case 36292:return Ws}}var Ks=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=Ts(t.type)}},qs=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=Gs(t.type)}},Js=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){let r=this.seq;for(let i=0,a=r.length;i!==a;++i){let a=r[i];a.setValue(e,t[a.id],n)}}},Ys=/(\w+)(\])?(\[|\.)?/g;function Xs(e,t){e.seq.push(t),e.map[t.id]=t}function Zs(e,t,n){let r=e.name,i=r.length;for(Ys.lastIndex=0;;){let a=Ys.exec(r),o=Ys.lastIndex,s=a[1],c=a[2]===`]`,l=a[3];if(c&&(s|=0),l===void 0||l===`[`&&o+2===i){Xs(n,l===void 0?new Ks(s,e,t):new qs(s,e,t));break}else{let e=n.map[s];e===void 0&&(e=new Js(s),Xs(n,e)),n=e}}}var Qs=class{constructor(e,t){this.seq=[],this.map={};let n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let r=0;r<n;++r){let n=e.getActiveUniform(t,r);Zs(n,e.getUniformLocation(t,n.name),this)}let r=[],i=[];for(let t of this.seq)t.type===e.SAMPLER_2D_SHADOW||t.type===e.SAMPLER_CUBE_SHADOW||t.type===e.SAMPLER_2D_ARRAY_SHADOW?r.push(t):i.push(t);r.length>0&&(this.seq=r.concat(i))}setValue(e,t,n,r){let i=this.map[t];i!==void 0&&i.setValue(e,n,r)}setOptional(e,t,n){let r=t[n];r!==void 0&&this.setValue(e,n,r)}static upload(e,t,n,r){for(let i=0,a=t.length;i!==a;++i){let a=t[i],o=n[a.id];o.needsUpdate!==!1&&a.setValue(e,o.value,r)}}static seqWithValue(e,t){let n=[];for(let r=0,i=e.length;r!==i;++r){let i=e[r];i.id in t&&n.push(i)}return n}};function $s(e,t,n){let r=e.createShader(t);return e.shaderSource(r,n),e.compileShader(r),r}var ec=37297,tc=0;function nc(e,t){let n=e.split(`
`),r=[],i=Math.max(t-6,0),a=Math.min(t+6,n.length);for(let e=i;e<a;e++){let i=e+1;r.push(`${i===t?`>`:` `} ${i}: ${n[e]}`)}return r.join(`
`)}var rc=new Y;function ic(e){Nt._getMatrix(rc,Nt.workingColorSpace,e);let t=`mat3( ${rc.elements.map(e=>e.toFixed(4))} )`;switch(Nt.getTransfer(e)){case Ie:return[t,`LinearTransferOETF`];case Le:return[t,`sRGBTransferOETF`];default:return W(`WebGLProgram: Unsupported color space: `,e),[t,`LinearTransferOETF`]}}function ac(e,t,n){let r=e.getShaderParameter(t,e.COMPILE_STATUS),i=(e.getShaderInfoLog(t)||``).trim();if(r&&i===``)return``;let a=/ERROR: 0:(\d+)/.exec(i);if(a){let r=parseInt(a[1]);return n.toUpperCase()+`

`+i+`

`+nc(e.getShaderSource(t),r)}else return i}function oc(e,t){let n=ic(t);return[`vec4 ${e}( vec4 value ) {`,`	return ${n[1]}( vec4( value.rgb * ${n[0]}, value.a ) );`,`}`].join(`
`)}var sc={1:`Linear`,2:`Reinhard`,3:`Cineon`,4:`ACESFilmic`,6:`AgX`,7:`Neutral`,5:`Custom`};function cc(e,t){let n=sc[t];return n===void 0?(W(`WebGLProgram: Unsupported toneMapping:`,t),`vec3 `+e+`( vec3 color ) { return LinearToneMapping( color ); }`):`vec3 `+e+`( vec3 color ) { return `+n+`ToneMapping( color ); }`}var lc=new J;function uc(){return Nt.getLuminanceCoefficients(lc),[`float luminance( const in vec3 rgb ) {`,`	const vec3 weights = vec3( ${lc.x.toFixed(4)}, ${lc.y.toFixed(4)}, ${lc.z.toFixed(4)} );`,`	return dot( weights, rgb );`,`}`].join(`
`)}function dc(e){return[e.extensionClipCullDistance?`#extension GL_ANGLE_clip_cull_distance : require`:``,e.extensionMultiDraw?`#extension GL_ANGLE_multi_draw : require`:``].filter(mc).join(`
`)}function fc(e){let t=[];for(let n in e){let r=e[n];r!==!1&&t.push(`#define `+n+` `+r)}return t.join(`
`)}function pc(e,t){let n={},r=e.getProgramParameter(t,e.ACTIVE_ATTRIBUTES);for(let i=0;i<r;i++){let r=e.getActiveAttrib(t,i),a=r.name,o=1;r.type===e.FLOAT_MAT2&&(o=2),r.type===e.FLOAT_MAT3&&(o=3),r.type===e.FLOAT_MAT4&&(o=4),n[a]={type:r.type,location:e.getAttribLocation(t,a),locationSize:o}}return n}function mc(e){return e!==``}function hc(e,t){let n=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return e.replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,n).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function gc(e,t){return e.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}var _c=/^[ \t]*#include +<([\w\d./]+)>/gm;function vc(e){return e.replace(_c,bc)}var yc=new Map;function bc(e,t){let n=Z[t];if(n===void 0){let e=yc.get(t);if(e!==void 0)n=Z[e],W(`WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.`,t,e);else throw Error(`Can not resolve #include <`+t+`>`)}return vc(n)}var xc=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Sc(e){return e.replace(xc,Cc)}function Cc(e,t,n,r){let i=``;for(let e=parseInt(t);e<parseInt(n);e++)i+=r.replace(/\[\s*i\s*\]/g,`[ `+e+` ]`).replace(/UNROLLED_LOOP_INDEX/g,e);return i}function wc(e){let t=`precision ${e.precision} float;
	precision ${e.precision} int;
	precision ${e.precision} sampler2D;
	precision ${e.precision} samplerCube;
	precision ${e.precision} sampler3D;
	precision ${e.precision} sampler2DArray;
	precision ${e.precision} sampler2DShadow;
	precision ${e.precision} samplerCubeShadow;
	precision ${e.precision} sampler2DArrayShadow;
	precision ${e.precision} isampler2D;
	precision ${e.precision} isampler3D;
	precision ${e.precision} isamplerCube;
	precision ${e.precision} isampler2DArray;
	precision ${e.precision} usampler2D;
	precision ${e.precision} usampler3D;
	precision ${e.precision} usamplerCube;
	precision ${e.precision} usampler2DArray;
	`;return e.precision===`highp`?t+=`
#define HIGH_PRECISION`:e.precision===`mediump`?t+=`
#define MEDIUM_PRECISION`:e.precision===`lowp`&&(t+=`
#define LOW_PRECISION`),t}var Tc={1:`SHADOWMAP_TYPE_PCF`,3:`SHADOWMAP_TYPE_VSM`};function Ec(e){return Tc[e.shadowMapType]||`SHADOWMAP_TYPE_BASIC`}var Dc={301:`ENVMAP_TYPE_CUBE`,302:`ENVMAP_TYPE_CUBE`,306:`ENVMAP_TYPE_CUBE_UV`};function Oc(e){return e.envMap===!1?`ENVMAP_TYPE_CUBE`:Dc[e.envMapMode]||`ENVMAP_TYPE_CUBE`}var kc={302:`ENVMAP_MODE_REFRACTION`};function Ac(e){return e.envMap===!1?`ENVMAP_MODE_REFLECTION`:kc[e.envMapMode]||`ENVMAP_MODE_REFLECTION`}var jc={0:`ENVMAP_BLENDING_MULTIPLY`,1:`ENVMAP_BLENDING_MIX`,2:`ENVMAP_BLENDING_ADD`};function Mc(e){return e.envMap===!1?`ENVMAP_BLENDING_NONE`:jc[e.combine]||`ENVMAP_BLENDING_NONE`}function Nc(e){let t=e.envMapCubeUVHeight;if(t===null)return null;let n=Math.log2(t)-2,r=1/t;return{texelWidth:1/(3*Math.max(2**n,112)),texelHeight:r,maxMip:n}}function Pc(e,t,n,r){let i=e.getContext(),a=n.defines,o=n.vertexShader,s=n.fragmentShader,c=Ec(n),l=Oc(n),u=Ac(n),d=Mc(n),f=Nc(n),p=dc(n),m=fc(a),h=i.createProgram(),g,_,v=n.glslVersion?`#version `+n.glslVersion+`
`:``;n.isRawShaderMaterial?(g=[`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m].filter(mc).join(`
`),g.length>0&&(g+=`
`),_=[`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m].filter(mc).join(`
`),_.length>0&&(_+=`
`)):(g=[wc(n),`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m,n.extensionClipCullDistance?`#define USE_CLIP_DISTANCE`:``,n.batching?`#define USE_BATCHING`:``,n.batchingColor?`#define USE_BATCHING_COLOR`:``,n.instancing?`#define USE_INSTANCING`:``,n.instancingColor?`#define USE_INSTANCING_COLOR`:``,n.instancingMorph?`#define USE_INSTANCING_MORPH`:``,n.useFog&&n.fog?`#define USE_FOG`:``,n.useFog&&n.fogExp2?`#define FOG_EXP2`:``,n.map?`#define USE_MAP`:``,n.envMap?`#define USE_ENVMAP`:``,n.envMap?`#define `+u:``,n.lightMap?`#define USE_LIGHTMAP`:``,n.aoMap?`#define USE_AOMAP`:``,n.bumpMap?`#define USE_BUMPMAP`:``,n.normalMap?`#define USE_NORMALMAP`:``,n.normalMapObjectSpace?`#define USE_NORMALMAP_OBJECTSPACE`:``,n.normalMapTangentSpace?`#define USE_NORMALMAP_TANGENTSPACE`:``,n.displacementMap?`#define USE_DISPLACEMENTMAP`:``,n.emissiveMap?`#define USE_EMISSIVEMAP`:``,n.anisotropy?`#define USE_ANISOTROPY`:``,n.anisotropyMap?`#define USE_ANISOTROPYMAP`:``,n.clearcoatMap?`#define USE_CLEARCOATMAP`:``,n.clearcoatRoughnessMap?`#define USE_CLEARCOAT_ROUGHNESSMAP`:``,n.clearcoatNormalMap?`#define USE_CLEARCOAT_NORMALMAP`:``,n.iridescenceMap?`#define USE_IRIDESCENCEMAP`:``,n.iridescenceThicknessMap?`#define USE_IRIDESCENCE_THICKNESSMAP`:``,n.specularMap?`#define USE_SPECULARMAP`:``,n.specularColorMap?`#define USE_SPECULAR_COLORMAP`:``,n.specularIntensityMap?`#define USE_SPECULAR_INTENSITYMAP`:``,n.roughnessMap?`#define USE_ROUGHNESSMAP`:``,n.metalnessMap?`#define USE_METALNESSMAP`:``,n.alphaMap?`#define USE_ALPHAMAP`:``,n.alphaHash?`#define USE_ALPHAHASH`:``,n.transmission?`#define USE_TRANSMISSION`:``,n.transmissionMap?`#define USE_TRANSMISSIONMAP`:``,n.thicknessMap?`#define USE_THICKNESSMAP`:``,n.sheenColorMap?`#define USE_SHEEN_COLORMAP`:``,n.sheenRoughnessMap?`#define USE_SHEEN_ROUGHNESSMAP`:``,n.mapUv?`#define MAP_UV `+n.mapUv:``,n.alphaMapUv?`#define ALPHAMAP_UV `+n.alphaMapUv:``,n.lightMapUv?`#define LIGHTMAP_UV `+n.lightMapUv:``,n.aoMapUv?`#define AOMAP_UV `+n.aoMapUv:``,n.emissiveMapUv?`#define EMISSIVEMAP_UV `+n.emissiveMapUv:``,n.bumpMapUv?`#define BUMPMAP_UV `+n.bumpMapUv:``,n.normalMapUv?`#define NORMALMAP_UV `+n.normalMapUv:``,n.displacementMapUv?`#define DISPLACEMENTMAP_UV `+n.displacementMapUv:``,n.metalnessMapUv?`#define METALNESSMAP_UV `+n.metalnessMapUv:``,n.roughnessMapUv?`#define ROUGHNESSMAP_UV `+n.roughnessMapUv:``,n.anisotropyMapUv?`#define ANISOTROPYMAP_UV `+n.anisotropyMapUv:``,n.clearcoatMapUv?`#define CLEARCOATMAP_UV `+n.clearcoatMapUv:``,n.clearcoatNormalMapUv?`#define CLEARCOAT_NORMALMAP_UV `+n.clearcoatNormalMapUv:``,n.clearcoatRoughnessMapUv?`#define CLEARCOAT_ROUGHNESSMAP_UV `+n.clearcoatRoughnessMapUv:``,n.iridescenceMapUv?`#define IRIDESCENCEMAP_UV `+n.iridescenceMapUv:``,n.iridescenceThicknessMapUv?`#define IRIDESCENCE_THICKNESSMAP_UV `+n.iridescenceThicknessMapUv:``,n.sheenColorMapUv?`#define SHEEN_COLORMAP_UV `+n.sheenColorMapUv:``,n.sheenRoughnessMapUv?`#define SHEEN_ROUGHNESSMAP_UV `+n.sheenRoughnessMapUv:``,n.specularMapUv?`#define SPECULARMAP_UV `+n.specularMapUv:``,n.specularColorMapUv?`#define SPECULAR_COLORMAP_UV `+n.specularColorMapUv:``,n.specularIntensityMapUv?`#define SPECULAR_INTENSITYMAP_UV `+n.specularIntensityMapUv:``,n.transmissionMapUv?`#define TRANSMISSIONMAP_UV `+n.transmissionMapUv:``,n.thicknessMapUv?`#define THICKNESSMAP_UV `+n.thicknessMapUv:``,n.vertexTangents&&n.flatShading===!1?`#define USE_TANGENT`:``,n.vertexNormals?`#define HAS_NORMAL`:``,n.vertexColors?`#define USE_COLOR`:``,n.vertexAlphas?`#define USE_COLOR_ALPHA`:``,n.vertexUv1s?`#define USE_UV1`:``,n.vertexUv2s?`#define USE_UV2`:``,n.vertexUv3s?`#define USE_UV3`:``,n.pointsUvs?`#define USE_POINTS_UV`:``,n.flatShading?`#define FLAT_SHADED`:``,n.skinning?`#define USE_SKINNING`:``,n.morphTargets?`#define USE_MORPHTARGETS`:``,n.morphNormals&&n.flatShading===!1?`#define USE_MORPHNORMALS`:``,n.morphColors?`#define USE_MORPHCOLORS`:``,n.morphTargetsCount>0?`#define MORPHTARGETS_TEXTURE_STRIDE `+n.morphTextureStride:``,n.morphTargetsCount>0?`#define MORPHTARGETS_COUNT `+n.morphTargetsCount:``,n.doubleSided?`#define DOUBLE_SIDED`:``,n.flipSided?`#define FLIP_SIDED`:``,n.shadowMapEnabled?`#define USE_SHADOWMAP`:``,n.shadowMapEnabled?`#define `+c:``,n.sizeAttenuation?`#define USE_SIZEATTENUATION`:``,n.numLightProbes>0?`#define USE_LIGHT_PROBES`:``,n.logarithmicDepthBuffer?`#define USE_LOGARITHMIC_DEPTH_BUFFER`:``,n.reversedDepthBuffer?`#define USE_REVERSED_DEPTH_BUFFER`:``,`uniform mat4 modelMatrix;`,`uniform mat4 modelViewMatrix;`,`uniform mat4 projectionMatrix;`,`uniform mat4 viewMatrix;`,`uniform mat3 normalMatrix;`,`uniform vec3 cameraPosition;`,`uniform bool isOrthographic;`,`#ifdef USE_INSTANCING`,`	attribute mat4 instanceMatrix;`,`#endif`,`#ifdef USE_INSTANCING_COLOR`,`	attribute vec3 instanceColor;`,`#endif`,`#ifdef USE_INSTANCING_MORPH`,`	uniform sampler2D morphTexture;`,`#endif`,`attribute vec3 position;`,`attribute vec3 normal;`,`attribute vec2 uv;`,`#ifdef USE_UV1`,`	attribute vec2 uv1;`,`#endif`,`#ifdef USE_UV2`,`	attribute vec2 uv2;`,`#endif`,`#ifdef USE_UV3`,`	attribute vec2 uv3;`,`#endif`,`#ifdef USE_TANGENT`,`	attribute vec4 tangent;`,`#endif`,`#if defined( USE_COLOR_ALPHA )`,`	attribute vec4 color;`,`#elif defined( USE_COLOR )`,`	attribute vec3 color;`,`#endif`,`#ifdef USE_SKINNING`,`	attribute vec4 skinIndex;`,`	attribute vec4 skinWeight;`,`#endif`,`
`].filter(mc).join(`
`),_=[wc(n),`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m,n.useFog&&n.fog?`#define USE_FOG`:``,n.useFog&&n.fogExp2?`#define FOG_EXP2`:``,n.alphaToCoverage?`#define ALPHA_TO_COVERAGE`:``,n.map?`#define USE_MAP`:``,n.matcap?`#define USE_MATCAP`:``,n.envMap?`#define USE_ENVMAP`:``,n.envMap?`#define `+l:``,n.envMap?`#define `+u:``,n.envMap?`#define `+d:``,f?`#define CUBEUV_TEXEL_WIDTH `+f.texelWidth:``,f?`#define CUBEUV_TEXEL_HEIGHT `+f.texelHeight:``,f?`#define CUBEUV_MAX_MIP `+f.maxMip+`.0`:``,n.lightMap?`#define USE_LIGHTMAP`:``,n.aoMap?`#define USE_AOMAP`:``,n.bumpMap?`#define USE_BUMPMAP`:``,n.normalMap?`#define USE_NORMALMAP`:``,n.normalMapObjectSpace?`#define USE_NORMALMAP_OBJECTSPACE`:``,n.normalMapTangentSpace?`#define USE_NORMALMAP_TANGENTSPACE`:``,n.packedNormalMap?`#define USE_PACKED_NORMALMAP`:``,n.emissiveMap?`#define USE_EMISSIVEMAP`:``,n.anisotropy?`#define USE_ANISOTROPY`:``,n.anisotropyMap?`#define USE_ANISOTROPYMAP`:``,n.clearcoat?`#define USE_CLEARCOAT`:``,n.clearcoatMap?`#define USE_CLEARCOATMAP`:``,n.clearcoatRoughnessMap?`#define USE_CLEARCOAT_ROUGHNESSMAP`:``,n.clearcoatNormalMap?`#define USE_CLEARCOAT_NORMALMAP`:``,n.dispersion?`#define USE_DISPERSION`:``,n.iridescence?`#define USE_IRIDESCENCE`:``,n.iridescenceMap?`#define USE_IRIDESCENCEMAP`:``,n.iridescenceThicknessMap?`#define USE_IRIDESCENCE_THICKNESSMAP`:``,n.specularMap?`#define USE_SPECULARMAP`:``,n.specularColorMap?`#define USE_SPECULAR_COLORMAP`:``,n.specularIntensityMap?`#define USE_SPECULAR_INTENSITYMAP`:``,n.roughnessMap?`#define USE_ROUGHNESSMAP`:``,n.metalnessMap?`#define USE_METALNESSMAP`:``,n.alphaMap?`#define USE_ALPHAMAP`:``,n.alphaTest?`#define USE_ALPHATEST`:``,n.alphaHash?`#define USE_ALPHAHASH`:``,n.sheen?`#define USE_SHEEN`:``,n.sheenColorMap?`#define USE_SHEEN_COLORMAP`:``,n.sheenRoughnessMap?`#define USE_SHEEN_ROUGHNESSMAP`:``,n.transmission?`#define USE_TRANSMISSION`:``,n.transmissionMap?`#define USE_TRANSMISSIONMAP`:``,n.thicknessMap?`#define USE_THICKNESSMAP`:``,n.vertexTangents&&n.flatShading===!1?`#define USE_TANGENT`:``,n.vertexColors||n.instancingColor?`#define USE_COLOR`:``,n.vertexAlphas||n.batchingColor?`#define USE_COLOR_ALPHA`:``,n.vertexUv1s?`#define USE_UV1`:``,n.vertexUv2s?`#define USE_UV2`:``,n.vertexUv3s?`#define USE_UV3`:``,n.pointsUvs?`#define USE_POINTS_UV`:``,n.gradientMap?`#define USE_GRADIENTMAP`:``,n.flatShading?`#define FLAT_SHADED`:``,n.doubleSided?`#define DOUBLE_SIDED`:``,n.flipSided?`#define FLIP_SIDED`:``,n.shadowMapEnabled?`#define USE_SHADOWMAP`:``,n.shadowMapEnabled?`#define `+c:``,n.premultipliedAlpha?`#define PREMULTIPLIED_ALPHA`:``,n.numLightProbes>0?`#define USE_LIGHT_PROBES`:``,n.numLightProbeGrids>0?`#define USE_LIGHT_PROBES_GRID`:``,n.decodeVideoTexture?`#define DECODE_VIDEO_TEXTURE`:``,n.decodeVideoTextureEmissive?`#define DECODE_VIDEO_TEXTURE_EMISSIVE`:``,n.logarithmicDepthBuffer?`#define USE_LOGARITHMIC_DEPTH_BUFFER`:``,n.reversedDepthBuffer?`#define USE_REVERSED_DEPTH_BUFFER`:``,`uniform mat4 viewMatrix;`,`uniform vec3 cameraPosition;`,`uniform bool isOrthographic;`,n.toneMapping===0?``:`#define TONE_MAPPING`,n.toneMapping===0?``:Z.tonemapping_pars_fragment,n.toneMapping===0?``:cc(`toneMapping`,n.toneMapping),n.dithering?`#define DITHERING`:``,n.opaque?`#define OPAQUE`:``,Z.colorspace_pars_fragment,oc(`linearToOutputTexel`,n.outputColorSpace),uc(),n.useDepthPacking?`#define DEPTH_PACKING `+n.depthPacking:``,`
`].filter(mc).join(`
`)),o=vc(o),o=hc(o,n),o=gc(o,n),s=vc(s),s=hc(s,n),s=gc(s,n),o=Sc(o),s=Sc(s),n.isRawShaderMaterial!==!0&&(v=`#version 300 es
`,g=[p,`#define attribute in`,`#define varying out`,`#define texture2D texture`].join(`
`)+`
`+g,_=[`#define varying in`,n.glslVersion===`300 es`?``:`layout(location = 0) out highp vec4 pc_fragColor;`,n.glslVersion===`300 es`?``:`#define gl_FragColor pc_fragColor`,`#define gl_FragDepthEXT gl_FragDepth`,`#define texture2D texture`,`#define textureCube texture`,`#define texture2DProj textureProj`,`#define texture2DLodEXT textureLod`,`#define texture2DProjLodEXT textureProjLod`,`#define textureCubeLodEXT textureLod`,`#define texture2DGradEXT textureGrad`,`#define texture2DProjGradEXT textureProjGrad`,`#define textureCubeGradEXT textureGrad`].join(`
`)+`
`+_);let y=v+g+o,b=v+_+s,x=$s(i,i.VERTEX_SHADER,y),S=$s(i,i.FRAGMENT_SHADER,b);i.attachShader(h,x),i.attachShader(h,S),n.index0AttributeName===void 0?n.morphTargets===!0&&i.bindAttribLocation(h,0,`position`):i.bindAttribLocation(h,0,n.index0AttributeName),i.linkProgram(h);function C(t){if(e.debug.checkShaderErrors){let n=i.getProgramInfoLog(h)||``,r=i.getShaderInfoLog(x)||``,a=i.getShaderInfoLog(S)||``,o=n.trim(),s=r.trim(),c=a.trim(),l=!0,u=!0;if(i.getProgramParameter(h,i.LINK_STATUS)===!1)if(l=!1,typeof e.debug.onShaderError==`function`)e.debug.onShaderError(i,h,x,S);else{let e=ac(i,x,`vertex`),n=ac(i,S,`fragment`);G(`THREE.WebGLProgram: Shader Error `+i.getError()+` - VALIDATE_STATUS `+i.getProgramParameter(h,i.VALIDATE_STATUS)+`

Material Name: `+t.name+`
Material Type: `+t.type+`

Program Info Log: `+o+`
`+e+`
`+n)}else o===``?(s===``||c===``)&&(u=!1):W(`WebGLProgram: Program Info Log:`,o);u&&(t.diagnostics={runnable:l,programLog:o,vertexShader:{log:s,prefix:g},fragmentShader:{log:c,prefix:_}})}i.deleteShader(x),i.deleteShader(S),w=new Qs(i,h),T=pc(i,h)}let w;this.getUniforms=function(){return w===void 0&&C(this),w};let T;this.getAttributes=function(){return T===void 0&&C(this),T};let E=n.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return E===!1&&(E=i.getProgramParameter(h,ec)),E},this.destroy=function(){r.releaseStatesOfProgram(this),i.deleteProgram(h),this.program=void 0},this.type=n.shaderType,this.name=n.shaderName,this.id=tc++,this.cacheKey=t,this.usedTimes=1,this.program=h,this.vertexShader=x,this.fragmentShader=S,this}var Fc=0,Ic=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e){let t=e.vertexShader,n=e.fragmentShader,r=this._getShaderStage(t),i=this._getShaderStage(n),a=this._getShaderCacheForMaterial(e);return a.has(r)===!1&&(a.add(r),r.usedTimes++),a.has(i)===!1&&(a.add(i),i.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let e of t)e.usedTimes--,e.usedTimes===0&&this.shaderCache.delete(e.code);return this.materialCache.delete(e),this}getVertexShaderID(e){return this._getShaderStage(e.vertexShader).id}getFragmentShaderID(e){return this._getShaderStage(e.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){let t=this.shaderCache,n=t.get(e);return n===void 0&&(n=new Lc(e),t.set(e,n)),n}},Lc=class{constructor(e){this.id=Fc++,this.code=e,this.usedTimes=0}};function Rc(e){return e===1030||e===37490||e===36285}function zc(e,t,n,r,i,a){let o=new sn,s=new Ic,c=new Set,l=[],u=new Map,d=r.logarithmicDepthBuffer,f=r.precision,p={MeshDepthMaterial:`depth`,MeshDistanceMaterial:`distance`,MeshNormalMaterial:`normal`,MeshBasicMaterial:`basic`,MeshLambertMaterial:`lambert`,MeshPhongMaterial:`phong`,MeshToonMaterial:`toon`,MeshStandardMaterial:`physical`,MeshPhysicalMaterial:`physical`,MeshMatcapMaterial:`matcap`,LineBasicMaterial:`basic`,LineDashedMaterial:`dashed`,PointsMaterial:`points`,ShadowMaterial:`shadow`,SpriteMaterial:`sprite`};function m(e){return c.add(e),e===0?`uv`:`uv${e}`}function h(i,o,l,u,h,g){let _=u.fog,v=h.geometry,y=i.isMeshStandardMaterial||i.isMeshLambertMaterial||i.isMeshPhongMaterial?u.environment:null,b=i.isMeshStandardMaterial||i.isMeshLambertMaterial&&!i.envMap||i.isMeshPhongMaterial&&!i.envMap,x=t.get(i.envMap||y,b),S=x&&x.mapping===306?x.image.height:null,C=p[i.type];i.precision!==null&&(f=r.getMaxPrecision(i.precision),f!==i.precision&&W(`WebGLProgram.getParameters:`,i.precision,`not supported, using`,f,`instead.`));let w=v.morphAttributes.position||v.morphAttributes.normal||v.morphAttributes.color,T=w===void 0?0:w.length,E=0;v.morphAttributes.position!==void 0&&(E=1),v.morphAttributes.normal!==void 0&&(E=2),v.morphAttributes.color!==void 0&&(E=3);let D,O,k,A;if(C){let e=oo[C];D=e.vertexShader,O=e.fragmentShader}else D=i.vertexShader,O=i.fragmentShader,s.update(i),k=s.getVertexShaderID(i),A=s.getFragmentShaderID(i);let j=e.getRenderTarget(),M=e.state.buffers.depth.getReversed(),N=h.isInstancedMesh===!0,P=h.isBatchedMesh===!0,F=!!i.map,I=!!i.matcap,ee=!!x,L=!!i.aoMap,te=!!i.lightMap,R=!!i.bumpMap,z=!!i.normalMap,ne=!!i.displacementMap,re=!!i.emissiveMap,ie=!!i.metalnessMap,ae=!!i.roughnessMap,oe=i.anisotropy>0,se=i.clearcoat>0,ce=i.dispersion>0,le=i.iridescence>0,ue=i.sheen>0,de=i.transmission>0,fe=oe&&!!i.anisotropyMap,pe=se&&!!i.clearcoatMap,me=se&&!!i.clearcoatNormalMap,he=se&&!!i.clearcoatRoughnessMap,ge=le&&!!i.iridescenceMap,_e=le&&!!i.iridescenceThicknessMap,ve=ue&&!!i.sheenColorMap,ye=ue&&!!i.sheenRoughnessMap,be=!!i.specularMap,xe=!!i.specularColorMap,Se=!!i.specularIntensityMap,Ce=de&&!!i.transmissionMap,we=de&&!!i.thicknessMap,Te=!!i.gradientMap,B=!!i.alphaMap,Ee=i.alphaTest>0,De=!!i.alphaHash,Oe=!!i.extensions,V=0;i.toneMapped&&(j===null||j.isXRRenderTarget===!0)&&(V=e.toneMapping);let ke={shaderID:C,shaderType:i.type,shaderName:i.name,vertexShader:D,fragmentShader:O,defines:i.defines,customVertexShaderID:k,customFragmentShaderID:A,isRawShaderMaterial:i.isRawShaderMaterial===!0,glslVersion:i.glslVersion,precision:f,batching:P,batchingColor:P&&h._colorsTexture!==null,instancing:N,instancingColor:N&&h.instanceColor!==null,instancingMorph:N&&h.morphTexture!==null,outputColorSpace:j===null?e.outputColorSpace:j.isXRRenderTarget===!0?j.texture.colorSpace:Nt.workingColorSpace,alphaToCoverage:!!i.alphaToCoverage,map:F,matcap:I,envMap:ee,envMapMode:ee&&x.mapping,envMapCubeUVHeight:S,aoMap:L,lightMap:te,bumpMap:R,normalMap:z,displacementMap:ne,emissiveMap:re,normalMapObjectSpace:z&&i.normalMapType===1,normalMapTangentSpace:z&&i.normalMapType===0,packedNormalMap:z&&i.normalMapType===0&&Rc(i.normalMap.format),metalnessMap:ie,roughnessMap:ae,anisotropy:oe,anisotropyMap:fe,clearcoat:se,clearcoatMap:pe,clearcoatNormalMap:me,clearcoatRoughnessMap:he,dispersion:ce,iridescence:le,iridescenceMap:ge,iridescenceThicknessMap:_e,sheen:ue,sheenColorMap:ve,sheenRoughnessMap:ye,specularMap:be,specularColorMap:xe,specularIntensityMap:Se,transmission:de,transmissionMap:Ce,thicknessMap:we,gradientMap:Te,opaque:i.transparent===!1&&i.blending===1&&i.alphaToCoverage===!1,alphaMap:B,alphaTest:Ee,alphaHash:De,combine:i.combine,mapUv:F&&m(i.map.channel),aoMapUv:L&&m(i.aoMap.channel),lightMapUv:te&&m(i.lightMap.channel),bumpMapUv:R&&m(i.bumpMap.channel),normalMapUv:z&&m(i.normalMap.channel),displacementMapUv:ne&&m(i.displacementMap.channel),emissiveMapUv:re&&m(i.emissiveMap.channel),metalnessMapUv:ie&&m(i.metalnessMap.channel),roughnessMapUv:ae&&m(i.roughnessMap.channel),anisotropyMapUv:fe&&m(i.anisotropyMap.channel),clearcoatMapUv:pe&&m(i.clearcoatMap.channel),clearcoatNormalMapUv:me&&m(i.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:he&&m(i.clearcoatRoughnessMap.channel),iridescenceMapUv:ge&&m(i.iridescenceMap.channel),iridescenceThicknessMapUv:_e&&m(i.iridescenceThicknessMap.channel),sheenColorMapUv:ve&&m(i.sheenColorMap.channel),sheenRoughnessMapUv:ye&&m(i.sheenRoughnessMap.channel),specularMapUv:be&&m(i.specularMap.channel),specularColorMapUv:xe&&m(i.specularColorMap.channel),specularIntensityMapUv:Se&&m(i.specularIntensityMap.channel),transmissionMapUv:Ce&&m(i.transmissionMap.channel),thicknessMapUv:we&&m(i.thicknessMap.channel),alphaMapUv:B&&m(i.alphaMap.channel),vertexTangents:!!v.attributes.tangent&&(z||oe),vertexNormals:!!v.attributes.normal,vertexColors:i.vertexColors,vertexAlphas:i.vertexColors===!0&&!!v.attributes.color&&v.attributes.color.itemSize===4,pointsUvs:h.isPoints===!0&&!!v.attributes.uv&&(F||B),fog:!!_,useFog:i.fog===!0,fogExp2:!!_&&_.isFogExp2,flatShading:i.wireframe===!1&&(i.flatShading===!0||v.attributes.normal===void 0&&z===!1&&(i.isMeshLambertMaterial||i.isMeshPhongMaterial||i.isMeshStandardMaterial||i.isMeshPhysicalMaterial)),sizeAttenuation:i.sizeAttenuation===!0,logarithmicDepthBuffer:d,reversedDepthBuffer:M,skinning:h.isSkinnedMesh===!0,morphTargets:v.morphAttributes.position!==void 0,morphNormals:v.morphAttributes.normal!==void 0,morphColors:v.morphAttributes.color!==void 0,morphTargetsCount:T,morphTextureStride:E,numDirLights:o.directional.length,numPointLights:o.point.length,numSpotLights:o.spot.length,numSpotLightMaps:o.spotLightMap.length,numRectAreaLights:o.rectArea.length,numHemiLights:o.hemi.length,numDirLightShadows:o.directionalShadowMap.length,numPointLightShadows:o.pointShadowMap.length,numSpotLightShadows:o.spotShadowMap.length,numSpotLightShadowsWithMaps:o.numSpotLightShadowsWithMaps,numLightProbes:o.numLightProbes,numLightProbeGrids:g.length,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:i.dithering,shadowMapEnabled:e.shadowMap.enabled&&l.length>0,shadowMapType:e.shadowMap.type,toneMapping:V,decodeVideoTexture:F&&i.map.isVideoTexture===!0&&Nt.getTransfer(i.map.colorSpace)===`srgb`,decodeVideoTextureEmissive:re&&i.emissiveMap.isVideoTexture===!0&&Nt.getTransfer(i.emissiveMap.colorSpace)===`srgb`,premultipliedAlpha:i.premultipliedAlpha,doubleSided:i.side===2,flipSided:i.side===1,useDepthPacking:i.depthPacking>=0,depthPacking:i.depthPacking||0,index0AttributeName:i.index0AttributeName,extensionClipCullDistance:Oe&&i.extensions.clipCullDistance===!0&&n.has(`WEBGL_clip_cull_distance`),extensionMultiDraw:(Oe&&i.extensions.multiDraw===!0||P)&&n.has(`WEBGL_multi_draw`),rendererExtensionParallelShaderCompile:n.has(`KHR_parallel_shader_compile`),customProgramCacheKey:i.customProgramCacheKey()};return ke.vertexUv1s=c.has(1),ke.vertexUv2s=c.has(2),ke.vertexUv3s=c.has(3),c.clear(),ke}function g(t){let n=[];if(t.shaderID?n.push(t.shaderID):(n.push(t.customVertexShaderID),n.push(t.customFragmentShaderID)),t.defines!==void 0)for(let e in t.defines)n.push(e),n.push(t.defines[e]);return t.isRawShaderMaterial===!1&&(_(n,t),v(n,t),n.push(e.outputColorSpace)),n.push(t.customProgramCacheKey),n.join()}function _(e,t){e.push(t.precision),e.push(t.outputColorSpace),e.push(t.envMapMode),e.push(t.envMapCubeUVHeight),e.push(t.mapUv),e.push(t.alphaMapUv),e.push(t.lightMapUv),e.push(t.aoMapUv),e.push(t.bumpMapUv),e.push(t.normalMapUv),e.push(t.displacementMapUv),e.push(t.emissiveMapUv),e.push(t.metalnessMapUv),e.push(t.roughnessMapUv),e.push(t.anisotropyMapUv),e.push(t.clearcoatMapUv),e.push(t.clearcoatNormalMapUv),e.push(t.clearcoatRoughnessMapUv),e.push(t.iridescenceMapUv),e.push(t.iridescenceThicknessMapUv),e.push(t.sheenColorMapUv),e.push(t.sheenRoughnessMapUv),e.push(t.specularMapUv),e.push(t.specularColorMapUv),e.push(t.specularIntensityMapUv),e.push(t.transmissionMapUv),e.push(t.thicknessMapUv),e.push(t.combine),e.push(t.fogExp2),e.push(t.sizeAttenuation),e.push(t.morphTargetsCount),e.push(t.morphAttributeCount),e.push(t.numDirLights),e.push(t.numPointLights),e.push(t.numSpotLights),e.push(t.numSpotLightMaps),e.push(t.numHemiLights),e.push(t.numRectAreaLights),e.push(t.numDirLightShadows),e.push(t.numPointLightShadows),e.push(t.numSpotLightShadows),e.push(t.numSpotLightShadowsWithMaps),e.push(t.numLightProbes),e.push(t.shadowMapType),e.push(t.toneMapping),e.push(t.numClippingPlanes),e.push(t.numClipIntersection),e.push(t.depthPacking)}function v(e,t){o.disableAll(),t.instancing&&o.enable(0),t.instancingColor&&o.enable(1),t.instancingMorph&&o.enable(2),t.matcap&&o.enable(3),t.envMap&&o.enable(4),t.normalMapObjectSpace&&o.enable(5),t.normalMapTangentSpace&&o.enable(6),t.clearcoat&&o.enable(7),t.iridescence&&o.enable(8),t.alphaTest&&o.enable(9),t.vertexColors&&o.enable(10),t.vertexAlphas&&o.enable(11),t.vertexUv1s&&o.enable(12),t.vertexUv2s&&o.enable(13),t.vertexUv3s&&o.enable(14),t.vertexTangents&&o.enable(15),t.anisotropy&&o.enable(16),t.alphaHash&&o.enable(17),t.batching&&o.enable(18),t.dispersion&&o.enable(19),t.batchingColor&&o.enable(20),t.gradientMap&&o.enable(21),t.packedNormalMap&&o.enable(22),t.vertexNormals&&o.enable(23),e.push(o.mask),o.disableAll(),t.fog&&o.enable(0),t.useFog&&o.enable(1),t.flatShading&&o.enable(2),t.logarithmicDepthBuffer&&o.enable(3),t.reversedDepthBuffer&&o.enable(4),t.skinning&&o.enable(5),t.morphTargets&&o.enable(6),t.morphNormals&&o.enable(7),t.morphColors&&o.enable(8),t.premultipliedAlpha&&o.enable(9),t.shadowMapEnabled&&o.enable(10),t.doubleSided&&o.enable(11),t.flipSided&&o.enable(12),t.useDepthPacking&&o.enable(13),t.dithering&&o.enable(14),t.transmission&&o.enable(15),t.sheen&&o.enable(16),t.opaque&&o.enable(17),t.pointsUvs&&o.enable(18),t.decodeVideoTexture&&o.enable(19),t.decodeVideoTextureEmissive&&o.enable(20),t.alphaToCoverage&&o.enable(21),t.numLightProbeGrids>0&&o.enable(22),e.push(o.mask)}function y(e){let t=p[e.type],n;if(t){let e=oo[t];n=Gi.clone(e.uniforms)}else n=e.uniforms;return n}function b(t,n){let r=u.get(n);return r===void 0?(r=new Pc(e,n,t,i),l.push(r),u.set(n,r)):++r.usedTimes,r}function x(e){if(--e.usedTimes===0){let t=l.indexOf(e);l[t]=l[l.length-1],l.pop(),u.delete(e.cacheKey),e.destroy()}}function S(e){s.remove(e)}function C(){s.dispose()}return{getParameters:h,getProgramCacheKey:g,getUniforms:y,acquireProgram:b,releaseProgram:x,releaseShaderCache:S,programs:l,dispose:C}}function Bc(){let e=new WeakMap;function t(t){return e.has(t)}function n(t){let n=e.get(t);return n===void 0&&(n={},e.set(t,n)),n}function r(t){e.delete(t)}function i(t,n,r){e.get(t)[n]=r}function a(){e=new WeakMap}return{has:t,get:n,remove:r,update:i,dispose:a}}function Vc(e,t){return e.groupOrder===t.groupOrder?e.renderOrder===t.renderOrder?e.material.id===t.material.id?e.materialVariant===t.materialVariant?e.z===t.z?e.id-t.id:e.z-t.z:e.materialVariant-t.materialVariant:e.material.id-t.material.id:e.renderOrder-t.renderOrder:e.groupOrder-t.groupOrder}function Hc(e,t){return e.groupOrder===t.groupOrder?e.renderOrder===t.renderOrder?e.z===t.z?e.id-t.id:t.z-e.z:e.renderOrder-t.renderOrder:e.groupOrder-t.groupOrder}function Uc(){let e=[],t=0,n=[],r=[],i=[];function a(){t=0,n.length=0,r.length=0,i.length=0}function o(e){let t=0;return e.isInstancedMesh&&(t+=2),e.isSkinnedMesh&&(t+=1),t}function s(n,r,i,a,s,c){let l=e[t];return l===void 0?(l={id:n.id,object:n,geometry:r,material:i,materialVariant:o(n),groupOrder:a,renderOrder:n.renderOrder,z:s,group:c},e[t]=l):(l.id=n.id,l.object=n,l.geometry=r,l.material=i,l.materialVariant=o(n),l.groupOrder=a,l.renderOrder=n.renderOrder,l.z=s,l.group=c),t++,l}function c(e,t,a,o,c,l){let u=s(e,t,a,o,c,l);a.transmission>0?r.push(u):a.transparent===!0?i.push(u):n.push(u)}function l(e,t,a,o,c,l){let u=s(e,t,a,o,c,l);a.transmission>0?r.unshift(u):a.transparent===!0?i.unshift(u):n.unshift(u)}function u(e,t){n.length>1&&n.sort(e||Vc),r.length>1&&r.sort(t||Hc),i.length>1&&i.sort(t||Hc)}function d(){for(let n=t,r=e.length;n<r;n++){let t=e[n];if(t.id===null)break;t.id=null,t.object=null,t.geometry=null,t.material=null,t.group=null}}return{opaque:n,transmissive:r,transparent:i,init:a,push:c,unshift:l,finish:d,sort:u}}function Wc(){let e=new WeakMap;function t(t,n){let r=e.get(t),i;return r===void 0?(i=new Uc,e.set(t,[i])):n>=r.length?(i=new Uc,r.push(i)):i=r[n],i}function n(){e=new WeakMap}return{get:t,dispose:n}}function Gc(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case`DirectionalLight`:n={direction:new J,color:new X};break;case`SpotLight`:n={position:new J,direction:new J,color:new X,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case`PointLight`:n={position:new J,color:new X,distance:0,decay:0};break;case`HemisphereLight`:n={direction:new J,skyColor:new X,groundColor:new X};break;case`RectAreaLight`:n={color:new X,position:new J,halfWidth:new J,halfHeight:new J};break}return e[t.id]=n,n}}}function Kc(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case`DirectionalLight`:n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new q};break;case`SpotLight`:n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new q};break;case`PointLight`:n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new q,shadowCameraNear:1,shadowCameraFar:1e3};break}return e[t.id]=n,n}}}var qc=0;function Jc(e,t){return(t.castShadow?2:0)-(e.castShadow?2:0)+ +!!t.map-!!e.map}function Yc(e){let t=new Gc,n=Kc(),r={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let e=0;e<9;e++)r.probe.push(new J);let i=new J,a=new Yt,o=new Yt;function s(i){let a=0,o=0,s=0;for(let e=0;e<9;e++)r.probe[e].set(0,0,0);let c=0,l=0,u=0,d=0,f=0,p=0,m=0,h=0,g=0,_=0,v=0;i.sort(Jc);for(let e=0,y=i.length;e<y;e++){let y=i[e],b=y.color,x=y.intensity,S=y.distance,C=null;if(y.shadow&&y.shadow.map&&(C=y.shadow.map.texture.format===1030?y.shadow.map.texture:y.shadow.map.depthTexture||y.shadow.map.texture),y.isAmbientLight)a+=b.r*x,o+=b.g*x,s+=b.b*x;else if(y.isLightProbe){for(let e=0;e<9;e++)r.probe[e].addScaledVector(y.sh.coefficients[e],x);v++}else if(y.isDirectionalLight){let e=t.get(y);if(e.color.copy(y.color).multiplyScalar(y.intensity),y.castShadow){let e=y.shadow,t=n.get(y);t.shadowIntensity=e.intensity,t.shadowBias=e.bias,t.shadowNormalBias=e.normalBias,t.shadowRadius=e.radius,t.shadowMapSize=e.mapSize,r.directionalShadow[c]=t,r.directionalShadowMap[c]=C,r.directionalShadowMatrix[c]=y.shadow.matrix,p++}r.directional[c]=e,c++}else if(y.isSpotLight){let e=t.get(y);e.position.setFromMatrixPosition(y.matrixWorld),e.color.copy(b).multiplyScalar(x),e.distance=S,e.coneCos=Math.cos(y.angle),e.penumbraCos=Math.cos(y.angle*(1-y.penumbra)),e.decay=y.decay,r.spot[u]=e;let i=y.shadow;if(y.map&&(r.spotLightMap[g]=y.map,g++,i.updateMatrices(y),y.castShadow&&_++),r.spotLightMatrix[u]=i.matrix,y.castShadow){let e=n.get(y);e.shadowIntensity=i.intensity,e.shadowBias=i.bias,e.shadowNormalBias=i.normalBias,e.shadowRadius=i.radius,e.shadowMapSize=i.mapSize,r.spotShadow[u]=e,r.spotShadowMap[u]=C,h++}u++}else if(y.isRectAreaLight){let e=t.get(y);e.color.copy(b).multiplyScalar(x),e.halfWidth.set(y.width*.5,0,0),e.halfHeight.set(0,y.height*.5,0),r.rectArea[d]=e,d++}else if(y.isPointLight){let e=t.get(y);if(e.color.copy(y.color).multiplyScalar(y.intensity),e.distance=y.distance,e.decay=y.decay,y.castShadow){let e=y.shadow,t=n.get(y);t.shadowIntensity=e.intensity,t.shadowBias=e.bias,t.shadowNormalBias=e.normalBias,t.shadowRadius=e.radius,t.shadowMapSize=e.mapSize,t.shadowCameraNear=e.camera.near,t.shadowCameraFar=e.camera.far,r.pointShadow[l]=t,r.pointShadowMap[l]=C,r.pointShadowMatrix[l]=y.shadow.matrix,m++}r.point[l]=e,l++}else if(y.isHemisphereLight){let e=t.get(y);e.skyColor.copy(y.color).multiplyScalar(x),e.groundColor.copy(y.groundColor).multiplyScalar(x),r.hemi[f]=e,f++}}d>0&&(e.has(`OES_texture_float_linear`)===!0?(r.rectAreaLTC1=Q.LTC_FLOAT_1,r.rectAreaLTC2=Q.LTC_FLOAT_2):(r.rectAreaLTC1=Q.LTC_HALF_1,r.rectAreaLTC2=Q.LTC_HALF_2)),r.ambient[0]=a,r.ambient[1]=o,r.ambient[2]=s;let y=r.hash;(y.directionalLength!==c||y.pointLength!==l||y.spotLength!==u||y.rectAreaLength!==d||y.hemiLength!==f||y.numDirectionalShadows!==p||y.numPointShadows!==m||y.numSpotShadows!==h||y.numSpotMaps!==g||y.numLightProbes!==v)&&(r.directional.length=c,r.spot.length=u,r.rectArea.length=d,r.point.length=l,r.hemi.length=f,r.directionalShadow.length=p,r.directionalShadowMap.length=p,r.pointShadow.length=m,r.pointShadowMap.length=m,r.spotShadow.length=h,r.spotShadowMap.length=h,r.directionalShadowMatrix.length=p,r.pointShadowMatrix.length=m,r.spotLightMatrix.length=h+g-_,r.spotLightMap.length=g,r.numSpotLightShadowsWithMaps=_,r.numLightProbes=v,y.directionalLength=c,y.pointLength=l,y.spotLength=u,y.rectAreaLength=d,y.hemiLength=f,y.numDirectionalShadows=p,y.numPointShadows=m,y.numSpotShadows=h,y.numSpotMaps=g,y.numLightProbes=v,r.version=qc++)}function c(e,t){let n=0,s=0,c=0,l=0,u=0,d=t.matrixWorldInverse;for(let t=0,f=e.length;t<f;t++){let f=e[t];if(f.isDirectionalLight){let e=r.directional[n];e.direction.setFromMatrixPosition(f.matrixWorld),i.setFromMatrixPosition(f.target.matrixWorld),e.direction.sub(i),e.direction.transformDirection(d),n++}else if(f.isSpotLight){let e=r.spot[c];e.position.setFromMatrixPosition(f.matrixWorld),e.position.applyMatrix4(d),e.direction.setFromMatrixPosition(f.matrixWorld),i.setFromMatrixPosition(f.target.matrixWorld),e.direction.sub(i),e.direction.transformDirection(d),c++}else if(f.isRectAreaLight){let e=r.rectArea[l];e.position.setFromMatrixPosition(f.matrixWorld),e.position.applyMatrix4(d),o.identity(),a.copy(f.matrixWorld),a.premultiply(d),o.extractRotation(a),e.halfWidth.set(f.width*.5,0,0),e.halfHeight.set(0,f.height*.5,0),e.halfWidth.applyMatrix4(o),e.halfHeight.applyMatrix4(o),l++}else if(f.isPointLight){let e=r.point[s];e.position.setFromMatrixPosition(f.matrixWorld),e.position.applyMatrix4(d),s++}else if(f.isHemisphereLight){let e=r.hemi[u];e.direction.setFromMatrixPosition(f.matrixWorld),e.direction.transformDirection(d),u++}}}return{setup:s,setupView:c,state:r}}function Xc(e){let t=new Yc(e),n=[],r=[],i=[];function a(e){d.camera=e,n.length=0,r.length=0,i.length=0}function o(e){n.push(e)}function s(e){r.push(e)}function c(e){i.push(e)}function l(){t.setup(n)}function u(e){t.setupView(n,e)}let d={lightsArray:n,shadowsArray:r,lightProbeGridArray:i,camera:null,lights:t,transmissionRenderTarget:{},textureUnits:0};return{init:a,state:d,setupLights:l,setupLightsView:u,pushLight:o,pushShadow:s,pushLightProbeGrid:c}}function Zc(e){let t=new WeakMap;function n(n,r=0){let i=t.get(n),a;return i===void 0?(a=new Xc(e),t.set(n,[a])):r>=i.length?(a=new Xc(e),i.push(a)):a=i[r],a}function r(){t=new WeakMap}return{get:n,dispose:r}}var Qc=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,$c=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,el=[new J(1,0,0),new J(-1,0,0),new J(0,1,0),new J(0,-1,0),new J(0,0,1),new J(0,0,-1)],tl=[new J(0,-1,0),new J(0,-1,0),new J(0,0,1),new J(0,0,-1),new J(0,-1,0),new J(0,-1,0)],nl=new Yt,rl=new J,il=new J;function al(e,t,n){let r=new hi,i=new q,o=new q,s=new Wt,l=new $i,u=new ea,d={},f=n.maxTextureSize,p={0:1,1:0,2:2},m=new Ji({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new q},radius:{value:4}},vertexShader:Qc,fragmentShader:$c}),h=m.clone();h.defines.HORIZONTAL_PASS=1;let y=new Er;y.setAttribute(`position`,new dr(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let b=new Yr(y,m),x=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=1;let S=this.type;this.render=function(t,n,l){if(x.enabled===!1||x.autoUpdate===!1&&x.needsUpdate===!1||t.length===0)return;this.type===2&&(W(`WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead.`),this.type=1);let u=e.getRenderTarget(),d=e.getActiveCubeFace(),p=e.getActiveMipmapLevel(),m=e.state;m.setBlending(0),m.buffers.depth.getReversed()===!0?m.buffers.color.setClear(0,0,0,0):m.buffers.color.setClear(1,1,1,1),m.buffers.depth.setTest(!0),m.setScissorTest(!1);let h=S!==this.type;h&&n.traverse(function(e){e.material&&(Array.isArray(e.material)?e.material.forEach(e=>e.needsUpdate=!0):e.material.needsUpdate=!0)});for(let u=0,d=t.length;u<d;u++){let d=t[u],p=d.shadow;if(p===void 0){W(`WebGLShadowMap:`,d,`has no shadow.`);continue}if(p.autoUpdate===!1&&p.needsUpdate===!1)continue;i.copy(p.mapSize);let y=p.getFrameExtents();i.multiply(y),o.copy(p.mapSize),(i.x>f||i.y>f)&&(i.x>f&&(o.x=Math.floor(f/y.x),i.x=o.x*y.x,p.mapSize.x=o.x),i.y>f&&(o.y=Math.floor(f/y.y),i.y=o.y*y.y,p.mapSize.y=o.y));let b=e.state.buffers.depth.getReversed();if(p.camera._reversedDepth=b,p.map===null||h===!0){if(p.map!==null&&(p.map.depthTexture!==null&&(p.map.depthTexture.dispose(),p.map.depthTexture=null),p.map.dispose()),this.type===3){if(d.isPointLight){W(`WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.`);continue}p.map=new Kt(i.x,i.y,{format:j,type:v,minFilter:c,magFilter:c,generateMipmaps:!1}),p.map.texture.name=d.name+`.shadowMap`,p.map.depthTexture=new Ai(i.x,i.y,_),p.map.depthTexture.name=d.name+`.shadowMapDepth`,p.map.depthTexture.format=D,p.map.depthTexture.compareFunction=null,p.map.depthTexture.minFilter=a,p.map.depthTexture.magFilter=a}else d.isPointLight?(p.map=new Io(i.x),p.map.depthTexture=new ji(i.x,g)):(p.map=new Kt(i.x,i.y),p.map.depthTexture=new Ai(i.x,i.y,g)),p.map.depthTexture.name=d.name+`.shadowMap`,p.map.depthTexture.format=D,this.type===1?(p.map.depthTexture.compareFunction=b?518:515,p.map.depthTexture.minFilter=c,p.map.depthTexture.magFilter=c):(p.map.depthTexture.compareFunction=null,p.map.depthTexture.minFilter=a,p.map.depthTexture.magFilter=a);p.camera.updateProjectionMatrix()}let x=p.map.isWebGLCubeRenderTarget?6:1;for(let t=0;t<x;t++){if(p.map.isWebGLCubeRenderTarget)e.setRenderTarget(p.map,t),e.clear();else{t===0&&(e.setRenderTarget(p.map),e.clear());let n=p.getViewport(t);s.set(o.x*n.x,o.y*n.y,o.x*n.z,o.y*n.w),m.viewport(s)}if(d.isPointLight){let e=p.camera,n=p.matrix,r=d.distance||e.far;r!==e.far&&(e.far=r,e.updateProjectionMatrix()),rl.setFromMatrixPosition(d.matrixWorld),e.position.copy(rl),il.copy(e.position),il.add(el[t]),e.up.copy(tl[t]),e.lookAt(il),e.updateMatrixWorld(),n.makeTranslation(-rl.x,-rl.y,-rl.z),nl.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),p._frustum.setFromProjectionMatrix(nl,e.coordinateSystem,e.reversedDepth)}else p.updateMatrices(d);r=p.getFrustum(),T(n,l,p.camera,d,this.type)}p.isPointLightShadow!==!0&&this.type===3&&C(p,l),p.needsUpdate=!1}S=this.type,x.needsUpdate=!1,e.setRenderTarget(u,d,p)};function C(n,r){let a=t.update(b);m.defines.VSM_SAMPLES!==n.blurSamples&&(m.defines.VSM_SAMPLES=n.blurSamples,h.defines.VSM_SAMPLES=n.blurSamples,m.needsUpdate=!0,h.needsUpdate=!0),n.mapPass===null&&(n.mapPass=new Kt(i.x,i.y,{format:j,type:v})),m.uniforms.shadow_pass.value=n.map.depthTexture,m.uniforms.resolution.value=n.mapSize,m.uniforms.radius.value=n.radius,e.setRenderTarget(n.mapPass),e.clear(),e.renderBufferDirect(r,null,a,m,b,null),h.uniforms.shadow_pass.value=n.mapPass.texture,h.uniforms.resolution.value=n.mapSize,h.uniforms.radius.value=n.radius,e.setRenderTarget(n.map),e.clear(),e.renderBufferDirect(r,null,a,h,b,null)}function w(t,n,r,i){let a=null,o=r.isPointLight===!0?t.customDistanceMaterial:t.customDepthMaterial;if(o!==void 0)a=o;else if(a=r.isPointLight===!0?u:l,e.localClippingEnabled&&n.clipShadows===!0&&Array.isArray(n.clippingPlanes)&&n.clippingPlanes.length!==0||n.displacementMap&&n.displacementScale!==0||n.alphaMap&&n.alphaTest>0||n.map&&n.alphaTest>0||n.alphaToCoverage===!0){let e=a.uuid,t=n.uuid,r=d[e];r===void 0&&(r={},d[e]=r);let i=r[t];i===void 0&&(i=a.clone(),r[t]=i,n.addEventListener(`dispose`,E)),a=i}if(a.visible=n.visible,a.wireframe=n.wireframe,i===3?a.side=n.shadowSide===null?n.side:n.shadowSide:a.side=n.shadowSide===null?p[n.side]:n.shadowSide,a.alphaMap=n.alphaMap,a.alphaTest=n.alphaToCoverage===!0?.5:n.alphaTest,a.map=n.map,a.clipShadows=n.clipShadows,a.clippingPlanes=n.clippingPlanes,a.clipIntersection=n.clipIntersection,a.displacementMap=n.displacementMap,a.displacementScale=n.displacementScale,a.displacementBias=n.displacementBias,a.wireframeLinewidth=n.wireframeLinewidth,a.linewidth=n.linewidth,r.isPointLight===!0&&a.isMeshDistanceMaterial===!0){let t=e.properties.get(a);t.light=r}return a}function T(n,i,a,o,s){if(n.visible===!1)return;if(n.layers.test(i.layers)&&(n.isMesh||n.isLine||n.isPoints)&&(n.castShadow||n.receiveShadow&&s===3)&&(!n.frustumCulled||r.intersectsObject(n))){n.modelViewMatrix.multiplyMatrices(a.matrixWorldInverse,n.matrixWorld);let r=t.update(n),c=n.material;if(Array.isArray(c)){let t=r.groups;for(let l=0,u=t.length;l<u;l++){let u=t[l],d=c[u.materialIndex];if(d&&d.visible){let t=w(n,d,o,s);n.onBeforeShadow(e,n,i,a,r,t,u),e.renderBufferDirect(a,null,r,t,n,u),n.onAfterShadow(e,n,i,a,r,t,u)}}}else if(c.visible){let t=w(n,c,o,s);n.onBeforeShadow(e,n,i,a,r,t,null),e.renderBufferDirect(a,null,r,t,n,null),n.onAfterShadow(e,n,i,a,r,t,null)}}let c=n.children;for(let e=0,t=c.length;e<t;e++)T(c[e],i,a,o,s)}function E(e){e.target.removeEventListener(`dispose`,E);for(let t in d){let n=d[t],r=e.target.uuid;r in n&&(n[r].dispose(),delete n[r])}}}function ol(e,t){function n(){let t=!1,n=new Wt,r=null,i=new Wt(0,0,0,0);return{setMask:function(n){r!==n&&!t&&(e.colorMask(n,n,n,n),r=n)},setLocked:function(e){t=e},setClear:function(t,r,a,o,s){s===!0&&(t*=o,r*=o,a*=o),n.set(t,r,a,o),i.equals(n)===!1&&(e.clearColor(t,r,a,o),i.copy(n))},reset:function(){t=!1,r=null,i.set(-1,0,0,0)}}}function r(){let n=!1,r=!1,i=null,a=null,o=null;return{setReversed:function(e){if(r!==e){let n=t.get(`EXT_clip_control`);e?n.clipControlEXT(n.LOWER_LEFT_EXT,n.ZERO_TO_ONE_EXT):n.clipControlEXT(n.LOWER_LEFT_EXT,n.NEGATIVE_ONE_TO_ONE_EXT),r=e;let i=o;o=null,this.setClear(i)}},getReversed:function(){return r},setTest:function(t){t?ie(e.DEPTH_TEST):ae(e.DEPTH_TEST)},setMask:function(t){i!==t&&!n&&(e.depthMask(t),i=t)},setFunc:function(t){if(r&&(t=Qe[t]),a!==t){switch(t){case 0:e.depthFunc(e.NEVER);break;case 1:e.depthFunc(e.ALWAYS);break;case 2:e.depthFunc(e.LESS);break;case 3:e.depthFunc(e.LEQUAL);break;case 4:e.depthFunc(e.EQUAL);break;case 5:e.depthFunc(e.GEQUAL);break;case 6:e.depthFunc(e.GREATER);break;case 7:e.depthFunc(e.NOTEQUAL);break;default:e.depthFunc(e.LEQUAL)}a=t}},setLocked:function(e){n=e},setClear:function(t){o!==t&&(o=t,r&&(t=1-t),e.clearDepth(t))},reset:function(){n=!1,i=null,a=null,o=null,r=!1}}}function i(){let t=!1,n=null,r=null,i=null,a=null,o=null,s=null,c=null,l=null;return{setTest:function(n){t||(n?ie(e.STENCIL_TEST):ae(e.STENCIL_TEST))},setMask:function(r){n!==r&&!t&&(e.stencilMask(r),n=r)},setFunc:function(t,n,o){(r!==t||i!==n||a!==o)&&(e.stencilFunc(t,n,o),r=t,i=n,a=o)},setOp:function(t,n,r){(o!==t||s!==n||c!==r)&&(e.stencilOp(t,n,r),o=t,s=n,c=r)},setLocked:function(e){t=e},setClear:function(t){l!==t&&(e.clearStencil(t),l=t)},reset:function(){t=!1,n=null,r=null,i=null,a=null,o=null,s=null,c=null,l=null}}}let a=new n,o=new r,s=new i,c=new WeakMap,l=new WeakMap,u={},d={},f={},p=new WeakMap,m=[],h=null,g=!1,_=null,v=null,y=null,b=null,x=null,S=null,C=null,w=new X(0,0,0),T=0,E=!1,D=null,O=null,k=null,A=null,j=null,M=e.getParameter(e.MAX_COMBINED_TEXTURE_IMAGE_UNITS),N=!1,P=0,F=e.getParameter(e.VERSION);F.indexOf(`WebGL`)===-1?F.indexOf(`OpenGL ES`)!==-1&&(P=parseFloat(/^OpenGL ES (\d)/.exec(F)[1]),N=P>=2):(P=parseFloat(/^WebGL (\d)/.exec(F)[1]),N=P>=1);let I=null,ee={},L=e.getParameter(e.SCISSOR_BOX),te=e.getParameter(e.VIEWPORT),R=new Wt().fromArray(L),z=new Wt().fromArray(te);function ne(t,n,r,i){let a=new Uint8Array(4),o=e.createTexture();e.bindTexture(t,o),e.texParameteri(t,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(t,e.TEXTURE_MAG_FILTER,e.NEAREST);for(let o=0;o<r;o++)t===e.TEXTURE_3D||t===e.TEXTURE_2D_ARRAY?e.texImage3D(n,0,e.RGBA,1,1,i,0,e.RGBA,e.UNSIGNED_BYTE,a):e.texImage2D(n+o,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,a);return o}let re={};re[e.TEXTURE_2D]=ne(e.TEXTURE_2D,e.TEXTURE_2D,1),re[e.TEXTURE_CUBE_MAP]=ne(e.TEXTURE_CUBE_MAP,e.TEXTURE_CUBE_MAP_POSITIVE_X,6),re[e.TEXTURE_2D_ARRAY]=ne(e.TEXTURE_2D_ARRAY,e.TEXTURE_2D_ARRAY,1,1),re[e.TEXTURE_3D]=ne(e.TEXTURE_3D,e.TEXTURE_3D,1,1),a.setClear(0,0,0,1),o.setClear(1),s.setClear(0),ie(e.DEPTH_TEST),o.setFunc(3),pe(!1),me(1),ie(e.CULL_FACE),de(0);function ie(t){u[t]!==!0&&(e.enable(t),u[t]=!0)}function ae(t){u[t]!==!1&&(e.disable(t),u[t]=!1)}function oe(t,n){return f[t]===n?!1:(e.bindFramebuffer(t,n),f[t]=n,t===e.DRAW_FRAMEBUFFER&&(f[e.FRAMEBUFFER]=n),t===e.FRAMEBUFFER&&(f[e.DRAW_FRAMEBUFFER]=n),!0)}function se(t,n){let r=m,i=!1;if(t){r=p.get(n),r===void 0&&(r=[],p.set(n,r));let a=t.textures;if(r.length!==a.length||r[0]!==e.COLOR_ATTACHMENT0){for(let t=0,n=a.length;t<n;t++)r[t]=e.COLOR_ATTACHMENT0+t;r.length=a.length,i=!0}}else r[0]!==e.BACK&&(r[0]=e.BACK,i=!0);i&&e.drawBuffers(r)}function ce(t){return h===t?!1:(e.useProgram(t),h=t,!0)}let le={100:e.FUNC_ADD,101:e.FUNC_SUBTRACT,102:e.FUNC_REVERSE_SUBTRACT};le[103]=e.MIN,le[104]=e.MAX;let ue={200:e.ZERO,201:e.ONE,202:e.SRC_COLOR,204:e.SRC_ALPHA,210:e.SRC_ALPHA_SATURATE,208:e.DST_COLOR,206:e.DST_ALPHA,203:e.ONE_MINUS_SRC_COLOR,205:e.ONE_MINUS_SRC_ALPHA,209:e.ONE_MINUS_DST_COLOR,207:e.ONE_MINUS_DST_ALPHA,211:e.CONSTANT_COLOR,212:e.ONE_MINUS_CONSTANT_COLOR,213:e.CONSTANT_ALPHA,214:e.ONE_MINUS_CONSTANT_ALPHA};function de(t,n,r,i,a,o,s,c,l,u){if(t===0){g===!0&&(ae(e.BLEND),g=!1);return}if(g===!1&&(ie(e.BLEND),g=!0),t!==5){if(t!==_||u!==E){if((v!==100||x!==100)&&(e.blendEquation(e.FUNC_ADD),v=100,x=100),u)switch(t){case 1:e.blendFuncSeparate(e.ONE,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case 2:e.blendFunc(e.ONE,e.ONE);break;case 3:e.blendFuncSeparate(e.ZERO,e.ONE_MINUS_SRC_COLOR,e.ZERO,e.ONE);break;case 4:e.blendFuncSeparate(e.DST_COLOR,e.ONE_MINUS_SRC_ALPHA,e.ZERO,e.ONE);break;default:G(`WebGLState: Invalid blending: `,t);break}else switch(t){case 1:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case 2:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE,e.ONE,e.ONE);break;case 3:G(`WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true`);break;case 4:G(`WebGLState: MultiplyBlending requires material.premultipliedAlpha = true`);break;default:G(`WebGLState: Invalid blending: `,t);break}y=null,b=null,S=null,C=null,w.set(0,0,0),T=0,_=t,E=u}return}a||=n,o||=r,s||=i,(n!==v||a!==x)&&(e.blendEquationSeparate(le[n],le[a]),v=n,x=a),(r!==y||i!==b||o!==S||s!==C)&&(e.blendFuncSeparate(ue[r],ue[i],ue[o],ue[s]),y=r,b=i,S=o,C=s),(c.equals(w)===!1||l!==T)&&(e.blendColor(c.r,c.g,c.b,l),w.copy(c),T=l),_=t,E=!1}function fe(t,n){t.side===2?ae(e.CULL_FACE):ie(e.CULL_FACE);let r=t.side===1;n&&(r=!r),pe(r),t.blending===1&&t.transparent===!1?de(0):de(t.blending,t.blendEquation,t.blendSrc,t.blendDst,t.blendEquationAlpha,t.blendSrcAlpha,t.blendDstAlpha,t.blendColor,t.blendAlpha,t.premultipliedAlpha),o.setFunc(t.depthFunc),o.setTest(t.depthTest),o.setMask(t.depthWrite),a.setMask(t.colorWrite);let i=t.stencilWrite;s.setTest(i),i&&(s.setMask(t.stencilWriteMask),s.setFunc(t.stencilFunc,t.stencilRef,t.stencilFuncMask),s.setOp(t.stencilFail,t.stencilZFail,t.stencilZPass)),ge(t.polygonOffset,t.polygonOffsetFactor,t.polygonOffsetUnits),t.alphaToCoverage===!0?ie(e.SAMPLE_ALPHA_TO_COVERAGE):ae(e.SAMPLE_ALPHA_TO_COVERAGE)}function pe(t){D!==t&&(t?e.frontFace(e.CW):e.frontFace(e.CCW),D=t)}function me(t){t===0?ae(e.CULL_FACE):(ie(e.CULL_FACE),t!==O&&(t===1?e.cullFace(e.BACK):t===2?e.cullFace(e.FRONT):e.cullFace(e.FRONT_AND_BACK))),O=t}function he(t){t!==k&&(N&&e.lineWidth(t),k=t)}function ge(t,n,r){t?(ie(e.POLYGON_OFFSET_FILL),(A!==n||j!==r)&&(A=n,j=r,o.getReversed()&&(n=-n),e.polygonOffset(n,r))):ae(e.POLYGON_OFFSET_FILL)}function _e(t){t?ie(e.SCISSOR_TEST):ae(e.SCISSOR_TEST)}function ve(t){t===void 0&&(t=e.TEXTURE0+M-1),I!==t&&(e.activeTexture(t),I=t)}function ye(t,n,r){r===void 0&&(r=I===null?e.TEXTURE0+M-1:I);let i=ee[r];i===void 0&&(i={type:void 0,texture:void 0},ee[r]=i),(i.type!==t||i.texture!==n)&&(I!==r&&(e.activeTexture(r),I=r),e.bindTexture(t,n||re[t]),i.type=t,i.texture=n)}function be(){let t=ee[I];t!==void 0&&t.type!==void 0&&(e.bindTexture(t.type,null),t.type=void 0,t.texture=void 0)}function xe(){try{e.compressedTexImage2D(...arguments)}catch(e){G(`WebGLState:`,e)}}function Se(){try{e.compressedTexImage3D(...arguments)}catch(e){G(`WebGLState:`,e)}}function Ce(){try{e.texSubImage2D(...arguments)}catch(e){G(`WebGLState:`,e)}}function we(){try{e.texSubImage3D(...arguments)}catch(e){G(`WebGLState:`,e)}}function Te(){try{e.compressedTexSubImage2D(...arguments)}catch(e){G(`WebGLState:`,e)}}function B(){try{e.compressedTexSubImage3D(...arguments)}catch(e){G(`WebGLState:`,e)}}function Ee(){try{e.texStorage2D(...arguments)}catch(e){G(`WebGLState:`,e)}}function De(){try{e.texStorage3D(...arguments)}catch(e){G(`WebGLState:`,e)}}function Oe(){try{e.texImage2D(...arguments)}catch(e){G(`WebGLState:`,e)}}function V(){try{e.texImage3D(...arguments)}catch(e){G(`WebGLState:`,e)}}function ke(t){return d[t]===void 0?e.getParameter(t):d[t]}function H(t,n){d[t]!==n&&(e.pixelStorei(t,n),d[t]=n)}function U(t){R.equals(t)===!1&&(e.scissor(t.x,t.y,t.z,t.w),R.copy(t))}function Ae(t){z.equals(t)===!1&&(e.viewport(t.x,t.y,t.z,t.w),z.copy(t))}function je(t,n){let r=l.get(n);r===void 0&&(r=new WeakMap,l.set(n,r));let i=r.get(t);i===void 0&&(i=e.getUniformBlockIndex(n,t.name),r.set(t,i))}function Me(t,n){let r=l.get(n).get(t);c.get(n)!==r&&(e.uniformBlockBinding(n,r,t.__bindingPointIndex),c.set(n,r))}function Ne(){e.disable(e.BLEND),e.disable(e.CULL_FACE),e.disable(e.DEPTH_TEST),e.disable(e.POLYGON_OFFSET_FILL),e.disable(e.SCISSOR_TEST),e.disable(e.STENCIL_TEST),e.disable(e.SAMPLE_ALPHA_TO_COVERAGE),e.blendEquation(e.FUNC_ADD),e.blendFunc(e.ONE,e.ZERO),e.blendFuncSeparate(e.ONE,e.ZERO,e.ONE,e.ZERO),e.blendColor(0,0,0,0),e.colorMask(!0,!0,!0,!0),e.clearColor(0,0,0,0),e.depthMask(!0),e.depthFunc(e.LESS),o.setReversed(!1),e.clearDepth(1),e.stencilMask(4294967295),e.stencilFunc(e.ALWAYS,0,4294967295),e.stencilOp(e.KEEP,e.KEEP,e.KEEP),e.clearStencil(0),e.cullFace(e.BACK),e.frontFace(e.CCW),e.polygonOffset(0,0),e.activeTexture(e.TEXTURE0),e.bindFramebuffer(e.FRAMEBUFFER,null),e.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),e.bindFramebuffer(e.READ_FRAMEBUFFER,null),e.useProgram(null),e.lineWidth(1),e.scissor(0,0,e.canvas.width,e.canvas.height),e.viewport(0,0,e.canvas.width,e.canvas.height),e.pixelStorei(e.PACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!1),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),e.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,e.BROWSER_DEFAULT_WEBGL),e.pixelStorei(e.PACK_ROW_LENGTH,0),e.pixelStorei(e.PACK_SKIP_PIXELS,0),e.pixelStorei(e.PACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_ROW_LENGTH,0),e.pixelStorei(e.UNPACK_IMAGE_HEIGHT,0),e.pixelStorei(e.UNPACK_SKIP_PIXELS,0),e.pixelStorei(e.UNPACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_SKIP_IMAGES,0),u={},d={},I=null,ee={},f={},p=new WeakMap,m=[],h=null,g=!1,_=null,v=null,y=null,b=null,x=null,S=null,C=null,w=new X(0,0,0),T=0,E=!1,D=null,O=null,k=null,A=null,j=null,R.set(0,0,e.canvas.width,e.canvas.height),z.set(0,0,e.canvas.width,e.canvas.height),a.reset(),o.reset(),s.reset()}return{buffers:{color:a,depth:o,stencil:s},enable:ie,disable:ae,bindFramebuffer:oe,drawBuffers:se,useProgram:ce,setBlending:de,setMaterial:fe,setFlipSided:pe,setCullFace:me,setLineWidth:he,setPolygonOffset:ge,setScissorTest:_e,activeTexture:ve,bindTexture:ye,unbindTexture:be,compressedTexImage2D:xe,compressedTexImage3D:Se,texImage2D:Oe,texImage3D:V,pixelStorei:H,getParameter:ke,updateUBOMapping:je,uniformBlockBinding:Me,texStorage2D:Ee,texStorage3D:De,texSubImage2D:Ce,texSubImage3D:we,compressedTexSubImage2D:Te,compressedTexSubImage3D:B,scissor:U,viewport:Ae,reset:Ne}}function sl(e,t,d,f,p,m,h){let g=t.has(`WEBGL_multisampled_render_to_texture`)?t.get(`WEBGL_multisampled_render_to_texture`):null,_=typeof navigator>`u`?!1:/OculusBrowser/g.test(navigator.userAgent),v=new q,y=new WeakMap,b=new Set,x,S=new WeakMap,C=!1;try{C=typeof OffscreenCanvas<`u`&&new OffscreenCanvas(1,1).getContext(`2d`)!==null}catch{}function w(e,t){return C?new OffscreenCanvas(e,t):We(`canvas`)}function T(e,t,n){let r=1,i=ke(e);if((i.width>n||i.height>n)&&(r=n/Math.max(i.width,i.height)),r<1)if(typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<`u`&&e instanceof HTMLCanvasElement||typeof ImageBitmap<`u`&&e instanceof ImageBitmap||typeof VideoFrame<`u`&&e instanceof VideoFrame){let n=Math.floor(r*i.width),a=Math.floor(r*i.height);x===void 0&&(x=w(n,a));let o=t?w(n,a):x;return o.width=n,o.height=a,o.getContext(`2d`).drawImage(e,0,0,n,a),W(`WebGLRenderer: Texture has been resized from (`+i.width+`x`+i.height+`) to (`+n+`x`+a+`).`),o}else return`data`in e&&W(`WebGLRenderer: Image in DataTexture is too big (`+i.width+`x`+i.height+`).`),e;return e}function E(e){return e.generateMipmaps}function D(t){e.generateMipmap(t)}function k(t){return t.isWebGLCubeRenderTarget?e.TEXTURE_CUBE_MAP:t.isWebGL3DRenderTarget?e.TEXTURE_3D:t.isWebGLArrayRenderTarget||t.isCompressedArrayTexture?e.TEXTURE_2D_ARRAY:e.TEXTURE_2D}function A(n,r,i,a,o,s=!1){if(n!==null){if(e[n]!==void 0)return e[n];W(`WebGLRenderer: Attempt to use non-existing WebGL internal format '`+n+`'`)}let c;a&&(c=t.get(`EXT_texture_norm16`),c||W(`WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension`));let l=r;if(r===e.RED&&(i===e.FLOAT&&(l=e.R32F),i===e.HALF_FLOAT&&(l=e.R16F),i===e.UNSIGNED_BYTE&&(l=e.R8),i===e.UNSIGNED_SHORT&&c&&(l=c.R16_EXT),i===e.SHORT&&c&&(l=c.R16_SNORM_EXT)),r===e.RED_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.R8UI),i===e.UNSIGNED_SHORT&&(l=e.R16UI),i===e.UNSIGNED_INT&&(l=e.R32UI),i===e.BYTE&&(l=e.R8I),i===e.SHORT&&(l=e.R16I),i===e.INT&&(l=e.R32I)),r===e.RG&&(i===e.FLOAT&&(l=e.RG32F),i===e.HALF_FLOAT&&(l=e.RG16F),i===e.UNSIGNED_BYTE&&(l=e.RG8),i===e.UNSIGNED_SHORT&&c&&(l=c.RG16_EXT),i===e.SHORT&&c&&(l=c.RG16_SNORM_EXT)),r===e.RG_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.RG8UI),i===e.UNSIGNED_SHORT&&(l=e.RG16UI),i===e.UNSIGNED_INT&&(l=e.RG32UI),i===e.BYTE&&(l=e.RG8I),i===e.SHORT&&(l=e.RG16I),i===e.INT&&(l=e.RG32I)),r===e.RGB_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.RGB8UI),i===e.UNSIGNED_SHORT&&(l=e.RGB16UI),i===e.UNSIGNED_INT&&(l=e.RGB32UI),i===e.BYTE&&(l=e.RGB8I),i===e.SHORT&&(l=e.RGB16I),i===e.INT&&(l=e.RGB32I)),r===e.RGBA_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.RGBA8UI),i===e.UNSIGNED_SHORT&&(l=e.RGBA16UI),i===e.UNSIGNED_INT&&(l=e.RGBA32UI),i===e.BYTE&&(l=e.RGBA8I),i===e.SHORT&&(l=e.RGBA16I),i===e.INT&&(l=e.RGBA32I)),r===e.RGB&&(i===e.UNSIGNED_SHORT&&c&&(l=c.RGB16_EXT),i===e.SHORT&&c&&(l=c.RGB16_SNORM_EXT),i===e.UNSIGNED_INT_5_9_9_9_REV&&(l=e.RGB9_E5),i===e.UNSIGNED_INT_10F_11F_11F_REV&&(l=e.R11F_G11F_B10F)),r===e.RGBA){let t=s?Ie:Nt.getTransfer(o);i===e.FLOAT&&(l=e.RGBA32F),i===e.HALF_FLOAT&&(l=e.RGBA16F),i===e.UNSIGNED_BYTE&&(l=t===`srgb`?e.SRGB8_ALPHA8:e.RGBA8),i===e.UNSIGNED_SHORT&&c&&(l=c.RGBA16_EXT),i===e.SHORT&&c&&(l=c.RGBA16_SNORM_EXT),i===e.UNSIGNED_SHORT_4_4_4_4&&(l=e.RGBA4),i===e.UNSIGNED_SHORT_5_5_5_1&&(l=e.RGB5_A1)}return(l===e.R16F||l===e.R32F||l===e.RG16F||l===e.RG32F||l===e.RGBA16F||l===e.RGBA32F)&&t.get(`EXT_color_buffer_float`),l}function j(t,n){let r;return t?n===null||n===1014||n===1020?r=e.DEPTH24_STENCIL8:n===1015?r=e.DEPTH32F_STENCIL8:n===1012&&(r=e.DEPTH24_STENCIL8,W(`DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.`)):n===null||n===1014||n===1020?r=e.DEPTH_COMPONENT24:n===1015?r=e.DEPTH_COMPONENT32F:n===1012&&(r=e.DEPTH_COMPONENT16),r}function M(e,t){return E(e)===!0||e.isFramebufferTexture&&e.minFilter!==1003&&e.minFilter!==1006?Math.log2(Math.max(t.width,t.height))+1:e.mipmaps!==void 0&&e.mipmaps.length>0?e.mipmaps.length:e.isCompressedTexture&&Array.isArray(e.image)?t.mipmaps.length:1}function N(e){let t=e.target;t.removeEventListener(`dispose`,N),F(t),t.isVideoTexture&&y.delete(t),t.isHTMLTexture&&b.delete(t)}function P(e){let t=e.target;t.removeEventListener(`dispose`,P),ee(t)}function F(e){let t=f.get(e);if(t.__webglInit===void 0)return;let n=e.source,r=S.get(n);if(r){let i=r[t.__cacheKey];i.usedTimes--,i.usedTimes===0&&I(e),Object.keys(r).length===0&&S.delete(n)}f.remove(e)}function I(t){let n=f.get(t);e.deleteTexture(n.__webglTexture);let r=t.source,i=S.get(r);delete i[n.__cacheKey],h.memory.textures--}function ee(t){let n=f.get(t);if(t.depthTexture&&(t.depthTexture.dispose(),f.remove(t.depthTexture)),t.isWebGLCubeRenderTarget)for(let t=0;t<6;t++){if(Array.isArray(n.__webglFramebuffer[t]))for(let r=0;r<n.__webglFramebuffer[t].length;r++)e.deleteFramebuffer(n.__webglFramebuffer[t][r]);else e.deleteFramebuffer(n.__webglFramebuffer[t]);n.__webglDepthbuffer&&e.deleteRenderbuffer(n.__webglDepthbuffer[t])}else{if(Array.isArray(n.__webglFramebuffer))for(let t=0;t<n.__webglFramebuffer.length;t++)e.deleteFramebuffer(n.__webglFramebuffer[t]);else e.deleteFramebuffer(n.__webglFramebuffer);if(n.__webglDepthbuffer&&e.deleteRenderbuffer(n.__webglDepthbuffer),n.__webglMultisampledFramebuffer&&e.deleteFramebuffer(n.__webglMultisampledFramebuffer),n.__webglColorRenderbuffer)for(let t=0;t<n.__webglColorRenderbuffer.length;t++)n.__webglColorRenderbuffer[t]&&e.deleteRenderbuffer(n.__webglColorRenderbuffer[t]);n.__webglDepthRenderbuffer&&e.deleteRenderbuffer(n.__webglDepthRenderbuffer)}let r=t.textures;for(let t=0,n=r.length;t<n;t++){let n=f.get(r[t]);n.__webglTexture&&(e.deleteTexture(n.__webglTexture),h.memory.textures--),f.remove(r[t])}f.remove(t)}let L=0;function te(){L=0}function R(){return L}function z(e){L=e}function ne(){let e=L;return e>=p.maxTextures&&W(`WebGLTextures: Trying to use `+e+` texture units while this GPU supports only `+p.maxTextures),L+=1,e}function re(e){let t=[];return t.push(e.wrapS),t.push(e.wrapT),t.push(e.wrapR||0),t.push(e.magFilter),t.push(e.minFilter),t.push(e.anisotropy),t.push(e.internalFormat),t.push(e.format),t.push(e.type),t.push(e.generateMipmaps),t.push(e.premultiplyAlpha),t.push(e.flipY),t.push(e.unpackAlignment),t.push(e.colorSpace),t.join()}function ie(t,n){let r=f.get(t);if(t.isVideoTexture&&Oe(t),t.isRenderTargetTexture===!1&&t.isExternalTexture!==!0&&t.version>0&&r.__version!==t.version){let e=t.image;if(e===null)W(`WebGLRenderer: Texture marked for update but no image data found.`);else if(e.complete===!1)W(`WebGLRenderer: Texture marked for update but image is incomplete`);else{he(r,t,n);return}}else t.isExternalTexture&&(r.__webglTexture=t.sourceTexture?t.sourceTexture:null);d.bindTexture(e.TEXTURE_2D,r.__webglTexture,e.TEXTURE0+n)}function ae(t,n){let r=f.get(t);if(t.isRenderTargetTexture===!1&&t.version>0&&r.__version!==t.version){he(r,t,n);return}else t.isExternalTexture&&(r.__webglTexture=t.sourceTexture?t.sourceTexture:null);d.bindTexture(e.TEXTURE_2D_ARRAY,r.__webglTexture,e.TEXTURE0+n)}function oe(t,n){let r=f.get(t);if(t.isRenderTargetTexture===!1&&t.version>0&&r.__version!==t.version){he(r,t,n);return}d.bindTexture(e.TEXTURE_3D,r.__webglTexture,e.TEXTURE0+n)}function se(t,n){let r=f.get(t);if(t.isCubeDepthTexture!==!0&&t.version>0&&r.__version!==t.version){ge(r,t,n);return}d.bindTexture(e.TEXTURE_CUBE_MAP,r.__webglTexture,e.TEXTURE0+n)}let ce={[n]:e.REPEAT,[r]:e.CLAMP_TO_EDGE,[i]:e.MIRRORED_REPEAT},le={[a]:e.NEAREST,[o]:e.NEAREST_MIPMAP_NEAREST,[s]:e.NEAREST_MIPMAP_LINEAR,[c]:e.LINEAR,[l]:e.LINEAR_MIPMAP_NEAREST,[u]:e.LINEAR_MIPMAP_LINEAR},ue={512:e.NEVER,519:e.ALWAYS,513:e.LESS,515:e.LEQUAL,514:e.EQUAL,518:e.GEQUAL,516:e.GREATER,517:e.NOTEQUAL};function de(n,r){if(r.type===1015&&t.has(`OES_texture_float_linear`)===!1&&(r.magFilter===1006||r.magFilter===1007||r.magFilter===1005||r.magFilter===1008||r.minFilter===1006||r.minFilter===1007||r.minFilter===1005||r.minFilter===1008)&&W(`WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device.`),e.texParameteri(n,e.TEXTURE_WRAP_S,ce[r.wrapS]),e.texParameteri(n,e.TEXTURE_WRAP_T,ce[r.wrapT]),(n===e.TEXTURE_3D||n===e.TEXTURE_2D_ARRAY)&&e.texParameteri(n,e.TEXTURE_WRAP_R,ce[r.wrapR]),e.texParameteri(n,e.TEXTURE_MAG_FILTER,le[r.magFilter]),e.texParameteri(n,e.TEXTURE_MIN_FILTER,le[r.minFilter]),r.compareFunction&&(e.texParameteri(n,e.TEXTURE_COMPARE_MODE,e.COMPARE_REF_TO_TEXTURE),e.texParameteri(n,e.TEXTURE_COMPARE_FUNC,ue[r.compareFunction])),t.has(`EXT_texture_filter_anisotropic`)===!0){if(r.magFilter===1003||r.minFilter!==1005&&r.minFilter!==1008||r.type===1015&&t.has(`OES_texture_float_linear`)===!1)return;if(r.anisotropy>1||f.get(r).__currentAnisotropy){let i=t.get(`EXT_texture_filter_anisotropic`);e.texParameterf(n,i.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(r.anisotropy,p.getMaxAnisotropy())),f.get(r).__currentAnisotropy=r.anisotropy}}}function fe(t,n){let r=!1;t.__webglInit===void 0&&(t.__webglInit=!0,n.addEventListener(`dispose`,N));let i=n.source,a=S.get(i);a===void 0&&(a={},S.set(i,a));let o=re(n);if(o!==t.__cacheKey){a[o]===void 0&&(a[o]={texture:e.createTexture(),usedTimes:0},h.memory.textures++,r=!0),a[o].usedTimes++;let i=a[t.__cacheKey];i!==void 0&&(a[t.__cacheKey].usedTimes--,i.usedTimes===0&&I(n)),t.__cacheKey=o,t.__webglTexture=a[o].texture}return r}function pe(e,t,n){return Math.floor(Math.floor(e/n)/t)}function me(t,n,r,i){let a=t.updateRanges;if(a.length===0)d.texSubImage2D(e.TEXTURE_2D,0,0,0,n.width,n.height,r,i,n.data);else{a.sort((e,t)=>e.start-t.start);let o=0;for(let e=1;e<a.length;e++){let t=a[o],r=a[e],i=t.start+t.count,s=pe(r.start,n.width,4),c=pe(t.start,n.width,4);r.start<=i+1&&s===c&&pe(r.start+r.count-1,n.width,4)===s?t.count=Math.max(t.count,r.start+r.count-t.start):(++o,a[o]=r)}a.length=o+1;let s=d.getParameter(e.UNPACK_ROW_LENGTH),c=d.getParameter(e.UNPACK_SKIP_PIXELS),l=d.getParameter(e.UNPACK_SKIP_ROWS);d.pixelStorei(e.UNPACK_ROW_LENGTH,n.width);for(let t=0,o=a.length;t<o;t++){let o=a[t],s=Math.floor(o.start/4),c=Math.ceil(o.count/4),l=s%n.width,u=Math.floor(s/n.width),f=c;d.pixelStorei(e.UNPACK_SKIP_PIXELS,l),d.pixelStorei(e.UNPACK_SKIP_ROWS,u),d.texSubImage2D(e.TEXTURE_2D,0,l,u,f,1,r,i,n.data)}t.clearUpdateRanges(),d.pixelStorei(e.UNPACK_ROW_LENGTH,s),d.pixelStorei(e.UNPACK_SKIP_PIXELS,c),d.pixelStorei(e.UNPACK_SKIP_ROWS,l)}}function he(t,n,r){let i=e.TEXTURE_2D;(n.isDataArrayTexture||n.isCompressedArrayTexture)&&(i=e.TEXTURE_2D_ARRAY),n.isData3DTexture&&(i=e.TEXTURE_3D);let a=fe(t,n),o=n.source;d.bindTexture(i,t.__webglTexture,e.TEXTURE0+r);let s=f.get(o);if(o.version!==s.__version||a===!0){if(d.activeTexture(e.TEXTURE0+r),!(typeof ImageBitmap<`u`&&n.image instanceof ImageBitmap)){let t=Nt.getPrimaries(Nt.workingColorSpace),r=n.colorSpace===``?null:Nt.getPrimaries(n.colorSpace),i=n.colorSpace===``||t===r?e.NONE:e.BROWSER_DEFAULT_WEBGL;d.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,n.flipY),d.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,n.premultiplyAlpha),d.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,i)}d.pixelStorei(e.UNPACK_ALIGNMENT,n.unpackAlignment);let t=T(n.image,!1,p.maxTextureSize);t=V(n,t);let c=m.convert(n.format,n.colorSpace),l=m.convert(n.type),u=A(n.internalFormat,c,l,n.normalized,n.colorSpace,n.isVideoTexture);de(i,n);let f,h=n.mipmaps,g=n.isVideoTexture!==!0,_=s.__version===void 0||a===!0,v=o.dataReady,y=M(n,t);if(n.isDepthTexture)u=j(n.format===O,n.type),_&&(g?d.texStorage2D(e.TEXTURE_2D,1,u,t.width,t.height):d.texImage2D(e.TEXTURE_2D,0,u,t.width,t.height,0,c,l,null));else if(n.isDataTexture)if(h.length>0){g&&_&&d.texStorage2D(e.TEXTURE_2D,y,u,h[0].width,h[0].height);for(let t=0,n=h.length;t<n;t++)f=h[t],g?v&&d.texSubImage2D(e.TEXTURE_2D,t,0,0,f.width,f.height,c,l,f.data):d.texImage2D(e.TEXTURE_2D,t,u,f.width,f.height,0,c,l,f.data);n.generateMipmaps=!1}else g?(_&&d.texStorage2D(e.TEXTURE_2D,y,u,t.width,t.height),v&&me(n,t,c,l)):d.texImage2D(e.TEXTURE_2D,0,u,t.width,t.height,0,c,l,t.data);else if(n.isCompressedTexture)if(n.isCompressedArrayTexture){g&&_&&d.texStorage3D(e.TEXTURE_2D_ARRAY,y,u,h[0].width,h[0].height,t.depth);for(let r=0,i=h.length;r<i;r++)if(f=h[r],n.format!==1023)if(c!==null)if(g){if(v)if(n.layerUpdates.size>0){let t=no(f.width,f.height,n.format,n.type);for(let i of n.layerUpdates){let n=f.data.subarray(i*t/f.data.BYTES_PER_ELEMENT,(i+1)*t/f.data.BYTES_PER_ELEMENT);d.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,r,0,0,i,f.width,f.height,1,c,n)}n.clearLayerUpdates()}else d.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,r,0,0,0,f.width,f.height,t.depth,c,f.data)}else d.compressedTexImage3D(e.TEXTURE_2D_ARRAY,r,u,f.width,f.height,t.depth,0,f.data,0,0);else W(`WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()`);else g?v&&d.texSubImage3D(e.TEXTURE_2D_ARRAY,r,0,0,0,f.width,f.height,t.depth,c,l,f.data):d.texImage3D(e.TEXTURE_2D_ARRAY,r,u,f.width,f.height,t.depth,0,c,l,f.data)}else{g&&_&&d.texStorage2D(e.TEXTURE_2D,y,u,h[0].width,h[0].height);for(let t=0,r=h.length;t<r;t++)f=h[t],n.format===1023?g?v&&d.texSubImage2D(e.TEXTURE_2D,t,0,0,f.width,f.height,c,l,f.data):d.texImage2D(e.TEXTURE_2D,t,u,f.width,f.height,0,c,l,f.data):c===null?W(`WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()`):g?v&&d.compressedTexSubImage2D(e.TEXTURE_2D,t,0,0,f.width,f.height,c,f.data):d.compressedTexImage2D(e.TEXTURE_2D,t,u,f.width,f.height,0,f.data)}else if(n.isDataArrayTexture)if(g){if(_&&d.texStorage3D(e.TEXTURE_2D_ARRAY,y,u,t.width,t.height,t.depth),v)if(n.layerUpdates.size>0){let r=no(t.width,t.height,n.format,n.type);for(let i of n.layerUpdates){let n=t.data.subarray(i*r/t.data.BYTES_PER_ELEMENT,(i+1)*r/t.data.BYTES_PER_ELEMENT);d.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,i,t.width,t.height,1,c,l,n)}n.clearLayerUpdates()}else d.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,0,t.width,t.height,t.depth,c,l,t.data)}else d.texImage3D(e.TEXTURE_2D_ARRAY,0,u,t.width,t.height,t.depth,0,c,l,t.data);else if(n.isData3DTexture)g?(_&&d.texStorage3D(e.TEXTURE_3D,y,u,t.width,t.height,t.depth),v&&d.texSubImage3D(e.TEXTURE_3D,0,0,0,0,t.width,t.height,t.depth,c,l,t.data)):d.texImage3D(e.TEXTURE_3D,0,u,t.width,t.height,t.depth,0,c,l,t.data);else if(n.isFramebufferTexture){if(_)if(g)d.texStorage2D(e.TEXTURE_2D,y,u,t.width,t.height);else{let n=t.width,r=t.height;for(let t=0;t<y;t++)d.texImage2D(e.TEXTURE_2D,t,u,n,r,0,c,l,null),n>>=1,r>>=1}}else if(n.isHTMLTexture){if(`texElementImage2D`in e){let r=e.canvas;if(r.hasAttribute(`layoutsubtree`)||r.setAttribute(`layoutsubtree`,`true`),t.parentNode!==r){r.appendChild(t),b.add(n),r.onpaint=e=>{let t=e.changedElements;for(let e of b)t.includes(e.image)&&(e.needsUpdate=!0)},r.requestPaint();return}let i=e.RGBA,a=e.RGBA,o=e.UNSIGNED_BYTE;e.texElementImage2D(e.TEXTURE_2D,0,i,a,o,t),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE)}}else if(h.length>0){if(g&&_){let t=ke(h[0]);d.texStorage2D(e.TEXTURE_2D,y,u,t.width,t.height)}for(let t=0,n=h.length;t<n;t++)f=h[t],g?v&&d.texSubImage2D(e.TEXTURE_2D,t,0,0,c,l,f):d.texImage2D(e.TEXTURE_2D,t,u,c,l,f);n.generateMipmaps=!1}else if(g){if(_){let n=ke(t);d.texStorage2D(e.TEXTURE_2D,y,u,n.width,n.height)}v&&d.texSubImage2D(e.TEXTURE_2D,0,0,0,c,l,t)}else d.texImage2D(e.TEXTURE_2D,0,u,c,l,t);E(n)&&D(i),s.__version=o.version,n.onUpdate&&n.onUpdate(n)}t.__version=n.version}function ge(t,n,r){if(n.image.length!==6)return;let i=fe(t,n),a=n.source;d.bindTexture(e.TEXTURE_CUBE_MAP,t.__webglTexture,e.TEXTURE0+r);let o=f.get(a);if(a.version!==o.__version||i===!0){d.activeTexture(e.TEXTURE0+r);let t=Nt.getPrimaries(Nt.workingColorSpace),s=n.colorSpace===``?null:Nt.getPrimaries(n.colorSpace),c=n.colorSpace===``||t===s?e.NONE:e.BROWSER_DEFAULT_WEBGL;d.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,n.flipY),d.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,n.premultiplyAlpha),d.pixelStorei(e.UNPACK_ALIGNMENT,n.unpackAlignment),d.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,c);let l=n.isCompressedTexture||n.image[0].isCompressedTexture,u=n.image[0]&&n.image[0].isDataTexture,f=[];for(let e=0;e<6;e++)!l&&!u?f[e]=T(n.image[e],!0,p.maxCubemapSize):f[e]=u?n.image[e].image:n.image[e],f[e]=V(n,f[e]);let h=f[0],g=m.convert(n.format,n.colorSpace),_=m.convert(n.type),v=A(n.internalFormat,g,_,n.normalized,n.colorSpace),y=n.isVideoTexture!==!0,b=o.__version===void 0||i===!0,x=a.dataReady,S=M(n,h);de(e.TEXTURE_CUBE_MAP,n);let C;if(l){y&&b&&d.texStorage2D(e.TEXTURE_CUBE_MAP,S,v,h.width,h.height);for(let t=0;t<6;t++){C=f[t].mipmaps;for(let r=0;r<C.length;r++){let i=C[r];n.format===1023?y?x&&d.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,0,0,i.width,i.height,g,_,i.data):d.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,v,i.width,i.height,0,g,_,i.data):g===null?W(`WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()`):y?x&&d.compressedTexSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,0,0,i.width,i.height,g,i.data):d.compressedTexImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,v,i.width,i.height,0,i.data)}}}else{if(C=n.mipmaps,y&&b){C.length>0&&S++;let t=ke(f[0]);d.texStorage2D(e.TEXTURE_CUBE_MAP,S,v,t.width,t.height)}for(let t=0;t<6;t++)if(u){y?x&&d.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,0,0,f[t].width,f[t].height,g,_,f[t].data):d.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,v,f[t].width,f[t].height,0,g,_,f[t].data);for(let n=0;n<C.length;n++){let r=C[n].image[t].image;y?x&&d.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,n+1,0,0,r.width,r.height,g,_,r.data):d.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,n+1,v,r.width,r.height,0,g,_,r.data)}}else{y?x&&d.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,0,0,g,_,f[t]):d.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,v,g,_,f[t]);for(let n=0;n<C.length;n++){let r=C[n];y?x&&d.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,n+1,0,0,g,_,r.image[t]):d.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,n+1,v,g,_,r.image[t])}}}E(n)&&D(e.TEXTURE_CUBE_MAP),o.__version=a.version,n.onUpdate&&n.onUpdate(n)}t.__version=n.version}function _e(t,n,r,i,a,o){let s=m.convert(r.format,r.colorSpace),c=m.convert(r.type),l=A(r.internalFormat,s,c,r.normalized,r.colorSpace),u=f.get(n),p=f.get(r);if(p.__renderTarget=n,!u.__hasExternalTextures){let t=Math.max(1,n.width>>o),r=Math.max(1,n.height>>o);a===e.TEXTURE_3D||a===e.TEXTURE_2D_ARRAY?d.texImage3D(a,o,l,t,r,n.depth,0,s,c,null):d.texImage2D(a,o,l,t,r,0,s,c,null)}d.bindFramebuffer(e.FRAMEBUFFER,t),De(n)?g.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,i,a,p.__webglTexture,0,Ee(n)):(a===e.TEXTURE_2D||a>=e.TEXTURE_CUBE_MAP_POSITIVE_X&&a<=e.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&e.framebufferTexture2D(e.FRAMEBUFFER,i,a,p.__webglTexture,o),d.bindFramebuffer(e.FRAMEBUFFER,null)}function ve(t,n,r){if(e.bindRenderbuffer(e.RENDERBUFFER,t),n.depthBuffer){let i=n.depthTexture,a=i&&i.isDepthTexture?i.type:null,o=j(n.stencilBuffer,a),s=n.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;De(n)?g.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,Ee(n),o,n.width,n.height):r?e.renderbufferStorageMultisample(e.RENDERBUFFER,Ee(n),o,n.width,n.height):e.renderbufferStorage(e.RENDERBUFFER,o,n.width,n.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,s,e.RENDERBUFFER,t)}else{let t=n.textures;for(let i=0;i<t.length;i++){let a=t[i],o=m.convert(a.format,a.colorSpace),s=m.convert(a.type),c=A(a.internalFormat,o,s,a.normalized,a.colorSpace);De(n)?g.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,Ee(n),c,n.width,n.height):r?e.renderbufferStorageMultisample(e.RENDERBUFFER,Ee(n),c,n.width,n.height):e.renderbufferStorage(e.RENDERBUFFER,c,n.width,n.height)}}e.bindRenderbuffer(e.RENDERBUFFER,null)}function ye(t,n,r){let i=n.isWebGLCubeRenderTarget===!0;if(d.bindFramebuffer(e.FRAMEBUFFER,t),!(n.depthTexture&&n.depthTexture.isDepthTexture))throw Error(`renderTarget.depthTexture must be an instance of THREE.DepthTexture`);let a=f.get(n.depthTexture);if(a.__renderTarget=n,(!a.__webglTexture||n.depthTexture.image.width!==n.width||n.depthTexture.image.height!==n.height)&&(n.depthTexture.image.width=n.width,n.depthTexture.image.height=n.height,n.depthTexture.needsUpdate=!0),i){if(a.__webglInit===void 0&&(a.__webglInit=!0,n.depthTexture.addEventListener(`dispose`,N)),a.__webglTexture===void 0){a.__webglTexture=e.createTexture(),d.bindTexture(e.TEXTURE_CUBE_MAP,a.__webglTexture),de(e.TEXTURE_CUBE_MAP,n.depthTexture);let t=m.convert(n.depthTexture.format),r=m.convert(n.depthTexture.type),i;n.depthTexture.format===1026?i=e.DEPTH_COMPONENT24:n.depthTexture.format===1027&&(i=e.DEPTH24_STENCIL8);for(let a=0;a<6;a++)e.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+a,0,i,n.width,n.height,0,t,r,null)}}else ie(n.depthTexture,0);let o=a.__webglTexture,s=Ee(n),c=i?e.TEXTURE_CUBE_MAP_POSITIVE_X+r:e.TEXTURE_2D,l=n.depthTexture.format===1027?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;if(n.depthTexture.format===1026)De(n)?g.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,l,c,o,0,s):e.framebufferTexture2D(e.FRAMEBUFFER,l,c,o,0);else if(n.depthTexture.format===1027)De(n)?g.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,l,c,o,0,s):e.framebufferTexture2D(e.FRAMEBUFFER,l,c,o,0);else throw Error(`Unknown depthTexture format`)}function be(t){let n=f.get(t),r=t.isWebGLCubeRenderTarget===!0;if(n.__boundDepthTexture!==t.depthTexture){let e=t.depthTexture;if(n.__depthDisposeCallback&&n.__depthDisposeCallback(),e){let t=()=>{delete n.__boundDepthTexture,delete n.__depthDisposeCallback,e.removeEventListener(`dispose`,t)};e.addEventListener(`dispose`,t),n.__depthDisposeCallback=t}n.__boundDepthTexture=e}if(t.depthTexture&&!n.__autoAllocateDepthBuffer)if(r)for(let e=0;e<6;e++)ye(n.__webglFramebuffer[e],t,e);else{let e=t.texture.mipmaps;e&&e.length>0?ye(n.__webglFramebuffer[0],t,0):ye(n.__webglFramebuffer,t,0)}else if(r){n.__webglDepthbuffer=[];for(let r=0;r<6;r++)if(d.bindFramebuffer(e.FRAMEBUFFER,n.__webglFramebuffer[r]),n.__webglDepthbuffer[r]===void 0)n.__webglDepthbuffer[r]=e.createRenderbuffer(),ve(n.__webglDepthbuffer[r],t,!1);else{let i=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,a=n.__webglDepthbuffer[r];e.bindRenderbuffer(e.RENDERBUFFER,a),e.framebufferRenderbuffer(e.FRAMEBUFFER,i,e.RENDERBUFFER,a)}}else{let r=t.texture.mipmaps;if(r&&r.length>0?d.bindFramebuffer(e.FRAMEBUFFER,n.__webglFramebuffer[0]):d.bindFramebuffer(e.FRAMEBUFFER,n.__webglFramebuffer),n.__webglDepthbuffer===void 0)n.__webglDepthbuffer=e.createRenderbuffer(),ve(n.__webglDepthbuffer,t,!1);else{let r=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,i=n.__webglDepthbuffer;e.bindRenderbuffer(e.RENDERBUFFER,i),e.framebufferRenderbuffer(e.FRAMEBUFFER,r,e.RENDERBUFFER,i)}}d.bindFramebuffer(e.FRAMEBUFFER,null)}function xe(t,n,r){let i=f.get(t);n!==void 0&&_e(i.__webglFramebuffer,t,t.texture,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,0),r!==void 0&&be(t)}function Se(t){let n=t.texture,r=f.get(t),i=f.get(n);t.addEventListener(`dispose`,P);let a=t.textures,o=t.isWebGLCubeRenderTarget===!0,s=a.length>1;if(s||(i.__webglTexture===void 0&&(i.__webglTexture=e.createTexture()),i.__version=n.version,h.memory.textures++),o){r.__webglFramebuffer=[];for(let t=0;t<6;t++)if(n.mipmaps&&n.mipmaps.length>0){r.__webglFramebuffer[t]=[];for(let i=0;i<n.mipmaps.length;i++)r.__webglFramebuffer[t][i]=e.createFramebuffer()}else r.__webglFramebuffer[t]=e.createFramebuffer()}else{if(n.mipmaps&&n.mipmaps.length>0){r.__webglFramebuffer=[];for(let t=0;t<n.mipmaps.length;t++)r.__webglFramebuffer[t]=e.createFramebuffer()}else r.__webglFramebuffer=e.createFramebuffer();if(s)for(let t=0,n=a.length;t<n;t++){let n=f.get(a[t]);n.__webglTexture===void 0&&(n.__webglTexture=e.createTexture(),h.memory.textures++)}if(t.samples>0&&De(t)===!1){r.__webglMultisampledFramebuffer=e.createFramebuffer(),r.__webglColorRenderbuffer=[],d.bindFramebuffer(e.FRAMEBUFFER,r.__webglMultisampledFramebuffer);for(let n=0;n<a.length;n++){let i=a[n];r.__webglColorRenderbuffer[n]=e.createRenderbuffer(),e.bindRenderbuffer(e.RENDERBUFFER,r.__webglColorRenderbuffer[n]);let o=m.convert(i.format,i.colorSpace),s=m.convert(i.type),c=A(i.internalFormat,o,s,i.normalized,i.colorSpace,t.isXRRenderTarget===!0),l=Ee(t);e.renderbufferStorageMultisample(e.RENDERBUFFER,l,c,t.width,t.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+n,e.RENDERBUFFER,r.__webglColorRenderbuffer[n])}e.bindRenderbuffer(e.RENDERBUFFER,null),t.depthBuffer&&(r.__webglDepthRenderbuffer=e.createRenderbuffer(),ve(r.__webglDepthRenderbuffer,t,!0)),d.bindFramebuffer(e.FRAMEBUFFER,null)}}if(o){d.bindTexture(e.TEXTURE_CUBE_MAP,i.__webglTexture),de(e.TEXTURE_CUBE_MAP,n);for(let i=0;i<6;i++)if(n.mipmaps&&n.mipmaps.length>0)for(let a=0;a<n.mipmaps.length;a++)_e(r.__webglFramebuffer[i][a],t,n,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+i,a);else _e(r.__webglFramebuffer[i],t,n,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+i,0);E(n)&&D(e.TEXTURE_CUBE_MAP),d.unbindTexture()}else if(s){for(let n=0,i=a.length;n<i;n++){let i=a[n],o=f.get(i),s=e.TEXTURE_2D;(t.isWebGL3DRenderTarget||t.isWebGLArrayRenderTarget)&&(s=t.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),d.bindTexture(s,o.__webglTexture),de(s,i),_e(r.__webglFramebuffer,t,i,e.COLOR_ATTACHMENT0+n,s,0),E(i)&&D(s)}d.unbindTexture()}else{let a=e.TEXTURE_2D;if((t.isWebGL3DRenderTarget||t.isWebGLArrayRenderTarget)&&(a=t.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),d.bindTexture(a,i.__webglTexture),de(a,n),n.mipmaps&&n.mipmaps.length>0)for(let i=0;i<n.mipmaps.length;i++)_e(r.__webglFramebuffer[i],t,n,e.COLOR_ATTACHMENT0,a,i);else _e(r.__webglFramebuffer,t,n,e.COLOR_ATTACHMENT0,a,0);E(n)&&D(a),d.unbindTexture()}t.depthBuffer&&be(t)}function Ce(e){let t=e.textures;for(let n=0,r=t.length;n<r;n++){let r=t[n];if(E(r)){let t=k(e),n=f.get(r).__webglTexture;d.bindTexture(t,n),D(t),d.unbindTexture()}}}let we=[],Te=[];function B(t){if(t.samples>0){if(De(t)===!1){let n=t.textures,r=t.width,i=t.height,a=e.COLOR_BUFFER_BIT,o=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,s=f.get(t),c=n.length>1;if(c)for(let t=0;t<n.length;t++)d.bindFramebuffer(e.FRAMEBUFFER,s.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.RENDERBUFFER,null),d.bindFramebuffer(e.FRAMEBUFFER,s.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.TEXTURE_2D,null,0);d.bindFramebuffer(e.READ_FRAMEBUFFER,s.__webglMultisampledFramebuffer);let l=t.texture.mipmaps;l&&l.length>0?d.bindFramebuffer(e.DRAW_FRAMEBUFFER,s.__webglFramebuffer[0]):d.bindFramebuffer(e.DRAW_FRAMEBUFFER,s.__webglFramebuffer);for(let l=0;l<n.length;l++){if(t.resolveDepthBuffer&&(t.depthBuffer&&(a|=e.DEPTH_BUFFER_BIT),t.stencilBuffer&&t.resolveStencilBuffer&&(a|=e.STENCIL_BUFFER_BIT)),c){e.framebufferRenderbuffer(e.READ_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.RENDERBUFFER,s.__webglColorRenderbuffer[l]);let t=f.get(n[l]).__webglTexture;e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,t,0)}e.blitFramebuffer(0,0,r,i,0,0,r,i,a,e.NEAREST),_===!0&&(we.length=0,Te.length=0,we.push(e.COLOR_ATTACHMENT0+l),t.depthBuffer&&t.resolveDepthBuffer===!1&&(we.push(o),Te.push(o),e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,Te)),e.invalidateFramebuffer(e.READ_FRAMEBUFFER,we))}if(d.bindFramebuffer(e.READ_FRAMEBUFFER,null),d.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),c)for(let t=0;t<n.length;t++){d.bindFramebuffer(e.FRAMEBUFFER,s.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.RENDERBUFFER,s.__webglColorRenderbuffer[t]);let r=f.get(n[t]).__webglTexture;d.bindFramebuffer(e.FRAMEBUFFER,s.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.TEXTURE_2D,r,0)}d.bindFramebuffer(e.DRAW_FRAMEBUFFER,s.__webglMultisampledFramebuffer)}else if(t.depthBuffer&&t.resolveDepthBuffer===!1&&_){let n=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,[n])}}}function Ee(e){return Math.min(p.maxSamples,e.samples)}function De(e){let n=f.get(e);return e.samples>0&&t.has(`WEBGL_multisampled_render_to_texture`)===!0&&n.__useRenderToTexture!==!1}function Oe(e){let t=h.render.frame;y.get(e)!==t&&(y.set(e,t),e.update())}function V(e,t){let n=e.colorSpace,r=e.format,i=e.type;return e.isCompressedTexture===!0||e.isVideoTexture===!0||n!==`srgb-linear`&&n!==``&&(Nt.getTransfer(n)===`srgb`?(r!==1023||i!==1009)&&W(`WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType.`):G(`WebGLTextures: Unsupported texture color space:`,n)),t}function ke(e){return typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement?(v.width=e.naturalWidth||e.width,v.height=e.naturalHeight||e.height):typeof VideoFrame<`u`&&e instanceof VideoFrame?(v.width=e.displayWidth,v.height=e.displayHeight):(v.width=e.width,v.height=e.height),v}this.allocateTextureUnit=ne,this.resetTextureUnits=te,this.getTextureUnits=R,this.setTextureUnits=z,this.setTexture2D=ie,this.setTexture2DArray=ae,this.setTexture3D=oe,this.setTextureCube=se,this.rebindTextures=xe,this.setupRenderTarget=Se,this.updateRenderTargetMipmap=Ce,this.updateMultisampleRenderTarget=B,this.setupDepthRenderbuffer=be,this.setupFrameBufferTexture=_e,this.useMultisampledRTT=De,this.isReversedDepthBuffer=function(){return d.buffers.depth.getReversed()}}function cl(e,t){function n(n,r=``){let i,a=Nt.getTransfer(r);if(n===1009)return e.UNSIGNED_BYTE;if(n===1017)return e.UNSIGNED_SHORT_4_4_4_4;if(n===1018)return e.UNSIGNED_SHORT_5_5_5_1;if(n===35902)return e.UNSIGNED_INT_5_9_9_9_REV;if(n===35899)return e.UNSIGNED_INT_10F_11F_11F_REV;if(n===1010)return e.BYTE;if(n===1011)return e.SHORT;if(n===1012)return e.UNSIGNED_SHORT;if(n===1013)return e.INT;if(n===1014)return e.UNSIGNED_INT;if(n===1015)return e.FLOAT;if(n===1016)return e.HALF_FLOAT;if(n===1021)return e.ALPHA;if(n===1022)return e.RGB;if(n===1023)return e.RGBA;if(n===1026)return e.DEPTH_COMPONENT;if(n===1027)return e.DEPTH_STENCIL;if(n===1028)return e.RED;if(n===1029)return e.RED_INTEGER;if(n===1030)return e.RG;if(n===1031)return e.RG_INTEGER;if(n===1033)return e.RGBA_INTEGER;if(n===33776||n===33777||n===33778||n===33779)if(a===`srgb`)if(i=t.get(`WEBGL_compressed_texture_s3tc_srgb`),i!==null){if(n===33776)return i.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===33777)return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===33778)return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===33779)return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(i=t.get(`WEBGL_compressed_texture_s3tc`),i!==null){if(n===33776)return i.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===33777)return i.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===33778)return i.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===33779)return i.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===35840||n===35841||n===35842||n===35843)if(i=t.get(`WEBGL_compressed_texture_pvrtc`),i!==null){if(n===35840)return i.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===35841)return i.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===35842)return i.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===35843)return i.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===36196||n===37492||n===37496||n===37488||n===37489||n===37490||n===37491)if(i=t.get(`WEBGL_compressed_texture_etc`),i!==null){if(n===36196||n===37492)return a===`srgb`?i.COMPRESSED_SRGB8_ETC2:i.COMPRESSED_RGB8_ETC2;if(n===37496)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:i.COMPRESSED_RGBA8_ETC2_EAC;if(n===37488)return i.COMPRESSED_R11_EAC;if(n===37489)return i.COMPRESSED_SIGNED_R11_EAC;if(n===37490)return i.COMPRESSED_RG11_EAC;if(n===37491)return i.COMPRESSED_SIGNED_RG11_EAC}else return null;if(n===37808||n===37809||n===37810||n===37811||n===37812||n===37813||n===37814||n===37815||n===37816||n===37817||n===37818||n===37819||n===37820||n===37821)if(i=t.get(`WEBGL_compressed_texture_astc`),i!==null){if(n===37808)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:i.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===37809)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:i.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===37810)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:i.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===37811)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:i.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===37812)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:i.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===37813)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:i.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===37814)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:i.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===37815)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:i.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===37816)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:i.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===37817)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:i.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===37818)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:i.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===37819)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:i.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===37820)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:i.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===37821)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:i.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===36492||n===36494||n===36495)if(i=t.get(`EXT_texture_compression_bptc`),i!==null){if(n===36492)return a===`srgb`?i.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:i.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===36494)return i.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===36495)return i.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===36283||n===36284||n===36285||n===36286)if(i=t.get(`EXT_texture_compression_rgtc`),i!==null){if(n===36283)return i.COMPRESSED_RED_RGTC1_EXT;if(n===36284)return i.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===36285)return i.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===36286)return i.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===1020?e.UNSIGNED_INT_24_8:e[n]===void 0?null:e[n]}return{convert:n}}var ll=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,ul=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`,dl=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){let n=new Mi(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=n}}getMesh(e){if(this.texture!==null&&this.mesh===null){let t=e.cameras[0].viewport,n=new Ji({vertexShader:ll,fragmentShader:ul,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new Yr(new zi(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},fl=class extends $e{constructor(e,t){super();let n=this,r=null,i=1,a=null,o=`local-floor`,s=1,c=null,l=null,u=null,f=null,p=null,m=null,h=typeof XRWebGLBinding<`u`,_=new dl,v={},y=t.getContextAttributes(),b=null,S=null,C=[],w=[],T=new q,k=null,A=new Aa;A.viewport=new Wt;let j=new Aa;j.viewport=new Wt;let M=[A,j],N=new Ba,P=null,F=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(e){let t=C[e];return t===void 0&&(t=new En,C[e]=t),t.getTargetRaySpace()},this.getControllerGrip=function(e){let t=C[e];return t===void 0&&(t=new En,C[e]=t),t.getGripSpace()},this.getHand=function(e){let t=C[e];return t===void 0&&(t=new En,C[e]=t),t.getHandSpace()};function I(e){let t=w.indexOf(e.inputSource);if(t===-1)return;let n=C[t];n!==void 0&&(n.update(e.inputSource,e.frame,c||a),n.dispatchEvent({type:e.type,data:e.inputSource}))}function ee(){r.removeEventListener(`select`,I),r.removeEventListener(`selectstart`,I),r.removeEventListener(`selectend`,I),r.removeEventListener(`squeeze`,I),r.removeEventListener(`squeezestart`,I),r.removeEventListener(`squeezeend`,I),r.removeEventListener(`end`,ee),r.removeEventListener(`inputsourceschange`,L);for(let e=0;e<C.length;e++){let t=w[e];t!==null&&(w[e]=null,C[e].disconnect(t))}P=null,F=null,_.reset();for(let e in v)delete v[e];e.setRenderTarget(b),p=null,f=null,u=null,r=null,S=null,oe.stop(),n.isPresenting=!1,e.setPixelRatio(k),e.setSize(T.width,T.height,!1),n.dispatchEvent({type:`sessionend`})}this.setFramebufferScaleFactor=function(e){i=e,n.isPresenting===!0&&W(`WebXRManager: Cannot change framebuffer scale while presenting.`)},this.setReferenceSpaceType=function(e){o=e,n.isPresenting===!0&&W(`WebXRManager: Cannot change reference space type while presenting.`)},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(e){c=e},this.getBaseLayer=function(){return f===null?p:f},this.getBinding=function(){return u===null&&h&&(u=new XRWebGLBinding(r,t)),u},this.getFrame=function(){return m},this.getSession=function(){return r},this.setSession=async function(l){if(r=l,r!==null){if(b=e.getRenderTarget(),r.addEventListener(`select`,I),r.addEventListener(`selectstart`,I),r.addEventListener(`selectend`,I),r.addEventListener(`squeeze`,I),r.addEventListener(`squeezestart`,I),r.addEventListener(`squeezeend`,I),r.addEventListener(`end`,ee),r.addEventListener(`inputsourceschange`,L),y.xrCompatible!==!0&&await t.makeXRCompatible(),k=e.getPixelRatio(),e.getSize(T),h&&`createProjectionLayer`in XRWebGLBinding.prototype){let n=null,a=null,o=null;y.depth&&(o=y.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,n=y.stencil?O:D,a=y.stencil?x:g);let s={colorFormat:t.RGBA8,depthFormat:o,scaleFactor:i};u=this.getBinding(),f=u.createProjectionLayer(s),r.updateRenderState({layers:[f]}),e.setPixelRatio(1),e.setSize(f.textureWidth,f.textureHeight,!1),S=new Kt(f.textureWidth,f.textureHeight,{format:E,type:d,depthTexture:new Ai(f.textureWidth,f.textureHeight,a,void 0,void 0,void 0,void 0,void 0,void 0,n),stencilBuffer:y.stencil,colorSpace:e.outputColorSpace,samples:y.antialias?4:0,resolveDepthBuffer:f.ignoreDepthValues===!1,resolveStencilBuffer:f.ignoreDepthValues===!1})}else{let n={antialias:y.antialias,alpha:!0,depth:y.depth,stencil:y.stencil,framebufferScaleFactor:i};p=new XRWebGLLayer(r,t,n),r.updateRenderState({baseLayer:p}),e.setPixelRatio(1),e.setSize(p.framebufferWidth,p.framebufferHeight,!1),S=new Kt(p.framebufferWidth,p.framebufferHeight,{format:E,type:d,colorSpace:e.outputColorSpace,stencilBuffer:y.stencil,resolveDepthBuffer:p.ignoreDepthValues===!1,resolveStencilBuffer:p.ignoreDepthValues===!1})}S.isXRRenderTarget=!0,this.setFoveation(s),c=null,a=await r.requestReferenceSpace(o),oe.setContext(r),oe.start(),n.isPresenting=!0,n.dispatchEvent({type:`sessionstart`})}},this.getEnvironmentBlendMode=function(){if(r!==null)return r.environmentBlendMode},this.getDepthTexture=function(){return _.getDepthTexture()};function L(e){for(let t=0;t<e.removed.length;t++){let n=e.removed[t],r=w.indexOf(n);r>=0&&(w[r]=null,C[r].disconnect(n))}for(let t=0;t<e.added.length;t++){let n=e.added[t],r=w.indexOf(n);if(r===-1){for(let e=0;e<C.length;e++)if(e>=w.length){w.push(n),r=e;break}else if(w[e]===null){w[e]=n,r=e;break}if(r===-1)break}let i=C[r];i&&i.connect(n)}}let te=new J,R=new J;function z(e,t,n){te.setFromMatrixPosition(t.matrixWorld),R.setFromMatrixPosition(n.matrixWorld);let r=te.distanceTo(R),i=t.projectionMatrix.elements,a=n.projectionMatrix.elements,o=i[14]/(i[10]-1),s=i[14]/(i[10]+1),c=(i[9]+1)/i[5],l=(i[9]-1)/i[5],u=(i[8]-1)/i[0],d=(a[8]+1)/a[0],f=o*u,p=o*d,m=r/(-u+d),h=m*-u;if(t.matrixWorld.decompose(e.position,e.quaternion,e.scale),e.translateX(h),e.translateZ(m),e.matrixWorld.compose(e.position,e.quaternion,e.scale),e.matrixWorldInverse.copy(e.matrixWorld).invert(),i[10]===-1)e.projectionMatrix.copy(t.projectionMatrix),e.projectionMatrixInverse.copy(t.projectionMatrixInverse);else{let t=o+m,n=s+m,i=f-h,a=p+(r-h),u=c*s/n*t,d=l*s/n*t;e.projectionMatrix.makePerspective(i,a,u,d,t,n),e.projectionMatrixInverse.copy(e.projectionMatrix).invert()}}function ne(e,t){t===null?e.matrixWorld.copy(e.matrix):e.matrixWorld.multiplyMatrices(t.matrixWorld,e.matrix),e.matrixWorldInverse.copy(e.matrixWorld).invert()}this.updateCamera=function(e){if(r===null)return;let t=e.near,n=e.far;_.texture!==null&&(_.depthNear>0&&(t=_.depthNear),_.depthFar>0&&(n=_.depthFar)),N.near=j.near=A.near=t,N.far=j.far=A.far=n,(P!==N.near||F!==N.far)&&(r.updateRenderState({depthNear:N.near,depthFar:N.far}),P=N.near,F=N.far),N.layers.mask=e.layers.mask|6,A.layers.mask=N.layers.mask&-5,j.layers.mask=N.layers.mask&-3;let i=e.parent,a=N.cameras;ne(N,i);for(let e=0;e<a.length;e++)ne(a[e],i);a.length===2?z(N,A,j):N.projectionMatrix.copy(A.projectionMatrix),re(e,N,i)};function re(e,t,n){n===null?e.matrix.copy(t.matrixWorld):(e.matrix.copy(n.matrixWorld),e.matrix.invert(),e.matrix.multiply(t.matrixWorld)),e.matrix.decompose(e.position,e.quaternion,e.scale),e.updateMatrixWorld(!0),e.projectionMatrix.copy(t.projectionMatrix),e.projectionMatrixInverse.copy(t.projectionMatrixInverse),e.isPerspectiveCamera&&(e.fov=rt*2*Math.atan(1/e.projectionMatrix.elements[5]),e.zoom=1)}this.getCamera=function(){return N},this.getFoveation=function(){if(!(f===null&&p===null))return s},this.setFoveation=function(e){s=e,f!==null&&(f.fixedFoveation=e),p!==null&&p.fixedFoveation!==void 0&&(p.fixedFoveation=e)},this.hasDepthSensing=function(){return _.texture!==null},this.getDepthSensingMesh=function(){return _.getMesh(N)},this.getCameraTexture=function(e){return v[e]};let ie=null;function ae(t,i){if(l=i.getViewerPose(c||a),m=i,l!==null){let t=l.views;p!==null&&(e.setRenderTargetFramebuffer(S,p.framebuffer),e.setRenderTarget(S));let i=!1;t.length!==N.cameras.length&&(N.cameras.length=0,i=!0);for(let n=0;n<t.length;n++){let r=t[n],a=null;if(p!==null)a=p.getViewport(r);else{let t=u.getViewSubImage(f,r);a=t.viewport,n===0&&(e.setRenderTargetTextures(S,t.colorTexture,t.depthStencilTexture),e.setRenderTarget(S))}let o=M[n];o===void 0&&(o=new Aa,o.layers.enable(n),o.viewport=new Wt,M[n]=o),o.matrix.fromArray(r.transform.matrix),o.matrix.decompose(o.position,o.quaternion,o.scale),o.projectionMatrix.fromArray(r.projectionMatrix),o.projectionMatrixInverse.copy(o.projectionMatrix).invert(),o.viewport.set(a.x,a.y,a.width,a.height),n===0&&(N.matrix.copy(o.matrix),N.matrix.decompose(N.position,N.quaternion,N.scale)),i===!0&&N.cameras.push(o)}let a=r.enabledFeatures;if(a&&a.includes(`depth-sensing`)&&r.depthUsage==`gpu-optimized`&&h){u=n.getBinding();let e=u.getDepthInformation(t[0]);e&&e.isValid&&e.texture&&_.init(e,r.renderState)}if(a&&a.includes(`camera-access`)&&h){e.state.unbindTexture(),u=n.getBinding();for(let e=0;e<t.length;e++){let n=t[e].camera;if(n){let e=v[n];e||(e=new Mi,v[n]=e);let t=u.getCameraImage(n);e.sourceTexture=t}}}}for(let e=0;e<C.length;e++){let t=w[e],n=C[e];t!==null&&n!==void 0&&n.update(t,i,c||a)}ie&&ie(t,i),i.detectedPlanes&&n.dispatchEvent({type:`planesdetected`,data:i}),m=null}let oe=new io;oe.setAnimationLoop(ae),this.setAnimationLoop=function(e){ie=e},this.dispose=function(){}}},pl=new Yt,ml=new Y;ml.set(-1,0,0,0,1,0,0,0,1);function hl(e,t){function n(e,t){e.matrixAutoUpdate===!0&&e.updateMatrix(),t.value.copy(e.matrix)}function r(t,n){n.color.getRGB(t.fogColor.value,Wi(e)),n.isFog?(t.fogNear.value=n.near,t.fogFar.value=n.far):n.isFogExp2&&(t.fogDensity.value=n.density)}function i(e,t,n,r,i){t.isNodeMaterial?t.uniformsNeedUpdate=!1:t.isMeshBasicMaterial?a(e,t):t.isMeshLambertMaterial?(a(e,t),t.envMap&&(e.envMapIntensity.value=t.envMapIntensity)):t.isMeshToonMaterial?(a(e,t),d(e,t)):t.isMeshPhongMaterial?(a(e,t),u(e,t),t.envMap&&(e.envMapIntensity.value=t.envMapIntensity)):t.isMeshStandardMaterial?(a(e,t),f(e,t),t.isMeshPhysicalMaterial&&p(e,t,i)):t.isMeshMatcapMaterial?(a(e,t),m(e,t)):t.isMeshDepthMaterial?a(e,t):t.isMeshDistanceMaterial?(a(e,t),h(e,t)):t.isMeshNormalMaterial?a(e,t):t.isLineBasicMaterial?(o(e,t),t.isLineDashedMaterial&&s(e,t)):t.isPointsMaterial?c(e,t,n,r):t.isSpriteMaterial?l(e,t):t.isShadowMaterial?(e.color.value.copy(t.color),e.opacity.value=t.opacity):t.isShaderMaterial&&(t.uniformsNeedUpdate=!1)}function a(e,r){e.opacity.value=r.opacity,r.color&&e.diffuse.value.copy(r.color),r.emissive&&e.emissive.value.copy(r.emissive).multiplyScalar(r.emissiveIntensity),r.map&&(e.map.value=r.map,n(r.map,e.mapTransform)),r.alphaMap&&(e.alphaMap.value=r.alphaMap,n(r.alphaMap,e.alphaMapTransform)),r.bumpMap&&(e.bumpMap.value=r.bumpMap,n(r.bumpMap,e.bumpMapTransform),e.bumpScale.value=r.bumpScale,r.side===1&&(e.bumpScale.value*=-1)),r.normalMap&&(e.normalMap.value=r.normalMap,n(r.normalMap,e.normalMapTransform),e.normalScale.value.copy(r.normalScale),r.side===1&&e.normalScale.value.negate()),r.displacementMap&&(e.displacementMap.value=r.displacementMap,n(r.displacementMap,e.displacementMapTransform),e.displacementScale.value=r.displacementScale,e.displacementBias.value=r.displacementBias),r.emissiveMap&&(e.emissiveMap.value=r.emissiveMap,n(r.emissiveMap,e.emissiveMapTransform)),r.specularMap&&(e.specularMap.value=r.specularMap,n(r.specularMap,e.specularMapTransform)),r.alphaTest>0&&(e.alphaTest.value=r.alphaTest);let i=t.get(r),a=i.envMap,o=i.envMapRotation;a&&(e.envMap.value=a,e.envMapRotation.value.setFromMatrix4(pl.makeRotationFromEuler(o)).transpose(),a.isCubeTexture&&a.isRenderTargetTexture===!1&&e.envMapRotation.value.premultiply(ml),e.reflectivity.value=r.reflectivity,e.ior.value=r.ior,e.refractionRatio.value=r.refractionRatio),r.lightMap&&(e.lightMap.value=r.lightMap,e.lightMapIntensity.value=r.lightMapIntensity,n(r.lightMap,e.lightMapTransform)),r.aoMap&&(e.aoMap.value=r.aoMap,e.aoMapIntensity.value=r.aoMapIntensity,n(r.aoMap,e.aoMapTransform))}function o(e,t){e.diffuse.value.copy(t.color),e.opacity.value=t.opacity,t.map&&(e.map.value=t.map,n(t.map,e.mapTransform))}function s(e,t){e.dashSize.value=t.dashSize,e.totalSize.value=t.dashSize+t.gapSize,e.scale.value=t.scale}function c(e,t,r,i){e.diffuse.value.copy(t.color),e.opacity.value=t.opacity,e.size.value=t.size*r,e.scale.value=i*.5,t.map&&(e.map.value=t.map,n(t.map,e.uvTransform)),t.alphaMap&&(e.alphaMap.value=t.alphaMap,n(t.alphaMap,e.alphaMapTransform)),t.alphaTest>0&&(e.alphaTest.value=t.alphaTest)}function l(e,t){e.diffuse.value.copy(t.color),e.opacity.value=t.opacity,e.rotation.value=t.rotation,t.map&&(e.map.value=t.map,n(t.map,e.mapTransform)),t.alphaMap&&(e.alphaMap.value=t.alphaMap,n(t.alphaMap,e.alphaMapTransform)),t.alphaTest>0&&(e.alphaTest.value=t.alphaTest)}function u(e,t){e.specular.value.copy(t.specular),e.shininess.value=Math.max(t.shininess,1e-4)}function d(e,t){t.gradientMap&&(e.gradientMap.value=t.gradientMap)}function f(e,t){e.metalness.value=t.metalness,t.metalnessMap&&(e.metalnessMap.value=t.metalnessMap,n(t.metalnessMap,e.metalnessMapTransform)),e.roughness.value=t.roughness,t.roughnessMap&&(e.roughnessMap.value=t.roughnessMap,n(t.roughnessMap,e.roughnessMapTransform)),t.envMap&&(e.envMapIntensity.value=t.envMapIntensity)}function p(e,t,r){e.ior.value=t.ior,t.sheen>0&&(e.sheenColor.value.copy(t.sheenColor).multiplyScalar(t.sheen),e.sheenRoughness.value=t.sheenRoughness,t.sheenColorMap&&(e.sheenColorMap.value=t.sheenColorMap,n(t.sheenColorMap,e.sheenColorMapTransform)),t.sheenRoughnessMap&&(e.sheenRoughnessMap.value=t.sheenRoughnessMap,n(t.sheenRoughnessMap,e.sheenRoughnessMapTransform))),t.clearcoat>0&&(e.clearcoat.value=t.clearcoat,e.clearcoatRoughness.value=t.clearcoatRoughness,t.clearcoatMap&&(e.clearcoatMap.value=t.clearcoatMap,n(t.clearcoatMap,e.clearcoatMapTransform)),t.clearcoatRoughnessMap&&(e.clearcoatRoughnessMap.value=t.clearcoatRoughnessMap,n(t.clearcoatRoughnessMap,e.clearcoatRoughnessMapTransform)),t.clearcoatNormalMap&&(e.clearcoatNormalMap.value=t.clearcoatNormalMap,n(t.clearcoatNormalMap,e.clearcoatNormalMapTransform),e.clearcoatNormalScale.value.copy(t.clearcoatNormalScale),t.side===1&&e.clearcoatNormalScale.value.negate())),t.dispersion>0&&(e.dispersion.value=t.dispersion),t.iridescence>0&&(e.iridescence.value=t.iridescence,e.iridescenceIOR.value=t.iridescenceIOR,e.iridescenceThicknessMinimum.value=t.iridescenceThicknessRange[0],e.iridescenceThicknessMaximum.value=t.iridescenceThicknessRange[1],t.iridescenceMap&&(e.iridescenceMap.value=t.iridescenceMap,n(t.iridescenceMap,e.iridescenceMapTransform)),t.iridescenceThicknessMap&&(e.iridescenceThicknessMap.value=t.iridescenceThicknessMap,n(t.iridescenceThicknessMap,e.iridescenceThicknessMapTransform))),t.transmission>0&&(e.transmission.value=t.transmission,e.transmissionSamplerMap.value=r.texture,e.transmissionSamplerSize.value.set(r.width,r.height),t.transmissionMap&&(e.transmissionMap.value=t.transmissionMap,n(t.transmissionMap,e.transmissionMapTransform)),e.thickness.value=t.thickness,t.thicknessMap&&(e.thicknessMap.value=t.thicknessMap,n(t.thicknessMap,e.thicknessMapTransform)),e.attenuationDistance.value=t.attenuationDistance,e.attenuationColor.value.copy(t.attenuationColor)),t.anisotropy>0&&(e.anisotropyVector.value.set(t.anisotropy*Math.cos(t.anisotropyRotation),t.anisotropy*Math.sin(t.anisotropyRotation)),t.anisotropyMap&&(e.anisotropyMap.value=t.anisotropyMap,n(t.anisotropyMap,e.anisotropyMapTransform))),e.specularIntensity.value=t.specularIntensity,e.specularColor.value.copy(t.specularColor),t.specularColorMap&&(e.specularColorMap.value=t.specularColorMap,n(t.specularColorMap,e.specularColorMapTransform)),t.specularIntensityMap&&(e.specularIntensityMap.value=t.specularIntensityMap,n(t.specularIntensityMap,e.specularIntensityMapTransform))}function m(e,t){t.matcap&&(e.matcap.value=t.matcap)}function h(e,n){let r=t.get(n).light;e.referencePosition.value.setFromMatrixPosition(r.matrixWorld),e.nearDistance.value=r.shadow.camera.near,e.farDistance.value=r.shadow.camera.far}return{refreshFogUniforms:r,refreshMaterialUniforms:i}}function gl(e,t,n,r){let i={},a={},o=[],s=e.getParameter(e.MAX_UNIFORM_BUFFER_BINDINGS);function c(e,t){let n=t.program;r.uniformBlockBinding(e,n)}function l(e,n){let o=i[e.id];o===void 0&&(m(e),o=u(e),i[e.id]=o,e.addEventListener(`dispose`,g));let s=n.program;r.updateUBOMapping(e,s);let c=t.render.frame;a[e.id]!==c&&(f(e),a[e.id]=c)}function u(t){let n=d();t.__bindingPointIndex=n;let r=e.createBuffer(),i=t.__size,a=t.usage;return e.bindBuffer(e.UNIFORM_BUFFER,r),e.bufferData(e.UNIFORM_BUFFER,i,a),e.bindBuffer(e.UNIFORM_BUFFER,null),e.bindBufferBase(e.UNIFORM_BUFFER,n,r),r}function d(){for(let e=0;e<s;e++)if(o.indexOf(e)===-1)return o.push(e),e;return G(`WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached.`),0}function f(t){let n=i[t.id],r=t.uniforms,a=t.__cache;e.bindBuffer(e.UNIFORM_BUFFER,n);for(let t=0,n=r.length;t<n;t++){let n=Array.isArray(r[t])?r[t]:[r[t]];for(let r=0,i=n.length;r<i;r++){let i=n[r];if(p(i,t,r,a)===!0){let t=i.__offset,n=Array.isArray(i.value)?i.value:[i.value],r=0;for(let a=0;a<n.length;a++){let o=n[a],s=h(o);typeof o==`number`||typeof o==`boolean`?(i.__data[0]=o,e.bufferSubData(e.UNIFORM_BUFFER,t+r,i.__data)):o.isMatrix3?(i.__data[0]=o.elements[0],i.__data[1]=o.elements[1],i.__data[2]=o.elements[2],i.__data[3]=0,i.__data[4]=o.elements[3],i.__data[5]=o.elements[4],i.__data[6]=o.elements[5],i.__data[7]=0,i.__data[8]=o.elements[6],i.__data[9]=o.elements[7],i.__data[10]=o.elements[8],i.__data[11]=0):ArrayBuffer.isView(o)?i.__data.set(new o.constructor(o.buffer,o.byteOffset,i.__data.length)):(o.toArray(i.__data,r),r+=s.storage/Float32Array.BYTES_PER_ELEMENT)}e.bufferSubData(e.UNIFORM_BUFFER,t,i.__data)}}}e.bindBuffer(e.UNIFORM_BUFFER,null)}function p(e,t,n,r){let i=e.value,a=t+`_`+n;if(r[a]===void 0)return typeof i==`number`||typeof i==`boolean`?r[a]=i:ArrayBuffer.isView(i)?r[a]=i.slice():r[a]=i.clone(),!0;{let e=r[a];if(typeof i==`number`||typeof i==`boolean`){if(e!==i)return r[a]=i,!0}else if(ArrayBuffer.isView(i))return!0;else if(e.equals(i)===!1)return e.copy(i),!0}return!1}function m(e){let t=e.uniforms,n=0;for(let e=0,r=t.length;e<r;e++){let r=Array.isArray(t[e])?t[e]:[t[e]];for(let e=0,t=r.length;e<t;e++){let t=r[e],i=Array.isArray(t.value)?t.value:[t.value];for(let e=0,r=i.length;e<r;e++){let r=i[e],a=h(r),o=n%16,s=o%a.boundary,c=o+s;n+=s,c!==0&&16-c<a.storage&&(n+=16-c),t.__data=new Float32Array(a.storage/Float32Array.BYTES_PER_ELEMENT),t.__offset=n,n+=a.storage}}}let r=n%16;return r>0&&(n+=16-r),e.__size=n,e.__cache={},this}function h(e){let t={boundary:0,storage:0};return typeof e==`number`||typeof e==`boolean`?(t.boundary=4,t.storage=4):e.isVector2?(t.boundary=8,t.storage=8):e.isVector3||e.isColor?(t.boundary=16,t.storage=12):e.isVector4?(t.boundary=16,t.storage=16):e.isMatrix3?(t.boundary=48,t.storage=48):e.isMatrix4?(t.boundary=64,t.storage=64):e.isTexture?W(`WebGLRenderer: Texture samplers can not be part of an uniforms group.`):ArrayBuffer.isView(e)?(t.boundary=16,t.storage=e.byteLength):W(`WebGLRenderer: Unsupported uniform value type.`,e),t}function g(t){let n=t.target;n.removeEventListener(`dispose`,g);let r=o.indexOf(n.__bindingPointIndex);o.splice(r,1),e.deleteBuffer(i[n.id]),delete i[n.id],delete a[n.id]}function _(){for(let t in i)e.deleteBuffer(i[t]);o=[],i={},a={}}return{bind:c,update:l,dispose:_}}var _l=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),vl=null;function yl(){return vl===null&&(vl=new Qr(_l,16,16,j,v),vl.name=`DFG_LUT`,vl.minFilter=c,vl.magFilter=c,vl.wrapS=r,vl.wrapT=r,vl.generateMipmaps=!1,vl.needsUpdate=!0),vl}var bl=class{constructor(e={}){let{canvas:t=Ge(),context:n=null,depth:r=!0,stencil:i=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:s=!0,preserveDrawingBuffer:c=!1,powerPreference:l=`default`,failIfMajorPerformanceCaveat:f=!1,reversedDepthBuffer:p=!1,outputBufferType:h=d}=e;this.isWebGLRenderer=!0;let _;if(n!==null){if(typeof WebGLRenderingContext<`u`&&n instanceof WebGLRenderingContext)throw Error(`THREE.WebGLRenderer: WebGL 1 is not supported since r163.`);_=n.getContextAttributes().alpha}else _=a;let S=h,C=new Set([N,M,A]),w=new Set([d,g,m,x,y,b]),T=new Uint32Array(4),E=new Int32Array(4),D=new J,O=null,k=null,j=[],P=[],F=null;this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=0,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let I=this,ee=!1,L=null;this._outputColorSpace=Pe;let te=0,R=0,z=null,ne=-1,re=null,ie=new Wt,ae=new Wt,oe=null,se=new X(0),ce=0,le=t.width,ue=t.height,de=1,fe=null,pe=null,me=new Wt(0,0,le,ue),he=new Wt(0,0,le,ue),ge=!1,_e=new hi,ve=!1,ye=!1,be=new Yt,xe=new J,Se=new Wt,Ce={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},we=!1;function Te(){return z===null?de:1}let B=n;function Ee(e,n){return t.getContext(e,n)}try{let e={alpha:!0,depth:r,stencil:i,antialias:o,premultipliedAlpha:s,preserveDrawingBuffer:c,powerPreference:l,failIfMajorPerformanceCaveat:f};if(`setAttribute`in t&&t.setAttribute(`data-engine`,`three.js r184`),t.addEventListener(`webglcontextlost`,et,!1),t.addEventListener(`webglcontextrestored`,tt,!1),t.addEventListener(`webglcontextcreationerror`,nt,!1),B===null){let t=`webgl2`;if(B=Ee(t,e),B===null)throw Ee(t)?Error(`Error creating WebGL context with your selected attributes.`):Error(`Error creating WebGL context.`)}}catch(e){throw G(`WebGLRenderer: `+e.message),e}let De,Oe,V,ke,H,U,Ae,je,Me,Ne,Fe,Ie,Le,Re,ze,Be,He,Ue,We,Ke,qe,Ye,Xe;function Qe(){De=new Ro(B),De.init(),qe=new cl(B,De),Oe=new mo(B,De,e,qe),V=new ol(B,De),Oe.reversedDepthBuffer&&p&&V.buffers.depth.setReversed(!0),ke=new Vo(B),H=new Bc,U=new sl(B,De,V,H,Oe,qe,ke),Ae=new Lo(I),je=new ao(B),Ye=new fo(B,je),Me=new zo(B,je,ke,Ye),Ne=new Uo(B,Me,je,Ye,ke),Ue=new Ho(B,Oe,U),ze=new ho(H),Fe=new zc(I,Ae,De,Oe,Ye,ze),Ie=new hl(I,H),Le=new Wc,Re=new Zc(De),He=new uo(I,Ae,V,Ne,_,s),Be=new al(I,Ne,Oe),Xe=new gl(B,ke,Oe,V),We=new po(B,De,ke),Ke=new Bo(B,De,ke),ke.programs=Fe.programs,I.capabilities=Oe,I.extensions=De,I.properties=H,I.renderLists=Le,I.shadowMap=Be,I.state=V,I.info=ke}Qe(),S!==1009&&(F=new Go(S,t.width,t.height,r,i));let $e=new fl(I,B);this.xr=$e,this.getContext=function(){return B},this.getContextAttributes=function(){return B.getContextAttributes()},this.forceContextLoss=function(){let e=De.get(`WEBGL_lose_context`);e&&e.loseContext()},this.forceContextRestore=function(){let e=De.get(`WEBGL_lose_context`);e&&e.restoreContext()},this.getPixelRatio=function(){return de},this.setPixelRatio=function(e){e!==void 0&&(de=e,this.setSize(le,ue,!1))},this.getSize=function(e){return e.set(le,ue)},this.setSize=function(e,n,r=!0){if($e.isPresenting){W(`WebGLRenderer: Can't change size while VR device is presenting.`);return}le=e,ue=n,t.width=Math.floor(e*de),t.height=Math.floor(n*de),r===!0&&(t.style.width=e+`px`,t.style.height=n+`px`),F!==null&&F.setSize(t.width,t.height),this.setViewport(0,0,e,n)},this.getDrawingBufferSize=function(e){return e.set(le*de,ue*de).floor()},this.setDrawingBufferSize=function(e,n,r){le=e,ue=n,de=r,t.width=Math.floor(e*r),t.height=Math.floor(n*r),this.setViewport(0,0,e,n)},this.setEffects=function(e){if(S===1009){G(`THREE.WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.`);return}if(e){for(let t=0;t<e.length;t++)if(e[t].isOutputPass===!0){W(`THREE.WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.`);break}}F.setEffects(e||[])},this.getCurrentViewport=function(e){return e.copy(ie)},this.getViewport=function(e){return e.copy(me)},this.setViewport=function(e,t,n,r){e.isVector4?me.set(e.x,e.y,e.z,e.w):me.set(e,t,n,r),V.viewport(ie.copy(me).multiplyScalar(de).round())},this.getScissor=function(e){return e.copy(he)},this.setScissor=function(e,t,n,r){e.isVector4?he.set(e.x,e.y,e.z,e.w):he.set(e,t,n,r),V.scissor(ae.copy(he).multiplyScalar(de).round())},this.getScissorTest=function(){return ge},this.setScissorTest=function(e){V.setScissorTest(ge=e)},this.setOpaqueSort=function(e){fe=e},this.setTransparentSort=function(e){pe=e},this.getClearColor=function(e){return e.copy(He.getClearColor())},this.setClearColor=function(){He.setClearColor(...arguments)},this.getClearAlpha=function(){return He.getClearAlpha()},this.setClearAlpha=function(){He.setClearAlpha(...arguments)},this.clear=function(e=!0,t=!0,n=!0){let r=0;if(e){let e=!1;if(z!==null){let t=z.texture.format;e=C.has(t)}if(e){let e=z.texture.type,t=w.has(e),n=He.getClearColor(),r=He.getClearAlpha(),i=n.r,a=n.g,o=n.b;t?(T[0]=i,T[1]=a,T[2]=o,T[3]=r,B.clearBufferuiv(B.COLOR,0,T)):(E[0]=i,E[1]=a,E[2]=o,E[3]=r,B.clearBufferiv(B.COLOR,0,E))}else r|=B.COLOR_BUFFER_BIT}t&&(r|=B.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),n&&(r|=B.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),r!==0&&B.clear(r)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(e){e.setRenderer(this),L=e},this.dispose=function(){t.removeEventListener(`webglcontextlost`,et,!1),t.removeEventListener(`webglcontextrestored`,tt,!1),t.removeEventListener(`webglcontextcreationerror`,nt,!1),He.dispose(),Le.dispose(),Re.dispose(),H.dispose(),Ae.dispose(),Ne.dispose(),Ye.dispose(),Xe.dispose(),Fe.dispose(),$e.dispose(),$e.removeEventListener(`sessionstart`,ct),$e.removeEventListener(`sessionend`,lt),ut.stop()};function et(e){e.preventDefault(),Je(`WebGLRenderer: Context Lost.`),ee=!0}function tt(){Je(`WebGLRenderer: Context Restored.`),ee=!1;let e=ke.autoReset,t=Be.enabled,n=Be.autoUpdate,r=Be.needsUpdate,i=Be.type;Qe(),ke.autoReset=e,Be.enabled=t,Be.autoUpdate=n,Be.needsUpdate=r,Be.type=i}function nt(e){G(`WebGLRenderer: A WebGL context could not be created. Reason: `,e.statusMessage)}function rt(e){let t=e.target;t.removeEventListener(`dispose`,rt),it(t)}function it(e){K(e),H.remove(e)}function K(e){let t=H.get(e).programs;t!==void 0&&(t.forEach(function(e){Fe.releaseProgram(e)}),e.isShaderMaterial&&Fe.releaseShaderCache(e))}this.renderBufferDirect=function(e,t,n,r,i,a){t===null&&(t=Ce);let o=i.isMesh&&i.matrixWorld.determinant()<0,s=bt(e,t,n,r,i);V.setMaterial(r,o);let c=n.index,l=1;if(r.wireframe===!0){if(c=Me.getWireframeAttribute(n),c===void 0)return;l=2}let u=n.drawRange,d=n.attributes.position,f=u.start*l,p=(u.start+u.count)*l;a!==null&&(f=Math.max(f,a.start*l),p=Math.min(p,(a.start+a.count)*l)),c===null?d!=null&&(f=Math.max(f,0),p=Math.min(p,d.count)):(f=Math.max(f,0),p=Math.min(p,c.count));let m=p-f;if(m<0||m===1/0)return;Ye.setup(i,r,s,n,c);let h,g=We;if(c!==null&&(h=je.get(c),g=Ke,g.setIndex(h)),i.isMesh)r.wireframe===!0?(V.setLineWidth(r.wireframeLinewidth*Te()),g.setMode(B.LINES)):g.setMode(B.TRIANGLES);else if(i.isLine){let e=r.linewidth;e===void 0&&(e=1),V.setLineWidth(e*Te()),i.isLineSegments?g.setMode(B.LINES):i.isLineLoop?g.setMode(B.LINE_LOOP):g.setMode(B.LINE_STRIP)}else i.isPoints?g.setMode(B.POINTS):i.isSprite&&g.setMode(B.TRIANGLES);if(i.isBatchedMesh)if(De.get(`WEBGL_multi_draw`))g.renderMultiDraw(i._multiDrawStarts,i._multiDrawCounts,i._multiDrawCount);else{let e=i._multiDrawStarts,t=i._multiDrawCounts,n=i._multiDrawCount,a=c?je.get(c).bytesPerElement:1,o=H.get(r).currentProgram.getUniforms();for(let r=0;r<n;r++)o.setValue(B,`_gl_DrawID`,r),g.render(e[r]/a,t[r])}else if(i.isInstancedMesh)g.renderInstances(f,m,i.count);else if(n.isInstancedBufferGeometry){let e=n._maxInstanceCount===void 0?1/0:n._maxInstanceCount,t=Math.min(n.instanceCount,e);g.renderInstances(f,m,t)}else g.render(f,m)};function at(e,t,n){e.transparent===!0&&e.side===2&&e.forceSinglePass===!1?(e.side=1,e.needsUpdate=!0,gt(e,t,n),e.side=0,e.needsUpdate=!0,gt(e,t,n),e.side=2):gt(e,t,n)}this.compile=function(e,t,n=null){n===null&&(n=e),k=Re.get(n),k.init(t),P.push(k),n.traverseVisible(function(e){e.isLight&&e.layers.test(t.layers)&&(k.pushLight(e),e.castShadow&&k.pushShadow(e))}),e!==n&&e.traverseVisible(function(e){e.isLight&&e.layers.test(t.layers)&&(k.pushLight(e),e.castShadow&&k.pushShadow(e))}),k.setupLights();let r=new Set;return e.traverse(function(e){if(!(e.isMesh||e.isPoints||e.isLine||e.isSprite))return;let t=e.material;if(t)if(Array.isArray(t))for(let i=0;i<t.length;i++){let a=t[i];at(a,n,e),r.add(a)}else at(t,n,e),r.add(t)}),k=P.pop(),r},this.compileAsync=function(e,t,n=null){let r=this.compile(e,t,n);return new Promise(t=>{function n(){if(r.forEach(function(e){H.get(e).currentProgram.isReady()&&r.delete(e)}),r.size===0){t(e);return}setTimeout(n,10)}De.get(`KHR_parallel_shader_compile`)===null?setTimeout(n,10):n()})};let ot=null;function st(e){ot&&ot(e)}function ct(){ut.stop()}function lt(){ut.start()}let ut=new io;ut.setAnimationLoop(st),typeof self<`u`&&ut.setContext(self),this.setAnimationLoop=function(e){ot=e,$e.setAnimationLoop(e),e===null?ut.stop():ut.start()},$e.addEventListener(`sessionstart`,ct),$e.addEventListener(`sessionend`,lt),this.render=function(e,t){if(t!==void 0&&t.isCamera!==!0){G(`WebGLRenderer.render: camera is not an instance of THREE.Camera.`);return}if(ee===!0)return;L!==null&&L.renderStart(e,t);let n=$e.enabled===!0&&$e.isPresenting===!0,r=F!==null&&(z===null||n)&&F.begin(I,z);if(e.matrixWorldAutoUpdate===!0&&e.updateMatrixWorld(),t.parent===null&&t.matrixWorldAutoUpdate===!0&&t.updateMatrixWorld(),$e.enabled===!0&&$e.isPresenting===!0&&(F===null||F.isCompositing()===!1)&&($e.cameraAutoUpdate===!0&&$e.updateCamera(t),t=$e.getCamera()),e.isScene===!0&&e.onBeforeRender(I,e,t,z),k=Re.get(e,P.length),k.init(t),k.state.textureUnits=U.getTextureUnits(),P.push(k),be.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),_e.setFromProjectionMatrix(be,Ve,t.reversedDepth),ye=this.localClippingEnabled,ve=ze.init(this.clippingPlanes,ye),O=Le.get(e,j.length),O.init(),j.push(O),$e.enabled===!0&&$e.isPresenting===!0){let e=I.xr.getDepthSensingMesh();e!==null&&dt(e,t,-1/0,I.sortObjects)}dt(e,t,0,I.sortObjects),O.finish(),I.sortObjects===!0&&O.sort(fe,pe),we=$e.enabled===!1||$e.isPresenting===!1||$e.hasDepthSensing()===!1,we&&He.addToRenderList(O,e),this.info.render.frame++,ve===!0&&ze.beginShadows();let i=k.state.shadowsArray;if(Be.render(i,e,t),ve===!0&&ze.endShadows(),this.info.autoReset===!0&&this.info.reset(),(r&&F.hasRenderPass())===!1){let n=O.opaque,r=O.transmissive;if(k.setupLights(),t.isArrayCamera){let i=t.cameras;if(r.length>0)for(let t=0,a=i.length;t<a;t++){let a=i[t];pt(n,r,e,a)}we&&He.render(e);for(let t=0,n=i.length;t<n;t++){let n=i[t];ft(O,e,n,n.viewport)}}else r.length>0&&pt(n,r,e,t),we&&He.render(e),ft(O,e,t)}z!==null&&R===0&&(U.updateMultisampleRenderTarget(z),U.updateRenderTargetMipmap(z)),r&&F.end(I),e.isScene===!0&&e.onAfterRender(I,e,t),Ye.resetDefaultState(),ne=-1,re=null,P.pop(),P.length>0?(k=P[P.length-1],U.setTextureUnits(k.state.textureUnits),ve===!0&&ze.setGlobalState(I.clippingPlanes,k.state.camera)):k=null,j.pop(),O=j.length>0?j[j.length-1]:null,L!==null&&L.renderEnd()};function dt(e,t,n,r){if(e.visible===!1)return;if(e.layers.test(t.layers)){if(e.isGroup)n=e.renderOrder;else if(e.isLOD)e.autoUpdate===!0&&e.update(t);else if(e.isLightProbeGrid)k.pushLightProbeGrid(e);else if(e.isLight)k.pushLight(e),e.castShadow&&k.pushShadow(e);else if(e.isSprite){if(!e.frustumCulled||_e.intersectsSprite(e)){r&&Se.setFromMatrixPosition(e.matrixWorld).applyMatrix4(be);let t=Ne.update(e),i=e.material;i.visible&&O.push(e,t,i,n,Se.z,null)}}else if((e.isMesh||e.isLine||e.isPoints)&&(!e.frustumCulled||_e.intersectsObject(e))){let t=Ne.update(e),i=e.material;if(r&&(e.boundingSphere===void 0?(t.boundingSphere===null&&t.computeBoundingSphere(),Se.copy(t.boundingSphere.center)):(e.boundingSphere===null&&e.computeBoundingSphere(),Se.copy(e.boundingSphere.center)),Se.applyMatrix4(e.matrixWorld).applyMatrix4(be)),Array.isArray(i)){let r=t.groups;for(let a=0,o=r.length;a<o;a++){let o=r[a],s=i[o.materialIndex];s&&s.visible&&O.push(e,t,s,n,Se.z,o)}}else i.visible&&O.push(e,t,i,n,Se.z,null)}}let i=e.children;for(let e=0,a=i.length;e<a;e++)dt(i[e],t,n,r)}function ft(e,t,n,r){let{opaque:i,transmissive:a,transparent:o}=e;k.setupLightsView(n),ve===!0&&ze.setGlobalState(I.clippingPlanes,n),r&&V.viewport(ie.copy(r)),i.length>0&&mt(i,t,n),a.length>0&&mt(a,t,n),o.length>0&&mt(o,t,n),V.buffers.depth.setTest(!0),V.buffers.depth.setMask(!0),V.buffers.color.setMask(!0),V.setPolygonOffset(!1)}function pt(e,t,n,r){if((n.isScene===!0?n.overrideMaterial:null)!==null)return;if(k.state.transmissionRenderTarget[r.id]===void 0){let e=De.has(`EXT_color_buffer_half_float`)||De.has(`EXT_color_buffer_float`);k.state.transmissionRenderTarget[r.id]=new Kt(1,1,{generateMipmaps:!0,type:e?v:d,minFilter:u,samples:Math.max(4,Oe.samples),stencilBuffer:i,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:Nt.workingColorSpace})}let a=k.state.transmissionRenderTarget[r.id],o=r.viewport||ie;a.setSize(o.z*I.transmissionResolutionScale,o.w*I.transmissionResolutionScale);let s=I.getRenderTarget(),c=I.getActiveCubeFace(),l=I.getActiveMipmapLevel();I.setRenderTarget(a),I.getClearColor(se),ce=I.getClearAlpha(),ce<1&&I.setClearColor(16777215,.5),I.clear(),we&&He.render(n);let f=I.toneMapping;I.toneMapping=0;let p=r.viewport;if(r.viewport!==void 0&&(r.viewport=void 0),k.setupLightsView(r),ve===!0&&ze.setGlobalState(I.clippingPlanes,r),mt(e,n,r),U.updateMultisampleRenderTarget(a),U.updateRenderTargetMipmap(a),De.has(`WEBGL_multisampled_render_to_texture`)===!1){let e=!1;for(let i=0,a=t.length;i<a;i++){let{object:a,geometry:o,material:s,group:c}=t[i];if(s.side===2&&a.layers.test(r.layers)){let t=s.side;s.side=1,s.needsUpdate=!0,ht(a,n,r,o,s,c),s.side=t,s.needsUpdate=!0,e=!0}}e===!0&&(U.updateMultisampleRenderTarget(a),U.updateRenderTargetMipmap(a))}I.setRenderTarget(s,c,l),I.setClearColor(se,ce),p!==void 0&&(r.viewport=p),I.toneMapping=f}function mt(e,t,n){let r=t.isScene===!0?t.overrideMaterial:null;for(let i=0,a=e.length;i<a;i++){let a=e[i],{object:o,geometry:s,group:c}=a,l=a.material;l.allowOverride===!0&&r!==null&&(l=r),o.layers.test(n.layers)&&ht(o,t,n,s,l,c)}}function ht(e,t,n,r,i,a){e.onBeforeRender(I,t,n,r,i,a),e.modelViewMatrix.multiplyMatrices(n.matrixWorldInverse,e.matrixWorld),e.normalMatrix.getNormalMatrix(e.modelViewMatrix),i.onBeforeRender(I,t,n,r,e,a),i.transparent===!0&&i.side===2&&i.forceSinglePass===!1?(i.side=1,i.needsUpdate=!0,I.renderBufferDirect(n,t,r,i,e,a),i.side=0,i.needsUpdate=!0,I.renderBufferDirect(n,t,r,i,e,a),i.side=2):I.renderBufferDirect(n,t,r,i,e,a),e.onAfterRender(I,t,n,r,i,a)}function gt(e,t,n){t.isScene!==!0&&(t=Ce);let r=H.get(e),i=k.state.lights,a=k.state.shadowsArray,o=i.state.version,s=Fe.getParameters(e,i.state,a,t,n,k.state.lightProbeGridArray),c=Fe.getProgramCacheKey(s),l=r.programs;r.environment=e.isMeshStandardMaterial||e.isMeshLambertMaterial||e.isMeshPhongMaterial?t.environment:null,r.fog=t.fog;let u=e.isMeshStandardMaterial||e.isMeshLambertMaterial&&!e.envMap||e.isMeshPhongMaterial&&!e.envMap;r.envMap=Ae.get(e.envMap||r.environment,u),r.envMapRotation=r.environment!==null&&e.envMap===null?t.environmentRotation:e.envMapRotation,l===void 0&&(e.addEventListener(`dispose`,rt),l=new Map,r.programs=l);let d=l.get(c);if(d!==void 0){if(r.currentProgram===d&&r.lightsStateVersion===o)return vt(e,s),d}else s.uniforms=Fe.getUniforms(e),L!==null&&e.isNodeMaterial&&L.build(e,n,s),e.onBeforeCompile(s,I),d=Fe.acquireProgram(s,c),l.set(c,d),r.uniforms=s.uniforms;let f=r.uniforms;return(!e.isShaderMaterial&&!e.isRawShaderMaterial||e.clipping===!0)&&(f.clippingPlanes=ze.uniform),vt(e,s),r.needsLights=St(e),r.lightsStateVersion=o,r.needsLights&&(f.ambientLightColor.value=i.state.ambient,f.lightProbe.value=i.state.probe,f.directionalLights.value=i.state.directional,f.directionalLightShadows.value=i.state.directionalShadow,f.spotLights.value=i.state.spot,f.spotLightShadows.value=i.state.spotShadow,f.rectAreaLights.value=i.state.rectArea,f.ltc_1.value=i.state.rectAreaLTC1,f.ltc_2.value=i.state.rectAreaLTC2,f.pointLights.value=i.state.point,f.pointLightShadows.value=i.state.pointShadow,f.hemisphereLights.value=i.state.hemi,f.directionalShadowMatrix.value=i.state.directionalShadowMatrix,f.spotLightMatrix.value=i.state.spotLightMatrix,f.spotLightMap.value=i.state.spotLightMap,f.pointShadowMatrix.value=i.state.pointShadowMatrix),r.lightProbeGrid=k.state.lightProbeGridArray.length>0,r.currentProgram=d,r.uniformsList=null,d}function _t(e){if(e.uniformsList===null){let t=e.currentProgram.getUniforms();e.uniformsList=Qs.seqWithValue(t.seq,e.uniforms)}return e.uniformsList}function vt(e,t){let n=H.get(e);n.outputColorSpace=t.outputColorSpace,n.batching=t.batching,n.batchingColor=t.batchingColor,n.instancing=t.instancing,n.instancingColor=t.instancingColor,n.instancingMorph=t.instancingMorph,n.skinning=t.skinning,n.morphTargets=t.morphTargets,n.morphNormals=t.morphNormals,n.morphColors=t.morphColors,n.morphTargetsCount=t.morphTargetsCount,n.numClippingPlanes=t.numClippingPlanes,n.numIntersection=t.numClipIntersection,n.vertexAlphas=t.vertexAlphas,n.vertexTangents=t.vertexTangents,n.toneMapping=t.toneMapping}function yt(e,t){if(e.length===0)return null;if(e.length===1)return e[0].texture===null?null:e[0];D.setFromMatrixPosition(t.matrixWorld);for(let t=0,n=e.length;t<n;t++){let n=e[t];if(n.texture!==null&&n.boundingBox.containsPoint(D))return n}return null}function bt(e,t,n,r,i){t.isScene!==!0&&(t=Ce),U.resetTextureUnits();let a=t.fog,o=r.isMeshStandardMaterial||r.isMeshLambertMaterial||r.isMeshPhongMaterial?t.environment:null,s=z===null?I.outputColorSpace:z.isXRRenderTarget===!0?z.texture.colorSpace:Nt.workingColorSpace,c=r.isMeshStandardMaterial||r.isMeshLambertMaterial&&!r.envMap||r.isMeshPhongMaterial&&!r.envMap,l=Ae.get(r.envMap||o,c),u=r.vertexColors===!0&&!!n.attributes.color&&n.attributes.color.itemSize===4,d=!!n.attributes.tangent&&(!!r.normalMap||r.anisotropy>0),f=!!n.morphAttributes.position,p=!!n.morphAttributes.normal,m=!!n.morphAttributes.color,h=0;r.toneMapped&&(z===null||z.isXRRenderTarget===!0)&&(h=I.toneMapping);let g=n.morphAttributes.position||n.morphAttributes.normal||n.morphAttributes.color,_=g===void 0?0:g.length,v=H.get(r),y=k.state.lights;if(ve===!0&&(ye===!0||e!==re)){let t=e===re&&r.id===ne;ze.setState(r,e,t)}let b=!1;r.version===v.__version?v.needsLights&&v.lightsStateVersion!==y.state.version?b=!0:v.outputColorSpace===s?i.isBatchedMesh&&v.batching===!1||!i.isBatchedMesh&&v.batching===!0||i.isBatchedMesh&&v.batchingColor===!0&&i.colorTexture===null||i.isBatchedMesh&&v.batchingColor===!1&&i.colorTexture!==null||i.isInstancedMesh&&v.instancing===!1||!i.isInstancedMesh&&v.instancing===!0||i.isSkinnedMesh&&v.skinning===!1||!i.isSkinnedMesh&&v.skinning===!0||i.isInstancedMesh&&v.instancingColor===!0&&i.instanceColor===null||i.isInstancedMesh&&v.instancingColor===!1&&i.instanceColor!==null||i.isInstancedMesh&&v.instancingMorph===!0&&i.morphTexture===null||i.isInstancedMesh&&v.instancingMorph===!1&&i.morphTexture!==null?b=!0:v.envMap===l?r.fog===!0&&v.fog!==a||v.numClippingPlanes!==void 0&&(v.numClippingPlanes!==ze.numPlanes||v.numIntersection!==ze.numIntersection)?b=!0:v.vertexAlphas===u&&v.vertexTangents===d&&v.morphTargets===f&&v.morphNormals===p&&v.morphColors===m&&v.toneMapping===h&&v.morphTargetsCount===_?!!v.lightProbeGrid!=k.state.lightProbeGridArray.length>0&&(b=!0):b=!0:b=!0:b=!0:(b=!0,v.__version=r.version);let x=v.currentProgram;b===!0&&(x=gt(r,t,i),L&&r.isNodeMaterial&&L.onUpdateProgram(r,x,v));let S=!1,C=!1,w=!1,T=x.getUniforms(),E=v.uniforms;if(V.useProgram(x.program)&&(S=!0,C=!0,w=!0),r.id!==ne&&(ne=r.id,C=!0),v.needsLights){let e=yt(k.state.lightProbeGridArray,i);v.lightProbeGrid!==e&&(v.lightProbeGrid=e,C=!0)}if(S||re!==e){V.buffers.depth.getReversed()&&e.reversedDepth!==!0&&(e._reversedDepth=!0,e.updateProjectionMatrix()),T.setValue(B,`projectionMatrix`,e.projectionMatrix),T.setValue(B,`viewMatrix`,e.matrixWorldInverse);let t=T.map.cameraPosition;t!==void 0&&t.setValue(B,xe.setFromMatrixPosition(e.matrixWorld)),Oe.logarithmicDepthBuffer&&T.setValue(B,`logDepthBufFC`,2/(Math.log(e.far+1)/Math.LN2)),(r.isMeshPhongMaterial||r.isMeshToonMaterial||r.isMeshLambertMaterial||r.isMeshBasicMaterial||r.isMeshStandardMaterial||r.isShaderMaterial)&&T.setValue(B,`isOrthographic`,e.isOrthographicCamera===!0),re!==e&&(re=e,C=!0,w=!0)}if(v.needsLights&&(y.state.directionalShadowMap.length>0&&T.setValue(B,`directionalShadowMap`,y.state.directionalShadowMap,U),y.state.spotShadowMap.length>0&&T.setValue(B,`spotShadowMap`,y.state.spotShadowMap,U),y.state.pointShadowMap.length>0&&T.setValue(B,`pointShadowMap`,y.state.pointShadowMap,U)),i.isSkinnedMesh){T.setOptional(B,i,`bindMatrix`),T.setOptional(B,i,`bindMatrixInverse`);let e=i.skeleton;e&&(e.boneTexture===null&&e.computeBoneTexture(),T.setValue(B,`boneTexture`,e.boneTexture,U))}i.isBatchedMesh&&(T.setOptional(B,i,`batchingTexture`),T.setValue(B,`batchingTexture`,i._matricesTexture,U),T.setOptional(B,i,`batchingIdTexture`),T.setValue(B,`batchingIdTexture`,i._indirectTexture,U),T.setOptional(B,i,`batchingColorTexture`),i._colorsTexture!==null&&T.setValue(B,`batchingColorTexture`,i._colorsTexture,U));let D=n.morphAttributes;if((D.position!==void 0||D.normal!==void 0||D.color!==void 0)&&Ue.update(i,n,x),(C||v.receiveShadow!==i.receiveShadow)&&(v.receiveShadow=i.receiveShadow,T.setValue(B,`receiveShadow`,i.receiveShadow)),(r.isMeshStandardMaterial||r.isMeshLambertMaterial||r.isMeshPhongMaterial)&&r.envMap===null&&t.environment!==null&&(E.envMapIntensity.value=t.environmentIntensity),E.dfgLUT!==void 0&&(E.dfgLUT.value=yl()),C){if(T.setValue(B,`toneMappingExposure`,I.toneMappingExposure),v.needsLights&&xt(E,w),a&&r.fog===!0&&Ie.refreshFogUniforms(E,a),Ie.refreshMaterialUniforms(E,r,de,ue,k.state.transmissionRenderTarget[e.id]),v.needsLights&&v.lightProbeGrid){let e=v.lightProbeGrid;E.probesSH.value=e.texture,E.probesMin.value.copy(e.boundingBox.min),E.probesMax.value.copy(e.boundingBox.max),E.probesResolution.value.copy(e.resolution)}Qs.upload(B,_t(v),E,U)}if(r.isShaderMaterial&&r.uniformsNeedUpdate===!0&&(Qs.upload(B,_t(v),E,U),r.uniformsNeedUpdate=!1),r.isSpriteMaterial&&T.setValue(B,`center`,i.center),T.setValue(B,`modelViewMatrix`,i.modelViewMatrix),T.setValue(B,`normalMatrix`,i.normalMatrix),T.setValue(B,`modelMatrix`,i.matrixWorld),r.uniformsGroups!==void 0){let e=r.uniformsGroups;for(let t=0,n=e.length;t<n;t++){let n=e[t];Xe.update(n,x),Xe.bind(n,x)}}return x}function xt(e,t){e.ambientLightColor.needsUpdate=t,e.lightProbe.needsUpdate=t,e.directionalLights.needsUpdate=t,e.directionalLightShadows.needsUpdate=t,e.pointLights.needsUpdate=t,e.pointLightShadows.needsUpdate=t,e.spotLights.needsUpdate=t,e.spotLightShadows.needsUpdate=t,e.rectAreaLights.needsUpdate=t,e.hemisphereLights.needsUpdate=t}function St(e){return e.isMeshLambertMaterial||e.isMeshToonMaterial||e.isMeshPhongMaterial||e.isMeshStandardMaterial||e.isShadowMaterial||e.isShaderMaterial&&e.lights===!0}this.getActiveCubeFace=function(){return te},this.getActiveMipmapLevel=function(){return R},this.getRenderTarget=function(){return z},this.setRenderTargetTextures=function(e,t,n){let r=H.get(e);r.__autoAllocateDepthBuffer=e.resolveDepthBuffer===!1,r.__autoAllocateDepthBuffer===!1&&(r.__useRenderToTexture=!1),H.get(e.texture).__webglTexture=t,H.get(e.depthTexture).__webglTexture=r.__autoAllocateDepthBuffer?void 0:n,r.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(e,t){let n=H.get(e);n.__webglFramebuffer=t,n.__useDefaultFramebuffer=t===void 0};let Ct=B.createFramebuffer();this.setRenderTarget=function(e,t=0,n=0){z=e,te=t,R=n;let r=null,i=!1,a=!1;if(e){let o=H.get(e);if(o.__useDefaultFramebuffer!==void 0){V.bindFramebuffer(B.FRAMEBUFFER,o.__webglFramebuffer),ie.copy(e.viewport),ae.copy(e.scissor),oe=e.scissorTest,V.viewport(ie),V.scissor(ae),V.setScissorTest(oe),ne=-1;return}else if(o.__webglFramebuffer===void 0)U.setupRenderTarget(e);else if(o.__hasExternalTextures)U.rebindTextures(e,H.get(e.texture).__webglTexture,H.get(e.depthTexture).__webglTexture);else if(e.depthBuffer){let t=e.depthTexture;if(o.__boundDepthTexture!==t){if(t!==null&&H.has(t)&&(e.width!==t.image.width||e.height!==t.image.height))throw Error(`WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.`);U.setupDepthRenderbuffer(e)}}let s=e.texture;(s.isData3DTexture||s.isDataArrayTexture||s.isCompressedArrayTexture)&&(a=!0);let c=H.get(e).__webglFramebuffer;e.isWebGLCubeRenderTarget?(r=Array.isArray(c[t])?c[t][n]:c[t],i=!0):r=e.samples>0&&U.useMultisampledRTT(e)===!1?H.get(e).__webglMultisampledFramebuffer:Array.isArray(c)?c[n]:c,ie.copy(e.viewport),ae.copy(e.scissor),oe=e.scissorTest}else ie.copy(me).multiplyScalar(de).floor(),ae.copy(he).multiplyScalar(de).floor(),oe=ge;if(n!==0&&(r=Ct),V.bindFramebuffer(B.FRAMEBUFFER,r)&&V.drawBuffers(e,r),V.viewport(ie),V.scissor(ae),V.setScissorTest(oe),i){let r=H.get(e.texture);B.framebufferTexture2D(B.FRAMEBUFFER,B.COLOR_ATTACHMENT0,B.TEXTURE_CUBE_MAP_POSITIVE_X+t,r.__webglTexture,n)}else if(a){let r=t;for(let t=0;t<e.textures.length;t++){let i=H.get(e.textures[t]);B.framebufferTextureLayer(B.FRAMEBUFFER,B.COLOR_ATTACHMENT0+t,i.__webglTexture,n,r)}}else if(e!==null&&n!==0){let t=H.get(e.texture);B.framebufferTexture2D(B.FRAMEBUFFER,B.COLOR_ATTACHMENT0,B.TEXTURE_2D,t.__webglTexture,n)}ne=-1},this.readRenderTargetPixels=function(e,t,n,r,i,a,o,s=0){if(!(e&&e.isWebGLRenderTarget)){G(`WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.`);return}let c=H.get(e).__webglFramebuffer;if(e.isWebGLCubeRenderTarget&&o!==void 0&&(c=c[o]),c){V.bindFramebuffer(B.FRAMEBUFFER,c);try{let o=e.textures[s],c=o.format,l=o.type;if(e.textures.length>1&&B.readBuffer(B.COLOR_ATTACHMENT0+s),!Oe.textureFormatReadable(c)){G(`WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.`);return}if(!Oe.textureTypeReadable(l)){G(`WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.`);return}t>=0&&t<=e.width-r&&n>=0&&n<=e.height-i&&B.readPixels(t,n,r,i,qe.convert(c),qe.convert(l),a)}finally{let e=z===null?null:H.get(z).__webglFramebuffer;V.bindFramebuffer(B.FRAMEBUFFER,e)}}},this.readRenderTargetPixelsAsync=async function(e,t,n,r,i,a,o,s=0){if(!(e&&e.isWebGLRenderTarget))throw Error(`THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.`);let c=H.get(e).__webglFramebuffer;if(e.isWebGLCubeRenderTarget&&o!==void 0&&(c=c[o]),c)if(t>=0&&t<=e.width-r&&n>=0&&n<=e.height-i){V.bindFramebuffer(B.FRAMEBUFFER,c);let o=e.textures[s],l=o.format,u=o.type;if(e.textures.length>1&&B.readBuffer(B.COLOR_ATTACHMENT0+s),!Oe.textureFormatReadable(l))throw Error(`THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.`);if(!Oe.textureTypeReadable(u))throw Error(`THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.`);let d=B.createBuffer();B.bindBuffer(B.PIXEL_PACK_BUFFER,d),B.bufferData(B.PIXEL_PACK_BUFFER,a.byteLength,B.STREAM_READ),B.readPixels(t,n,r,i,qe.convert(l),qe.convert(u),0);let f=z===null?null:H.get(z).__webglFramebuffer;V.bindFramebuffer(B.FRAMEBUFFER,f);let p=B.fenceSync(B.SYNC_GPU_COMMANDS_COMPLETE,0);return B.flush(),await Ze(B,p,4),B.bindBuffer(B.PIXEL_PACK_BUFFER,d),B.getBufferSubData(B.PIXEL_PACK_BUFFER,0,a),B.deleteBuffer(d),B.deleteSync(p),a}else throw Error(`THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.`)},this.copyFramebufferToTexture=function(e,t=null,n=0){let r=2**-n,i=Math.floor(e.image.width*r),a=Math.floor(e.image.height*r),o=t===null?0:t.x,s=t===null?0:t.y;U.setTexture2D(e,0),B.copyTexSubImage2D(B.TEXTURE_2D,n,0,0,o,s,i,a),V.unbindTexture()};let wt=B.createFramebuffer(),Tt=B.createFramebuffer();this.copyTextureToTexture=function(e,t,n=null,r=null,i=0,a=0){let o,s,c,l,u,d,f,p,m,h=e.isCompressedTexture?e.mipmaps[a]:e.image;if(n!==null)o=n.max.x-n.min.x,s=n.max.y-n.min.y,c=n.isBox3?n.max.z-n.min.z:1,l=n.min.x,u=n.min.y,d=n.isBox3?n.min.z:0;else{let t=2**-i;o=Math.floor(h.width*t),s=Math.floor(h.height*t),c=e.isDataArrayTexture?h.depth:e.isData3DTexture?Math.floor(h.depth*t):1,l=0,u=0,d=0}r===null?(f=0,p=0,m=0):(f=r.x,p=r.y,m=r.z);let g=qe.convert(t.format),_=qe.convert(t.type),v;t.isData3DTexture?(U.setTexture3D(t,0),v=B.TEXTURE_3D):t.isDataArrayTexture||t.isCompressedArrayTexture?(U.setTexture2DArray(t,0),v=B.TEXTURE_2D_ARRAY):(U.setTexture2D(t,0),v=B.TEXTURE_2D),V.activeTexture(B.TEXTURE0),V.pixelStorei(B.UNPACK_FLIP_Y_WEBGL,t.flipY),V.pixelStorei(B.UNPACK_PREMULTIPLY_ALPHA_WEBGL,t.premultiplyAlpha),V.pixelStorei(B.UNPACK_ALIGNMENT,t.unpackAlignment);let y=V.getParameter(B.UNPACK_ROW_LENGTH),b=V.getParameter(B.UNPACK_IMAGE_HEIGHT),x=V.getParameter(B.UNPACK_SKIP_PIXELS),S=V.getParameter(B.UNPACK_SKIP_ROWS),C=V.getParameter(B.UNPACK_SKIP_IMAGES);V.pixelStorei(B.UNPACK_ROW_LENGTH,h.width),V.pixelStorei(B.UNPACK_IMAGE_HEIGHT,h.height),V.pixelStorei(B.UNPACK_SKIP_PIXELS,l),V.pixelStorei(B.UNPACK_SKIP_ROWS,u),V.pixelStorei(B.UNPACK_SKIP_IMAGES,d);let w=e.isDataArrayTexture||e.isData3DTexture,T=t.isDataArrayTexture||t.isData3DTexture;if(e.isDepthTexture){let n=H.get(e),r=H.get(t),h=H.get(n.__renderTarget),g=H.get(r.__renderTarget);V.bindFramebuffer(B.READ_FRAMEBUFFER,h.__webglFramebuffer),V.bindFramebuffer(B.DRAW_FRAMEBUFFER,g.__webglFramebuffer);for(let n=0;n<c;n++)w&&(B.framebufferTextureLayer(B.READ_FRAMEBUFFER,B.COLOR_ATTACHMENT0,H.get(e).__webglTexture,i,d+n),B.framebufferTextureLayer(B.DRAW_FRAMEBUFFER,B.COLOR_ATTACHMENT0,H.get(t).__webglTexture,a,m+n)),B.blitFramebuffer(l,u,o,s,f,p,o,s,B.DEPTH_BUFFER_BIT,B.NEAREST);V.bindFramebuffer(B.READ_FRAMEBUFFER,null),V.bindFramebuffer(B.DRAW_FRAMEBUFFER,null)}else if(i!==0||e.isRenderTargetTexture||H.has(e)){let n=H.get(e),r=H.get(t);V.bindFramebuffer(B.READ_FRAMEBUFFER,wt),V.bindFramebuffer(B.DRAW_FRAMEBUFFER,Tt);for(let e=0;e<c;e++)w?B.framebufferTextureLayer(B.READ_FRAMEBUFFER,B.COLOR_ATTACHMENT0,n.__webglTexture,i,d+e):B.framebufferTexture2D(B.READ_FRAMEBUFFER,B.COLOR_ATTACHMENT0,B.TEXTURE_2D,n.__webglTexture,i),T?B.framebufferTextureLayer(B.DRAW_FRAMEBUFFER,B.COLOR_ATTACHMENT0,r.__webglTexture,a,m+e):B.framebufferTexture2D(B.DRAW_FRAMEBUFFER,B.COLOR_ATTACHMENT0,B.TEXTURE_2D,r.__webglTexture,a),i===0?T?B.copyTexSubImage3D(v,a,f,p,m+e,l,u,o,s):B.copyTexSubImage2D(v,a,f,p,l,u,o,s):B.blitFramebuffer(l,u,o,s,f,p,o,s,B.COLOR_BUFFER_BIT,B.NEAREST);V.bindFramebuffer(B.READ_FRAMEBUFFER,null),V.bindFramebuffer(B.DRAW_FRAMEBUFFER,null)}else T?e.isDataTexture||e.isData3DTexture?B.texSubImage3D(v,a,f,p,m,o,s,c,g,_,h.data):t.isCompressedArrayTexture?B.compressedTexSubImage3D(v,a,f,p,m,o,s,c,g,h.data):B.texSubImage3D(v,a,f,p,m,o,s,c,g,_,h):e.isDataTexture?B.texSubImage2D(B.TEXTURE_2D,a,f,p,o,s,g,_,h.data):e.isCompressedTexture?B.compressedTexSubImage2D(B.TEXTURE_2D,a,f,p,h.width,h.height,g,h.data):B.texSubImage2D(B.TEXTURE_2D,a,f,p,o,s,g,_,h);V.pixelStorei(B.UNPACK_ROW_LENGTH,y),V.pixelStorei(B.UNPACK_IMAGE_HEIGHT,b),V.pixelStorei(B.UNPACK_SKIP_PIXELS,x),V.pixelStorei(B.UNPACK_SKIP_ROWS,S),V.pixelStorei(B.UNPACK_SKIP_IMAGES,C),a===0&&t.generateMipmaps&&B.generateMipmap(v),V.unbindTexture()},this.initRenderTarget=function(e){H.get(e).__webglFramebuffer===void 0&&U.setupRenderTarget(e)},this.initTexture=function(e){e.isCubeTexture?U.setTextureCube(e,0):e.isData3DTexture?U.setTexture3D(e,0):e.isDataArrayTexture||e.isCompressedArrayTexture?U.setTexture2DArray(e,0):U.setTexture2D(e,0),V.unbindTexture()},this.resetState=function(){te=0,R=0,z=null,V.reset(),Ye.reset()},typeof __THREE_DEVTOOLS__<`u`&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent(`observe`,{detail:this}))}get coordinateSystem(){return Ve}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=Nt._getDrawingBufferColorSpace(e),t.unpackColorSpace=Nt._getUnpackColorSpace()}},xl={type:`change`},Sl={type:`start`},Cl={type:`end`},wl=new Ir,Tl=new di,El=Math.cos(70*Tt.DEG2RAD),Dl=new J,Ol=2*Math.PI,kl={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},Al=1e-6,jl=class extends to{constructor(n,r=null){super(n,r),this.state=kl.NONE,this.target=new J,this.cursor=new J,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.keyRotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:`ArrowLeft`,UP:`ArrowUp`,RIGHT:`ArrowRight`,BOTTOM:`ArrowDown`},this.mouseButtons={LEFT:e.ROTATE,MIDDLE:e.DOLLY,RIGHT:e.PAN},this.touches={ONE:t.ROTATE,TWO:t.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._cursorStyle=`auto`,this._domElementKeyEvents=null,this._lastPosition=new J,this._lastQuaternion=new Et,this._lastTargetPosition=new J,this._quat=new Et().setFromUnitVectors(n.up,new J(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new $a,this._sphericalDelta=new $a,this._scale=1,this._panOffset=new J,this._rotateStart=new q,this._rotateEnd=new q,this._rotateDelta=new q,this._panStart=new q,this._panEnd=new q,this._panDelta=new q,this._dollyStart=new q,this._dollyEnd=new q,this._dollyDelta=new q,this._dollyDirection=new J,this._mouse=new q,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=Nl.bind(this),this._onPointerDown=Ml.bind(this),this._onPointerUp=Pl.bind(this),this._onContextMenu=Vl.bind(this),this._onMouseWheel=Ll.bind(this),this._onKeyDown=Rl.bind(this),this._onTouchStart=zl.bind(this),this._onTouchMove=Bl.bind(this),this._onMouseDown=Fl.bind(this),this._onMouseMove=Il.bind(this),this._interceptControlDown=Hl.bind(this),this._interceptControlUp=Ul.bind(this),this.domElement!==null&&this.connect(this.domElement),this.update()}set cursorStyle(e){this._cursorStyle=e,e===`grab`?this.domElement.style.cursor=`grab`:this.domElement.style.cursor=`auto`}get cursorStyle(){return this._cursorStyle}connect(e){super.connect(e),this.domElement.addEventListener(`pointerdown`,this._onPointerDown),this.domElement.addEventListener(`pointercancel`,this._onPointerUp),this.domElement.addEventListener(`contextmenu`,this._onContextMenu),this.domElement.addEventListener(`wheel`,this._onMouseWheel,{passive:!1}),this.domElement.getRootNode().addEventListener(`keydown`,this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction=`none`}disconnect(){this.domElement.removeEventListener(`pointerdown`,this._onPointerDown),this.domElement.ownerDocument.removeEventListener(`pointermove`,this._onPointerMove),this.domElement.ownerDocument.removeEventListener(`pointerup`,this._onPointerUp),this.domElement.removeEventListener(`pointercancel`,this._onPointerUp),this.domElement.removeEventListener(`wheel`,this._onMouseWheel),this.domElement.removeEventListener(`contextmenu`,this._onContextMenu),this.stopListenToKeyEvents(),this.domElement.getRootNode().removeEventListener(`keydown`,this._interceptControlDown,{capture:!0}),this.domElement.style.touchAction=``}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(e){e.addEventListener(`keydown`,this._onKeyDown),this._domElementKeyEvents=e}stopListenToKeyEvents(){this._domElementKeyEvents!==null&&(this._domElementKeyEvents.removeEventListener(`keydown`,this._onKeyDown),this._domElementKeyEvents=null)}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(xl),this.update(),this.state=kl.NONE}pan(e,t){this._pan(e,t),this.update()}dollyIn(e){this._dollyIn(e),this.update()}dollyOut(e){this._dollyOut(e),this.update()}rotateLeft(e){this._rotateLeft(e),this.update()}rotateUp(e){this._rotateUp(e),this.update()}update(e=null){let t=this.object.position;Dl.copy(t).sub(this.target),Dl.applyQuaternion(this._quat),this._spherical.setFromVector3(Dl),this.autoRotate&&this.state===kl.NONE&&this._rotateLeft(this._getAutoRotationAngle(e)),this.enableDamping?(this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor):(this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi);let n=this.minAzimuthAngle,r=this.maxAzimuthAngle;isFinite(n)&&isFinite(r)&&(n<-Math.PI?n+=Ol:n>Math.PI&&(n-=Ol),r<-Math.PI?r+=Ol:r>Math.PI&&(r-=Ol),n<=r?this._spherical.theta=Math.max(n,Math.min(r,this._spherical.theta)):this._spherical.theta=this._spherical.theta>(n+r)/2?Math.max(n,this._spherical.theta):Math.min(r,this._spherical.theta)),this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0?this.target.addScaledVector(this._panOffset,this.dampingFactor):this.target.add(this._panOffset),this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let i=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{let e=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),i=e!=this._spherical.radius}if(Dl.setFromSpherical(this._spherical),Dl.applyQuaternion(this._quatInverse),t.copy(this.target).add(Dl),this.object.lookAt(this.target),this.enableDamping===!0?(this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor)):(this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0)),this.zoomToCursor&&this._performCursorZoom){let e=null;if(this.object.isPerspectiveCamera){let t=Dl.length();e=this._clampDistance(t*this._scale);let n=t-e;this.object.position.addScaledVector(this._dollyDirection,n),this.object.updateMatrixWorld(),i=!!n}else if(this.object.isOrthographicCamera){let t=new J(this._mouse.x,this._mouse.y,0);t.unproject(this.object);let n=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),i=n!==this.object.zoom;let r=new J(this._mouse.x,this._mouse.y,0);r.unproject(this.object),this.object.position.sub(r).add(t),this.object.updateMatrixWorld(),e=Dl.length()}else console.warn(`WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled.`),this.zoomToCursor=!1;e!==null&&(this.screenSpacePanning?this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(e).add(this.object.position):(wl.origin.copy(this.object.position),wl.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(wl.direction))<El?this.object.lookAt(this.target):(Tl.setFromNormalAndCoplanarPoint(this.object.up,this.target),wl.intersectPlane(Tl,this.target))))}else if(this.object.isOrthographicCamera){let e=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),e!==this.object.zoom&&(this.object.updateProjectionMatrix(),i=!0)}return this._scale=1,this._performCursorZoom=!1,i||this._lastPosition.distanceToSquared(this.object.position)>Al||8*(1-this._lastQuaternion.dot(this.object.quaternion))>Al||this._lastTargetPosition.distanceToSquared(this.target)>Al?(this.dispatchEvent(xl),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0):!1}_getAutoRotationAngle(e){return e===null?Ol/60/60*this.autoRotateSpeed:Ol/60*this.autoRotateSpeed*e}_getZoomScale(e){let t=Math.abs(e*.01);return .95**(this.zoomSpeed*t)}_rotateLeft(e){this._sphericalDelta.theta-=e}_rotateUp(e){this._sphericalDelta.phi-=e}_panLeft(e,t){Dl.setFromMatrixColumn(t,0),Dl.multiplyScalar(-e),this._panOffset.add(Dl)}_panUp(e,t){this.screenSpacePanning===!0?Dl.setFromMatrixColumn(t,1):(Dl.setFromMatrixColumn(t,0),Dl.crossVectors(this.object.up,Dl)),Dl.multiplyScalar(e),this._panOffset.add(Dl)}_pan(e,t){let n=this.domElement;if(this.object.isPerspectiveCamera){let r=this.object.position;Dl.copy(r).sub(this.target);let i=Dl.length();i*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*e*i/n.clientHeight,this.object.matrix),this._panUp(2*t*i/n.clientHeight,this.object.matrix)}else this.object.isOrthographicCamera?(this._panLeft(e*(this.object.right-this.object.left)/this.object.zoom/n.clientWidth,this.object.matrix),this._panUp(t*(this.object.top-this.object.bottom)/this.object.zoom/n.clientHeight,this.object.matrix)):(console.warn(`WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.`),this.enablePan=!1)}_dollyOut(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale/=e:(console.warn(`WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.`),this.enableZoom=!1)}_dollyIn(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale*=e:(console.warn(`WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.`),this.enableZoom=!1)}_updateZoomParameters(e,t){if(!this.zoomToCursor)return;this._performCursorZoom=!0;let n=this.domElement.getBoundingClientRect(),r=e-n.left,i=t-n.top,a=n.width,o=n.height;this._mouse.x=r/a*2-1,this._mouse.y=-(i/o)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(e){return Math.max(this.minDistance,Math.min(this.maxDistance,e))}_handleMouseDownRotate(e){this._rotateStart.set(e.clientX,e.clientY)}_handleMouseDownDolly(e){this._updateZoomParameters(e.clientX,e.clientX),this._dollyStart.set(e.clientX,e.clientY)}_handleMouseDownPan(e){this._panStart.set(e.clientX,e.clientY)}_handleMouseMoveRotate(e){this._rotateEnd.set(e.clientX,e.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(Ol*this._rotateDelta.x/t.clientHeight),this._rotateUp(Ol*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(e){this._dollyEnd.set(e.clientX,e.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0?this._dollyOut(this._getZoomScale(this._dollyDelta.y)):this._dollyDelta.y<0&&this._dollyIn(this._getZoomScale(this._dollyDelta.y)),this._dollyStart.copy(this._dollyEnd),this.update()}_handleMouseMovePan(e){this._panEnd.set(e.clientX,e.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(e){this._updateZoomParameters(e.clientX,e.clientY),e.deltaY<0?this._dollyIn(this._getZoomScale(e.deltaY)):e.deltaY>0&&this._dollyOut(this._getZoomScale(e.deltaY)),this.update()}_handleKeyDown(e){let t=!1;switch(e.code){case this.keys.UP:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(Ol*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,this.keyPanSpeed),t=!0;break;case this.keys.BOTTOM:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(-Ol*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,-this.keyPanSpeed),t=!0;break;case this.keys.LEFT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(Ol*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(this.keyPanSpeed,0),t=!0;break;case this.keys.RIGHT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(-Ol*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(-this.keyPanSpeed,0),t=!0;break}t&&(e.preventDefault(),this.update())}_handleTouchStartRotate(e){if(this._pointers.length===1)this._rotateStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._rotateStart.set(n,r)}}_handleTouchStartPan(e){if(this._pointers.length===1)this._panStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._panStart.set(n,r)}}_handleTouchStartDolly(e){let t=this._getSecondPointerPosition(e),n=e.pageX-t.x,r=e.pageY-t.y,i=Math.sqrt(n*n+r*r);this._dollyStart.set(0,i)}_handleTouchStartDollyPan(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enablePan&&this._handleTouchStartPan(e)}_handleTouchStartDollyRotate(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enableRotate&&this._handleTouchStartRotate(e)}_handleTouchMoveRotate(e){if(this._pointers.length==1)this._rotateEnd.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._rotateEnd.set(n,r)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(Ol*this._rotateDelta.x/t.clientHeight),this._rotateUp(Ol*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(e){if(this._pointers.length===1)this._panEnd.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._panEnd.set(n,r)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(e){let t=this._getSecondPointerPosition(e),n=e.pageX-t.x,r=e.pageY-t.y,i=Math.sqrt(n*n+r*r);this._dollyEnd.set(0,i),this._dollyDelta.set(0,(this._dollyEnd.y/this._dollyStart.y)**+this.zoomSpeed),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);let a=(e.pageX+t.x)*.5,o=(e.pageY+t.y)*.5;this._updateZoomParameters(a,o)}_handleTouchMoveDollyPan(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enablePan&&this._handleTouchMovePan(e)}_handleTouchMoveDollyRotate(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enableRotate&&this._handleTouchMoveRotate(e)}_addPointer(e){this._pointers.push(e.pointerId)}_removePointer(e){delete this._pointerPositions[e.pointerId];for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId){this._pointers.splice(t,1);return}}_isTrackingPointer(e){for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId)return!0;return!1}_trackPointer(e){let t=this._pointerPositions[e.pointerId];t===void 0&&(t=new q,this._pointerPositions[e.pointerId]=t),t.set(e.pageX,e.pageY)}_getSecondPointerPosition(e){let t=e.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[t]}_customWheelEvent(e){let t=e.deltaMode,n={clientX:e.clientX,clientY:e.clientY,deltaY:e.deltaY};switch(t){case 1:n.deltaY*=16;break;case 2:n.deltaY*=100;break}return e.ctrlKey&&!this._controlActive&&(n.deltaY*=10),n}};function Ml(e){this.enabled!==!1&&(this._pointers.length===0&&(this.domElement.setPointerCapture(e.pointerId),this.domElement.ownerDocument.addEventListener(`pointermove`,this._onPointerMove),this.domElement.ownerDocument.addEventListener(`pointerup`,this._onPointerUp)),!this._isTrackingPointer(e)&&(this._addPointer(e),e.pointerType===`touch`?this._onTouchStart(e):this._onMouseDown(e),this._cursorStyle===`grab`&&(this.domElement.style.cursor=`grabbing`)))}function Nl(e){this.enabled!==!1&&(e.pointerType===`touch`?this._onTouchMove(e):this._onMouseMove(e))}function Pl(e){switch(this._removePointer(e),this._pointers.length){case 0:this.domElement.releasePointerCapture(e.pointerId),this.domElement.ownerDocument.removeEventListener(`pointermove`,this._onPointerMove),this.domElement.ownerDocument.removeEventListener(`pointerup`,this._onPointerUp),this.dispatchEvent(Cl),this.state=kl.NONE,this._cursorStyle===`grab`&&(this.domElement.style.cursor=`grab`);break;case 1:let t=this._pointers[0],n=this._pointerPositions[t];this._onTouchStart({pointerId:t,pageX:n.x,pageY:n.y});break}}function Fl(t){let n;switch(t.button){case 0:n=this.mouseButtons.LEFT;break;case 1:n=this.mouseButtons.MIDDLE;break;case 2:n=this.mouseButtons.RIGHT;break;default:n=-1}switch(n){case e.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(t),this.state=kl.DOLLY;break;case e.ROTATE:if(t.ctrlKey||t.metaKey||t.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(t),this.state=kl.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(t),this.state=kl.ROTATE}break;case e.PAN:if(t.ctrlKey||t.metaKey||t.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(t),this.state=kl.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(t),this.state=kl.PAN}break;default:this.state=kl.NONE}this.state!==kl.NONE&&this.dispatchEvent(Sl)}function Il(e){switch(this.state){case kl.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(e);break;case kl.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(e);break;case kl.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(e);break}}function Ll(e){this.enabled===!1||this.enableZoom===!1||this.state!==kl.NONE||(e.preventDefault(),this.dispatchEvent(Sl),this._handleMouseWheel(this._customWheelEvent(e)),this.dispatchEvent(Cl))}function Rl(e){this.enabled!==!1&&this._handleKeyDown(e)}function zl(e){switch(this._trackPointer(e),this._pointers.length){case 1:switch(this.touches.ONE){case t.ROTATE:if(this.enableRotate===!1)return;this._handleTouchStartRotate(e),this.state=kl.TOUCH_ROTATE;break;case t.PAN:if(this.enablePan===!1)return;this._handleTouchStartPan(e),this.state=kl.TOUCH_PAN;break;default:this.state=kl.NONE}break;case 2:switch(this.touches.TWO){case t.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(e),this.state=kl.TOUCH_DOLLY_PAN;break;case t.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(e),this.state=kl.TOUCH_DOLLY_ROTATE;break;default:this.state=kl.NONE}break;default:this.state=kl.NONE}this.state!==kl.NONE&&this.dispatchEvent(Sl)}function Bl(e){switch(this._trackPointer(e),this.state){case kl.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(e),this.update();break;case kl.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(e),this.update();break;case kl.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(e),this.update();break;case kl.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(e),this.update();break;default:this.state=kl.NONE}}function Vl(e){this.enabled!==!1&&e.preventDefault()}function Hl(e){e.key===`Control`&&(this._controlActive=!0,this.domElement.getRootNode().addEventListener(`keyup`,this._interceptControlUp,{passive:!0,capture:!0}))}function Ul(e){e.key===`Control`&&(this._controlActive=!1,this.domElement.getRootNode().removeEventListener(`keyup`,this._interceptControlUp,{passive:!0,capture:!0}))}var Wl=class extends Yr{constructor(e,t,n=!1,r=!1,i=1e4){let a=new Er;super(a,t),this.isMarchingCubes=!0;let o=this,s=new Float32Array(36),c=new Float32Array(36),l=new Float32Array(36);this.enableUvs=n,this.enableColors=r,this.init=function(e){this.resolution=e,this.isolation=80,this.size=e,this.size2=this.size*this.size,this.size3=this.size2*this.size,this.halfsize=this.size/2,this.delta=2/this.size,this.yd=this.size,this.zd=this.size2,this.field=new Float32Array(this.size3),this.normal_cache=new Float32Array(this.size3*3),this.palette=new Float32Array(this.size3*3),this.count=0;let t=i*3;this.positionArray=new Float32Array(t*3);let n=new dr(this.positionArray,3);n.setUsage(Be),a.setAttribute(`position`,n),this.normalArray=new Float32Array(t*3);let r=new dr(this.normalArray,3);if(r.setUsage(Be),a.setAttribute(`normal`,r),this.enableUvs){this.uvArray=new Float32Array(t*2);let e=new dr(this.uvArray,2);e.setUsage(Be),a.setAttribute(`uv`,e)}if(this.enableColors){this.colorArray=new Float32Array(t*3);let e=new dr(this.colorArray,3);e.setUsage(Be),a.setAttribute(`color`,e)}a.boundingSphere=new vr(new J,1)};function u(e,t,n){return e+(t-e)*n}function d(e,t,n,r,i,a,d,f,p,m){let h=(n-d)/(f-d),g=o.normal_cache;s[t+0]=r+h*o.delta,s[t+1]=i,s[t+2]=a,c[t+0]=u(g[e+0],g[e+3],h),c[t+1]=u(g[e+1],g[e+4],h),c[t+2]=u(g[e+2],g[e+5],h),l[t+0]=u(o.palette[p*3+0],o.palette[m*3+0],h),l[t+1]=u(o.palette[p*3+1],o.palette[m*3+1],h),l[t+2]=u(o.palette[p*3+2],o.palette[m*3+2],h)}function f(e,t,n,r,i,a,d,f,p,m){let h=(n-d)/(f-d),g=o.normal_cache;s[t+0]=r,s[t+1]=i+h*o.delta,s[t+2]=a;let _=e+o.yd*3;c[t+0]=u(g[e+0],g[_+0],h),c[t+1]=u(g[e+1],g[_+1],h),c[t+2]=u(g[e+2],g[_+2],h),l[t+0]=u(o.palette[p*3+0],o.palette[m*3+0],h),l[t+1]=u(o.palette[p*3+1],o.palette[m*3+1],h),l[t+2]=u(o.palette[p*3+2],o.palette[m*3+2],h)}function p(e,t,n,r,i,a,d,f,p,m){let h=(n-d)/(f-d),g=o.normal_cache;s[t+0]=r,s[t+1]=i,s[t+2]=a+h*o.delta;let _=e+o.zd*3;c[t+0]=u(g[e+0],g[_+0],h),c[t+1]=u(g[e+1],g[_+1],h),c[t+2]=u(g[e+2],g[_+2],h),l[t+0]=u(o.palette[p*3+0],o.palette[m*3+0],h),l[t+1]=u(o.palette[p*3+1],o.palette[m*3+1],h),l[t+2]=u(o.palette[p*3+2],o.palette[m*3+2],h)}function m(e){let t=e*3;o.normal_cache[t]===0&&(o.normal_cache[t+0]=o.field[e-1]-o.field[e+1],o.normal_cache[t+1]=o.field[e-o.yd]-o.field[e+o.yd],o.normal_cache[t+2]=o.field[e-o.zd]-o.field[e+o.zd])}function h(e,t,n,r,i){let a=r+1,u=r+o.yd,h=r+o.zd,_=a+o.yd,v=a+o.zd,y=r+o.yd+o.zd,b=a+o.yd+o.zd,x=0,S=o.field[r],C=o.field[a],w=o.field[u],T=o.field[_],E=o.field[h],D=o.field[v],O=o.field[y],k=o.field[b];S<i&&(x|=1),C<i&&(x|=2),w<i&&(x|=8),T<i&&(x|=4),E<i&&(x|=16),D<i&&(x|=32),O<i&&(x|=128),k<i&&(x|=64);let A=Gl[x];if(A===0)return 0;let j=o.delta,M=e+j,N=t+j,P=n+j;A&1&&(m(r),m(a),d(r*3,0,i,e,t,n,S,C,r,a)),A&2&&(m(a),m(_),f(a*3,3,i,M,t,n,C,T,a,_)),A&4&&(m(u),m(_),d(u*3,6,i,e,N,n,w,T,u,_)),A&8&&(m(r),m(u),f(r*3,9,i,e,t,n,S,w,r,u)),A&16&&(m(h),m(v),d(h*3,12,i,e,t,P,E,D,h,v)),A&32&&(m(v),m(b),f(v*3,15,i,M,t,P,D,k,v,b)),A&64&&(m(y),m(b),d(y*3,18,i,e,N,P,O,k,y,b)),A&128&&(m(h),m(y),f(h*3,21,i,e,t,P,E,O,h,y)),A&256&&(m(r),m(h),p(r*3,24,i,e,t,n,S,E,r,h)),A&512&&(m(a),m(v),p(a*3,27,i,M,t,n,C,D,a,v)),A&1024&&(m(_),m(b),p(_*3,30,i,M,N,n,T,k,_,b)),A&2048&&(m(u),m(y),p(u*3,33,i,e,N,n,w,O,u,y)),x<<=4;let F,I,ee,L=0,te=0;for(;Kl[x+te]!=-1;)F=x+te,I=F+1,ee=F+2,g(s,c,l,3*Kl[F],3*Kl[I],3*Kl[ee]),te+=3,L++;return L}function g(e,t,n,r,i,a){let s=o.count*3;if(o.positionArray[s+0]=e[r],o.positionArray[s+1]=e[r+1],o.positionArray[s+2]=e[r+2],o.positionArray[s+3]=e[i],o.positionArray[s+4]=e[i+1],o.positionArray[s+5]=e[i+2],o.positionArray[s+6]=e[a],o.positionArray[s+7]=e[a+1],o.positionArray[s+8]=e[a+2],o.material.flatShading===!0){let e=(t[r+0]+t[i+0]+t[a+0])/3,n=(t[r+1]+t[i+1]+t[a+1])/3,c=(t[r+2]+t[i+2]+t[a+2])/3;o.normalArray[s+0]=e,o.normalArray[s+1]=n,o.normalArray[s+2]=c,o.normalArray[s+3]=e,o.normalArray[s+4]=n,o.normalArray[s+5]=c,o.normalArray[s+6]=e,o.normalArray[s+7]=n,o.normalArray[s+8]=c}else o.normalArray[s+0]=t[r+0],o.normalArray[s+1]=t[r+1],o.normalArray[s+2]=t[r+2],o.normalArray[s+3]=t[i+0],o.normalArray[s+4]=t[i+1],o.normalArray[s+5]=t[i+2],o.normalArray[s+6]=t[a+0],o.normalArray[s+7]=t[a+1],o.normalArray[s+8]=t[a+2];if(o.enableUvs){let t=o.count*2;o.uvArray[t+0]=e[r+0],o.uvArray[t+1]=e[r+2],o.uvArray[t+2]=e[i+0],o.uvArray[t+3]=e[i+2],o.uvArray[t+4]=e[a+0],o.uvArray[t+5]=e[a+2]}o.enableColors&&(o.colorArray[s+0]=n[r+0],o.colorArray[s+1]=n[r+1],o.colorArray[s+2]=n[r+2],o.colorArray[s+3]=n[i+0],o.colorArray[s+4]=n[i+1],o.colorArray[s+5]=n[i+2],o.colorArray[s+6]=n[a+0],o.colorArray[s+7]=n[a+1],o.colorArray[s+8]=n[a+2]),o.count+=3}this.addBall=function(e,t,n,r,i,a){let o=Math.sign(r);r=Math.abs(r);let s=a!=null,c=new X(e,t,n);if(s)try{c=a instanceof X?a:Array.isArray(a)?new X(Math.min(Math.abs(a[0]),1),Math.min(Math.abs(a[1]),1),Math.min(Math.abs(a[2]),1)):new X(a)}catch{c=new X(e,t,n)}let l=this.size*Math.sqrt(r/i),u=n*this.size,d=t*this.size,f=e*this.size,p=Math.floor(u-l);p<1&&(p=1);let m=Math.floor(u+l);m>this.size-1&&(m=this.size-1);let h=Math.floor(d-l);h<1&&(h=1);let g=Math.floor(d+l);g>this.size-1&&(g=this.size-1);let _=Math.floor(f-l);_<1&&(_=1);let v=Math.floor(f+l);v>this.size-1&&(v=this.size-1);let y,b,x,S,C,w,T,E,D,O,k;for(x=p;x<m;x++)for(C=this.size2*x,E=x/this.size-n,D=E*E,b=h;b<g;b++)for(S=C+this.size*b,T=b/this.size-t,O=T*T,y=_;y<v;y++)if(w=y/this.size-e,k=r/(1e-6+w*w+O+D)-i,k>0){this.field[S+y]+=k*o;let e=Math.sqrt((y-f)*(y-f)+(b-d)*(b-d)+(x-u)*(x-u))/l,t=1-e*e*e*(e*(e*6-15)+10);this.palette[(S+y)*3+0]+=c.r*t,this.palette[(S+y)*3+1]+=c.g*t,this.palette[(S+y)*3+2]+=c.b*t}},this.addPlaneX=function(e,t){let n=this.size,r=this.yd,i=this.zd,a=this.field,o,s,c,l,u,d,f,p=n*Math.sqrt(e/t);for(p>n&&(p=n),o=0;o<p;o++)if(d=o/n,l=d*d,u=e/(1e-4+l)-t,u>0)for(s=0;s<n;s++)for(f=o+s*r,c=0;c<n;c++)a[i*c+f]+=u},this.addPlaneY=function(e,t){let n=this.size,r=this.yd,i=this.zd,a=this.field,o,s,c,l,u,d,f,p,m=n*Math.sqrt(e/t);for(m>n&&(m=n),s=0;s<m;s++)if(d=s/n,l=d*d,u=e/(1e-4+l)-t,u>0)for(f=s*r,o=0;o<n;o++)for(p=f+o,c=0;c<n;c++)a[i*c+p]+=u},this.addPlaneZ=function(e,t){let n=this.size,r=this.yd,i=this.zd,a=this.field,o,s,c,l,u,d,f,p,m=n*Math.sqrt(e/t);for(m>n&&(m=n),c=0;c<m;c++)if(d=c/n,l=d*d,u=e/(1e-4+l)-t,u>0)for(f=i*c,s=0;s<n;s++)for(p=f+s*r,o=0;o<n;o++)a[p+o]+=u},this.setCell=function(e,t,n,r){let i=this.size2*n+this.size*t+e;this.field[i]=r},this.getCell=function(e,t,n){let r=this.size2*n+this.size*t+e;return this.field[r]},this.blur=function(e=1){let t=this.field,n=t.slice(),r=this.size,i=this.size2;for(let a=0;a<r;a++)for(let o=0;o<r;o++)for(let s=0;s<r;s++){let c=i*s+r*o+a,l=n[c],u=1;for(let t=-1;t<=1;t+=2){let c=t+a;if(!(c<0||c>=r))for(let t=-1;t<=1;t+=2){let a=t+o;if(!(a<0||a>=r))for(let t=-1;t<=1;t+=2){let o=t+s;if(o<0||o>=r)continue;let d=n[i*o+r*a+c];u++,l+=e*(d-l)/u}}}t[c]=l}},this.reset=function(){for(let e=0;e<this.size3;e++)this.normal_cache[e*3]=0,this.field[e]=0,this.palette[e*3]=this.palette[e*3+1]=this.palette[e*3+2]=0},this.update=function(){this.count=0;let e=this.size-2;for(let t=1;t<e;t++){let n=this.size2*t,r=(t-this.halfsize)/this.halfsize;for(let t=1;t<e;t++){let i=n+this.size*t,a=(t-this.halfsize)/this.halfsize;for(let t=1;t<e;t++)h((t-this.halfsize)/this.halfsize,a,r,i+t,this.isolation)}}this.geometry.setDrawRange(0,this.count),a.getAttribute(`position`).needsUpdate=!0,a.getAttribute(`normal`).needsUpdate=!0,this.enableUvs&&(a.getAttribute(`uv`).needsUpdate=!0),this.enableColors&&(a.getAttribute(`color`).needsUpdate=!0),this.count/3>i&&console.warn(`THREE.MarchingCubes: Geometry buffers too small for rendering. Please create an instance with a higher poly count.`)},this.init(e)}},Gl=new Int32Array([0,265,515,778,1030,1295,1541,1804,2060,2309,2575,2822,3082,3331,3593,3840,400,153,915,666,1430,1183,1941,1692,2460,2197,2975,2710,3482,3219,3993,3728,560,825,51,314,1590,1855,1077,1340,2620,2869,2111,2358,3642,3891,3129,3376,928,681,419,170,1958,1711,1445,1196,2988,2725,2479,2214,4010,3747,3497,3232,1120,1385,1635,1898,102,367,613,876,3180,3429,3695,3942,2154,2403,2665,2912,1520,1273,2035,1786,502,255,1013,764,3580,3317,4095,3830,2554,2291,3065,2800,1616,1881,1107,1370,598,863,85,348,3676,3925,3167,3414,2650,2899,2137,2384,1984,1737,1475,1226,966,719,453,204,4044,3781,3535,3270,3018,2755,2505,2240,2240,2505,2755,3018,3270,3535,3781,4044,204,453,719,966,1226,1475,1737,1984,2384,2137,2899,2650,3414,3167,3925,3676,348,85,863,598,1370,1107,1881,1616,2800,3065,2291,2554,3830,4095,3317,3580,764,1013,255,502,1786,2035,1273,1520,2912,2665,2403,2154,3942,3695,3429,3180,876,613,367,102,1898,1635,1385,1120,3232,3497,3747,4010,2214,2479,2725,2988,1196,1445,1711,1958,170,419,681,928,3376,3129,3891,3642,2358,2111,2869,2620,1340,1077,1855,1590,314,51,825,560,3728,3993,3219,3482,2710,2975,2197,2460,1692,1941,1183,1430,666,915,153,400,3840,3593,3331,3082,2822,2575,2309,2060,1804,1541,1295,1030,778,515,265,0]),Kl=new Int32Array([-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,8,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,1,9,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,8,3,9,8,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,2,10,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,8,3,1,2,10,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,9,2,10,0,2,9,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2,8,3,2,10,8,10,9,8,-1,-1,-1,-1,-1,-1,-1,3,11,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,11,2,8,11,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,9,0,2,3,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,11,2,1,9,11,9,8,11,-1,-1,-1,-1,-1,-1,-1,3,10,1,11,10,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,10,1,0,8,10,8,11,10,-1,-1,-1,-1,-1,-1,-1,3,9,0,3,11,9,11,10,9,-1,-1,-1,-1,-1,-1,-1,9,8,10,10,8,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4,7,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4,3,0,7,3,4,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,1,9,8,4,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4,1,9,4,7,1,7,3,1,-1,-1,-1,-1,-1,-1,-1,1,2,10,8,4,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,3,4,7,3,0,4,1,2,10,-1,-1,-1,-1,-1,-1,-1,9,2,10,9,0,2,8,4,7,-1,-1,-1,-1,-1,-1,-1,2,10,9,2,9,7,2,7,3,7,9,4,-1,-1,-1,-1,8,4,7,3,11,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,11,4,7,11,2,4,2,0,4,-1,-1,-1,-1,-1,-1,-1,9,0,1,8,4,7,2,3,11,-1,-1,-1,-1,-1,-1,-1,4,7,11,9,4,11,9,11,2,9,2,1,-1,-1,-1,-1,3,10,1,3,11,10,7,8,4,-1,-1,-1,-1,-1,-1,-1,1,11,10,1,4,11,1,0,4,7,11,4,-1,-1,-1,-1,4,7,8,9,0,11,9,11,10,11,0,3,-1,-1,-1,-1,4,7,11,4,11,9,9,11,10,-1,-1,-1,-1,-1,-1,-1,9,5,4,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,9,5,4,0,8,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,5,4,1,5,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,5,4,8,3,5,3,1,5,-1,-1,-1,-1,-1,-1,-1,1,2,10,9,5,4,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,3,0,8,1,2,10,4,9,5,-1,-1,-1,-1,-1,-1,-1,5,2,10,5,4,2,4,0,2,-1,-1,-1,-1,-1,-1,-1,2,10,5,3,2,5,3,5,4,3,4,8,-1,-1,-1,-1,9,5,4,2,3,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,11,2,0,8,11,4,9,5,-1,-1,-1,-1,-1,-1,-1,0,5,4,0,1,5,2,3,11,-1,-1,-1,-1,-1,-1,-1,2,1,5,2,5,8,2,8,11,4,8,5,-1,-1,-1,-1,10,3,11,10,1,3,9,5,4,-1,-1,-1,-1,-1,-1,-1,4,9,5,0,8,1,8,10,1,8,11,10,-1,-1,-1,-1,5,4,0,5,0,11,5,11,10,11,0,3,-1,-1,-1,-1,5,4,8,5,8,10,10,8,11,-1,-1,-1,-1,-1,-1,-1,9,7,8,5,7,9,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,9,3,0,9,5,3,5,7,3,-1,-1,-1,-1,-1,-1,-1,0,7,8,0,1,7,1,5,7,-1,-1,-1,-1,-1,-1,-1,1,5,3,3,5,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,9,7,8,9,5,7,10,1,2,-1,-1,-1,-1,-1,-1,-1,10,1,2,9,5,0,5,3,0,5,7,3,-1,-1,-1,-1,8,0,2,8,2,5,8,5,7,10,5,2,-1,-1,-1,-1,2,10,5,2,5,3,3,5,7,-1,-1,-1,-1,-1,-1,-1,7,9,5,7,8,9,3,11,2,-1,-1,-1,-1,-1,-1,-1,9,5,7,9,7,2,9,2,0,2,7,11,-1,-1,-1,-1,2,3,11,0,1,8,1,7,8,1,5,7,-1,-1,-1,-1,11,2,1,11,1,7,7,1,5,-1,-1,-1,-1,-1,-1,-1,9,5,8,8,5,7,10,1,3,10,3,11,-1,-1,-1,-1,5,7,0,5,0,9,7,11,0,1,0,10,11,10,0,-1,11,10,0,11,0,3,10,5,0,8,0,7,5,7,0,-1,11,10,5,7,11,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,10,6,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,8,3,5,10,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,9,0,1,5,10,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,8,3,1,9,8,5,10,6,-1,-1,-1,-1,-1,-1,-1,1,6,5,2,6,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,6,5,1,2,6,3,0,8,-1,-1,-1,-1,-1,-1,-1,9,6,5,9,0,6,0,2,6,-1,-1,-1,-1,-1,-1,-1,5,9,8,5,8,2,5,2,6,3,2,8,-1,-1,-1,-1,2,3,11,10,6,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,11,0,8,11,2,0,10,6,5,-1,-1,-1,-1,-1,-1,-1,0,1,9,2,3,11,5,10,6,-1,-1,-1,-1,-1,-1,-1,5,10,6,1,9,2,9,11,2,9,8,11,-1,-1,-1,-1,6,3,11,6,5,3,5,1,3,-1,-1,-1,-1,-1,-1,-1,0,8,11,0,11,5,0,5,1,5,11,6,-1,-1,-1,-1,3,11,6,0,3,6,0,6,5,0,5,9,-1,-1,-1,-1,6,5,9,6,9,11,11,9,8,-1,-1,-1,-1,-1,-1,-1,5,10,6,4,7,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4,3,0,4,7,3,6,5,10,-1,-1,-1,-1,-1,-1,-1,1,9,0,5,10,6,8,4,7,-1,-1,-1,-1,-1,-1,-1,10,6,5,1,9,7,1,7,3,7,9,4,-1,-1,-1,-1,6,1,2,6,5,1,4,7,8,-1,-1,-1,-1,-1,-1,-1,1,2,5,5,2,6,3,0,4,3,4,7,-1,-1,-1,-1,8,4,7,9,0,5,0,6,5,0,2,6,-1,-1,-1,-1,7,3,9,7,9,4,3,2,9,5,9,6,2,6,9,-1,3,11,2,7,8,4,10,6,5,-1,-1,-1,-1,-1,-1,-1,5,10,6,4,7,2,4,2,0,2,7,11,-1,-1,-1,-1,0,1,9,4,7,8,2,3,11,5,10,6,-1,-1,-1,-1,9,2,1,9,11,2,9,4,11,7,11,4,5,10,6,-1,8,4,7,3,11,5,3,5,1,5,11,6,-1,-1,-1,-1,5,1,11,5,11,6,1,0,11,7,11,4,0,4,11,-1,0,5,9,0,6,5,0,3,6,11,6,3,8,4,7,-1,6,5,9,6,9,11,4,7,9,7,11,9,-1,-1,-1,-1,10,4,9,6,4,10,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4,10,6,4,9,10,0,8,3,-1,-1,-1,-1,-1,-1,-1,10,0,1,10,6,0,6,4,0,-1,-1,-1,-1,-1,-1,-1,8,3,1,8,1,6,8,6,4,6,1,10,-1,-1,-1,-1,1,4,9,1,2,4,2,6,4,-1,-1,-1,-1,-1,-1,-1,3,0,8,1,2,9,2,4,9,2,6,4,-1,-1,-1,-1,0,2,4,4,2,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,3,2,8,2,4,4,2,6,-1,-1,-1,-1,-1,-1,-1,10,4,9,10,6,4,11,2,3,-1,-1,-1,-1,-1,-1,-1,0,8,2,2,8,11,4,9,10,4,10,6,-1,-1,-1,-1,3,11,2,0,1,6,0,6,4,6,1,10,-1,-1,-1,-1,6,4,1,6,1,10,4,8,1,2,1,11,8,11,1,-1,9,6,4,9,3,6,9,1,3,11,6,3,-1,-1,-1,-1,8,11,1,8,1,0,11,6,1,9,1,4,6,4,1,-1,3,11,6,3,6,0,0,6,4,-1,-1,-1,-1,-1,-1,-1,6,4,8,11,6,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,7,10,6,7,8,10,8,9,10,-1,-1,-1,-1,-1,-1,-1,0,7,3,0,10,7,0,9,10,6,7,10,-1,-1,-1,-1,10,6,7,1,10,7,1,7,8,1,8,0,-1,-1,-1,-1,10,6,7,10,7,1,1,7,3,-1,-1,-1,-1,-1,-1,-1,1,2,6,1,6,8,1,8,9,8,6,7,-1,-1,-1,-1,2,6,9,2,9,1,6,7,9,0,9,3,7,3,9,-1,7,8,0,7,0,6,6,0,2,-1,-1,-1,-1,-1,-1,-1,7,3,2,6,7,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2,3,11,10,6,8,10,8,9,8,6,7,-1,-1,-1,-1,2,0,7,2,7,11,0,9,7,6,7,10,9,10,7,-1,1,8,0,1,7,8,1,10,7,6,7,10,2,3,11,-1,11,2,1,11,1,7,10,6,1,6,7,1,-1,-1,-1,-1,8,9,6,8,6,7,9,1,6,11,6,3,1,3,6,-1,0,9,1,11,6,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,7,8,0,7,0,6,3,11,0,11,6,0,-1,-1,-1,-1,7,11,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,7,6,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,3,0,8,11,7,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,1,9,11,7,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,1,9,8,3,1,11,7,6,-1,-1,-1,-1,-1,-1,-1,10,1,2,6,11,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,2,10,3,0,8,6,11,7,-1,-1,-1,-1,-1,-1,-1,2,9,0,2,10,9,6,11,7,-1,-1,-1,-1,-1,-1,-1,6,11,7,2,10,3,10,8,3,10,9,8,-1,-1,-1,-1,7,2,3,6,2,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,7,0,8,7,6,0,6,2,0,-1,-1,-1,-1,-1,-1,-1,2,7,6,2,3,7,0,1,9,-1,-1,-1,-1,-1,-1,-1,1,6,2,1,8,6,1,9,8,8,7,6,-1,-1,-1,-1,10,7,6,10,1,7,1,3,7,-1,-1,-1,-1,-1,-1,-1,10,7,6,1,7,10,1,8,7,1,0,8,-1,-1,-1,-1,0,3,7,0,7,10,0,10,9,6,10,7,-1,-1,-1,-1,7,6,10,7,10,8,8,10,9,-1,-1,-1,-1,-1,-1,-1,6,8,4,11,8,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,3,6,11,3,0,6,0,4,6,-1,-1,-1,-1,-1,-1,-1,8,6,11,8,4,6,9,0,1,-1,-1,-1,-1,-1,-1,-1,9,4,6,9,6,3,9,3,1,11,3,6,-1,-1,-1,-1,6,8,4,6,11,8,2,10,1,-1,-1,-1,-1,-1,-1,-1,1,2,10,3,0,11,0,6,11,0,4,6,-1,-1,-1,-1,4,11,8,4,6,11,0,2,9,2,10,9,-1,-1,-1,-1,10,9,3,10,3,2,9,4,3,11,3,6,4,6,3,-1,8,2,3,8,4,2,4,6,2,-1,-1,-1,-1,-1,-1,-1,0,4,2,4,6,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,9,0,2,3,4,2,4,6,4,3,8,-1,-1,-1,-1,1,9,4,1,4,2,2,4,6,-1,-1,-1,-1,-1,-1,-1,8,1,3,8,6,1,8,4,6,6,10,1,-1,-1,-1,-1,10,1,0,10,0,6,6,0,4,-1,-1,-1,-1,-1,-1,-1,4,6,3,4,3,8,6,10,3,0,3,9,10,9,3,-1,10,9,4,6,10,4,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4,9,5,7,6,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,8,3,4,9,5,11,7,6,-1,-1,-1,-1,-1,-1,-1,5,0,1,5,4,0,7,6,11,-1,-1,-1,-1,-1,-1,-1,11,7,6,8,3,4,3,5,4,3,1,5,-1,-1,-1,-1,9,5,4,10,1,2,7,6,11,-1,-1,-1,-1,-1,-1,-1,6,11,7,1,2,10,0,8,3,4,9,5,-1,-1,-1,-1,7,6,11,5,4,10,4,2,10,4,0,2,-1,-1,-1,-1,3,4,8,3,5,4,3,2,5,10,5,2,11,7,6,-1,7,2,3,7,6,2,5,4,9,-1,-1,-1,-1,-1,-1,-1,9,5,4,0,8,6,0,6,2,6,8,7,-1,-1,-1,-1,3,6,2,3,7,6,1,5,0,5,4,0,-1,-1,-1,-1,6,2,8,6,8,7,2,1,8,4,8,5,1,5,8,-1,9,5,4,10,1,6,1,7,6,1,3,7,-1,-1,-1,-1,1,6,10,1,7,6,1,0,7,8,7,0,9,5,4,-1,4,0,10,4,10,5,0,3,10,6,10,7,3,7,10,-1,7,6,10,7,10,8,5,4,10,4,8,10,-1,-1,-1,-1,6,9,5,6,11,9,11,8,9,-1,-1,-1,-1,-1,-1,-1,3,6,11,0,6,3,0,5,6,0,9,5,-1,-1,-1,-1,0,11,8,0,5,11,0,1,5,5,6,11,-1,-1,-1,-1,6,11,3,6,3,5,5,3,1,-1,-1,-1,-1,-1,-1,-1,1,2,10,9,5,11,9,11,8,11,5,6,-1,-1,-1,-1,0,11,3,0,6,11,0,9,6,5,6,9,1,2,10,-1,11,8,5,11,5,6,8,0,5,10,5,2,0,2,5,-1,6,11,3,6,3,5,2,10,3,10,5,3,-1,-1,-1,-1,5,8,9,5,2,8,5,6,2,3,8,2,-1,-1,-1,-1,9,5,6,9,6,0,0,6,2,-1,-1,-1,-1,-1,-1,-1,1,5,8,1,8,0,5,6,8,3,8,2,6,2,8,-1,1,5,6,2,1,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,3,6,1,6,10,3,8,6,5,6,9,8,9,6,-1,10,1,0,10,0,6,9,5,0,5,6,0,-1,-1,-1,-1,0,3,8,5,6,10,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,10,5,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,11,5,10,7,5,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,11,5,10,11,7,5,8,3,0,-1,-1,-1,-1,-1,-1,-1,5,11,7,5,10,11,1,9,0,-1,-1,-1,-1,-1,-1,-1,10,7,5,10,11,7,9,8,1,8,3,1,-1,-1,-1,-1,11,1,2,11,7,1,7,5,1,-1,-1,-1,-1,-1,-1,-1,0,8,3,1,2,7,1,7,5,7,2,11,-1,-1,-1,-1,9,7,5,9,2,7,9,0,2,2,11,7,-1,-1,-1,-1,7,5,2,7,2,11,5,9,2,3,2,8,9,8,2,-1,2,5,10,2,3,5,3,7,5,-1,-1,-1,-1,-1,-1,-1,8,2,0,8,5,2,8,7,5,10,2,5,-1,-1,-1,-1,9,0,1,5,10,3,5,3,7,3,10,2,-1,-1,-1,-1,9,8,2,9,2,1,8,7,2,10,2,5,7,5,2,-1,1,3,5,3,7,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,8,7,0,7,1,1,7,5,-1,-1,-1,-1,-1,-1,-1,9,0,3,9,3,5,5,3,7,-1,-1,-1,-1,-1,-1,-1,9,8,7,5,9,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,5,8,4,5,10,8,10,11,8,-1,-1,-1,-1,-1,-1,-1,5,0,4,5,11,0,5,10,11,11,3,0,-1,-1,-1,-1,0,1,9,8,4,10,8,10,11,10,4,5,-1,-1,-1,-1,10,11,4,10,4,5,11,3,4,9,4,1,3,1,4,-1,2,5,1,2,8,5,2,11,8,4,5,8,-1,-1,-1,-1,0,4,11,0,11,3,4,5,11,2,11,1,5,1,11,-1,0,2,5,0,5,9,2,11,5,4,5,8,11,8,5,-1,9,4,5,2,11,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2,5,10,3,5,2,3,4,5,3,8,4,-1,-1,-1,-1,5,10,2,5,2,4,4,2,0,-1,-1,-1,-1,-1,-1,-1,3,10,2,3,5,10,3,8,5,4,5,8,0,1,9,-1,5,10,2,5,2,4,1,9,2,9,4,2,-1,-1,-1,-1,8,4,5,8,5,3,3,5,1,-1,-1,-1,-1,-1,-1,-1,0,4,5,1,0,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,4,5,8,5,3,9,0,5,0,3,5,-1,-1,-1,-1,9,4,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4,11,7,4,9,11,9,10,11,-1,-1,-1,-1,-1,-1,-1,0,8,3,4,9,7,9,11,7,9,10,11,-1,-1,-1,-1,1,10,11,1,11,4,1,4,0,7,4,11,-1,-1,-1,-1,3,1,4,3,4,8,1,10,4,7,4,11,10,11,4,-1,4,11,7,9,11,4,9,2,11,9,1,2,-1,-1,-1,-1,9,7,4,9,11,7,9,1,11,2,11,1,0,8,3,-1,11,7,4,11,4,2,2,4,0,-1,-1,-1,-1,-1,-1,-1,11,7,4,11,4,2,8,3,4,3,2,4,-1,-1,-1,-1,2,9,10,2,7,9,2,3,7,7,4,9,-1,-1,-1,-1,9,10,7,9,7,4,10,2,7,8,7,0,2,0,7,-1,3,7,10,3,10,2,7,4,10,1,10,0,4,0,10,-1,1,10,2,8,7,4,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4,9,1,4,1,7,7,1,3,-1,-1,-1,-1,-1,-1,-1,4,9,1,4,1,7,0,8,1,8,7,1,-1,-1,-1,-1,4,0,3,7,4,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4,8,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,9,10,8,10,11,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,3,0,9,3,9,11,11,9,10,-1,-1,-1,-1,-1,-1,-1,0,1,10,0,10,8,8,10,11,-1,-1,-1,-1,-1,-1,-1,3,1,10,11,3,10,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,2,11,1,11,9,9,11,8,-1,-1,-1,-1,-1,-1,-1,3,0,9,3,9,11,1,2,9,2,11,9,-1,-1,-1,-1,0,2,11,8,0,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,3,2,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2,3,8,2,8,10,10,8,9,-1,-1,-1,-1,-1,-1,-1,9,10,2,0,9,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2,3,8,2,8,10,0,1,8,1,10,8,-1,-1,-1,-1,1,10,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,3,8,9,1,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,9,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,3,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1]),ql=class extends Mn{constructor(){super(),this.name=`RoomEnvironment`,this.position.y=-3.5;let e=new Ni;e.deleteAttribute(`uv`);let t=new Xi({side:1}),n=new Xi,r=new Ma(16777215,900,28,2);r.position.set(.418,16.199,.3),this.add(r);let i=new Yr(e,t);i.position.set(-.757,13.219,.717),i.scale.set(31.713,28.305,28.591),this.add(i);let a=new si(e,n,6),o=new Cn;o.position.set(-10.906,2.009,1.846),o.rotation.set(0,-.195,0),o.scale.set(2.328,7.905,4.651),o.updateMatrix(),a.setMatrixAt(0,o.matrix),o.position.set(-5.607,-.754,-.758),o.rotation.set(0,.994,0),o.scale.set(1.97,1.534,3.955),o.updateMatrix(),a.setMatrixAt(1,o.matrix),o.position.set(6.167,.857,7.803),o.rotation.set(0,.561,0),o.scale.set(3.927,6.285,3.687),o.updateMatrix(),a.setMatrixAt(2,o.matrix),o.position.set(-2.017,.018,6.124),o.rotation.set(0,.333,0),o.scale.set(2.002,4.566,2.064),o.updateMatrix(),a.setMatrixAt(3,o.matrix),o.position.set(2.291,-.756,-2.621),o.rotation.set(0,-.286,0),o.scale.set(1.546,1.552,1.496),o.updateMatrix(),a.setMatrixAt(4,o.matrix),o.position.set(-2.193,-.369,-5.547),o.rotation.set(0,.516,0),o.scale.set(3.875,3.487,2.986),o.updateMatrix(),a.setMatrixAt(5,o.matrix),this.add(a);let s=new Yr(e,Jl(50));s.position.set(-16.116,14.37,8.208),s.scale.set(.1,2.428,2.739),this.add(s);let c=new Yr(e,Jl(50));c.position.set(-16.109,18.021,-8.207),c.scale.set(.1,2.425,2.751),this.add(c);let l=new Yr(e,Jl(17));l.position.set(14.904,12.198,-1.832),l.scale.set(.15,4.265,6.331),this.add(l);let u=new Yr(e,Jl(43));u.position.set(-.462,8.89,14.52),u.scale.set(4.38,5.441,.088),this.add(u);let d=new Yr(e,Jl(20));d.position.set(3.235,11.486,-12.541),d.scale.set(2.5,2,.1),this.add(d);let f=new Yr(e,Jl(100));f.position.set(0,20,0),f.scale.set(1,.1,1),this.add(f)}dispose(){let e=new Set;this.traverse(t=>{t.isMesh&&(e.add(t.geometry),e.add(t.material))});for(let t of e)t.dispose()}};function Jl(e){return new Qi({color:0,emissive:16777215,emissiveIntensity:e})}var Yl=Object.freeze({material:`eshkol.ulg.material-closure.v0`,eos:`eshkol.ulg.eos-closure.v0`,"phase-equilibrium":`eshkol.ulg.phase-equilibrium-closure.v0`,transport:`eshkol.ulg.transport-closure.v0`,mechanical:`eshkol.ulg.mechanical-closure.v0`,optical:`eshkol.ulg.optical-closure.v0`,radiation:`eshkol.ulg.radiation-closure.v0`,"wall-boundary":`eshkol.ulg.wall-boundary-closure.v0`}),Xl=`moonlab.ulg.microphysics-reference.v0`,Zl=Object.freeze([`materialValidation`,`eosValidation`,`mechanicalValidation`,`opticalValidation`,`phaseChangeValidation`,`sphValidation`,`scientificValidation`,`fullPhysicsValidation`]);Object.freeze([`xMin`,`xMax`,`yMin`,`yMax`,`zMin`,`zMax`]);function Ql(){let e={};for(let t of Zl)e[t]=!1;return e}function $l(e={},{evidenceRefs:t=[]}={}){let n=Array.isArray(t)&&t.length>0,r=Ql();for(let t of Zl){let i=e[t]===!0;if(i&&!n)throw Error(`Overclaim rejected: ${t} cannot be true without validation.evidenceRefs`);r[t]=i&&n}return r}function eu(e,t){if(!e||typeof e!=`object`)throw Error(`${t} closure requires a validityDomain`);let n=e.temperatureK;if(!Array.isArray(n)||n.length!==2||!(Number(n[0])<Number(n[1])))throw Error(`${t} closure validityDomain.temperatureK must be an ascending [min, max] range`)}function tu({artifactId:e,species:t,producer:n={},data:r={},derived:i={},comparison:a=null,quantitative:o=!1,provenance:s={}}){if(!e||!t)throw Error(`artifactId and species are required for microphysics reference artifacts`);return{schema:Xl,artifactId:e,sourceService:`moonlab`,species:t,producer:n,data:r,derived:i,comparison:a,quantitative:o===!0,status:o===!0?`produced-quantitative`:`produced-model-not-quantitative`,...Ql(),provenance:{sourceService:`moonlab`,...s,notes:[...s.notes||[],`Produced microphysics evidence: exact ground state of a MoonLab molecular Hamiltonian.`,`Evidence only; does not by itself flip closure material/EOS/scientific validation.`]}}}function nu({closureFamily:e,closureId:t,material:n,inputRefs:r=[],producer:i={},validityDomain:a={},units:o={},properties:s={},derivatives:c=!1,descriptors:l={},uncertainty:u={},tolerance:d={},validation:f={},provenance:p={}}){let m=Yl[e];if(!m)throw Error(`Unknown closure family: ${e}`);if(!t)throw Error(`closureId is required for material closures`);eu(a,e);let h=$l(f,{evidenceRefs:f.evidenceRefs});return{schema:m,closureFamily:e,closureId:t,closureKind:`sph-phase-${e}`,material:n||null,inputRefs:r,producer:{service:i.service||`eshkol`,commit:i.commit||null,toolchain:i.toolchain||null,...i},validityDomain:a,units:o,properties:s,derivatives:c,descriptors:l,uncertainty:u,tolerance:d,validation:{status:f.status||`reference-fixture-unvalidated`,evidenceRefs:Array.isArray(f.evidenceRefs)?f.evidenceRefs:[],...h},closureBacked:!0,provenance:{sourceService:`eshkol`,...p,notes:[...p.notes||[],`Closure family ${e}; values from tagged reference fixtures unless evidenceRefs are present.`,`No validated material/EOS/mechanical/optical/phase/SPH/scientific physics is claimed without evidence.`]}}}var ru=`peercompute.ulg.closure-law-graph.v0`,iu=`peercompute.ulg.optical-gpu-table.v0`,au=`peercompute.ulg.optical-gpu-lookup.v0`,ou=`peercompute.ulg.optical-gpu-lookup-execution.v0`,su=`peercompute.ulg.optical-gpu-lookup-parity.v0`,cu=`peercompute.ulg.sph-gpu-particle-buffer.v0`,lu=`peercompute.ulg.sph-gpu-particle-buffer-set.v0`,uu=`peercompute.ulg.sph-gpu-thermal-material-table.v0`,du=`peercompute.ulg.sph-gpu-thermal-closure-graph-set.v0`,fu=`peercompute.ulg.sph-gpu-thermal-closure-graph-bank.v0`,pu=`peercompute.ulg.sph-gpu-thermal-phase-response-table.v0`,mu=`peercompute.ulg.sph-gpu-thermal-step.v0`,hu=`peercompute.ulg.sph-gpu-reaction-table.v0`,gu=`peercompute.ulg.sph-gpu-reaction-step.v0`,_u=`peercompute.ulg.sph-gpu-render-rows.v0`,vu=`peercompute.ulg.sph-gpu-render-field.v0`,yu=`peercompute.ulg.mls-mpm-gpu-particle-buffer.v0`,bu=`peercompute.ulg.mls-mpm-gpu-particle-buffer-set.v0`,xu=`peercompute.ulg.mls-mpm-gpu-mechanics-prediction.v0`,Su=`peercompute.ulg.mls-mpm-gpu-mechanics-execution.v0`,Cu=`peercompute.ulg.mls-mpm-gpu-mechanics-parity.v0`,wu=`peercompute.ulg.mls-mpm-gpu-grid-projection.v0`,Tu=`peercompute.ulg.mls-mpm-gpu-grid-projection-execution.v0`,Eu=`peercompute.ulg.mls-mpm-gpu-grid-projection-parity.v0`,Du=`peercompute.ulg.mls-mpm-gpu-grid-update.v0`,Ou=`peercompute.ulg.mls-mpm-gpu-grid-update-execution.v0`,ku=`peercompute.ulg.mls-mpm-gpu-grid-update-parity.v0`,Au=`peercompute.ulg.mls-mpm-gpu-g2p-reconstruction.v0`,ju=`peercompute.ulg.mls-mpm-gpu-g2p-reconstruction-execution.v0`,Mu=`peercompute.ulg.mls-mpm-gpu-g2p-reconstruction-parity.v0`,Nu=`peercompute.ulg.mls-mpm-gpu-resident-step.v0`,Pu=`peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0`,Fu=`peercompute.ulg.mls-mpm-gpu-resident-steps-execution.v0`,Iu=`peercompute.ulg.mls-mpm-gpu-resident-summary.v0`,Lu=`peercompute.ulg.mls-mpm-gpu-resident-summary-execution.v0`,Ru=Object.freeze([`axis:f32`,`value:f32`,`derivative:f32`,`pad0:f32`]),zu=Object.freeze([`opId:f32`,`inputSlot:f32`,`outputSlot:f32`,`derivativeSlot:f32`,`sampleOffset:f32`,`sampleCount:f32`,`domainMin:f32`,`domainMax:f32`,`edgeOffset:f32`,`edgeCount:f32`,`interpolationId:f32`,`statusFlagId:f32`,`provenanceIndex:f32`,`materialId:f32`,`phaseId:f32`,`pad0:f32`]),Bu=Object.freeze([`sourceSlot:f32`,`destinationNode:f32`,`unitId:f32`,`sensitivityTag:f32`]),Vu=Object.freeze([`value:f32`,`derivative:f32`,`status:f32`,`pad0:f32`]),Hu=Object.freeze([`nodeId:f32`,`status:f32`,`observedInput:f32`,`limit:f32`]),Uu=Object.freeze({tableLinear:1,tableStep:2}),Wu=Object.freeze({linear:1}),Gu=Object.freeze({ok:1,outOfDomainLow:2,outOfDomainHigh:3,unsupportedOperation:4}),Ku=Object.freeze([`materialId:f32`,`phaseId:f32`,`spectralOffset:f32`,`spectralCount:f32`,`baseColorLinearR:f32`,`baseColorLinearG:f32`,`baseColorLinearB:f32`,`metalness:f32`,`roughness:f32`,`transmission:f32`,`opacity:f32`,`ior:f32`,`attenuationLinearR:f32`,`attenuationLinearG:f32`,`attenuationLinearB:f32`,`attenuationDistanceM:f32`,`absorptionCoefficientPerM:f32`,`scatteringCoefficientPerM:f32`,`renderModelId:f32`,`vertexColorPolicyId:f32`,`opticalDepth:f32`,`blocked:f32`,`status:f32`,`pad0:f32`]),qu=Object.freeze([`wavelengthNm:f32`,`reflectance:f32`,`transmittance:f32`,`absorptionCoefficientPerM:f32`,`scatteringCoefficientPerM:f32`,`n:f32`,`k:f32`,`pad0:f32`]),Ju=Object.freeze([`materialId:f32`,`phaseId:f32`,`pad0:f32`,`pad1:f32`]),Yu=Object.freeze([`baseColorLinearR:f32`,`baseColorLinearG:f32`,`baseColorLinearB:f32`,`opacity:f32`,`metalness:f32`,`roughness:f32`,`transmission:f32`,`ior:f32`,`renderModelId:f32`,`vertexColorPolicyId:f32`,`status:f32`,`recordIndex:f32`]),Xu=Object.freeze([`positionXM:f32`,`positionYM:f32`,`positionZM:f32`,`massKg:f32`,`velocityXMPerS:f32`,`velocityYMPerS:f32`,`velocityZMPerS:f32`,`specificInternalEnergyJPerKg:f32`]),Zu=Object.freeze([`materialId:f32`,`phaseId:f32`,`temperatureK:f32`,`restDensityKgPerM3:f32`,`phaseFractionSolid:f32`,`phaseFractionLiquid:f32`,`phaseFractionGas:f32`,`phaseFractionPlasma:f32`,`smoothingLengthM:f32`,`representedEntityCount:f32`,`status:f32`,`pad0:f32`]),Qu=Object.freeze([`materialId:f32`,`segmentOffset:f32`,`segmentCount:f32`,`status:f32`]),$u=Object.freeze([`materialId:f32`,`segmentType:f32`,`phaseFromId:f32`,`phaseToId:f32`,`energyStartJPerKg:f32`,`energyEndJPerKg:f32`,`temperatureStartK:f32`,`temperatureEndK:f32`,`densityFromKgPerM3:f32`,`densityToKgPerM3:f32`,`status:f32`,`pad0:f32`]),ed=Object.freeze([`materialId:f32`,`responseOffset:f32`,`responseCount:f32`,`status:f32`]),td=Object.freeze([`materialId:f32`,`segmentType:f32`,`temperatureGraphIndex:f32`,`status:f32`,`energyStartJPerKg:f32`,`energyEndJPerKg:f32`,`phaseFromId:f32`,`phaseToId:f32`,`densityFromKgPerM3:f32`,`densityToKgPerM3:f32`,`densityPolicyId:f32`,`stablePhasePolicyId:f32`,`fractionFromSlope:f32`,`fractionFromIntercept:f32`,`fractionToSlope:f32`,`fractionToIntercept:f32`]),nd=Object.freeze([`reactantAMaterialId:f32`,`reactantBMaterialId:f32`,`productMaterialId:f32`,`activationTemperatureK:f32`,`specificEnthalpyJPerKg:f32`,`contactRadiusM:f32`,`phaseMaskA:f32`,`phaseMaskB:f32`,`status:f32`,`pad0:f32`,`pad1:f32`,`pad2:f32`]),rd=Object.freeze([`materialId:f32`,`phaseId:f32`,`restDensityKgPerM3:f32`,`effectiveBulkModulusPa:f32`,`shearModulusPa:f32`,`lameLambdaPa:f32`,`soundSpeedMPerS:f32`,`eosModelId:f32`,`solidFlag:f32`,`status:f32`,`pad0:f32`,`pad1:f32`]),id=Object.freeze([`positionXM:f32`,`positionYM:f32`,`positionZM:f32`,`massKg:f32`,`materialId:f32`,`phaseId:f32`,`temperatureK:f32`,`status:f32`,`restDensityKgPerM3:f32`,`phaseFractionGas:f32`,`representedEntityCount:f32`,`pad0:f32`]),ad=Object.freeze([`materialId:f32`,`phaseId:f32`,`fieldOffset:f32`,`fieldCellCount:f32`,`resolution:f32`,`isolation:f32`,`subtract:f32`,`strength:f32`,`radiusNorm:f32`,`colorLinearR:f32`,`colorLinearG:f32`,`colorLinearB:f32`,`status:f32`,`pad0:f32`,`pad1:f32`,`pad2:f32`]),od=Object.freeze([`density:f32`,`paletteLinearR:f32`,`paletteLinearG:f32`,`paletteLinearB:f32`]),sd=Object.freeze(`deformationF00:f32.deformationF01:f32.deformationF02:f32.deformationF10:f32.deformationF11:f32.deformationF12:f32.deformationF20:f32.deformationF21:f32.deformationF22:f32.affineC00:f32.affineC01:f32.affineC02:f32.affineC10:f32.affineC11:f32.affineC12:f32.affineC20:f32.affineC21:f32.affineC22:f32.volumeRatioJ:f32.restVolumeM3:f32.solidFlag:f32.status:f32.effectiveBulkModulusPa:f32.shearModulusPa:f32.lameLambdaPa:f32.soundSpeedMPerS:f32.eosModelId:f32.constitutiveStatus:f32.pad0:f32.pad1:f32.pad2:f32.pad3:f32`.split(`.`)),cd=Object.freeze([`massKg:f32`,`momentumXKgMPerS:f32`,`momentumYKgMPerS:f32`,`momentumZKgMPerS:f32`,`nodeXM:f32`,`nodeYM:f32`,`nodeZM:f32`,`status:f32`]),ld=Object.freeze([`massKg:f32`,`velocityXMPerS:f32`,`velocityYMPerS:f32`,`velocityZMPerS:f32`,`nodeXM:f32`,`nodeYM:f32`,`nodeZM:f32`,`status:f32`]),ud=Object.freeze([`particleCount:f32`,`gridNodeCount:f32`,`activeGridNodeCount:f32`,`sourceMassKg:f32`,`nextMassKg:f32`,`massDeltaKg:f32`,`sourceMomentumXKgMPerS:f32`,`sourceMomentumYKgMPerS:f32`,`sourceMomentumZKgMPerS:f32`,`nextMomentumXKgMPerS:f32`,`nextMomentumYKgMPerS:f32`,`nextMomentumZKgMPerS:f32`,`momentumDeltaXKgMPerS:f32`,`momentumDeltaYKgMPerS:f32`,`momentumDeltaZKgMPerS:f32`,`maxSpeedMPerS:f32`,`maxDisplacementM:f32`,`minVolumeRatioJ:f32`,`maxVolumeRatioJ:f32`,`status:f32`]),dd=Object.freeze({f32:{name:`f32`,byteSize:4,lanes:1},u32:{name:`u32`,byteSize:4,lanes:1},i32:{name:`i32`,byteSize:4,lanes:1},complex64:{name:`complex64`,byteSize:8,lanes:2,scalar:`f32`}});function fd(e,t){if(e===!0)throw Error(`${t} must remain false for closure-table WGSL descriptors`);return!1}function pd(e,t){let n=Number(e);if(!Number.isFinite(n))throw TypeError(`${t} must be finite`);return n}function md(e,t,n){for(let r of t)if(e?.[r]!=null)return pd(e[r],n);throw TypeError(`${n} is required`)}function hd(e,t,n){let r=e?.[t]??e?.derivative??e?.dEdr;return r==null?null:pd(r,`samples[${n}].derivative`)}function gd(e,t,n,r,i){let a=hd(e[t],i,t);if(a!=null)return a;let o=Math.max(0,t-1),s=Math.min(e.length-1,t+1),c=md(e[o],[n,`axis`,`r`,`x`],`samples[${o}].axis`),l=md(e[s],[n,`axis`,`r`,`x`],`samples[${s}].axis`);if(l===c)return 0;let u=md(e[o],[r,`value`,`energy`],`samples[${o}].value`);return(md(e[s],[r,`value`,`energy`],`samples[${s}].value`)-u)/(l-c)}function _d(e,{axisKey:t=`axis`,outputKey:n=`value`,derivativeKey:r=`derivative`}={}){if(!Array.isArray(e)||e.length===0)throw TypeError(`samples must be a non-empty array`);let i=new Float32Array(e.length*Ru.length);return e.forEach((a,o)=>{let s=o*Ru.length;i[s]=md(a,[t,`axis`,`r`,`x`],`samples[${o}].axis`),i[s+1]=md(a,[n,`value`,`energy`],`samples[${o}].value`),i[s+2]=gd(e,o,t,n,r),i[s+3]=0}),i}function vd(e){if(typeof e==`number`)return pd(e,`node.opId`);let t=Uu[e||`tableLinear`];if(!t)throw RangeError(`Unsupported closure law graph op: ${e}`);return t}function yd(e){if(typeof e==`number`)return pd(e,`node.interpolationId`);let t=Wu[e||`linear`];if(!t)throw RangeError(`Unsupported closure law graph interpolation: ${e}`);return t}function bd(e,t,n=0){let r=e==null?n:Number(e);if(!Number.isInteger(r)||r<0)throw TypeError(`${t} must be a non-negative integer`);return r}function xd({graphId:e,nodeCount:t,edgeCount:n=0,sampleCount:r,slotCount:i,statusCount:a=t,strategy:o=`flat-webgpu-closure-law-graph`,scientificValidation:s=!1,fullPhysicsValidation:c=!1,materialValidation:l=!1,eosValidation:u=!1,sphValidation:d=!1,phaseChangeValidation:f=!1}={}){if(!e)throw Error(`graphId is required`);for(let[e,o]of Object.entries({nodeCount:t,edgeCount:n,sampleCount:r,slotCount:i,statusCount:a}))if(!Number.isInteger(o)||o<0)throw TypeError(`${e} must be a non-negative integer`);return{schema:ru,abiVersion:`0.5`,status:`declared-flat-closure-law-graph`,strategy:o,graphId:e,nodeCount:t,edgeCount:n,sampleCount:r,slotCount:i,statusCount:a,nodeLayout:[...zu],nodeStrideFloats:zu.length,nodeStrideBytes:zu.length*dd.f32.byteSize,edgeLayout:[...Bu],edgeStrideFloats:Bu.length,edgeStrideBytes:Bu.length*dd.f32.byteSize,sampleLayout:[...Ru],sampleStrideFloats:Ru.length,sampleStrideBytes:Ru.length*dd.f32.byteSize,slotLayout:[...Vu],slotStrideFloats:Vu.length,slotStrideBytes:Vu.length*dd.f32.byteSize,statusLayout:[...Hu],statusStrideFloats:Hu.length,statusStrideBytes:Hu.length*dd.f32.byteSize,opIds:{...Uu},interpolationIds:{...Wu},statusIds:{...Gu},storageAddressSpace:`storage`,storageAccess:`read/read_write`,scientificValidation:fd(s,`scientificValidation`),fullPhysicsValidation:fd(c,`fullPhysicsValidation`),materialValidation:fd(l,`materialValidation`),eosValidation:fd(u,`eosValidation`),sphValidation:fd(d,`sphValidation`),phaseChangeValidation:fd(f,`phaseChangeValidation`)}}function Sd(e){if(!Array.isArray(e)||e.length===0)throw TypeError(`nodes must be a non-empty array`);let t=new Float32Array(e.length*zu.length);return e.forEach((e,n)=>{let r=n*zu.length;t[r]=vd(e.opId??e.op),t[r+1]=bd(e.inputSlot,`nodes[${n}].inputSlot`),t[r+2]=bd(e.outputSlot,`nodes[${n}].outputSlot`),t[r+3]=bd(e.derivativeSlot,`nodes[${n}].derivativeSlot`),t[r+4]=bd(e.sampleOffset,`nodes[${n}].sampleOffset`),t[r+5]=bd(e.sampleCount,`nodes[${n}].sampleCount`),t[r+6]=pd(e.domainMin,`nodes[${n}].domainMin`),t[r+7]=pd(e.domainMax,`nodes[${n}].domainMax`),t[r+8]=bd(e.edgeOffset,`nodes[${n}].edgeOffset`,0),t[r+9]=bd(e.edgeCount,`nodes[${n}].edgeCount`,0),t[r+10]=yd(e.interpolationId??e.interpolation),t[r+11]=bd(e.statusFlagId,`nodes[${n}].statusFlagId`,n),t[r+12]=bd(e.provenanceIndex,`nodes[${n}].provenanceIndex`,0),t[r+13]=pd(e.materialId??0,`nodes[${n}].materialId`),t[r+14]=pd(e.phaseId??0,`nodes[${n}].phaseId`),t[r+15]=0}),t}function Cd(e=[]){let t=new Float32Array(Math.max(0,e.length)*Bu.length);return e.forEach((e,n)=>{let r=n*Bu.length;t[r]=bd(e.sourceSlot,`edges[${n}].sourceSlot`),t[r+1]=bd(e.destinationNode,`edges[${n}].destinationNode`),t[r+2]=bd(e.unitId,`edges[${n}].unitId`,0),t[r+3]=bd(e.sensitivityTag,`edges[${n}].sensitivityTag`,0)}),t}function wd(e,t={}){if(!Number.isInteger(e)||e<=0)throw TypeError(`slotCount must be a positive integer`);let n=new Float32Array(e*Vu.length);for(let r=0;r<e;r+=1){let e=Array.isArray(t)?t[r]:t[String(r)],i=r*Vu.length;typeof e==`number`?(n[i]=pd(e,`slot[${r}].value`),n[i+2]=Gu.ok):e&&typeof e==`object`&&(n[i]=pd(e.value??0,`slot[${r}].value`),n[i+1]=pd(e.derivative??0,`slot[${r}].derivative`),n[i+2]=pd(e.status??Gu.ok,`slot[${r}].status`))}return n}function Td(e){if(!Number.isInteger(e)||e<0)throw TypeError(`statusCount must be a non-negative integer`);return new Float32Array(e*Hu.length)}function Ed({graphId:e,nodes:t,edges:n=[],samples:r,slotCount:i,initialSlots:a={},statusCount:o=t?.length??0,...s}={}){let c=Sd(t),l=Cd(n),u=_d(r),d=wd(i,a),f=Td(o);return{...xd({graphId:e,nodeCount:t.length,edgeCount:n.length,sampleCount:r.length,slotCount:i,statusCount:o,...s}),nodeRows:c,edgeRows:l,sampleRows:u,slotRows:d,statusRows:f,nodeRowByteLength:c.byteLength,edgeRowByteLength:l.byteLength,sampleRowByteLength:u.byteLength,slotRowByteLength:d.byteLength,statusRowByteLength:f.byteLength,scientificValidation:!1,fullPhysicsValidation:!1}}function Dd(e){let t=Od(e),n=2166136261;for(let e=0;e<t.length;e+=1)n^=t.charCodeAt(e),n=Math.imul(n,16777619);return`ulg:${(n>>>0).toString(16).padStart(8,`0`)}`}function Od(e){return Array.isArray(e)?`[${e.map(e=>Od(e)).join(`,`)}]`:e&&typeof e==`object`?`{${Object.keys(e).sort().map(t=>`${JSON.stringify(t)}:${Od(e[t])}`).join(`,`)}}`:JSON.stringify(e)}var kd=`
struct TensorDescriptor {
  offset_words: u32,
  length_words: u32,
  dtype: u32,
  tensor_layout: u32,
};

struct ClosureTableSample {
  axis: f32,
  value: f32,
  derivative: f32,
  _pad0: f32,
};

fn complex64_mul(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
  return vec2<f32>(
    a.x * b.x - a.y * b.y,
    a.x * b.y + a.y * b.x
  );
}

fn complex64_norm2(value: vec2<f32>) -> f32 {
  return dot(value, value);
}
`;`${kd}`,`${kd}`,`${kd}`;var Ad=`
struct OpticalLookupParams {
  record_count: u32,
  query_count: u32,
  _pad0: u32,
  _pad1: u32,
};

@group(0) @binding(0) var<storage, read> optical_records: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> optical_queries: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> optical_outputs: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> optical_params: OpticalLookupParams;

fn record_row(record_index: u32, row: u32) -> vec4<f32> {
  return optical_records[record_index * 6u + row];
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let query_index = global_id.x;
  if (query_index >= optical_params.query_count) {
    return;
  }

  let query = optical_queries[query_index];
  var matched_index = -1.0;
  var out0 = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  var out1 = vec4<f32>(0.0, 0.0, 0.0, 1.0);
  var out2 = vec4<f32>(0.0, 0.0, 255.0, -1.0);

  for (var record_index = 0u; record_index < optical_params.record_count; record_index = record_index + 1u) {
    let row0 = record_row(record_index, 0u);
    if (row0.x == query.x && row0.y == query.y) {
      let row1 = record_row(record_index, 1u);
      let row2 = record_row(record_index, 2u);
      let row4 = record_row(record_index, 4u);
      let row5 = record_row(record_index, 5u);
      matched_index = f32(record_index);
      out0 = vec4<f32>(row1.x, row1.y, row1.z, row2.z);
      out1 = vec4<f32>(row1.w, row2.x, row2.y, row2.w);
      out2 = vec4<f32>(row4.z, row4.w, row5.z, matched_index);
      break;
    }
  }

  optical_outputs[query_index * 3u] = out0;
  optical_outputs[query_index * 3u + 1u] = out1;
  optical_outputs[query_index * 3u + 2u] = out2;
}
`,jd=`
struct ThermalParams {
  particle_count: u32,
  material_count: u32,
  response_count: u32,
  _pad0: u32,
  dt: f32,
  smoothing_length_m: f32,
  conduction_rate: f32,
  wall_rate: f32,
  wall_layer_m: f32,
  box_x: f32,
  box_y: f32,
  box_z: f32,
  wall_x_min_k: f32,
  wall_x_max_k: f32,
  wall_y_min_k: f32,
  wall_y_max_k: f32,
  wall_z_min_k: f32,
  wall_z_max_k: f32,
  _pad1: f32,
  _pad2: f32,
};

@group(0) @binding(0) var<storage, read> sph_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> sph_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> phase_response_records: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> phase_responses: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> thermal_graph_nodes: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> thermal_graph_samples: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> out_sph_state: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> out_sph_thermo: array<vec4<f32>>;
@group(0) @binding(8) var<uniform> params: ThermalParams;

fn state_pos_mass(index: u32) -> vec4<f32> {
  return sph_state[index * 2u];
}

fn state_vel_u(index: u32) -> vec4<f32> {
  return sph_state[index * 2u + 1u];
}

fn thermo_row0(index: u32) -> vec4<f32> {
  return sph_thermo[index * 3u];
}

fn thermo_row1(index: u32) -> vec4<f32> {
  return sph_thermo[index * 3u + 1u];
}

fn thermo_row2(index: u32) -> vec4<f32> {
  return sph_thermo[index * 3u + 2u];
}

fn response_row0(response_index: u32) -> vec4<f32> {
  return phase_responses[response_index * 4u];
}

fn response_row1(response_index: u32) -> vec4<f32> {
  return phase_responses[response_index * 4u + 1u];
}

fn response_row2(response_index: u32) -> vec4<f32> {
  return phase_responses[response_index * 4u + 2u];
}

fn response_row3(response_index: u32) -> vec4<f32> {
  return phase_responses[response_index * 4u + 3u];
}

fn graph_node_row1(graph_index: u32) -> vec4<f32> {
  return thermal_graph_nodes[graph_index * 4u + 1u];
}

fn sample_temperature_from_graph(graph_index: u32, specific_internal_energy: f32) -> f32 {
  let node1 = graph_node_row1(graph_index);
  let sample_offset = u32(max(node1.x, 0.0));
  let sample_count = u32(max(node1.y, 0.0));
  if (sample_count < 2u) {
    return 0.0;
  }
  let domain_min = node1.z;
  let domain_max = node1.w;
  let x = clamp(specific_internal_energy, domain_min, domain_max);
  var left_index = sample_offset;
  var right_index = sample_offset + sample_count - 1u;
  for (var index = sample_offset; index + 1u < sample_offset + sample_count; index = index + 1u) {
    let left_axis = thermal_graph_samples[index].x;
    let right_axis = thermal_graph_samples[index + 1u].x;
    if (x >= left_axis && x <= right_axis) {
      left_index = index;
      right_index = index + 1u;
      break;
    }
  }
  let left = thermal_graph_samples[left_index];
  let right = thermal_graph_samples[right_index];
  if (right.x == left.x) {
    return left.y;
  }
  let t = clamp((x - left.x) / (right.x - left.x), 0.0, 1.0);
  return left.y + t * (right.y - left.y);
}

fn phase_fraction(phase_id: f32, solid: f32, liquid: f32, gas: f32, plasma: f32) -> f32 {
  if (phase_id == 1.0) { return solid; }
  if (phase_id == 2.0) { return liquid; }
  if (phase_id == 3.0) { return gas; }
  if (phase_id == 4.0) { return plasma; }
  return 0.0;
}

fn write_thermal_state(index: u32, material_id: f32, next_u: f32, source_row1: vec4<f32>, source_row2: vec4<f32>) {
  var material_response_offset = 0u;
  var material_response_count = 0u;
  var found_material = false;
  for (var record_index = 0u; record_index < params.material_count; record_index = record_index + 1u) {
    let record = phase_response_records[record_index];
    if (record.x == material_id) {
      material_response_offset = u32(record.y);
      material_response_count = u32(record.z);
      found_material = true;
      break;
    }
  }

  if (!found_material || material_response_count == 0u) {
    out_sph_thermo[index * 3u] = vec4<f32>(material_id, 0.0, 0.0, source_row1.x);
    out_sph_thermo[index * 3u + 1u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
    out_sph_thermo[index * 3u + 2u] = vec4<f32>(source_row2.x, source_row2.y, 255.0, 0.0);
    return;
  }

  var selected = material_response_offset;
  for (var local = 0u; local < material_response_count; local = local + 1u) {
    let candidate = material_response_offset + local;
    let row1 = response_row1(candidate);
    selected = candidate;
    if (next_u <= row1.y || local + 1u == material_response_count) {
      break;
    }
  }

  let response0 = response_row0(selected);
  let response1 = response_row1(selected);
  let response2 = response_row2(selected);
  let response3 = response_row3(selected);
  if (response0.w != 1.0 || response0.z < 0.0) {
    out_sph_thermo[index * 3u] = vec4<f32>(material_id, 0.0, 0.0, source_row1.x);
    out_sph_thermo[index * 3u + 1u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
    out_sph_thermo[index * 3u + 2u] = vec4<f32>(source_row2.x, source_row2.y, 255.0, 0.0);
    return;
  }
  let denom = max(response1.y - response1.x, 1.0e-12);
  let alpha = clamp((next_u - response1.x) / denom, 0.0, 1.0);
  let temperature_k = sample_temperature_from_graph(u32(response0.z), next_u);
  let from_fraction = clamp(response3.x * alpha + response3.y, 0.0, 1.0);
  let to_fraction = clamp(response3.z * alpha + response3.w, 0.0, 1.0);
  let solid = phase_fraction(response1.z, from_fraction, 0.0, 0.0, 0.0)
    + phase_fraction(response1.w, to_fraction, 0.0, 0.0, 0.0);
  let liquid = phase_fraction(response1.z, 0.0, from_fraction, 0.0, 0.0)
    + phase_fraction(response1.w, 0.0, to_fraction, 0.0, 0.0);
  let gas = phase_fraction(response1.z, 0.0, 0.0, from_fraction, 0.0)
    + phase_fraction(response1.w, 0.0, 0.0, to_fraction, 0.0);
  let plasma = phase_fraction(response1.z, 0.0, 0.0, 0.0, from_fraction)
    + phase_fraction(response1.w, 0.0, 0.0, 0.0, to_fraction);
  var phase_id = response1.z;
  var rest_density = response2.x;
  if (response0.y == 2.0 && alpha >= 0.5 && response2.w == 1.0) {
    phase_id = response1.w;
  }
  if (response0.y == 2.0 && alpha >= 0.5 && response2.z == 1.0) {
    rest_density = response2.y;
  }

  out_sph_thermo[index * 3u] = vec4<f32>(material_id, phase_id, temperature_k, rest_density);
  out_sph_thermo[index * 3u + 1u] = vec4<f32>(solid, liquid, gas, plasma);
  out_sph_thermo[index * 3u + 2u] = vec4<f32>(source_row2.x, source_row2.y, 1.0, 0.0);
}

fn wall_temperature(face_index: u32) -> f32 {
  if (face_index == 0u) { return params.wall_x_min_k; }
  if (face_index == 1u) { return params.wall_x_max_k; }
  if (face_index == 2u) { return params.wall_y_min_k; }
  if (face_index == 3u) { return params.wall_y_max_k; }
  if (face_index == 4u) { return params.wall_z_min_k; }
  return params.wall_z_max_k;
}

fn wall_distance(position: vec3<f32>, face_index: u32) -> f32 {
  if (face_index == 0u) { return position.x; }
  if (face_index == 1u) { return params.box_x - position.x; }
  if (face_index == 2u) { return position.y; }
  if (face_index == 3u) { return params.box_y - position.y; }
  if (face_index == 4u) { return position.z; }
  return params.box_z - position.z;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }

  let pos_mass = state_pos_mass(particle_index);
  let vel_u = state_vel_u(particle_index);
  let row0 = thermo_row0(particle_index);
  let row1 = thermo_row1(particle_index);
  let row2 = thermo_row2(particle_index);
  let position = vec3<f32>(pos_mass.x, pos_mass.y, pos_mass.z);
  let mass = max(pos_mass.w, 1.0e-30);
  let temperature = row0.z;
  let support = 2.0 * params.smoothing_length_m;
  var du = 0.0;

  for (var other = 0u; other < params.particle_count; other = other + 1u) {
    if (other == particle_index) {
      continue;
    }
    let other_pos_mass = state_pos_mass(other);
    let delta = position - vec3<f32>(other_pos_mass.x, other_pos_mass.y, other_pos_mass.z);
    let distance = length(delta);
    if (distance < support) {
      let weight = 1.0 - distance / support;
      let other_temperature = thermo_row0(other).z;
      let dE = params.conduction_rate * (other_temperature - temperature) * weight * params.dt;
      du = du + dE / mass;
    }
  }

  for (var face = 0u; face < 6u; face = face + 1u) {
    let distance = wall_distance(position, face);
    if (distance < params.wall_layer_m) {
      let weight = 1.0 - distance / params.wall_layer_m;
      let dE = params.wall_rate * (wall_temperature(face) - temperature) * weight * params.dt;
      du = du + dE / mass;
    }
  }

  let next_u = vel_u.w + du;
  out_sph_state[particle_index * 2u] = pos_mass;
  out_sph_state[particle_index * 2u + 1u] = vec4<f32>(vel_u.x, vel_u.y, vel_u.z, next_u);
  write_thermal_state(particle_index, row0.x, next_u, row1, row2);
}
`,Md=`
struct ReactionParams {
  particle_count: u32,
  reaction_count: u32,
  product_phase_count: u32,
  material_count: u32,
  segment_count: u32,
  reset_mechanics: u32,
  _pad0: u32,
  _pad1: u32,
};

struct ThermalRows {
  row0: vec4<f32>,
  row1: vec4<f32>,
  row2: vec4<f32>,
};

struct ProductMechanics {
  rest_density: f32,
  bulk: f32,
  shear: f32,
  lambda: f32,
  sound_speed: f32,
  eos_model: f32,
  solid: f32,
  status: f32,
};

@group(0) @binding(0) var<storage, read> sph_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> sph_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> mls_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> reaction_records: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read> material_records: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read> thermal_segments: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> proposals: array<vec4<f32>>;
@group(0) @binding(8) var<storage, read_write> out_sph_state: array<vec4<f32>>;
@group(0) @binding(9) var<storage, read_write> out_sph_thermo: array<vec4<f32>>;
@group(0) @binding(10) var<storage, read_write> out_mls_mechanics: array<vec4<f32>>;
@group(0) @binding(11) var<uniform> params: ReactionParams;

fn state_pos_mass(index: u32) -> vec4<f32> {
  return sph_state[index * 2u];
}

fn state_vel_u(index: u32) -> vec4<f32> {
  return sph_state[index * 2u + 1u];
}

fn thermo_row0(index: u32) -> vec4<f32> {
  return sph_thermo[index * 3u];
}

fn thermo_row1(index: u32) -> vec4<f32> {
  return sph_thermo[index * 3u + 1u];
}

fn thermo_row2(index: u32) -> vec4<f32> {
  return sph_thermo[index * 3u + 2u];
}

fn reaction_row0(reaction_index: u32) -> vec4<f32> {
  return reaction_records[reaction_index * 3u];
}

fn reaction_row1(reaction_index: u32) -> vec4<f32> {
  return reaction_records[reaction_index * 3u + 1u];
}

fn reaction_row2(reaction_index: u32) -> vec4<f32> {
  return reaction_records[reaction_index * 3u + 2u];
}

fn product_phase_row0(record_index: u32) -> vec4<f32> {
  return reaction_records[(params.reaction_count + record_index) * 3u];
}

fn product_phase_row1(record_index: u32) -> vec4<f32> {
  return reaction_records[(params.reaction_count + record_index) * 3u + 1u];
}

fn product_phase_row2(record_index: u32) -> vec4<f32> {
  return reaction_records[(params.reaction_count + record_index) * 3u + 2u];
}

fn segment_row0(segment_index: u32) -> vec4<f32> {
  return thermal_segments[segment_index * 3u];
}

fn segment_row1(segment_index: u32) -> vec4<f32> {
  return thermal_segments[segment_index * 3u + 1u];
}

fn segment_row2(segment_index: u32) -> vec4<f32> {
  return thermal_segments[segment_index * 3u + 2u];
}

fn phase_mask_satisfied(mask_f: f32, phase_id_f: f32) -> bool {
  let mask = u32(mask_f + 0.5);
  if (mask == 0u) {
    return true;
  }
  let phase_id = u32(phase_id_f + 0.5);
  if (phase_id >= 31u) {
    return false;
  }
  return (mask & (1u << phase_id)) != 0u;
}

fn phase_fraction(phase_id: f32, solid: f32, liquid: f32, gas: f32, plasma: f32) -> f32 {
  if (phase_id == 1.0) { return solid; }
  if (phase_id == 2.0) { return liquid; }
  if (phase_id == 3.0) { return gas; }
  if (phase_id == 4.0) { return plasma; }
  return 0.0;
}

fn resolve_thermal_rows(material_id: f32, next_u: f32, source_row2: vec4<f32>) -> ThermalRows {
  var material_segment_offset = 0u;
  var material_segment_count = 0u;
  var found_material = false;
  for (var record_index = 0u; record_index < params.material_count; record_index = record_index + 1u) {
    let record = material_records[record_index];
    if (record.x == material_id) {
      material_segment_offset = u32(record.y);
      material_segment_count = u32(record.z);
      found_material = true;
      break;
    }
  }

  if (!found_material || material_segment_count == 0u) {
    return ThermalRows(
      vec4<f32>(material_id, 0.0, 0.0, 0.0),
      vec4<f32>(0.0, 0.0, 0.0, 0.0),
      vec4<f32>(source_row2.x, source_row2.y, 255.0, 0.0)
    );
  }

  var selected = material_segment_offset;
  for (var local = 0u; local < material_segment_count; local = local + 1u) {
    let candidate = material_segment_offset + local;
    let row1 = segment_row1(candidate);
    selected = candidate;
    if (next_u <= row1.y || local + 1u == material_segment_count) {
      break;
    }
  }

  let seg0 = segment_row0(selected);
  let seg1 = segment_row1(selected);
  let seg2 = segment_row2(selected);
  let denom = max(seg1.y - seg1.x, 1.0e-12);
  let alpha = clamp((next_u - seg1.x) / denom, 0.0, 1.0);
  let segment_type = seg0.y;
  var temperature_k = seg1.z + alpha * (seg1.w - seg1.z);
  var solid = 0.0;
  var liquid = 0.0;
  var gas = 0.0;
  var plasma = 0.0;
  var phase_id = seg0.z;
  var rest_density = seg2.x;

  if (segment_type == 2.0) {
    temperature_k = seg1.z;
    let from_fraction = 1.0 - alpha;
    let to_fraction = alpha;
    solid = phase_fraction(seg0.z, from_fraction, 0.0, 0.0, 0.0)
      + phase_fraction(seg0.w, to_fraction, 0.0, 0.0, 0.0);
    liquid = phase_fraction(seg0.z, 0.0, from_fraction, 0.0, 0.0)
      + phase_fraction(seg0.w, 0.0, to_fraction, 0.0, 0.0);
    gas = phase_fraction(seg0.z, 0.0, 0.0, from_fraction, 0.0)
      + phase_fraction(seg0.w, 0.0, 0.0, to_fraction, 0.0);
    plasma = phase_fraction(seg0.z, 0.0, 0.0, 0.0, from_fraction)
      + phase_fraction(seg0.w, 0.0, 0.0, 0.0, to_fraction);
    if (alpha >= 0.5) {
      phase_id = seg0.w;
      rest_density = seg2.y;
    }
  } else {
    solid = phase_fraction(seg0.z, 1.0, 0.0, 0.0, 0.0);
    liquid = phase_fraction(seg0.z, 0.0, 1.0, 0.0, 0.0);
    gas = phase_fraction(seg0.z, 0.0, 0.0, 1.0, 0.0);
    plasma = phase_fraction(seg0.z, 0.0, 0.0, 0.0, 1.0);
  }

  return ThermalRows(
    vec4<f32>(material_id, phase_id, temperature_k, rest_density),
    vec4<f32>(solid, liquid, gas, plasma),
    vec4<f32>(source_row2.x, source_row2.y, 1.0, 0.0)
  );
}

fn find_product_mechanics(material_id: f32, phase_id: f32) -> ProductMechanics {
  for (var record_index = 0u; record_index < params.product_phase_count; record_index = record_index + 1u) {
    let row0 = product_phase_row0(record_index);
    if (row0.x == material_id && row0.y == phase_id) {
      let row1 = product_phase_row1(record_index);
      let row2 = product_phase_row2(record_index);
      return ProductMechanics(row0.z, row0.w, row1.x, row1.y, row1.z, row1.w, row2.x, row2.y);
    }
  }
  return ProductMechanics(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 255.0);
}

fn copy_particle(index: u32) {
  out_sph_state[index * 2u] = sph_state[index * 2u];
  out_sph_state[index * 2u + 1u] = sph_state[index * 2u + 1u];
  out_sph_thermo[index * 3u] = sph_thermo[index * 3u];
  out_sph_thermo[index * 3u + 1u] = sph_thermo[index * 3u + 1u];
  out_sph_thermo[index * 3u + 2u] = sph_thermo[index * 3u + 2u];
  let mechanics_base = index * 8u;
  for (var row = 0u; row < 8u; row = row + 1u) {
    out_mls_mechanics[mechanics_base + row] = mls_mechanics[mechanics_base + row];
  }
}

fn write_reacted_mechanics(index: u32, mass_kg: f32, resolved: ThermalRows) {
  let mechanics = find_product_mechanics(resolved.row0.x, resolved.row0.y);
  var rest_density = resolved.row0.w;
  if (rest_density <= 0.0) {
    rest_density = mechanics.rest_density;
  }
  var rest_volume = 0.0;
  if (rest_density > 0.0) {
    rest_volume = mass_kg / rest_density;
  }
  let base = index * 8u;
  out_mls_mechanics[base] = vec4<f32>(1.0, 0.0, 0.0, 0.0);
  out_mls_mechanics[base + 1u] = vec4<f32>(1.0, 0.0, 0.0, 0.0);
  out_mls_mechanics[base + 2u] = vec4<f32>(1.0, 0.0, 0.0, 0.0);
  out_mls_mechanics[base + 3u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  out_mls_mechanics[base + 4u] = vec4<f32>(0.0, 0.0, 1.0, rest_volume);
  out_mls_mechanics[base + 5u] = vec4<f32>(mechanics.solid, mechanics.status, mechanics.bulk, mechanics.shear);
  out_mls_mechanics[base + 6u] = vec4<f32>(mechanics.lambda, mechanics.sound_speed, mechanics.eos_model, mechanics.status);
  out_mls_mechanics[base + 7u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
}

@compute @workgroup_size(64)
fn propose(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }

  let self_thermo = thermo_row0(particle_index);
  let self_material = self_thermo.x;
  let self_phase = self_thermo.y;
  let self_temperature = self_thermo.z;
  let self_pos_mass = state_pos_mass(particle_index);
  let self_pos = vec3<f32>(self_pos_mass.x, self_pos_mass.y, self_pos_mass.z);

  var best_partner = -1.0;
  var best_reaction = -1.0;
  var best_role = 0.0;
  var best_distance2 = 3.402823e38;

  for (var reaction_index = 0u; reaction_index < params.reaction_count; reaction_index = reaction_index + 1u) {
    let rx0 = reaction_row0(reaction_index);
    let rx1 = reaction_row1(reaction_index);
    let rx2 = reaction_row2(reaction_index);
    if (rx2.x != 1.0) {
      continue;
    }

    var partner_material = 0.0;
    var partner_phase_mask = 0.0;
    var role = 0.0;
    if (self_material == rx0.x && phase_mask_satisfied(rx1.z, self_phase)) {
      partner_material = rx0.y;
      partner_phase_mask = rx1.w;
      role = 1.0;
    } else if (self_material == rx0.y && phase_mask_satisfied(rx1.w, self_phase)) {
      partner_material = rx0.x;
      partner_phase_mask = rx1.z;
      role = 2.0;
    } else {
      continue;
    }

    let activation_k = rx0.w;
    let contact_radius2 = rx1.y * rx1.y;
    for (var other = 0u; other < params.particle_count; other = other + 1u) {
      if (other == particle_index) {
        continue;
      }
      let other_thermo = thermo_row0(other);
      if (other_thermo.x != partner_material || !phase_mask_satisfied(partner_phase_mask, other_thermo.y)) {
        continue;
      }
      if (max(self_temperature, other_thermo.z) < activation_k) {
        continue;
      }
      let other_pos_mass = state_pos_mass(other);
      let delta = self_pos - vec3<f32>(other_pos_mass.x, other_pos_mass.y, other_pos_mass.z);
      let distance2 = dot(delta, delta);
      if (distance2 > contact_radius2) {
        continue;
      }
      if (
        distance2 < best_distance2
        || (distance2 == best_distance2 && f32(other) < best_partner)
      ) {
        best_partner = f32(other);
        best_reaction = f32(reaction_index);
        best_role = role;
        best_distance2 = distance2;
      }
    }
  }

  proposals[particle_index] = vec4<f32>(best_partner, best_reaction, best_role, best_distance2);
}

@compute @workgroup_size(64)
fn resolve(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }

  let proposal = proposals[particle_index];
  if (proposal.x < 0.0 || proposal.y < 0.0) {
    copy_particle(particle_index);
    return;
  }
  let partner_index = u32(proposal.x + 0.5);
  if (partner_index >= params.particle_count) {
    copy_particle(particle_index);
    return;
  }
  let partner_proposal = proposals[partner_index];
  if (partner_proposal.x < 0.0 || u32(partner_proposal.x + 0.5) != particle_index || partner_proposal.y != proposal.y) {
    copy_particle(particle_index);
    return;
  }

  let reaction_index = u32(proposal.y + 0.5);
  let rx0 = reaction_row0(reaction_index);
  let rx1 = reaction_row1(reaction_index);
  let pos_mass = state_pos_mass(particle_index);
  let vel_u = state_vel_u(particle_index);
  let source_row2 = thermo_row2(particle_index);
  let next_u = vel_u.w - rx1.x;
  let resolved = resolve_thermal_rows(rx0.z, next_u, source_row2);

  out_sph_state[particle_index * 2u] = pos_mass;
  out_sph_state[particle_index * 2u + 1u] = vec4<f32>(vel_u.x, vel_u.y, vel_u.z, next_u);
  out_sph_thermo[particle_index * 3u] = resolved.row0;
  out_sph_thermo[particle_index * 3u + 1u] = resolved.row1;
  out_sph_thermo[particle_index * 3u + 2u] = resolved.row2;
  if (params.reset_mechanics != 0u) {
    write_reacted_mechanics(particle_index, pos_mass.w, resolved);
  } else {
    let mechanics_base = particle_index * 8u;
    for (var row = 0u; row < 8u; row = row + 1u) {
      out_mls_mechanics[mechanics_base + row] = mls_mechanics[mechanics_base + row];
    }
  }
}
`,Nd=`
struct RenderRowsParams {
  particle_count: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
};

@group(0) @binding(0) var<storage, read> sph_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> sph_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> render_rows: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> params: RenderRowsParams;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }

  let pos_mass = sph_state[particle_index * 2u];
  let thermo0 = sph_thermo[particle_index * 3u];
  let thermo1 = sph_thermo[particle_index * 3u + 1u];
  let thermo2 = sph_thermo[particle_index * 3u + 2u];
  render_rows[particle_index * 3u] = pos_mass;
  render_rows[particle_index * 3u + 1u] = vec4<f32>(thermo0.x, thermo0.y, thermo0.z, thermo2.z);
  render_rows[particle_index * 3u + 2u] = vec4<f32>(thermo0.w, thermo1.z, thermo2.y, 0.0);
}
`,Pd=`
struct RenderFieldParams {
  particle_count: u32,
  surface_count: u32,
  total_field_cells: u32,
  _pad0: u32,
  field_padding: f32,
  ref_edge_m: f32,
  _pad1: f32,
  _pad2: f32,
};

@group(0) @binding(0) var<storage, read> render_rows: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> render_surfaces: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> render_field_cells: array<vec4<f32>>;
@group(0) @binding(3) var<uniform> params: RenderFieldParams;

fn render_row0(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * 3u];
}

fn render_row1(particle_index: u32) -> vec4<f32> {
  return render_rows[particle_index * 3u + 1u];
}

fn surface_row0(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u];
}

fn surface_row1(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 1u];
}

fn surface_row2(surface_index: u32) -> vec4<f32> {
  return render_surfaces[surface_index * 4u + 2u];
}

fn smooth_palette_weight(ratio: f32) -> f32 {
  let t = clamp(ratio, 0.0, 1.0);
  return 1.0 - t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let cell_index = global_id.x;
  let surface_index = global_id.y;
  if (surface_index >= params.surface_count) {
    return;
  }

  let s0 = surface_row0(surface_index);
  let s1 = surface_row1(surface_index);
  let s2 = surface_row2(surface_index);
  let field_offset = u32(s0.z);
  let field_cell_count = u32(s0.w);
  if (cell_index >= field_cell_count) {
    return;
  }

  let resolution = max(u32(s1.x), 1u);
  let xy_count = resolution * resolution;
  let z = cell_index / xy_count;
  let rem = cell_index - z * xy_count;
  let y = rem / resolution;
  let x = rem - y * resolution;
  let inv_resolution = 1.0 / f32(resolution);
  let cell = vec3<f32>(
    f32(x) * inv_resolution,
    f32(y) * inv_resolution,
    f32(z) * inv_resolution
  );

  let material_id = s0.x;
  let phase_id = s0.y;
  let subtract = max(s1.z, 1.0e-12);
  let strength = s1.w;
  let support_norm = sqrt(abs(strength) / subtract);
  let color = vec3<f32>(s2.y, s2.z, s2.w);
  let span = 1.0 - 2.0 * params.field_padding;
  let ref_edge = max(params.ref_edge_m, 1.0e-12);

  var density = 0.0;
  var palette = vec3<f32>(0.0, 0.0, 0.0);
  for (var particle_index = 0u; particle_index < params.particle_count; particle_index = particle_index + 1u) {
    let row0 = render_row0(particle_index);
    let row1 = render_row1(particle_index);
    if (row1.x != material_id || row1.y != phase_id) {
      continue;
    }
    let particle = vec3<f32>(
      clamp(params.field_padding + (row0.x / ref_edge) * span, 0.001, 0.999),
      clamp(params.field_padding + (row0.y / ref_edge) * span, 0.001, 0.999),
      clamp(params.field_padding + (row0.z / ref_edge) * span, 0.001, 0.999)
    );
    let delta = cell - particle;
    let dist2 = dot(delta, delta);
    let value = strength / (0.000001 + dist2) - subtract;
    if (value > 0.0) {
      density = density + value;
      let ratio = sqrt(dist2) / max(support_norm, 1.0e-6);
      palette = palette + color * smooth_palette_weight(ratio);
    }
  }

  let out_index = field_offset + cell_index;
  if (out_index < params.total_field_cells) {
    render_field_cells[out_index] = vec4<f32>(density, palette);
  }
}
`,Fd=`
struct MechanicsParams {
  particle_count: u32,
  dt: f32,
  gravity_x: f32,
  gravity_y: f32,
  gravity_z: f32,
  box_x: f32,
  box_y: f32,
  box_z: f32,
};

@group(0) @binding(0) var<storage, read> sph_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> sph_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> mls_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> out_sph_state: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> out_mls_mechanics: array<vec4<f32>>;
@group(0) @binding(5) var<uniform> params: MechanicsParams;

fn det3(
  f00: f32, f01: f32, f02: f32,
  f10: f32, f11: f32, f12: f32,
  f20: f32, f21: f32, f22: f32
) -> f32 {
  return f00 * (f11 * f22 - f12 * f21)
    - f01 * (f10 * f22 - f12 * f20)
    + f02 * (f10 * f21 - f11 * f20);
}

fn cubic_root_positive(value: f32) -> f32 {
  return exp(log(max(value, 1.0e-12)) / 3.0);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }

  let state_base = particle_index * 2u;
  let mechanics_base = particle_index * 8u;
  let pos_mass = sph_state[state_base];
  let vel_u = sph_state[state_base + 1u];
  let _thermo_status = sph_thermo[particle_index * 3u + 2u].z;

  var velocity = vec3<f32>(vel_u.x, vel_u.y, vel_u.z)
    + vec3<f32>(params.gravity_x, params.gravity_y, params.gravity_z) * params.dt;
  var position = vec3<f32>(pos_mass.x, pos_mass.y, pos_mass.z) + velocity * params.dt;
  let box_dims = vec3<f32>(params.box_x, params.box_y, params.box_z);

  if (position.x < 0.0) {
    position.x = 0.0;
    if (velocity.x < 0.0) { velocity.x = 0.0; }
  }
  if (position.x > box_dims.x) {
    position.x = box_dims.x;
    if (velocity.x > 0.0) { velocity.x = 0.0; }
  }
  if (position.y < 0.0) {
    position.y = 0.0;
    if (velocity.y < 0.0) { velocity.y = 0.0; }
  }
  if (position.y > box_dims.y) {
    position.y = box_dims.y;
    if (velocity.y > 0.0) { velocity.y = 0.0; }
  }
  if (position.z < 0.0) {
    position.z = 0.0;
    if (velocity.z < 0.0) { velocity.z = 0.0; }
  }
  if (position.z > box_dims.z) {
    position.z = box_dims.z;
    if (velocity.z > 0.0) { velocity.z = 0.0; }
  }

  let row0 = mls_mechanics[mechanics_base];
  let row1 = mls_mechanics[mechanics_base + 1u];
  let row2 = mls_mechanics[mechanics_base + 2u];
  let row3 = mls_mechanics[mechanics_base + 3u];
  let row4 = mls_mechanics[mechanics_base + 4u];
  let row5 = mls_mechanics[mechanics_base + 5u];
  let row6 = mls_mechanics[mechanics_base + 6u];
  let row7 = mls_mechanics[mechanics_base + 7u];

  let f00 = row0.x; let f01 = row0.y; let f02 = row0.z;
  let f10 = row0.w; let f11 = row1.x; let f12 = row1.y;
  let f20 = row1.z; let f21 = row1.w; let f22 = row2.x;
  let c00 = row2.y; let c01 = row2.z; let c02 = row2.w;
  let c10 = row3.x; let c11 = row3.y; let c12 = row3.z;
  let c20 = row3.w; let c21 = row4.x; let c22 = row4.y;

  let g00 = 1.0 + params.dt * c00; let g01 = params.dt * c01; let g02 = params.dt * c02;
  let g10 = params.dt * c10; let g11 = 1.0 + params.dt * c11; let g12 = params.dt * c12;
  let g20 = params.dt * c20; let g21 = params.dt * c21; let g22 = 1.0 + params.dt * c22;

  var nf00 = g00 * f00 + g01 * f10 + g02 * f20;
  var nf01 = g00 * f01 + g01 * f11 + g02 * f21;
  var nf02 = g00 * f02 + g01 * f12 + g02 * f22;
  var nf10 = g10 * f00 + g11 * f10 + g12 * f20;
  var nf11 = g10 * f01 + g11 * f11 + g12 * f21;
  var nf12 = g10 * f02 + g11 * f12 + g12 * f22;
  var nf20 = g20 * f00 + g21 * f10 + g22 * f20;
  var nf21 = g20 * f01 + g21 * f11 + g22 * f21;
  var nf22 = g20 * f02 + g21 * f12 + g22 * f22;
  var next_j = det3(nf00, nf01, nf02, nf10, nf11, nf12, nf20, nf21, nf22);

  if (row5.x < 0.5) {
    next_j = max(next_j, 0.05);
    let s = cubic_root_positive(next_j);
    nf00 = s; nf01 = 0.0; nf02 = 0.0;
    nf10 = 0.0; nf11 = s; nf12 = 0.0;
    nf20 = 0.0; nf21 = 0.0; nf22 = s;
  }

  next_j = det3(nf00, nf01, nf02, nf10, nf11, nf12, nf20, nf21, nf22);
  if (next_j < 0.1) {
    let s = cubic_root_positive(0.1);
    nf00 = s; nf01 = 0.0; nf02 = 0.0;
    nf10 = 0.0; nf11 = s; nf12 = 0.0;
    nf20 = 0.0; nf21 = 0.0; nf22 = s;
    next_j = 0.1;
  }

  out_sph_state[state_base] = vec4<f32>(position.x, position.y, position.z, pos_mass.w);
  out_sph_state[state_base + 1u] = vec4<f32>(velocity.x, velocity.y, velocity.z, vel_u.w);
  out_mls_mechanics[mechanics_base] = vec4<f32>(nf00, nf01, nf02, nf10);
  out_mls_mechanics[mechanics_base + 1u] = vec4<f32>(nf11, nf12, nf20, nf21);
  out_mls_mechanics[mechanics_base + 2u] = vec4<f32>(nf22, c00, c01, c02);
  out_mls_mechanics[mechanics_base + 3u] = vec4<f32>(c10, c11, c12, c20);
  out_mls_mechanics[mechanics_base + 4u] = vec4<f32>(c21, c22, next_j, row4.w);
  out_mls_mechanics[mechanics_base + 5u] = row5;
  out_mls_mechanics[mechanics_base + 6u] = row6;
  out_mls_mechanics[mechanics_base + 7u] = row7;
}
`,Id=`
struct P2gProjectionParams {
  particle_count: u32,
  grid_node_count: u32,
  grid_nx: u32,
  grid_ny: u32,
  grid_nz: u32,
  shift: u32,
  grid_spacing_m: f32,
  inv_grid_spacing_m: f32,
  dt: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
};

struct StressRows {
  x: vec3<f32>,
  y: vec3<f32>,
  z: vec3<f32>,
};

@group(0) @binding(0) var<storage, read> sph_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> sph_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> mls_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> grid_nodes: array<vec4<f32>>;
@group(0) @binding(4) var<uniform> params: P2gProjectionParams;

fn quadratic_weights(fx: f32) -> vec3<f32> {
  let a = 1.5 - fx;
  let b = fx - 1.0;
  let c = fx - 0.5;
  return vec3<f32>(0.5 * a * a, 0.75 - b * b, 0.5 * c * c);
}

fn weight_at(weights: vec3<f32>, offset: i32) -> f32 {
  if (offset == 0) { return weights.x; }
  if (offset == 1) { return weights.y; }
  if (offset == 2) { return weights.z; }
  return 0.0;
}

fn det3(
  f00: f32, f01: f32, f02: f32,
  f10: f32, f11: f32, f12: f32,
  f20: f32, f21: f32, f22: f32
) -> f32 {
  return f00 * (f11 * f22 - f12 * f21)
    - f01 * (f10 * f22 - f12 * f20)
    + f02 * (f10 * f21 - f11 * f20);
}

fn packed_pressure(density_kg_per_m3: f32, rest_density_kg_per_m3: f32, sound_speed_m_per_s: f32, eos_model_id: f32) -> f32 {
  if (density_kg_per_m3 <= 0.0 || rest_density_kg_per_m3 <= 0.0 || sound_speed_m_per_s <= 0.0) {
    return 0.0;
  }
  if (eos_model_id > 1.5 && eos_model_id < 2.5) {
    return max(0.0, sound_speed_m_per_s * sound_speed_m_per_s * (density_kg_per_m3 - rest_density_kg_per_m3));
  }
  if (eos_model_id > 0.5 && eos_model_id < 1.5) {
    let ratio = density_kg_per_m3 / max(rest_density_kg_per_m3, 1.0e-9);
    return (rest_density_kg_per_m3 * sound_speed_m_per_s * sound_speed_m_per_s / 7.0)
      * (pow(ratio, 7.0) - 1.0);
  }
  return 0.0;
}

fn corotated_stress(
  f00: f32, f01: f32, f02: f32,
  f10: f32, f11: f32, f12: f32,
  f20: f32, f21: f32, f22: f32,
  mu: f32,
  lambda: f32
) -> StressRows {
  var r0 = f00; var r1 = f01; var r2 = f02;
  var r3 = f10; var r4 = f11; var r5 = f12;
  var r6 = f20; var r7 = f21; var r8 = f22;
  for (var it = 0u; it < 12u; it = it + 1u) {
    let rd = det3(r0, r1, r2, r3, r4, r5, r6, r7, r8);
    if (abs(rd) < 1.0e-12) {
      break;
    }
    let id = 1.0 / rd;
    let t0 = (r4 * r8 - r5 * r7) * id; let t3 = (r2 * r7 - r1 * r8) * id; let t6 = (r1 * r5 - r2 * r4) * id;
    let t1 = (r5 * r6 - r3 * r8) * id; let t4 = (r0 * r8 - r2 * r6) * id; let t7 = (r2 * r3 - r0 * r5) * id;
    let t2 = (r3 * r7 - r4 * r6) * id; let t5 = (r1 * r6 - r0 * r7) * id; let t8 = (r0 * r4 - r1 * r3) * id;
    let n0 = 0.5 * (r0 + t0); let n1 = 0.5 * (r1 + t1); let n2 = 0.5 * (r2 + t2);
    let n3 = 0.5 * (r3 + t3); let n4 = 0.5 * (r4 + t4); let n5 = 0.5 * (r5 + t5);
    let n6 = 0.5 * (r6 + t6); let n7 = 0.5 * (r7 + t7); let n8 = 0.5 * (r8 + t8);
    let diff = abs(n0 - r0) + abs(n4 - r4) + abs(n8 - r8);
    r0 = n0; r1 = n1; r2 = n2;
    r3 = n3; r4 = n4; r5 = n5;
    r6 = n6; r7 = n7; r8 = n8;
    if (diff < 1.0e-10) {
      break;
    }
  }

  let j = det3(f00, f01, f02, f10, f11, f12, f20, f21, f22);
  if (abs(j) < 1.0e-12) {
    return StressRows(vec3<f32>(0.0), vec3<f32>(0.0), vec3<f32>(0.0));
  }
  let jid = 1.0 / j;
  let ft0 = (f11 * f22 - f12 * f21) * jid; let ft3 = (f02 * f21 - f01 * f22) * jid; let ft6 = (f01 * f12 - f02 * f11) * jid;
  let ft1 = (f12 * f20 - f10 * f22) * jid; let ft4 = (f00 * f22 - f02 * f20) * jid; let ft7 = (f02 * f10 - f00 * f12) * jid;
  let ft2 = (f10 * f21 - f11 * f20) * jid; let ft5 = (f01 * f20 - f00 * f21) * jid; let ft8 = (f00 * f11 - f01 * f10) * jid;
  let c = lambda * (j - 1.0) * j;
  let p0 = 2.0 * mu * (f00 - r0) + c * ft0; let p1 = 2.0 * mu * (f01 - r1) + c * ft1; let p2 = 2.0 * mu * (f02 - r2) + c * ft2;
  let p3 = 2.0 * mu * (f10 - r3) + c * ft3; let p4 = 2.0 * mu * (f11 - r4) + c * ft4; let p5 = 2.0 * mu * (f12 - r5) + c * ft5;
  let p6 = 2.0 * mu * (f20 - r6) + c * ft6; let p7 = 2.0 * mu * (f21 - r7) + c * ft7; let p8 = 2.0 * mu * (f22 - r8) + c * ft8;
  return StressRows(
    vec3<f32>((p0 * f00 + p1 * f01 + p2 * f02) * jid, (p0 * f10 + p1 * f11 + p2 * f12) * jid, (p0 * f20 + p1 * f21 + p2 * f22) * jid),
    vec3<f32>((p3 * f00 + p4 * f01 + p5 * f02) * jid, (p3 * f10 + p4 * f11 + p5 * f12) * jid, (p3 * f20 + p4 * f21 + p5 * f22) * jid),
    vec3<f32>((p6 * f00 + p7 * f01 + p8 * f02) * jid, (p6 * f10 + p7 * f11 + p8 * f12) * jid, (p6 * f20 + p7 * f21 + p8 * f22) * jid)
  );
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let node_index = global_id.x;
  if (node_index >= params.grid_node_count) {
    return;
  }

  let plane = params.grid_ny * params.grid_nz;
  let i = node_index / plane;
  let rem = node_index - i * plane;
  let j = rem / params.grid_nz;
  let k = rem - j * params.grid_nz;
  let node_i = i32(i) - i32(params.shift);
  let node_j = i32(j) - i32(params.shift);
  let node_k = i32(k) - i32(params.shift);
  let node_pos = vec3<f32>(
    f32(node_i) * params.grid_spacing_m,
    f32(node_j) * params.grid_spacing_m,
    f32(node_k) * params.grid_spacing_m
  );

  var mass = 0.0;
  var momentum = vec3<f32>(0.0, 0.0, 0.0);

  for (var particle_index = 0u; particle_index < params.particle_count; particle_index = particle_index + 1u) {
    let state_base = particle_index * 2u;
    let thermo_base = particle_index * 3u;
    let mechanics_base = particle_index * 8u;
    let pos_mass = sph_state[state_base];
    let vel_u = sph_state[state_base + 1u];
    let thermo0 = sph_thermo[thermo_base];
    let _thermo_status = sph_thermo[thermo_base + 2u].z;
    let p_grid = pos_mass.xyz * params.inv_grid_spacing_m;
    let base_x = i32(floor(p_grid.x - 0.5));
    let base_y = i32(floor(p_grid.y - 0.5));
    let base_z = i32(floor(p_grid.z - 0.5));
    let ox = node_i - base_x;
    let oy = node_j - base_y;
    let oz = node_k - base_z;
    if (ox < 0 || ox > 2 || oy < 0 || oy > 2 || oz < 0 || oz > 2) {
      continue;
    }

    let wx = quadratic_weights(p_grid.x - f32(base_x));
    let wy = quadratic_weights(p_grid.y - f32(base_y));
    let wz = quadratic_weights(p_grid.z - f32(base_z));
    let weight = weight_at(wx, ox) * weight_at(wy, oy) * weight_at(wz, oz);
    if (weight == 0.0) {
      continue;
    }

    let row0 = mls_mechanics[mechanics_base];
    let row1 = mls_mechanics[mechanics_base + 1u];
    let row2 = mls_mechanics[mechanics_base + 2u];
    let row3 = mls_mechanics[mechanics_base + 3u];
    let row4 = mls_mechanics[mechanics_base + 4u];
    let row5 = mls_mechanics[mechanics_base + 5u];
    let row6 = mls_mechanics[mechanics_base + 6u];
    let f00 = row0.x; let f01 = row0.y; let f02 = row0.z;
    let f10 = row0.w; let f11 = row1.x; let f12 = row1.y;
    let f20 = row1.z; let f21 = row1.w; let f22 = row2.x;
    let c00 = row2.y; let c01 = row2.z; let c02 = row2.w;
    let c10 = row3.x; let c11 = row3.y; let c12 = row3.z;
    let c20 = row3.w; let c21 = row4.x; let c22 = row4.y;
    let dpos = node_pos - pos_mass.xyz;
    let volume = max(row4.w * max(row4.z, 1.0e-9), 0.0);
    var sigma = StressRows(vec3<f32>(0.0), vec3<f32>(0.0), vec3<f32>(0.0));
    if (params.dt != 0.0 && volume > 0.0) {
      if (row5.x > 0.5 && row5.w > 0.0) {
        sigma = corotated_stress(
          f00, f01, f02,
          f10, f11, f12,
          f20, f21, f22,
          row5.w,
          row6.x
        );
      } else {
        let density = pos_mass.w / max(volume, 1.0e-30);
        let pressure = packed_pressure(density, thermo0.w, row6.y, row6.z);
        sigma = StressRows(
          vec3<f32>(-pressure, 0.0, 0.0),
          vec3<f32>(0.0, -pressure, 0.0),
          vec3<f32>(0.0, 0.0, -pressure)
        );
      }
    }
    let stress_scale = -params.dt * volume * 4.0 * params.inv_grid_spacing_m * params.inv_grid_spacing_m;
    let aff_x = vec3<f32>(
      pos_mass.w * c00 + stress_scale * sigma.x.x,
      pos_mass.w * c01 + stress_scale * sigma.x.y,
      pos_mass.w * c02 + stress_scale * sigma.x.z
    );
    let aff_y = vec3<f32>(
      pos_mass.w * c10 + stress_scale * sigma.y.x,
      pos_mass.w * c11 + stress_scale * sigma.y.y,
      pos_mass.w * c12 + stress_scale * sigma.y.z
    );
    let aff_z = vec3<f32>(
      pos_mass.w * c20 + stress_scale * sigma.z.x,
      pos_mass.w * c21 + stress_scale * sigma.z.y,
      pos_mass.w * c22 + stress_scale * sigma.z.z
    );
    let affine_momentum = vec3<f32>(
      dot(aff_x, dpos),
      dot(aff_y, dpos),
      dot(aff_z, dpos)
    );
    let particle_momentum = pos_mass.w * vel_u.xyz + affine_momentum;
    mass = mass + weight * pos_mass.w;
    momentum = momentum + weight * particle_momentum;
  }

  let status = select(0.0, 1.0, mass > 0.0);
  grid_nodes[node_index * 2u] = vec4<f32>(mass, momentum.x, momentum.y, momentum.z);
  grid_nodes[node_index * 2u + 1u] = vec4<f32>(node_pos.x, node_pos.y, node_pos.z, status);
}
`,Ld=`
struct GridUpdateParams {
  grid_node_count: u32,
  grid_nx: u32,
  grid_ny: u32,
  grid_nz: u32,
  shift: u32,
  pad_u0: u32,
  pad_u1: u32,
  pad_u2: u32,
  grid_spacing_m: f32,
  dt: f32,
  gravity_x: f32,
  gravity_y: f32,
  gravity_z: f32,
  box_x: f32,
  box_y: f32,
  box_z: f32,
  cfl_factor: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
};

@group(0) @binding(0) var<storage, read> p2g_grid_nodes: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> updated_grid_nodes: array<vec4<f32>>;
@group(0) @binding(2) var<uniform> params: GridUpdateParams;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let node_index = global_id.x;
  if (node_index >= params.grid_node_count) {
    return;
  }

  let row0 = p2g_grid_nodes[node_index * 2u];
  let row1 = p2g_grid_nodes[node_index * 2u + 1u];
  let mass = row0.x;
  var velocity = vec3<f32>(0.0, 0.0, 0.0);
  var status = 0.0;

  if (mass > 0.0) {
    velocity = row0.yzw / mass + vec3<f32>(params.gravity_x, params.gravity_y, params.gravity_z) * params.dt;
    let vmax = params.cfl_factor * params.grid_spacing_m / max(params.dt, 1.0e-12);
    let speed2 = dot(velocity, velocity);
    if (speed2 > vmax * vmax) {
      velocity = velocity * (vmax / sqrt(speed2));
    }
    let node_pos = row1.xyz;
    if ((node_pos.x < params.grid_spacing_m && velocity.x < 0.0) || (node_pos.x > params.box_x - params.grid_spacing_m && velocity.x > 0.0)) {
      velocity.x = 0.0;
    }
    if ((node_pos.y < params.grid_spacing_m && velocity.y < 0.0) || (node_pos.y > params.box_y - params.grid_spacing_m && velocity.y > 0.0)) {
      velocity.y = 0.0;
    }
    if ((node_pos.z < params.grid_spacing_m && velocity.z < 0.0) || (node_pos.z > params.box_z - params.grid_spacing_m && velocity.z > 0.0)) {
      velocity.z = 0.0;
    }
    status = 1.0;
  }

  updated_grid_nodes[node_index * 2u] = vec4<f32>(mass, velocity.x, velocity.y, velocity.z);
  updated_grid_nodes[node_index * 2u + 1u] = vec4<f32>(row1.x, row1.y, row1.z, status);
}
`,Rd=`
struct G2pParams {
  particle_count: u32,
  grid_node_count: u32,
  grid_nx: u32,
  grid_ny: u32,
  grid_nz: u32,
  shift: u32,
  pad_u0: u32,
  pad_u1: u32,
  grid_spacing_m: f32,
  inv_grid_spacing_m: f32,
  dt: f32,
  box_x: f32,
  box_y: f32,
  box_z: f32,
  pad0: f32,
  pad1: f32,
};

@group(0) @binding(0) var<storage, read> sph_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> sph_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> mls_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> updated_grid_nodes: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> out_sph_state: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> out_mls_mechanics: array<vec4<f32>>;
@group(0) @binding(6) var<uniform> params: G2pParams;

fn g2p_quadratic_weights(fx: f32) -> vec3<f32> {
  let a = 1.5 - fx;
  let b = fx - 1.0;
  let c = fx - 0.5;
  return vec3<f32>(0.5 * a * a, 0.75 - b * b, 0.5 * c * c);
}

fn g2p_weight_at(weights: vec3<f32>, offset: i32) -> f32 {
  if (offset == 0) { return weights.x; }
  if (offset == 1) { return weights.y; }
  if (offset == 2) { return weights.z; }
  return 0.0;
}

fn g2p_det3(
  f00: f32, f01: f32, f02: f32,
  f10: f32, f11: f32, f12: f32,
  f20: f32, f21: f32, f22: f32
) -> f32 {
  return f00 * (f11 * f22 - f12 * f21)
    - f01 * (f10 * f22 - f12 * f20)
    + f02 * (f10 * f21 - f11 * f20);
}

fn g2p_cubic_root_positive(value: f32) -> f32 {
  return exp(log(max(value, 1.0e-12)) / 3.0);
}

fn g2p_grid_index(i: i32, j: i32, k: i32) -> u32 {
  return (u32(i + i32(params.shift)) * params.grid_ny + u32(j + i32(params.shift))) * params.grid_nz + u32(k + i32(params.shift));
}

fn g2p_in_range(i: i32, j: i32, k: i32) -> bool {
  let ii = i + i32(params.shift);
  let jj = j + i32(params.shift);
  let kk = k + i32(params.shift);
  return ii >= 0 && jj >= 0 && kk >= 0
    && ii < i32(params.grid_nx)
    && jj < i32(params.grid_ny)
    && kk < i32(params.grid_nz);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let particle_index = global_id.x;
  if (particle_index >= params.particle_count) {
    return;
  }

  let state_base = particle_index * 2u;
  let mechanics_base = particle_index * 8u;
  let pos_mass = sph_state[state_base];
  let vel_u = sph_state[state_base + 1u];
  let _thermo_status = sph_thermo[particle_index * 3u + 2u].z;
  let row0 = mls_mechanics[mechanics_base];
  let row1 = mls_mechanics[mechanics_base + 1u];
  let row2 = mls_mechanics[mechanics_base + 2u];
  let row3 = mls_mechanics[mechanics_base + 3u];
  let row4 = mls_mechanics[mechanics_base + 4u];
  let row5 = mls_mechanics[mechanics_base + 5u];
  let row6 = mls_mechanics[mechanics_base + 6u];
  let row7 = mls_mechanics[mechanics_base + 7u];

  let p_grid = pos_mass.xyz * params.inv_grid_spacing_m;
  let base_x = i32(floor(p_grid.x - 0.5));
  let base_y = i32(floor(p_grid.y - 0.5));
  let base_z = i32(floor(p_grid.z - 0.5));
  let wx = g2p_quadratic_weights(p_grid.x - f32(base_x));
  let wy = g2p_quadratic_weights(p_grid.y - f32(base_y));
  let wz = g2p_quadratic_weights(p_grid.z - f32(base_z));

  var velocity = vec3<f32>(0.0, 0.0, 0.0);
  var c00 = 0.0; var c01 = 0.0; var c02 = 0.0;
  var c10 = 0.0; var c11 = 0.0; var c12 = 0.0;
  var c20 = 0.0; var c21 = 0.0; var c22 = 0.0;

  for (var a = 0i; a < 3i; a = a + 1i) {
    for (var b = 0i; b < 3i; b = b + 1i) {
      for (var c = 0i; c < 3i; c = c + 1i) {
        let node_i = base_x + a;
        let node_j = base_y + b;
        let node_k = base_z + c;
        if (!g2p_in_range(node_i, node_j, node_k)) {
          continue;
        }
        let weight = g2p_weight_at(wx, a) * g2p_weight_at(wy, b) * g2p_weight_at(wz, c);
        if (weight == 0.0) {
          continue;
        }
        let idx = g2p_grid_index(node_i, node_j, node_k);
        let grid_row = updated_grid_nodes[idx * 2u];
        let grid_velocity = grid_row.yzw;
        velocity = velocity + weight * grid_velocity;
        let dpos = (vec3<f32>(f32(node_i), f32(node_j), f32(node_k)) - p_grid) * params.grid_spacing_m;
        let s = 4.0 * params.inv_grid_spacing_m * params.inv_grid_spacing_m * weight;
        c00 = c00 + s * grid_velocity.x * dpos.x;
        c01 = c01 + s * grid_velocity.x * dpos.y;
        c02 = c02 + s * grid_velocity.x * dpos.z;
        c10 = c10 + s * grid_velocity.y * dpos.x;
        c11 = c11 + s * grid_velocity.y * dpos.y;
        c12 = c12 + s * grid_velocity.y * dpos.z;
        c20 = c20 + s * grid_velocity.z * dpos.x;
        c21 = c21 + s * grid_velocity.z * dpos.y;
        c22 = c22 + s * grid_velocity.z * dpos.z;
      }
    }
  }

  var position = pos_mass.xyz + params.dt * velocity;
  if (position.x < 0.0) { position.x = 0.0; if (velocity.x < 0.0) { velocity.x = 0.0; } }
  if (position.x > params.box_x) { position.x = params.box_x; if (velocity.x > 0.0) { velocity.x = 0.0; } }
  if (position.y < 0.0) { position.y = 0.0; if (velocity.y < 0.0) { velocity.y = 0.0; } }
  if (position.y > params.box_y) { position.y = params.box_y; if (velocity.y > 0.0) { velocity.y = 0.0; } }
  if (position.z < 0.0) { position.z = 0.0; if (velocity.z < 0.0) { velocity.z = 0.0; } }
  if (position.z > params.box_z) { position.z = params.box_z; if (velocity.z > 0.0) { velocity.z = 0.0; } }

  let f00 = row0.x; let f01 = row0.y; let f02 = row0.z;
  let f10 = row0.w; let f11 = row1.x; let f12 = row1.y;
  let f20 = row1.z; let f21 = row1.w; let f22 = row2.x;
  let g00 = 1.0 + params.dt * c00; let g01 = params.dt * c01; let g02 = params.dt * c02;
  let g10 = params.dt * c10; let g11 = 1.0 + params.dt * c11; let g12 = params.dt * c12;
  let g20 = params.dt * c20; let g21 = params.dt * c21; let g22 = 1.0 + params.dt * c22;

  var nf00 = g00 * f00 + g01 * f10 + g02 * f20;
  var nf01 = g00 * f01 + g01 * f11 + g02 * f21;
  var nf02 = g00 * f02 + g01 * f12 + g02 * f22;
  var nf10 = g10 * f00 + g11 * f10 + g12 * f20;
  var nf11 = g10 * f01 + g11 * f11 + g12 * f21;
  var nf12 = g10 * f02 + g11 * f12 + g12 * f22;
  var nf20 = g20 * f00 + g21 * f10 + g22 * f20;
  var nf21 = g20 * f01 + g21 * f11 + g22 * f21;
  var nf22 = g20 * f02 + g21 * f12 + g22 * f22;
  var next_j = g2p_det3(nf00, nf01, nf02, nf10, nf11, nf12, nf20, nf21, nf22);
  if (row5.x < 0.5) {
    next_j = max(next_j, 0.05);
    let s = g2p_cubic_root_positive(next_j);
    nf00 = s; nf01 = 0.0; nf02 = 0.0;
    nf10 = 0.0; nf11 = s; nf12 = 0.0;
    nf20 = 0.0; nf21 = 0.0; nf22 = s;
  }
  next_j = g2p_det3(nf00, nf01, nf02, nf10, nf11, nf12, nf20, nf21, nf22);
  if (next_j < 0.1) {
    let s = g2p_cubic_root_positive(0.1);
    nf00 = s; nf01 = 0.0; nf02 = 0.0;
    nf10 = 0.0; nf11 = s; nf12 = 0.0;
    nf20 = 0.0; nf21 = 0.0; nf22 = s;
    next_j = 0.1;
  }

  out_sph_state[state_base] = vec4<f32>(position.x, position.y, position.z, pos_mass.w);
  out_sph_state[state_base + 1u] = vec4<f32>(velocity.x, velocity.y, velocity.z, vel_u.w);
  out_mls_mechanics[mechanics_base] = vec4<f32>(nf00, nf01, nf02, nf10);
  out_mls_mechanics[mechanics_base + 1u] = vec4<f32>(nf11, nf12, nf20, nf21);
  out_mls_mechanics[mechanics_base + 2u] = vec4<f32>(nf22, c00, c01, c02);
  out_mls_mechanics[mechanics_base + 3u] = vec4<f32>(c10, c11, c12, c20);
  out_mls_mechanics[mechanics_base + 4u] = vec4<f32>(c21, c22, next_j, row4.w);
  out_mls_mechanics[mechanics_base + 5u] = row5;
  out_mls_mechanics[mechanics_base + 6u] = row6;
  out_mls_mechanics[mechanics_base + 7u] = row7;
}
`,zd=`
struct ResidentSummaryParams {
  particle_count: u32,
  grid_node_count: u32,
  partial_count: u32,
  pad_u1: u32,
};

@group(0) @binding(0) var<storage, read> source_sph_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> next_sph_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> source_mls_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> next_mls_mechanics: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> updated_grid_nodes: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> partial_summaries: array<vec4<f32>>;
@group(0) @binding(6) var<uniform> params: ResidentSummaryParams;

var<workgroup> wg_active_grid_nodes: array<f32, 64>;
var<workgroup> wg_source_mass: array<f32, 64>;
var<workgroup> wg_next_mass: array<f32, 64>;
var<workgroup> wg_source_momentum_x: array<f32, 64>;
var<workgroup> wg_source_momentum_y: array<f32, 64>;
var<workgroup> wg_source_momentum_z: array<f32, 64>;
var<workgroup> wg_next_momentum_x: array<f32, 64>;
var<workgroup> wg_next_momentum_y: array<f32, 64>;
var<workgroup> wg_next_momentum_z: array<f32, 64>;
var<workgroup> wg_max_speed: array<f32, 64>;
var<workgroup> wg_max_displacement: array<f32, 64>;
var<workgroup> wg_min_volume_ratio_j: array<f32, 64>;
var<workgroup> wg_max_volume_ratio_j: array<f32, 64>;

@compute @workgroup_size(64)
fn main(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let index = global_id.x;
  let lane = local_id.x;

  var active_grid_nodes = 0.0;
  if (index < params.grid_node_count) {
    let row0 = updated_grid_nodes[index * 2u];
    if (row0.x > 0.0) {
      active_grid_nodes = 1.0;
    }
  }

  var source_mass = 0.0;
  var next_mass = 0.0;
  var source_momentum = vec3<f32>(0.0);
  var next_momentum = vec3<f32>(0.0);
  var max_speed2 = 0.0;
  var max_displacement2 = 0.0;
  var min_volume_ratio_j = 3.4028234663852886e38;
  var max_volume_ratio_j = 0.0;

  if (index < params.particle_count) {
    let state_base = index * 2u;
    let mechanics_base = index * 8u;
    let source_pos_mass = source_sph_state[state_base];
    let source_vel_u = source_sph_state[state_base + 1u];
    let next_pos_mass = next_sph_state[state_base];
    let next_vel_u = next_sph_state[state_base + 1u];

    source_mass = source_mass + source_pos_mass.w;
    next_mass = next_mass + next_pos_mass.w;
    source_momentum = source_momentum + source_pos_mass.w * source_vel_u.xyz;
    next_momentum = next_momentum + next_pos_mass.w * next_vel_u.xyz;
    max_speed2 = max(max_speed2, dot(next_vel_u.xyz, next_vel_u.xyz));
    let displacement = next_pos_mass.xyz - source_pos_mass.xyz;
    max_displacement2 = max(max_displacement2, dot(displacement, displacement));

    let next_j = next_mls_mechanics[mechanics_base + 4u].z;
    min_volume_ratio_j = min(min_volume_ratio_j, next_j);
    max_volume_ratio_j = max(max_volume_ratio_j, next_j);
  }

  wg_active_grid_nodes[lane] = active_grid_nodes;
  wg_source_mass[lane] = source_mass;
  wg_next_mass[lane] = next_mass;
  wg_source_momentum_x[lane] = source_momentum.x;
  wg_source_momentum_y[lane] = source_momentum.y;
  wg_source_momentum_z[lane] = source_momentum.z;
  wg_next_momentum_x[lane] = next_momentum.x;
  wg_next_momentum_y[lane] = next_momentum.y;
  wg_next_momentum_z[lane] = next_momentum.z;
  wg_max_speed[lane] = sqrt(max_speed2);
  wg_max_displacement[lane] = sqrt(max_displacement2);
  wg_min_volume_ratio_j[lane] = min_volume_ratio_j;
  wg_max_volume_ratio_j[lane] = max_volume_ratio_j;
  workgroupBarrier();

  var stride = 32u;
  loop {
    if (lane < stride) {
      let other = lane + stride;
      wg_active_grid_nodes[lane] = wg_active_grid_nodes[lane] + wg_active_grid_nodes[other];
      wg_source_mass[lane] = wg_source_mass[lane] + wg_source_mass[other];
      wg_next_mass[lane] = wg_next_mass[lane] + wg_next_mass[other];
      wg_source_momentum_x[lane] = wg_source_momentum_x[lane] + wg_source_momentum_x[other];
      wg_source_momentum_y[lane] = wg_source_momentum_y[lane] + wg_source_momentum_y[other];
      wg_source_momentum_z[lane] = wg_source_momentum_z[lane] + wg_source_momentum_z[other];
      wg_next_momentum_x[lane] = wg_next_momentum_x[lane] + wg_next_momentum_x[other];
      wg_next_momentum_y[lane] = wg_next_momentum_y[lane] + wg_next_momentum_y[other];
      wg_next_momentum_z[lane] = wg_next_momentum_z[lane] + wg_next_momentum_z[other];
      wg_max_speed[lane] = max(wg_max_speed[lane], wg_max_speed[other]);
      wg_max_displacement[lane] = max(wg_max_displacement[lane], wg_max_displacement[other]);
      wg_min_volume_ratio_j[lane] = min(wg_min_volume_ratio_j[lane], wg_min_volume_ratio_j[other]);
      wg_max_volume_ratio_j[lane] = max(wg_max_volume_ratio_j[lane], wg_max_volume_ratio_j[other]);
    }
    workgroupBarrier();
    if (stride == 1u) {
      break;
    }
    stride = stride / 2u;
  }

  if (lane == 0u) {
    let partial_base = workgroup_id.x * 5u;
    let momentum_delta = vec3<f32>(
      wg_next_momentum_x[0u] - wg_source_momentum_x[0u],
      wg_next_momentum_y[0u] - wg_source_momentum_y[0u],
      wg_next_momentum_z[0u] - wg_source_momentum_z[0u]
    );
    partial_summaries[partial_base] = vec4<f32>(
      0.0,
      0.0,
      wg_active_grid_nodes[0u],
      wg_source_mass[0u]
    );
    partial_summaries[partial_base + 1u] = vec4<f32>(
      wg_next_mass[0u],
      wg_next_mass[0u] - wg_source_mass[0u],
      wg_source_momentum_x[0u],
      wg_source_momentum_y[0u]
    );
    partial_summaries[partial_base + 2u] = vec4<f32>(
      wg_source_momentum_z[0u],
      wg_next_momentum_x[0u],
      wg_next_momentum_y[0u],
      wg_next_momentum_z[0u]
    );
    partial_summaries[partial_base + 3u] = vec4<f32>(
      momentum_delta.x,
      momentum_delta.y,
      momentum_delta.z,
      wg_max_speed[0u]
    );
    partial_summaries[partial_base + 4u] = vec4<f32>(
      wg_max_displacement[0u],
      wg_min_volume_ratio_j[0u],
      wg_max_volume_ratio_j[0u],
      1.0
    );
  }
}
`,Bd=`
struct ResidentSummaryParams {
  particle_count: u32,
  grid_node_count: u32,
  partial_count: u32,
  pad_u1: u32,
};

@group(0) @binding(0) var<storage, read> partial_summaries: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> resident_summary: array<vec4<f32>>;
@group(0) @binding(2) var<uniform> params: ResidentSummaryParams;

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x > 0u) {
    return;
  }

  var active_grid_nodes = 0.0;
  var source_mass = 0.0;
  var next_mass = 0.0;
  var source_momentum = vec3<f32>(0.0);
  var next_momentum = vec3<f32>(0.0);
  var max_speed = 0.0;
  var max_displacement = 0.0;
  var min_volume_ratio_j = 3.4028234663852886e38;
  var max_volume_ratio_j = 0.0;

  for (var partial_index = 0u; partial_index < params.partial_count; partial_index = partial_index + 1u) {
    let base = partial_index * 5u;
    let row0 = partial_summaries[base];
    let row1 = partial_summaries[base + 1u];
    let row2 = partial_summaries[base + 2u];
    let row3 = partial_summaries[base + 3u];
    let row4 = partial_summaries[base + 4u];
    active_grid_nodes = active_grid_nodes + row0.z;
    source_mass = source_mass + row0.w;
    next_mass = next_mass + row1.x;
    source_momentum = source_momentum + vec3<f32>(row1.z, row1.w, row2.x);
    next_momentum = next_momentum + vec3<f32>(row2.y, row2.z, row2.w);
    max_speed = max(max_speed, row3.w);
    max_displacement = max(max_displacement, row4.x);
    min_volume_ratio_j = min(min_volume_ratio_j, row4.y);
    max_volume_ratio_j = max(max_volume_ratio_j, row4.z);
  }

  if (params.particle_count == 0u) {
    min_volume_ratio_j = 0.0;
  }

  let momentum_delta = next_momentum - source_momentum;
  resident_summary[0u] = vec4<f32>(
    f32(params.particle_count),
    f32(params.grid_node_count),
    active_grid_nodes,
    source_mass
  );
  resident_summary[1u] = vec4<f32>(
    next_mass,
    next_mass - source_mass,
    source_momentum.x,
    source_momentum.y
  );
  resident_summary[2u] = vec4<f32>(
    source_momentum.z,
    next_momentum.x,
    next_momentum.y,
    next_momentum.z
  );
  resident_summary[3u] = vec4<f32>(
    momentum_delta.x,
    momentum_delta.y,
    momentum_delta.z,
    max_speed
  );
  resident_summary[4u] = vec4<f32>(
    max_displacement,
    min_volume_ratio_j,
    max_volume_ratio_j,
    1.0
  );
}
`,Vd=Object.freeze(`H.He.Li.Be.B.C.N.O.F.Ne.Na.Mg.Al.Si.P.S.Cl.Ar.K.Ca.Sc.Ti.V.Cr.Mn.Fe.Co.Ni.Cu.Zn.Ga.Ge.As.Se.Br.Kr.Rb.Sr.Y.Zr.Nb.Mo.Tc.Ru.Rh.Pd.Ag.Cd.In.Sn.Sb.Te.I.Xe.Cs.Ba.La.Ce.Pr.Nd.Pm.Sm.Eu.Gd.Tb.Dy.Ho.Er.Tm.Yb.Lu.Hf.Ta.W.Re.Os.Ir.Pt.Au.Hg.Tl.Pb.Bi.Po.At.Rn.Fr.Ra.Ac.Th.Pa.U.Np.Pu.Am.Cm.Bk.Cf.Es.Fm.Md.No.Lr.Rf.Db.Sg.Bh.Hs.Mt.Ds.Rg.Cn.Nh.Fl.Mc.Lv.Ts.Og`.split(`.`)),Hd=Object.freeze([1.008,4.0026,6.94,9.0122,10.81,12.011,14.007,15.999,18.998,20.18,22.99,24.305,26.982,28.085,30.974,32.06,35.45,39.948,39.098,40.078,44.956,47.867,50.942,51.996,54.938,55.845,58.933,58.693,63.546,65.38,69.723,72.63,74.922,78.971,79.904,83.798,85.468,87.62,88.906,91.224,92.906,95.95,98,101.07,102.91,106.42,107.87,112.41,114.82,118.71,121.76,127.6,126.9,131.29,132.91,137.33,138.91,140.12,140.91,144.24,145,150.36,151.96,157.25,158.93,162.5,164.93,167.26,168.93,173.05,174.97,178.49,180.95,183.84,186.21,190.23,192.22,195.08,196.97,200.59,204.38,207.2,208.98,209,210,222,223,226,227,232.04,231.04,238.03,237,244,243,247,247,251,252,257,258,259,266,267,268,269,270,269,278,281,282,285,286,289,290,293,294,294]),Ud=16605390666e-37;function Wd(e){return Hd[e-1]*Ud}var Gd=Object.freeze({0:2,1:6,2:10,3:14}),Kd=[`s`,`p`,`d`,`f`];function qd(e){return Vd[e-1]??null}function Jd(e){let t=Vd.indexOf(e);return t>=0?t+1:null}function Yd(){let e=[];for(let t=1;t<=8;t+=1)for(let n=0;n<t&&n<=3;n+=1)e.push({n:t,l:n});return e.sort((e,t)=>e.n+e.l-(t.n+t.l)||e.n-t.n),e}var Xd=Yd(),Zd={24:{"3,2":5,"4,0":1},29:{"3,2":10,"4,0":1},41:{"4,2":4,"5,0":1},42:{"4,2":5,"5,0":1},44:{"4,2":7,"5,0":1},45:{"4,2":8,"5,0":1},46:{"4,2":10,"5,0":0},47:{"4,2":10,"5,0":1},57:{"4,3":0,"5,2":1,"6,0":2},58:{"4,3":1,"5,2":1,"6,0":2},64:{"4,3":7,"5,2":1,"6,0":2},78:{"4,3":14,"5,2":9,"6,0":1},79:{"4,3":14,"5,2":10,"6,0":1},89:{"5,3":0,"6,2":1,"7,0":2},90:{"5,3":0,"6,2":2,"7,0":2},91:{"5,3":2,"6,2":1,"7,0":2},92:{"5,3":3,"6,2":1,"7,0":2},93:{"5,3":4,"6,2":1,"7,0":2},96:{"5,3":7,"6,2":1,"7,0":2}};function Qd(e,{applyAnomalies:t=!0}={}){if(!Number.isInteger(e)||e<1||e>118)throw RangeError(`Z out of range: ${e}`);let n=new Map,r=e;for(let{n:e,l:t}of Xd){if(r<=0)break;let i=Math.min(Gd[t],r);n.set(`${e},${t}`,i),r-=i}if(t&&Zd[e])for(let[t,r]of Object.entries(Zd[e]))r===0?n.delete(t):n.set(t,r);let i=[];for(let[e,t]of n){if(t<=0)continue;let[n,r]=e.split(`,`).map(Number);i.push({n,l:r,occupancy:t})}return i.sort((e,t)=>e.n-t.n||e.l-t.l),i}function $d(e,t){let n=Qd(e,t),r=new Map(Xd.map((e,t)=>[`${e.n},${e.l}`,t]));return[...n].sort((e,t)=>(r.get(`${e.n},${e.l}`)??99)-(r.get(`${t.n},${t.l}`)??99)).map(e=>`${e.n}${Kd[e.l]}${e.occupancy}`).join(` `)}function ef(e,t){return Qd(e,t).map(({n:e,l:t,occupancy:n})=>{let r=2*t+1,i=Math.min(n,r);return{n:e,l:t,occUp:i,occDown:n-i}})}function tf(e,t){return ef(e,t).reduce((e,t)=>e+(t.occUp-t.occDown),0)}function nf(e,t){let n=Qd(e,t),r=n.reduce((e,t)=>Math.max(e,t.n),0);return n.filter(e=>e.n===r&&(e.l===0||e.l===1)).reduce((e,t)=>e+t.occupancy,0)}var rf={COMPUTE:globalThis.GPUShaderStage?.COMPUTE??4};function $(e,t=`read-only-storage`){return{binding:e,visibility:rf.COMPUTE,buffer:{type:t}}}function af(e,{label:t,module:n,entryPoint:r=`main`,bindings:i=[]}={}){let a=null,o=null;e?.createBindGroupLayout&&e?.createPipelineLayout&&i.length>0&&(a=e.createBindGroupLayout({label:`${t||r}-bind-group-layout`,entries:i}),o=e.createPipelineLayout({label:`${t||r}-pipeline-layout`,bindGroupLayouts:[a]}));let s=e.createComputePipeline({label:t,layout:o||`auto`,compute:{module:n,entryPoint:r}});return{pipeline:s,bindGroupLayout:a||s.getBindGroupLayout(0)}}function of(e,t){let n=e.map(e=>e.slice()),r=Array.from({length:t},(e,n)=>Array.from({length:t},(e,t)=>+(n===t)));for(let e=0;e<100;e+=1){let e=0;for(let r=0;r<t;r+=1)for(let i=r+1;i<t;i+=1)e+=n[r][i]*n[r][i];if(e<1e-22)break;for(let e=0;e<t;e+=1)for(let i=e+1;i<t;i+=1){if(Math.abs(n[e][i])<1e-18)continue;let a=(n[i][i]-n[e][e])/(2*n[e][i]),o=Math.sign(a||1)/(Math.abs(a)+Math.sqrt(a*a+1)),s=1/Math.sqrt(o*o+1),c=o*s;for(let r=0;r<t;r+=1){let t=n[r][e],a=n[r][i];n[r][e]=s*t-c*a,n[r][i]=c*t+s*a}for(let r=0;r<t;r+=1){let t=n[e][r],a=n[i][r];n[e][r]=s*t-c*a,n[i][r]=c*t+s*a}for(let n=0;n<t;n+=1){let t=r[n][e],a=r[n][i];r[n][e]=s*t-c*a,r[n][i]=c*t+s*a}}}return{values:n.map((e,t)=>e[t]),vectors:r}}function sf(e,t){let n=Array(e+1);if(t<1e-12){for(let t=0;t<=e;t+=1)n[t]=1/(2*t+1);return n}if(t>30){n[0]=.5*Math.sqrt(Math.PI/t);let r=Math.exp(-t);for(let i=1;i<=e;i+=1)n[i]=((2*i-1)*n[i-1]-r)/(2*t);return n}let r=1/(2*e+1),i=r;for(let n=1;n<300&&(r*=-t/n*(2*e+2*n-1)/(2*e+2*n+1),i+=r,!(Math.abs(r)<1e-17*Math.abs(i)));n+=1);n[e]=i;let a=Math.exp(-t);for(let r=e-1;r>=0;--r)n[r]=(2*t*n[r+1]+a)/(2*r+1);return n}function cf(e,t,n,r,i,a){let o=i+a,s=i*a/o;return n<0||n>e+t?0:e===0&&t===0&&n===0?Math.exp(-s*r*r):t===0?1/(2*o)*cf(e-1,t,n-1,r,i,a)-s*r/i*cf(e-1,t,n,r,i,a)+(n+1)*cf(e-1,t,n+1,r,i,a):1/(2*o)*cf(e,t-1,n-1,r,i,a)+s*r/a*cf(e,t-1,n,r,i,a)+(n+1)*cf(e,t-1,n+1,r,i,a)}function lf(e,t,n,r,i,a,o,s,c){return e===0&&t===0&&n===0?(-2*i)**r*c[r]:e>0?(e-1>0?(e-1)*lf(e-2,t,n,r+1,i,a,o,s,c):0)+a*lf(e-1,t,n,r+1,i,a,o,s,c):t>0?(t-1>0?(t-1)*lf(e,t-2,n,r+1,i,a,o,s,c):0)+o*lf(e,t-1,n,r+1,i,a,o,s,c):(n-1>0?(n-1)*lf(e,t,n-2,r+1,i,a,o,s,c):0)+s*lf(e,t,n-1,r+1,i,a,o,s,c)}var uf=(e,t,n,r)=>[(e*t[0]+n*r[0])/(e+n),(e*t[1]+n*r[1])/(e+n),(e*t[2]+n*r[2])/(e+n)];function df(e,t,n,r,i,a){let o=e+r,s=cf(t[0],i[0],0,n[0]-a[0],e,r),c=cf(t[1],i[1],0,n[1]-a[1],e,r),l=cf(t[2],i[2],0,n[2]-a[2],e,r);return s*c*l*(Math.PI/o)**1.5}function ff(e,t,n,r,i,a){let[o,s,c]=i,l=r*(2*(o+s+c)+3)*df(e,t,n,r,i,a),u=-2*r*r*(df(e,t,n,r,[o+2,s,c],a)+df(e,t,n,r,[o,s+2,c],a)+df(e,t,n,r,[o,s,c+2],a)),d=-.5*(o*(o-1)*df(e,t,n,r,[o-2,s,c],a)+s*(s-1)*df(e,t,n,r,[o,s-2,c],a)+c*(c-1)*df(e,t,n,r,[o,s,c-2],a));return l+u+d}function pf(e,t,n,r,i,a,o){let s=e+r,c=uf(e,n,r,a),l=c[0]-o[0],u=c[1]-o[1],d=c[2]-o[2],f=l*l+u*u+d*d,p=sf(t[0]+t[1]+t[2]+i[0]+i[1]+i[2],s*f),m=0;for(let o=0;o<=t[0]+i[0];o+=1){let c=cf(t[0],i[0],o,n[0]-a[0],e,r);for(let f=0;f<=t[1]+i[1];f+=1){let h=cf(t[1],i[1],f,n[1]-a[1],e,r);for(let g=0;g<=t[2]+i[2];g+=1){let _=cf(t[2],i[2],g,n[2]-a[2],e,r);m+=c*h*_*lf(o,f,g,0,s,l,u,d,p)}}}return 2*Math.PI/s*m}function mf(e,t,n,r,i,a,o,s,c,l,u,d){let f=e+r,p=o+l,m=uf(e,n,r,a),h=uf(o,c,l,d),g=f*p/(f+p),_=m[0]-h[0],v=m[1]-h[1],y=m[2]-h[2],b=_*_+v*v+y*y,x=sf(t[0]+t[1]+t[2]+i[0]+i[1]+i[2]+s[0]+s[1]+s[2]+u[0]+u[1]+u[2],g*b),S=0;for(let f=0;f<=t[0]+i[0];f+=1){let p=cf(t[0],i[0],f,n[0]-a[0],e,r);for(let m=0;m<=t[1]+i[1];m+=1){let h=cf(t[1],i[1],m,n[1]-a[1],e,r);for(let b=0;b<=t[2]+i[2];b+=1){let C=cf(t[2],i[2],b,n[2]-a[2],e,r),w=p*h*C;if(w!==0)for(let e=0;e<=s[0]+u[0];e+=1){let t=cf(s[0],u[0],e,c[0]-d[0],o,l);for(let n=0;n<=s[1]+u[1];n+=1){let r=cf(s[1],u[1],n,c[1]-d[1],o,l);for(let i=0;i<=s[2]+u[2];i+=1){let a=cf(s[2],u[2],i,c[2]-d[2],o,l),p=(e+n+i)%2==0?1:-1;S+=w*t*r*a*p*lf(f+e,m+n,b+i,0,g,_,v,y,x)}}}}}}return S*2*Math.PI**2.5/(f*p*Math.sqrt(f+p))}function hf(e){if(e<=0)return 1;let t=1;for(let n=e;n>0;n-=2)t*=n;return t}function gf(e,t){let[n,r,i]=t;return Math.sqrt((2*e/Math.PI)**1.5*(4*e)**(n+r+i)/(hf(2*n-1)*hf(2*r-1)*hf(2*i-1)))}function _f(e,t,n,r){let i=n.map((e,n)=>r[n]*gf(e,t)),a=0;for(let r=0;r<n.length;r+=1)for(let o=0;o<n.length;o+=1)a+=i[r]*i[o]*df(n[r],t,e,n[o],t,e);let o=1/Math.sqrt(a);return{center:e,lmn:t,exps:n,coeffs:i.map(e=>e*o)}}function vf(e,t,n){let r=0;for(let i=0;i<e.exps.length;i+=1)for(let a=0;a<t.exps.length;a+=1)r+=e.coeffs[i]*t.coeffs[a]*n(e.exps[i],e.lmn,e.center,t.exps[a],t.lmn,t.center);return r}var yf=[.15432897,.53532814,.44463454],bf=[-.09996723,.39951283,.70011547],xf=[.15591627,.60768372,.39195739],Sf=[-.219620369,.2255954336,.900398426],Cf=[.0105876043,.5951670053,.462001012],wf={1:[{l:`s`,exps:[3.42525091,.62391373,.1688554],sCoef:yf}],2:[{l:`s`,exps:[6.36242139,1.158923,.31364979],sCoef:yf}],3:[{l:`s`,exps:[16.11957475,2.936200663,.794650487],sCoef:yf},{l:`sp`,exps:[.6362897469,.1478600533,.0480886784],sCoef:bf,pCoef:xf}],4:[{l:`s`,exps:[30.16787069,5.495115306,1.487192653],sCoef:yf},{l:`sp`,exps:[1.31483311,.3055389383,.0993707456],sCoef:bf,pCoef:xf}],5:[{l:`s`,exps:[48.79111318,8.887362172,2.40526704],sCoef:yf},{l:`sp`,exps:[2.236956142,.5198204999,.16906176],sCoef:bf,pCoef:xf}],6:[{l:`s`,exps:[71.616837,13.045096,3.5305122],sCoef:yf},{l:`sp`,exps:[2.9412494,.6834831,.2222899],sCoef:bf,pCoef:xf}],7:[{l:`s`,exps:[99.106169,18.052312,4.8856602],sCoef:yf},{l:`sp`,exps:[3.7804559,.8784966,.2857144],sCoef:bf,pCoef:xf}],8:[{l:`s`,exps:[130.70932,23.808861,6.4436083],sCoef:yf},{l:`sp`,exps:[5.0331513,1.1695961,.380389],sCoef:bf,pCoef:xf}],9:[{l:`s`,exps:[166.679134,30.36081233,8.216820672],sCoef:yf},{l:`sp`,exps:[6.464803249,1.502281245,.4885884864],sCoef:bf,pCoef:xf}],10:[{l:`s`,exps:[207.015607,37.70815124,10.20529731],sCoef:yf},{l:`sp`,exps:[8.24631512,1.916266291,.6232292721],sCoef:bf,pCoef:xf}],11:[{l:`s`,exps:[250.77243,45.67851117,12.36238776],sCoef:yf},{l:`sp`,exps:[12.04019274,2.797881859,.909958017],sCoef:bf,pCoef:xf},{l:`sp`,exps:[1.478740622,.4125648801,.1614750979],sCoef:Sf,pCoef:Cf}],12:[{l:`s`,exps:[299.2374137,54.50646845,14.75157752],sCoef:yf},{l:`sp`,exps:[15.12182352,3.513986579,1.142857498],sCoef:bf,pCoef:xf},{l:`sp`,exps:[1.395448293,.3893265318,.1523797659],sCoef:Sf,pCoef:Cf}],13:[{l:`s`,exps:[351.4214767,64.01186067,17.32410761],sCoef:yf},{l:`sp`,exps:[18.89939621,4.391813233,1.42835397],sCoef:bf,pCoef:xf},{l:`sp`,exps:[1.395448293,.3893265318,.1523797659],sCoef:Sf,pCoef:Cf}],14:[{l:`s`,exps:[407.7975514,74.28083305,20.10329229],sCoef:yf},{l:`sp`,exps:[23.19365606,5.389706871,1.752899952],sCoef:bf,pCoef:xf},{l:`sp`,exps:[1.478740622,.4125648801,.1614750979],sCoef:Sf,pCoef:Cf}],15:[{l:`s`,exps:[468.3656378,85.31338559,23.08913156],sCoef:yf},{l:`sp`,exps:[28.03263958,6.514182577,2.118614352],sCoef:bf,pCoef:xf},{l:`sp`,exps:[1.743103231,.4863213771,.1903428909],sCoef:Sf,pCoef:Cf}],16:[{l:`s`,exps:[533.1257359,97.1095183,26.28162542],sCoef:yf},{l:`sp`,exps:[33.32975173,7.745117521,2.518952599],sCoef:bf,pCoef:xf},{l:`sp`,exps:[2.029194274,.5661400518,.2215833792],sCoef:Sf,pCoef:Cf}],17:[{l:`s`,exps:[601.3456136,109.5358542,29.64467686],sCoef:yf},{l:`sp`,exps:[38.96041889,9.053563477,2.944499834],sCoef:bf,pCoef:xf},{l:`sp`,exps:[2.129386495,.5940934274,.232524141],sCoef:Sf,pCoef:Cf}],18:[{l:`s`,exps:[674.4465184,122.8512753,33.24834945],sCoef:yf},{l:`sp`,exps:[45.16424392,10.495199,3.413364448],sCoef:bf,pCoef:xf},{l:`sp`,exps:[2.621366518,.731354605,.2862472356],sCoef:Sf,pCoef:Cf}]},Tf=[[1,0,0],[0,1,0],[0,0,1]];function Ef(e){let t=[];return e.forEach((e,n)=>{let r=wf[e.Z];if(!r)throw Error(`No STO-3G basis for Z=${e.Z} (have Z=1-18: H–Ar)`);for(let i of r){let r=_f(e.position,[0,0,0],i.exps,i.sCoef);if(r.atomIndex=n,t.push(r),i.l===`sp`)for(let r of Tf){let a=_f(e.position,r,i.exps,i.pCoef);a.atomIndex=n,t.push(a)}}}),t}function Df(e,t){let{values:n,vectors:r}=of(e,t),i=Array.from({length:t},()=>Array(t).fill(0));for(let e=0;e<t;e+=1)for(let a=0;a<t;a+=1){let o=0;for(let i=0;i<t;i+=1)o+=r[e][i]*r[a][i]/Math.sqrt(n[i]);i[e][a]=o}return i}function Of(e,t){let n=Ef(e),r=n.length,i=e.reduce((e,t)=>e+t.Z,0)-t,a=Array.from({length:r},()=>Array(r).fill(0)),o=Array.from({length:r},()=>Array(r).fill(0));for(let t=0;t<r;t+=1)for(let i=0;i<r;i+=1){a[t][i]=vf(n[t],n[i],df);let r=vf(n[t],n[i],ff);for(let a of e)r+=-a.Z*vf(n[t],n[i],(e,t,n,r,i,o)=>pf(e,t,n,r,i,o,a.position));o[t][i]=r}let s=new Float64Array(r*r*r*r),c=(e,t,n,i)=>((e*r+t)*r+n)*r+i;for(let e=0;e<r;e+=1)for(let t=0;t<=e;t+=1)for(let i=0;i<r;i+=1)for(let r=0;r<=i;r+=1){if(e*(e+1)/2+t<i*(i+1)/2+r)continue;let a=Mf(n[e],n[t],n[i],n[r]);for(let[n,o,l,u]of[[e,t,i,r],[t,e,i,r],[e,t,r,i],[t,e,r,i],[i,r,e,t],[r,i,e,t],[i,r,t,e],[r,i,t,e]])s[c(n,o,l,u)]=a}return{basis:n,n:r,nElectrons:i,S:a,Hcore:o,eri:s,idx:c,X:Df(a,r),nuclearRepulsion:Nf(e)}}function kf(e,t,n){let{values:r,vectors:i}=of(Ff(Ff(Pf(t,n),e,n),t,n),n),a=r.map((e,t)=>t).sort((e,t)=>r[e]-r[t]),o=Array.from({length:n},()=>Array(n).fill(0));for(let e=0;e<n;e+=1)for(let r=0;r<n;r+=1){let s=0;for(let o=0;o<n;o+=1)s+=t[e][o]*i[o][a[r]];o[e][r]=s}return{C:o,epsilon:a.map(e=>r[e])}}function Af(e,{charge:t=0,maxIter:n=200,tol:r=1e-8,damping:i=.5}={}){let{basis:a,n:o,nElectrons:s,S:c,Hcore:l,eri:u,idx:d,X:f,nuclearRepulsion:p}=Of(e,t);if(s%2!=0)throw Error(`RHF requires an even electron count (closed shell)`);let m=s/2,h=Array.from({length:o},()=>Array(o).fill(0)),g=0,_=1/0,v=null,y=null,b=h;for(let e=0;e<n;e+=1){let t=Array.from({length:o},()=>Array(o).fill(0));for(let e=0;e<o;e+=1)for(let n=0;n<o;n+=1){let r=0;for(let t=0;t<o;t+=1)for(let i=0;i<o;i+=1)r+=h[t][i]*(u[d(e,n,i,t)]-.5*u[d(e,t,i,n)]);t[e][n]=l[e][n]+r}let{C:n,epsilon:a}=kf(t,f,o);v=n,y=a;let s=Array.from({length:o},()=>Array(o).fill(0));for(let e=0;e<o;e+=1)for(let t=0;t<o;t+=1){let r=0;for(let i=0;i<m;i+=1)r+=n[e][i]*n[t][i];s[e][t]=2*r}let c=0;for(let e=0;e<o;e+=1)for(let n=0;n<o;n+=1)c+=.5*s[e][n]*(l[e][n]+t[e][n]);b=s;for(let e=0;e<o;e+=1)for(let t=0;t<o;t+=1)h[e][t]=i*s[e][t]+(1-i)*h[e][t];if(g=c,Math.abs(g-_)<r&&e>2)break;_=g}return{totalEnergyHa:g+p,electronicEnergyHa:g,nuclearRepulsionHa:p,nBasis:o,nElectrons:s,nOcc:m,C:v,orbitalEnergies:y,eri:u,idx:d,P:b,S:c,basis:a}}function jf(e,{charge:t=0,multiplicity:n=null,maxIter:r=300,tol:i=1e-9,damping:a=.6}={}){let{n:o,nElectrons:s,Hcore:c,eri:l,idx:u,X:d,nuclearRepulsion:f}=Of(e,t),p=n==null?s%2:n-1,m=(s+p)/2,h=(s-p)/2;if(!Number.isInteger(m)||h<0)throw Error(`inconsistent electron count / multiplicity`);let g=(e,t)=>{let n=Array.from({length:o},()=>Array(o).fill(0));for(let r=0;r<o;r+=1)for(let i=0;i<o;i+=1){let a=0;for(let n=0;n<t;n+=1)a+=e[r][n]*e[i][n];n[r][i]=a}return n},{C:_}=kf(c,d,o),v=g(_,m),y=g(_,h),b=0,x=1/0;for(let e=0;e<r;e+=1){let t=Array.from({length:o},(e,t)=>Array.from({length:o},(e,n)=>v[t][n]+y[t][n])),n=Array.from({length:o},()=>Array(o).fill(0)),r=Array.from({length:o},()=>Array(o).fill(0));for(let e=0;e<o;e+=1)for(let i=0;i<o;i+=1){let a=0,s=0,d=0;for(let n=0;n<o;n+=1)for(let r=0;r<o;r+=1)a+=t[n][r]*l[u(e,i,r,n)],s+=v[n][r]*l[u(e,n,r,i)],d+=y[n][r]*l[u(e,n,r,i)];n[e][i]=c[e][i]+a-s,r[e][i]=c[e][i]+a-d}let{C:s}=kf(n,d,o),{C:f}=kf(r,d,o),p=g(s,m),_=g(f,h),S=0;for(let e=0;e<o;e+=1)for(let t=0;t<o;t+=1)S+=.5*((p[e][t]+_[e][t])*c[e][t]+p[e][t]*n[e][t]+_[e][t]*r[e][t]);for(let e=0;e<o;e+=1)for(let t=0;t<o;t+=1)v[e][t]=a*p[e][t]+(1-a)*v[e][t],y[e][t]=a*_[e][t]+(1-a)*y[e][t];if(b=S,Math.abs(b-x)<i&&e>2)break;x=b}return{totalEnergyHa:b+f,electronicEnergyHa:b,nuclearRepulsionHa:f,nBasis:o,nElectrons:s,nAlpha:m,nBeta:h}}function Mf(e,t,n,r){let i=0;for(let a=0;a<e.exps.length;a+=1)for(let o=0;o<t.exps.length;o+=1)for(let s=0;s<n.exps.length;s+=1)for(let c=0;c<r.exps.length;c+=1)i+=e.coeffs[a]*t.coeffs[o]*n.coeffs[s]*r.coeffs[c]*mf(e.exps[a],e.lmn,e.center,t.exps[o],t.lmn,t.center,n.exps[s],n.lmn,n.center,r.exps[c],r.lmn,r.center);return i}function Nf(e){let t=0;for(let n=0;n<e.length;n+=1)for(let r=n+1;r<e.length;r+=1){let i=e[n].position[0]-e[r].position[0],a=e[n].position[1]-e[r].position[1],o=e[n].position[2]-e[r].position[2];t+=e[n].Z*e[r].Z/Math.sqrt(i*i+a*a+o*o)}return t}var Pf=(e,t)=>Array.from({length:t},(n,r)=>Array.from({length:t},(t,n)=>e[n][r]));function Ff(e,t,n){let r=Array.from({length:n},()=>Array(n).fill(0));for(let i=0;i<n;i+=1)for(let a=0;a<n;a+=1){let o=e[i][a];if(o!==0)for(let e=0;e<n;e+=1)r[i][e]+=o*t[a][e]}return r}function If(e,t={}){return jf([{Z:e,position:[0,0,0]}],{multiplicity:tf(e)+1,...t}).totalEnergyHa}function Lf(e,{moleculeOptions:t={},atomCache:n=new Map}={}){let r=jf(e,t).totalEnergyHa,i=0;for(let t of e)n.has(t.Z)||n.set(t.Z,If(t.Z)),i+=n.get(t.Z);return{atomizationEnergyHa:i-r,moleculeEnergyHa:r,atomsEnergyHa:i}}var Rf=43597447222071e-31,zf=529177210903e-22,Bf=(9*Math.PI/4)**(1/3),Vf=(Math.log(2)-1)/(2*Math.PI*Math.PI),Hf=20.4562557,Uf=(Math.log(2)-1)/(4*Math.PI*Math.PI),Wf=27.4203609;function Gf(e){return(3/(4*Math.PI*e))**(1/3)}function Kf(e){return 3/(4*Math.PI*e**3)}function qf(e){let t=Bf/e;return .3*t*t}function Jf(e){return-(3/(4*Math.PI))*(Bf/e)}function Yf(e){return Vf*Math.log(1+Hf/e+Hf/(e*e))}function Xf(e){return Uf*Math.log(1+Wf/e+Wf/(e*e))}function Zf(e){return((1+e)**(4/3)+(1-e)**(4/3)-2)/(2**(4/3)-2)}function Qf(e,t){return Jf(e)*.5*((1+t)**(4/3)+(1-t)**(4/3))}function $f(e,t){let n=Yf(e);return n+(Xf(e)-n)*Zf(t)}function ep(e,t){return Qf(e,t)+$f(e,t)}function tp(e){return qf(e)+Jf(e)+Yf(e)}var np=.0072973525693;function rp(e){if(e<=1e-12)return 0;let t=Gf(e);return e*(tp(t)-ip(t))}function ip(e){let t=(9*Math.PI/4)**(1/3)/e;return .3*t*t}function ap(e){if(e<=1e-12)return 0;let t=e*1e-4+1e-15;return(rp(e+t)-rp(e-t))/(2*t)}function op(e,t,n){let r=e.length,i=new Float64Array(r),a=new Float64Array(r);i[0]=t[0]/e[0],a[0]=n[0]/e[0];for(let o=1;o<r;o+=1){let s=e[o]-t[o-1]*i[o-1];i[o]=(o<r-1?t[o]:0)/s,a[o]=(n[o]-t[o-1]*a[o-1])/s}let o=new Float64Array(r);o[r-1]=a[r-1];for(let e=r-2;e>=0;--e)o[e]=a[e]-i[e]*o[e+1];return o}function sp(e,t,n){let r=e.length,i=0,a=e[0]-n;a<0&&(i+=1);for(let o=1;o<r;o+=1)Math.abs(a)<1e-300&&(a=-1e-300),a=e[o]-n-t[o-1]*t[o-1]/a,a<0&&(i+=1);return i}function cp(e,t){let n=e.length,r=1/0,i=-1/0;for(let a=0;a<n;a+=1){let o=Math.abs(a>0?t[a-1]:0)+Math.abs(a<n-1?t[a]:0);r=Math.min(r,e[a]-o),i=Math.max(i,e[a]+o)}return{lo:r,hi:i}}function lp(e){return Math.min(160,Math.max(48,Math.ceil(Math.log2(Math.max(e,1e-300)/1e-13))))}function up(e,t,n,r,{lowerVecs:i=null,bounds:a=null,bracketHint:o=null}={}){let s=e.length,c,l;if(o&&sp(e,t,o[0])<n&&sp(e,t,o[1])>=n)[c,l]=o;else{let{lo:n,hi:r}=a??cp(e,t);c=n,l=r}let u=lp(l-c);for(let r=0;r<u;r+=1){let r=.5*(c+l);sp(e,t,r)>=n?l=r:c=r}let d=.5*(c+l),f=d-1e-7*(Math.abs(d)+1),p=new Float64Array(s);for(let t=0;t<s;t+=1)p[t]=e[t]-f;let m=new Float64Array(s);for(let e=0;e<s;e+=1)m[e]=Math.sin(n*Math.PI*(e+1)/(s+1));for(let e=0;e<12;e+=1){let e=op(p,t,m);if(i)for(let t of i){let n=0;for(let i=0;i<s;i+=1)n+=e[i]*t[i]*r;for(let r=0;r<s;r+=1)e[r]-=n*t[r]}let n=0;for(let t=0;t<s;t+=1)n+=e[t]*e[t]*r;n=Math.sqrt(n);for(let t=0;t<s;t+=1)m[t]=e[t]/n}if(m[1]<0)for(let e=0;e<s;e+=1)m[e]=-m[e];return{energyHa:d,u:m}}function dp(e,t,n,r){let i=cp(e,t),a=[],o=[];for(let s=1;s<=n;s+=1){let n=up(e,t,s,r,{lowerVecs:o,bounds:i});a.push(n),o.push(n.u)}return a}Object.freeze({H:{Z:1,config:[{n:1,l:0,occupancy:1}]},He:{Z:2,config:[{n:1,l:0,occupancy:2}]},Be:{Z:4,config:[{n:1,l:0,occupancy:2},{n:2,l:0,occupancy:2}]},Ne:{Z:10,config:[{n:1,l:0,occupancy:2},{n:2,l:0,occupancy:2},{n:2,l:1,occupancy:6}]},Ar:{Z:18,config:[{n:1,l:0,occupancy:2},{n:2,l:0,occupancy:2},{n:2,l:1,occupancy:6},{n:3,l:0,occupancy:2},{n:3,l:1,occupancy:6}]},Fe:{Z:26,config:[{n:1,l:0,occupancy:2},{n:2,l:0,occupancy:2},{n:2,l:1,occupancy:6},{n:3,l:0,occupancy:2},{n:3,l:1,occupancy:6},{n:4,l:0,occupancy:2},{n:3,l:2,occupancy:6}]}});function fp(e,t,n){let r=t.length,i=new Float64Array(r),a=new Float64Array(r),o=0;for(let a=0;a<r;a+=1)o+=e[a]*t[a]*t[a]*t[a]*n,i[a]=o;o=0;for(let i=r-1;i>=0;--i)o+=e[i]*t[i]*t[i]*n,a[i]=o;let s=new Float64Array(r);for(let e=0;e<r;e+=1)s[e]=4*Math.PI*(i[e]/t[e]+a[e]);return s}function pp(e,t,n,r,i){let a=t.length,o=1/(n*n),s=new Float64Array(a),c=new Float64Array(a);for(let n=0;n<a;n+=1)s[n]=(o+.5*(r+.5)*(r+.5))/(t[n]*t[n])+e[n],n<a-1&&(c[n]=-o/(2*t[n]*t[n+1]));let l=dp(s,c,i,n);for(let e of l){let r=new Float64Array(a);for(let n=0;n<a;n+=1)r[n]=e.u[n]/Math.sqrt(2*t[n]);let i=0;for(let e=0;e<a;e+=1)i+=r[e]*r[e]*t[e]*n;i=Math.sqrt(i);for(let e=0;e<a;e+=1)r[e]/=i;e.u=r}return l}function mp({u:e,energyHa:t,vFull:n,r,dx:i,l:a,atomicNumberZ:o}){let s=np*np,c=0;for(let a=0;a<r.length;a+=1){let o=t-n[a];c+=o*o*e[a]*e[a]*r[a]*i}let l=0;if(a===0){let t=e[0]/r[0];l=s/8*o*t*t}return-.5*s*c+l}function hp(e,t,n){let r=e.length,i=new Float64Array(r),a=new Float64Array(r);for(let o=1;o<r-1;o+=1){let r=(e[o+1]-e[o-1])/(2*n),s=(e[o+1]-2*e[o]+e[o-1])/(n*n);i[o]=r/t[o],a[o]=(s-r)/(t[o]*t[o])}return i[0]=i[1],i[r-1]=i[r-2],a[0]=a[1],a[r-1]=a[r-2],{fp:i,fpp:a}}function gp(e,t,n,r,i,a,o){let s=t.length,c=1/(n*n),l=.5*np*np,u=new Float64Array(s);for(let n=0;n<s;n+=1)u[n]=-a/t[n]+e[n];let{fp:d,fpp:f}=hp(e,t,n),p=new Float64Array(s),m=new Float64Array(s);for(let e=0;e<s;e+=1)p[e]=a/(t[e]*t[e])+d[e],m[e]=-2*a/(t[e]*t[e]*t[e])+f[e];let h=[];for(let e=0;e<i;e+=1){let i=o?.[e]??-a*a/(2*(e+r+1)*(e+r+1)),d=null;for(let a=0;a<40;a+=1){let o=new Float64Array(s);for(let e=0;e<s;e+=1)o[e]=1+l*(i-u[e]);let f=new Float64Array(s),h=new Float64Array(s);for(let e=0;e<s;e+=1){let n=-26625677260334657e-21*p[e]/o[e],i=2*o[e]*u[e]-n/t[e]+.75*n*n-.5*(-26625677260334657e-21*m[e])/o[e];f[e]=(2*c+(r+.5)*(r+.5)+t[e]*t[e]*i)/(2*o[e]*t[e]*t[e]),e<s-1&&(h[e]=-c/(2*t[e]*t[e+1]*Math.sqrt(o[e]*o[e+1])))}let g=Math.max(2,.05*Math.abs(i)),_=up(f,h,e+1,n,{bracketHint:[i-g,i+g]}),v=_.energyHa;if(d=_.u,Math.abs(v-i)<1e-9&&a>1){i=v;break}i=v}let f=new Float64Array(s);for(let e=0;e<s;e+=1)f[e]=d[e]/Math.sqrt(2*t[e]);let g=0;for(let e=0;e<s;e+=1)g+=f[e]*f[e]*t[e]*n;g=Math.sqrt(g);for(let e=0;e<s;e+=1)f[e]/=g;h.push({energyHa:i,u:f})}return h}function _p({atomicNumberZ:e,configuration:t,gridPointsN:n=1400,rMinBohr:r=1e-5,rMaxBohr:i=40,mixing:a=.2,maxScf:o=500,tol:s=1e-7,relativistic:c=!1,returnRadialDensity:l=!1}){let u=Math.log(r),d=(Math.log(i)-u)/(n-1),f=new Float64Array(n);for(let e=0;e<n;e+=1)f[e]=Math.exp(u+e*d);let p=new Map;for(let e of t)p.set(e.l,Math.max(p.get(e.l)||0,e.n-e.l));let m=new Float64Array(n);for(let t=0;t<n;t+=1)m[t]=e*(e**3/Math.PI)*Math.exp(-2*e*f[t]);let h=new Map,g=new Float64Array(n),_=new Float64Array(n),v=new Float64Array(n);for(let r=0;r<o;r+=1){g=fp(m,f,d);for(let t=0;t<n;t+=1)_[t]=ap(m[t]),v[t]=-e/f[t]+g[t]+_[t];h=new Map;for(let[e,t]of p)h.set(e,pp(v,f,d,e,t));let i=new Float64Array(n);for(let e of t){let t=h.get(e.l)[e.n-e.l-1];for(let r=0;r<n;r+=1)i[r]+=e.occupancy*t.u[r]*t.u[r]/(4*Math.PI*f[r]*f[r])}let o=0;for(let e=0;e<n;e+=1)o+=Math.abs(i[e]-m[e])*4*Math.PI*f[e]*f[e]*f[e]*d,m[e]=(1-a)*m[e]+a*i[e];if(o<s&&r>8)break}let y=0,b=0,x=0,S=[];for(let n of t){let t=h.get(n.l)[n.n-n.l-1];y+=n.occupancy*t.energyHa,b+=n.occupancy;let r={n:n.n,l:n.l,occupancy:n.occupancy,energyHa:t.energyHa};c&&(r.relativisticShiftHa=mp({u:t.u,energyHa:t.energyHa,vFull:v,r:f,dx:d,l:n.l,atomicNumberZ:e}),x+=n.occupancy*r.relativisticShiftHa),S.push(r)}let C=0,w=0,T=0;for(let e=0;e<n;e+=1){let t=4*Math.PI*f[e]*f[e]*f[e]*d;C+=m[e]*t,w+=.5*m[e]*g[e]*t,T+=(rp(m[e])-_[e]*m[e])*t}let E=y-w+T;return{totalEnergyHa:E,orbitals:S,electronCount:b,integratedElectrons:C,atomicNumberZ:e,...l?{radialGrid:{r:Array.from(f),rho:Array.from(m),dx:d}}:{},...c?{relativisticCorrectionHa:x,totalEnergyRelHa:E+x}:{}}}function vp(e,t){let n=e+t;return n<=1e-12?0:n*ep(Gf(n),Math.max(-1,Math.min(1,(e-t)/n)))}function yp(e,t){let n=e*1e-4+1e-15,r=t*1e-4+1e-15;return{vUp:(vp(e+n,t)-vp(e-n,t))/(2*n),vDown:(vp(e,t+r)-vp(e,t-r))/(2*r)}}function bp(e,t,n,r,i){let a=new Float64Array(i),o=new Float64Array(i);for(let s of e){let e=s.n-s.l-1;if(s.occUp>0){let n=t.get(s.l)[e].u;for(let e=0;e<i;e+=1)a[e]+=s.occUp*n[e]*n[e]/(4*Math.PI*r[e]*r[e])}if(s.occDown>0){let t=n.get(s.l)[e].u;for(let e=0;e<i;e+=1)o[e]+=s.occDown*t[e]*t[e]/(4*Math.PI*r[e]*r[e])}}return{rhoUp:a,rhoDown:o}}function xp({atomicNumberZ:e,spinConfiguration:t,gridPointsN:n=1400,rMinBohr:r=1e-5,rMaxBohr:i=40,mixing:a=.2,maxScf:o=600,tol:s=1e-7,relativistic:c=!1}){let l=Math.log(r),u=(Math.log(i)-l)/(n-1),d=new Float64Array(n);for(let e=0;e<n;e+=1)d[e]=Math.exp(l+e*u);let f=new Map,p=new Map,m=0,h=0;for(let e of t)e.occUp>0&&f.set(e.l,Math.max(f.get(e.l)||0,e.n-e.l)),e.occDown>0&&p.set(e.l,Math.max(p.get(e.l)||0,e.n-e.l)),m+=e.occUp,h+=e.occDown;let g=m+h,_=new Float64Array(n),v=new Float64Array(n);for(let t=0;t<n;t+=1){let n=e*(e**3/Math.PI)*Math.exp(-2*e*d[t]);_[t]=m/g*n,v[t]=h/g*n}let y=new Map,b=new Map,x=new Float64Array(n),S=new Float64Array(n),C=new Float64Array(n),w=new Float64Array(n),T=new Float64Array(n);for(let r=0;r<o;r+=1){let i=new Float64Array(n);for(let e=0;e<n;e+=1)i[e]=_[e]+v[e];x=fp(i,d,u);for(let t=0;t<n;t+=1){let{vUp:n,vDown:r}=yp(_[t],v[t]);S[t]=n,C[t]=r,w[t]=-e/d[t]+x[t]+n,T[t]=-e/d[t]+x[t]+r}y=new Map,b=new Map;for(let[e,t]of f)y.set(e,pp(w,d,u,e,t));for(let[e,t]of p)b.set(e,pp(T,d,u,e,t));let{rhoUp:o,rhoDown:c}=bp(t,y,b,d,n),l=0;for(let e=0;e<n;e+=1)l+=(Math.abs(o[e]-_[e])+Math.abs(c[e]-v[e]))*4*Math.PI*d[e]*d[e]*d[e]*u,_[e]=(1-a)*_[e]+a*o[e],v[e]=(1-a)*v[e]+a*c[e];if(l<s&&r>8)break}let E=0,D=0,O=[];for(let n of t){let t=n.n-n.l-1,r={n:n.n,l:n.l,occUp:n.occUp,occDown:n.occDown};if(n.occUp>0){let i=y.get(n.l)[t];r.energyUpHa=i.energyHa,E+=n.occUp*i.energyHa,c&&(D+=n.occUp*mp({u:i.u,energyHa:i.energyHa,vFull:w,r:d,dx:u,l:n.l,atomicNumberZ:e}))}if(n.occDown>0){let i=b.get(n.l)[t];r.energyDownHa=i.energyHa,E+=n.occDown*i.energyHa,c&&(D+=n.occDown*mp({u:i.u,energyHa:i.energyHa,vFull:T,r:d,dx:u,l:n.l,atomicNumberZ:e}))}O.push(r)}let k=0,A=0,j=0,M=0;for(let e=0;e<n;e+=1){let t=4*Math.PI*d[e]*d[e]*d[e]*u,n=_[e]+v[e];k+=n*t,A+=(_[e]-v[e])*t,j+=.5*n*x[e]*t,M+=(vp(_[e],v[e])-S[e]*_[e]-C[e]*v[e])*t}let N=E-j+M;return{totalEnergyHa:N,spinMoment:A,orbitals:O,electronCount:g,integratedElectrons:k,atomicNumberZ:e,...c?{relativisticCorrectionHa:D,totalEnergyRelHa:N+D}:{}}}function Sp({atomicNumberZ:e,configuration:t,gridPointsN:n=1400,rMinBohr:r=1e-6,rMaxBohr:i=40,mixing:a=.2,maxScf:o=500,tol:s=1e-7}){let c=Math.log(r),l=(Math.log(i)-c)/(n-1),u=new Float64Array(n);for(let e=0;e<n;e+=1)u[e]=Math.exp(c+e*l);let d=new Map;for(let e of t)d.set(e.l,Math.max(d.get(e.l)||0,e.n-e.l));let f=new Float64Array(n);for(let t=0;t<n;t+=1)f[t]=e*(e**3/Math.PI)*Math.exp(-2*e*u[t]);let p=new Map,m=new Map,h=new Float64Array(n),g=new Float64Array(n),_=new Float64Array(n);for(let r=0;r<o;r+=1){h=fp(f,u,l);for(let e=0;e<n;e+=1)g[e]=ap(f[e]),_[e]=h[e]+g[e];p=new Map;for(let[t,n]of d){let r=gp(_,u,l,t,n,e,m.get(t));m.set(t,r.map(e=>e.energyHa)),p.set(t,r)}let i=new Float64Array(n);for(let e of t){let t=p.get(e.l)[e.n-e.l-1];for(let r=0;r<n;r+=1)i[r]+=e.occupancy*t.u[r]*t.u[r]/(4*Math.PI*u[r]*u[r])}let o=0;for(let e=0;e<n;e+=1)o+=Math.abs(i[e]-f[e])*4*Math.PI*u[e]*u[e]*u[e]*l,f[e]=(1-a)*f[e]+a*i[e];if(o<s&&r>8)break}let v=0,y=0,b=[];for(let e of t){let t=p.get(e.l)[e.n-e.l-1];v+=e.occupancy*t.energyHa,y+=e.occupancy,b.push({n:e.n,l:e.l,occupancy:e.occupancy,energyHa:t.energyHa})}let x=0,S=0,C=0;for(let e=0;e<n;e+=1){let t=4*Math.PI*u[e]*u[e]*u[e]*l;x+=f[e]*t,S+=.5*f[e]*h[e]*t,C+=(rp(f[e])-g[e]*f[e])*t}return{totalEnergyHa:v-S+C,orbitals:b,electronCount:y,integratedElectrons:x,atomicNumberZ:e,relativisticMethod:`koelling-harmon`}}function Cp(e,t={}){let n=t.gridPointsN??Math.round(1200+12*e),r=t.rMaxBohr??Math.max(20,60/Math.sqrt(e));if(t.spinPolarized){let i=t.spinConfiguration??ef(e),a=xp({atomicNumberZ:e,spinConfiguration:i,gridPointsN:n,rMaxBohr:r,...t});return{symbol:qd(e),spinConfiguration:i,...a}}let i=t.configuration??Qd(e);if(t.scalarRelativistic){let a=Sp({atomicNumberZ:e,configuration:i,gridPointsN:n,rMaxBohr:r,...t});return{symbol:qd(e),configuration:i,...a}}let a=_p({atomicNumberZ:e,configuration:i,gridPointsN:n,rMaxBohr:r,...t});return{symbol:qd(e),configuration:i,...a}}var wp=529177210903e-22,Tp=27.211386245988,Ep=6582119569e-25,Dp=.025,Op=.22,kp=.35,Ap=.06,jp=12,Mp=6,Np=Object.freeze([380,430,480,530,580,630,680,730,780]),Pp=new Map,Fp=(e,t)=>jf(e,{multiplicity:t}).totalEnergyHa,Ip=new Map;function Lp(e,t,n,r){let i=(e-t)*(e<t?1/n:1/r);return Math.exp(-.5*i*i)}function Rp(e){return 1.056*Lp(e,599.8,37.9,31)+.362*Lp(e,442,16,26.7)-.065*Lp(e,501.1,20.4,26.2)}function zp(e){return .821*Lp(e,568.8,46.9,40.5)+.286*Lp(e,530.9,16.3,31.1)}function Bp(e){return 1.217*Lp(e,437,11.8,36)+.681*Lp(e,459,26,13.8)}function Vp(e){let t=Math.min(1,Math.max(0,e));return t<=.0031308?12.92*t:1.055*t**(1/2.4)-.055}function Hp(e){let t=0,n=0,r=0,i=0;for(let a=380;a<=780;a+=5){let o=e(a);t+=o*Rp(a),n+=o*zp(a),r+=o*Bp(a),i+=zp(a)}t/=i,n/=i,r/=i;let a=3.2406*t-1.5372*n-.4986*r,o=-.9689*t+1.8758*n+.0415*r,s=.0557*t-.204*n+1.057*r;return{r:Vp(Math.max(0,a)),g:Vp(Math.max(0,o)),b:Vp(Math.max(0,s))}}function Up(e){let t=0,n=0;for(let r=380;r<=780;r+=5){let i=zp(r);t+=e(r)*i,n+=i}return n>0?t/n:0}function Wp(e){return Math.min(1,Math.max(0,Number.isFinite(e)?e:0))}function Gp(e){return Array.isArray(e)?[Wp(e[0]),Wp(e[1]),Wp(e[2])]:[Wp(e?.r),Wp(e?.g),Wp(e?.b)]}function Kp(e){return Number.isFinite(e)?Number(e).toPrecision(10):String(e??`null`)}function qp(e){return!Array.isArray(e)||e.length===0?`none`:e.map(e=>[e.from??`?`,e.to??`?`,Kp(e.energyEv),Kp(e.dampingEv),Kp(e.strengthWeight)].join(`:`)).join(`|`)}function Jp({material:e,phase:t=`liquid`,pathLengthM:n=.3,properties:r,conductionElectronDensityPerM3:i}={}){return[e??`unknown`,t??`unknown`,Kp(n),Kp(i??r?.conductionElectronDensityPerM3),Kp(r?.electronicGapEv),qp(r?.opticalInterbandOscillators),Array.isArray(r?.intrinsicColorSrgb)?r.intrinsicColorSrgb.map(Kp).join(`,`):`no-intrinsic`].join(`::`)}function Yp(e){return{...e,baseColorSrgb:e.baseColorSrgb?[...e.baseColorSrgb]:e.baseColorSrgb,attenuationColor:e.attenuationColor?[...e.attenuationColor]:e.attenuationColor,interbandOscillators:Array.isArray(e.interbandOscillators)?e.interbandOscillators.map(e=>({...e})):e.interbandOscillators,spectralSamples:Array.isArray(e.spectralSamples)?e.spectralSamples.map(e=>({...e})):e.spectralSamples,pbr:e.pbr?{...e.pbr,baseColorSrgb:e.pbr.baseColorSrgb?[...e.pbr.baseColorSrgb]:e.pbr.baseColorSrgb}:e.pbr,provenance:e.provenance?{...e.provenance,inputs:e.provenance.inputs?{...e.provenance.inputs}:e.provenance.inputs}:e.provenance}}function Xp(e,{baseColorSrgb:t,renderModel:n,vertexColorPolicy:r=`material-pbr`,spectralSamples:i=[]}){let a=Gp(t);return{...e,baseColorSrgb:a,renderModel:n,vertexColorPolicy:r,spectralSamples:i,pbr:{baseColorSrgb:a,metalness:e.metalness,roughness:e.roughness,opacity:e.opacity,transmission:e.transmission,ior:e.ior??null,renderModel:n,vertexColorPolicy:r}}}function Zp(e){return e>0?1-Math.exp(-Math.min(80,e)):0}function Qp(e,t){return[e[0]+t[0],e[1]+t[1]]}function $p(e,t){return[e[0]-t[0],e[1]-t[1]]}function em(e,t){let n=t[0]*t[0]+t[1]*t[1];return[(e[0]*t[0]+e[1]*t[1])/n,(e[1]*t[0]-e[0]*t[1])/n]}function tm(e){let[t,n]=e,r=Math.hypot(t,n);return[Math.sqrt(Math.max(0,(r+t)/2)),Math.sign(n||1)*Math.sqrt(Math.max(0,(r-t)/2))]}function nm(e){let[t,n]=tm(e);return((t-1)**2+n**2)/((t+1)**2+n**2)}function rm(e,t){let[,n]=tm(t);return 4*Math.PI*Math.max(0,n)/(e*1e-9)}function im(e,t,n){let[r,i]=tm(t),a=rm(e,t);return{wavelengthNm:e,reflectance:Wp(nm(t)),transmittance:Math.exp(-Math.min(80,a*Math.max(0,n))),absorptionCoefficientPerM:a,scatteringCoefficientPerM:0,n:r,k:i}}function am(e,{absorptionCoefficientPerM:t,pathLengthM:n,reflectance:r=0,scatteringCoefficientPerM:i=0,n:a=null,k:o=null}){let s=Math.max(0,t??0);return{wavelengthNm:e,reflectance:Wp(r),transmittance:Math.exp(-Math.min(80,s*Math.max(0,n))),absorptionCoefficientPerM:s,scatteringCoefficientPerM:Math.max(0,i),n:a,k:o}}function om(e){return typeof e!=`string`||e.length===0?null:Jd(e[0].toUpperCase()+e.slice(1).toLowerCase())??null}function sm(e){return 2*(2*e+1)}function cm(e){return`${e.n}${`spdfg`[e.l]??`l${e.l}`}`}function lm(e){return Qd(e).some(e=>e.l>=2&&e.occupancy>0)}function um(e){let t=Qd(e).map(e=>({...e})),n=(e,n)=>{let r=Math.max(e,n+1);for(;t.some(e=>e.n===r&&e.l===n);)r+=1;t.push({n:r,l:n,occupancy:0})};for(let e of[...t])if(!(e.occupancy<=0||e.l<2))for(let t of[e.l-1,e.l+1])t<0||t>4||n(e.n+1,t);return t.sort((e,t)=>e.n+e.l-(t.n+t.l)||e.n-t.n||e.l-t.l)}function dm(e,t={}){if(!lm(e))return[];let n=t.gridPointsN??900,r=t.rMaxBohr??42,i=t.maxScf??160,a=`${e}:${n}:${r}:${i}`;if(Ip.has(a))return Ip.get(a);let o=Cp(e,{scalarRelativistic:!0,configuration:um(e),gridPointsN:n,rMaxBohr:r,maxScf:i}),s=o.orbitals.filter(e=>e.occupancy>0),c=o.orbitals.filter(e=>e.occupancy<sm(e.l)),l=[];for(let e of s)if(!(e.l<2))for(let t of c){if(t.n===e.n&&t.l===e.l||Math.abs(t.l-e.l)!==1||t.energyHa<=e.energyHa)continue;let n=(t.energyHa-e.energyHa)*Tp;if(!(n>0)||n>jp)continue;let r=t.l>e.l?(e.l+1)/(2*e.l+1):e.l/(2*e.l+1),i=Math.min(1,Math.max(0,e.occupancy/sm(e.l))),a=Math.min(1,Math.max(0,1-t.occupancy/sm(t.l))),o=e.l>=2?1:.35,s=i*a*r*o;s>0&&l.push({from:cm(e),to:cm(t),fromL:e.l,toL:t.l,occupancy:e.occupancy,targetOccupancy:t.occupancy,rawEnergyEv:n,strengthWeight:s})}let u=l.sort((e,t)=>e.rawEnergyEv-t.rawEnergyEv||t.strengthWeight-e.strengthWeight).slice(0,Mp);return Ip.set(a,u),u}function fm(e){let t=Math.max(0,e)*wp**3;if(!(t>0))return 0;let n=(3*Math.PI*Math.PI*t)**(1/3);return Math.sqrt(4*n/Math.PI)}function pm({atomicNumberZ:e,conductionElectronDensityPerM3:t,options:n={}}={}){if(!(e>0)||!(t>0))return[];let r=fm(t),i=.5*Tp*r*r;return dm(e,n).map(e=>{let t=e.rawEnergyEv/Tp,n=Math.sqrt(1+(r/Math.sqrt(Math.max(t,1e-6)))**2),a=Ap*i*Math.sqrt(Math.max(e.strengthWeight,0)),o=e.rawEnergyEv;return{...e,energyEv:o,thomasFermiScreeningRatio:n,electronGasEnergyEv:i,bandBroadeningEv:a,thomasFermiWavevectorBohr:r,dampingEv:Math.max(Op,kp*o+a)}}).filter(e=>e.energyEv>.15&&e.energyEv<8).sort((e,t)=>e.energyEv-t.energyEv||t.strengthWeight-e.strengthWeight).slice(0,Mp)}var mm=1602176634e-28,hm=88541878128e-22,gm=91093837015e-41;function _m(e){return Math.sqrt(e*mm*mm/(hm*gm))}function vm(e,{plasmaEnergyEv:t,dampingEv:n,oscillators:r}){let i=[1,0];i=$p(i,em([t*t,0],[e*e,e*n]));for(let n of r||[]){let r=Dp*t*t*n.strengthWeight;i=Qp(i,em([r,0],[n.energyEv*n.energyEv-e*e,-n.dampingEv*e]))}return i}function ym(e,{atomicNumberZ:t=null,conductionElectronDensityPerM3:n,interbandOptions:r={},interbandOscillators:i=null}={}){let a=Ep*_m(n),o=a/30,s=Array.isArray(i)?i:t?pm({atomicNumberZ:t,conductionElectronDensityPerM3:n,options:r}):[];return nm(vm(1239.841984/e,{plasmaEnergyEv:a,dampingEv:o,oscillators:s}))}function bm({atomicNumberZ:e=null,conductionElectronDensityPerM3:t,interbandOptions:n={},interbandOscillators:r=null}={}){if(!(t>0))return{r:.7,g:.7,b:.7,interbandOscillators:[]};let i=Array.isArray(r)?r:e?pm({atomicNumberZ:e,conductionElectronDensityPerM3:t,options:n}):[],a=Hp(r=>ym(r,{atomicNumberZ:e,conductionElectronDensityPerM3:t,interbandOptions:n,interbandOscillators:i}));return{r:a.r,g:a.g,b:a.b,plasmaRadPerS:_m(t),interbandOscillators:i}}function xm(e,{pathLengthM:t=.3,atomicNumberZ:n=null,interbandOptions:r={},interbandOscillators:i=null}={}){let a=Ep*_m(e),o=a/30,s=Array.isArray(i)?i:n?pm({atomicNumberZ:n,conductionElectronDensityPerM3:e,options:r}):[],c=e=>vm(1239.841984/e,{plasmaEnergyEv:a,dampingEv:o,oscillators:s}),l=e=>nm(c(e)),u=Up(e=>rm(e,c(e))),d=Up(l),f=u*Math.max(0,t),p=Zp(f),m=Math.exp(-Math.min(80,f)),h=Hp(l),g=Np.map(e=>im(e,c(e),t));return Xp({metalness:p>.5?1:p,roughness:.32,transmission:m,ior:null,opacity:p,attenuationColor:null,attenuationDistanceM:u>0?1/u:1/0,condensationScatter:0,internalScatter:0,opticalDepth:f,absorptionCoefficientPerM:u,reflectance:d,interbandOscillators:s,provenance:{status:`derived`,source:s.length?`scalar-relativistic-kohn-sham-drude-lorentz-skin-depth`:`drude-free-electron-skin-depth`,method:s.length?`conduction electron density + scalar-relativistic Kohn-Sham dipole-allowed interband transitions -> Drude-Lorentz complex index -> luminous skin-depth opacity`:`conduction electron density -> plasma frequency -> complex index -> luminous absorption coefficient -> Beer-Lambert opacity`,inputs:{atomicNumberZ:n,conductionElectronDensityPerM3:e,pathLengthM:t,damping:`omega_p/30`,oscillatorCount:s.length},validation:!1}},{baseColorSrgb:[h.r,h.g,h.b],renderModel:s.length?`conductor-drude-lorentz-relativistic-interband`:`conductor-drude-free-electron`,spectralSamples:g})}var Sm=null;function Cm(){if(Sm!=null)return Sm;let e=e=>Fp([{Z:8,position:[0,0,0]},{Z:1,position:[0,0,e]}],2),t=1.83,n=.02,r=(e(1.85)-2*e(t)+e(t-n))/(n*n),i=529177210903e-22,a=r*43597447222071e-31/(i*i);return Sm=Math.sqrt(Math.max(a,0)/(15.999*1.008/17.007*16605390666e-37))/(2*Math.PI*29979245800),Sm}var wm=.12,Tm=.02,Em=120;function Dm(e){let t=Cm(),n=1e7/e,r=.001;for(let e=2;e<=9;e+=1){let i=e*t*(1-Tm*e),a=.06*i,o=(n-i)/a;r+=Em*wm**e*Math.exp(-o*o)}return r}function Om({material:e,phase:t=`solid`,pathLengthM:n=3,conductionElectronDensityPerM3:r=null}){if(r>0){let t=bm({atomicNumberZ:om(e),conductionElectronDensityPerM3:r});return{r:t.r,g:t.g,b:t.b}}if(e===`h2o`){let e=0,n=0;for(let t=380;t<=780;t+=5){let r=zp(t);e+=Dm(t)*r,n+=r}let r=e/n,i=(t===`gas`?.03:t===`solid`?.6:1)/r;return Hp(e=>Math.exp(-Dm(e)*i))}return e===`air`?Hp(e=>.85+.15*(450/e)**4):{r:.7,g:.7,b:.7}}var km=Object.freeze({waterLiquid:1.333,waterIce:1.309,waterVapor:1.00025});function Am(){let e=0,t=0;for(let n=380;n<=780;n+=5){let r=zp(n);e+=Dm(n)*r,t+=r}let n=e/t,r=n>0?1/n:1e3,i=Hp(e=>Math.exp(-Dm(e)*r));return{attenuationColor:[i.r,i.g,i.b],attenuationDistanceM:r}}function jm(e,t){let n=e?.phases||[],r=n.find(e=>e.name===t),i=n.find(e=>e.densityKgPerM3>0);return r?.densityKgPerM3??i?.densityKgPerM3??null}function Mm(e,{properties:t,phase:n=`solid`}){let r=t?.electronicGapEv;if(!(r>=0))return null;let i=1239.841984/e;if(i<=r)return 0;let a=jm(t,n),o=t?.molarMassKgPerMol;if(!(a>0)||!(o>0))return null;let s=a/o*602214076e15,c=(1/s)**(2/3),l=Math.min(1,Math.max(0,(i-r)/Math.max(1,i)));return s*c*l}function Nm({properties:e,phase:t=`solid`,pathLengthM:n=.3}){if(Mm(500,{properties:e,phase:t})==null)return null;let r=n=>Mm(n,{properties:e,phase:t})??0,i=Up(r),a=i*Math.max(0,n),o=Zp(a),s=Hp(e=>Math.exp(-r(e)*Math.max(0,n))),c=e?.intrinsicColorSrgb??[s.r,s.g,s.b],l=Np.map(e=>am(e,{absorptionCoefficientPerM:r(e),pathLengthM:n,reflectance:.04,n:1.4,k:0}));return Xp({metalness:0,roughness:.4,transmission:Math.exp(-Math.min(80,a)),ior:1.4,opacity:o,attenuationColor:e?.intrinsicColorSrgb??null,attenuationDistanceM:i>0?1/i:1/0,condensationScatter:0,internalScatter:0,opticalDepth:a,absorptionCoefficientPerM:i,provenance:{status:`derived`,source:`molecular-gap-geometric-absorption`,method:`electronic gap + formula density -> geometric oscillator absorption -> Beer-Lambert opacity`,inputs:{electronicGapEv:e?.electronicGapEv,pathLengthM:n,phase:t},validation:!1}},{baseColorSrgb:c,renderModel:`molecular-gap-pbr`,spectralSamples:l})}function Pm({material:e,phase:t=`liquid`,pathLengthM:n=.3,properties:r=null,conductionElectronDensityPerM3:i=null}={}){let a=i??r?.conductionElectronDensityPerM3??null;if(a>0)return xm(a,{pathLengthM:n,atomicNumberZ:om(e),interbandOscillators:r?.opticalInterbandOscillators});if(e===`h2o`||e===`steam`||e===`ice`){let r=e===`steam`||t===`gas`,i=e===`ice`||t===`solid`,a=r?km.waterVapor:i?km.waterIce:km.waterLiquid,o=((a-1)/(a+1))**2,s=Am(),c=r?[1,1,1]:s.attenuationColor,l=r?s.attenuationDistanceM*50:s.attenuationDistanceM,u=1/l,d=u*Math.max(0,n),f=Math.exp(-Math.min(80,d)),p=Math.min(1,Math.max(0,(1-o)*f)),m=Zp(d),h=r?.9:i?.5:.08,g=r?`gas`:i?`solid`:`liquid`,_=r?[1,1,1]:c,v=Np.map(e=>am(e,{absorptionCoefficientPerM:r?Dm(e)/50:Dm(e),pathLengthM:n,reflectance:o,n:a,k:0}));return Xp({metalness:0,roughness:h,transmission:p,ior:a,opacity:m,attenuationColor:c,attenuationDistanceM:l,condensationScatter:0,internalScatter:0,opticalDepth:d,absorptionCoefficientPerM:u,provenance:{status:`derived`,source:`beer-lambert-oh-overtone-optical-depth`,method:`O-H overtone absorption -> luminous attenuation distance -> Beer-Lambert opacity/transmission`,inputs:{pathLengthM:n,phase:g},validation:!1}},{baseColorSrgb:_,renderModel:r?`molecular-vapor-transparent-spectrum`:`molecular-transparent-beer-lambert-pbr`,spectralSamples:v})}return Nm({properties:r,phase:t,pathLengthM:n})||Xp({metalness:0,roughness:.4,transmission:0,ior:1.4,opacity:0,attenuationColor:null,attenuationDistanceM:1/0,condensationScatter:0,internalScatter:0,opticalDepth:null,absorptionCoefficientPerM:null,blocked:!0,provenance:{status:`blocked`,source:`missing-optical-closure`,method:`no conduction density, water absorption model, or electronic-gap opacity available`,inputs:{material:e,phase:t},validation:!1}},{baseColorSrgb:[0,0,0],renderModel:`blocked-missing-optical-closure`,vertexColorPolicy:`blocked`,spectralSamples:[]})}function Fm(e={}){let t=Jp(e),n=Pp.get(t);if(n)return Yp(n);let r=Pm(e);return Pp.set(t,Yp(r)),Yp(r)}var Im=Ku.length,Lm=qu.length,Rm=Ju.length,zm=Yu.length,Bm=Ku,Vm=qu,Hm=Ju,Um=Yu,Wm=`
struct OpticalMaterialRecord {
  material_id: f32,
  phase_id: f32,
  spectral_offset: f32,
  spectral_count: f32,
  base_color_linear: vec3<f32>,
  metalness: f32,
  roughness: f32,
  transmission: f32,
  opacity: f32,
  ior: f32,
  attenuation_linear: vec3<f32>,
  attenuation_distance_m: f32,
  absorption_coefficient_per_m: f32,
  scattering_coefficient_per_m: f32,
  render_model_id: f32,
  vertex_color_policy_id: f32,
  optical_depth: f32,
  blocked: f32,
  status: f32,
  pad0: f32,
};

struct OpticalSpectralSample {
  wavelength_nm: f32,
  reflectance: f32,
  transmittance: f32,
  absorption_coefficient_per_m: f32,
  scattering_coefficient_per_m: f32,
  n: f32,
  k: f32,
  pad0: f32,
};
`,Gm={MAP_READ:globalThis.GPUBufferUsage?.MAP_READ??1,COPY_SRC:globalThis.GPUBufferUsage?.COPY_SRC??4,COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64},Km={READ:globalThis.GPUMapMode?.READ??1},qm=Object.freeze({unknown:0,solid:1,liquid:2,gas:3,plasma:4}),Jm=Object.freeze({"material-pbr":1,"particle-diagnostic":2,blocked:255}),Ym=Object.freeze({"conductor-drude-lorentz-relativistic-interband":1,"molecular-transparent-beer-lambert-pbr":2,"molecular-vapor-transparent-spectrum":3,"molecular-gap-pbr":4,"rayleigh-gas-transparent-spectrum":5,"conductor-drude-free-electron":6,"blocked-missing-optical-closure":255});function Xm(e,t=0){let n=Number(e);return Number.isFinite(n)?n:t}function Zm(e,t=0){let n=Number(e);return Number.isFinite(n)?n:t}function Qm(e){let t=Math.max(0,Math.min(1,Xm(e)));return t<=.04045?t/12.92:((t+.055)/1.055)**2.4}function $m(e,t=[0,0,0]){let n=Array.isArray(e)?e:t;return[Qm(n[0]),Qm(n[1]),Qm(n[2])]}function eh(e){return qm[e]??qm.unknown}function th(e,t){return e[t]??0}function nh(e){return typeof e==`string`?e:e?.material||e?.renderKey||null}function rh(e){return typeof e!=`string`||e.length===0?null:`${e[0].toUpperCase()}${e.slice(1).toLowerCase()}`}function ih(e){let t=2166136261;for(let n of String(e))t^=n.charCodeAt(0),t=Math.imul(t,16777619)>>>0;return 1e3+t%8e6}function ah(e){let t=rh(e);return(t?Jd(t):null)??ih(String(e||`unknown`).toLowerCase())}function oh(e){return typeof e==`string`?`unknown`:e?.phase||`unknown`}function sh(e){return[Xm(e?.wavelengthNm),Xm(e?.reflectance),Xm(e?.transmittance),Xm(e?.absorptionCoefficientPerM),Xm(e?.scatteringCoefficientPerM),Xm(e?.n),Xm(e?.k),0]}function ch(e,t){if(t.length!==Im)throw Error(`Optical GPU record must be ${Im} floats`);e.push(...t)}function lh(e,{materialProperties:t={},pathLengthM:n=.25}={}){if(!Array.isArray(e))throw TypeError(`buildOpticalGpuTable requires an array of material/phase descriptors`);let r=[],i=[],a=[],o=new Map,s=new Set,c=e=>(o.has(e)||o.set(e,ah(e)),o.get(e));for(let o of e){let e=nh(o);if(!e)continue;let l=oh(o),u=`${e}|${l}`;if(s.has(u))continue;s.add(u);let d=Fm({material:e,phase:l,properties:typeof o==`object`&&o?.properties?o.properties:t[e],pathLengthM:n}),f=c(e),p=i.length/Lm;for(let e of d.spectralSamples||[])i.push(...sh(e));let m=i.length/Lm-p,h=$m(d.baseColorSrgb),g=$m(d.attenuationColor,[1,1,1]),_=Math.max(Xm(d.scatteringCoefficientPerM),Xm(d.condensationScatter),Xm(d.internalScatter));ch(r,[f,eh(l),p,m,h[0],h[1],h[2],Xm(d.metalness),Xm(d.roughness),Xm(d.transmission),Xm(d.opacity),Xm(d.ior,1),g[0],g[1],g[2],Zm(d.attenuationDistanceM,0x56bc75e2d63100000),Xm(d.absorptionCoefficientPerM),_,th(Ym,d.renderModel),th(Jm,d.vertexColorPolicy),Xm(d.opticalDepth),+!!d.blocked,d.provenance?.status===`blocked`?255:1,0]),a.push({material:e,phase:l,materialId:f,phaseId:eh(l),recordIndex:a.length,spectralOffset:p,spectralCount:m,renderModel:d.renderModel,renderModelId:th(Ym,d.renderModel),vertexColorPolicy:d.vertexColorPolicy,vertexColorPolicyId:th(Jm,d.vertexColorPolicy),blocked:d.blocked===!0,provenance:d.provenance||null})}return{schema:iu,status:`cpu-derived-gpu-buffer-ready`,recordLayout:[...Bm],spectralSampleLayout:[...Vm],recordStrideFloats:Im,spectralSampleStrideFloats:Lm,recordStrideBytes:Im*Float32Array.BYTES_PER_ELEMENT,spectralSampleStrideBytes:Lm*Float32Array.BYTES_PER_ELEMENT,wgslStructs:Wm,records:Float32Array.from(r),spectralSamples:Float32Array.from(i),recordCount:a.length,spectralSampleCount:i.length/Lm,materialMap:[...o.entries()].map(([e,t])=>({material:e,materialId:t})),recordMetadata:a,colorSpace:`linear-rgb-from-srgb-closure-output`,scientificValidation:!1,fullPhysicsValidation:!1}}function uh(e,t){let n=t*Im;return e.records.slice(n,n+Im)}function dh(e){return{material:nh(e),phase:oh(e)}}function fh(e,t){if(e?.schema!==`peercompute.ulg.optical-gpu-table.v0`)throw TypeError(`buildOpticalGpuLookupQueries requires an optical GPU table`);if(!Array.isArray(t))throw TypeError(`buildOpticalGpuLookupQueries requires an array of descriptors`);let n=new Map(e.materialMap.map(e=>[e.material,e.materialId])),r=[],i=[];for(let e of t){let{material:t,phase:a}=dh(e),o=n.get(t)??0,s=eh(a);r.push(o,s,0,0),i.push({material:t,phase:a,materialId:o,phaseId:s})}return{schema:au,queryLayout:[...Hm],outputLayout:[...Um],queryStrideFloats:Rm,outputStrideFloats:zm,queries:Float32Array.from(r),queryCount:t.length,metadata:i,scientificValidation:!1,fullPhysicsValidation:!1}}function ph(e,t){if(e?.schema!==`peercompute.ulg.optical-gpu-table.v0`)throw TypeError(`sampleOpticalGpuTableCpu requires an optical GPU table`);if(t?.schema!==`peercompute.ulg.optical-gpu-lookup.v0`)throw TypeError(`sampleOpticalGpuTableCpu requires lookup queries`);let n=new Float32Array(t.queryCount*zm);for(let r=0;r<t.queryCount;r+=1){let i=r*Rm,a=t.queries[i],o=t.queries[i+1],s=-1;for(let t=0;t<e.recordCount;t+=1){let i=uh(e,t);if(i[0]===a&&i[1]===o){s=t;let e=r*zm;n.set([i[4],i[5],i[6],i[10],i[7],i[8],i[9],i[11],i[18],i[19],i[22],t],e);break}}s<0&&n.set([0,0,0,0,0,0,0,1,0,0,255,-1],r*zm)}return{schema:au,backend:`cpu-reference`,outputLayout:[...Um],outputStrideFloats:zm,queryCount:t.queryCount,outputs:n,scientificValidation:!1,fullPhysicsValidation:!1}}function mh({cpuReference:e,gpuResult:t,tolerance:n=1e-6}={}){let r=e?.outputs,i=t?.outputs;if(!(r instanceof Float32Array)||!(i instanceof Float32Array))return{schema:su,status:`fail`,tolerance:n,maxOutputAbs:1/0,lengthMismatch:!0,cpuBackend:e?.backend||null,gpuBackend:t?.backend||null,reason:`missing lookup output buffers`,scientificValidation:!1,fullPhysicsValidation:!1};let a=Math.min(r.length,i.length),o=0;for(let e=0;e<a;e+=1)o=Math.max(o,Math.abs(r[e]-i[e]));let s=r.length!==i.length;return{schema:su,status:!s&&o<=n?`pass`:`fail`,tolerance:n,maxOutputAbs:o,lengthMismatch:s,outputCount:r.length,cpuBackend:e.backend,gpuBackend:t.backend,scientificValidation:!1,fullPhysicsValidation:!1}}function hh(e,t=null){let n=e?.outputs;if(!(n instanceof Float32Array))throw TypeError(`decodeOpticalGpuLookupOutputRows requires Float32Array lookup outputs`);let r=e.queryCount??t?.queryCount??n.length/zm,i=[];for(let e=0;e<r;e+=1){let r=e*zm;i.push({queryIndex:e,material:t?.metadata?.[e]?.material??null,phase:t?.metadata?.[e]?.phase??null,materialId:t?.metadata?.[e]?.materialId??null,phaseId:t?.metadata?.[e]?.phaseId??null,baseColorLinear:[n[r],n[r+1],n[r+2]],opacity:n[r+3],metalness:n[r+4],roughness:n[r+5],transmission:n[r+6],ior:n[r+7],renderModelId:n[r+8],vertexColorPolicyId:n[r+9],status:n[r+10],recordIndex:n[r+11]})}return i}function gh(e,{cpuReference:t=null,gpuResult:n=null,webgpuStatus:r,webgpuParity:i=null}={}){return{schema:ou,lookupResultSchema:e?.schema||`peercompute.ulg.optical-gpu-lookup.v0`,backend:e?.backend||`cpu-reference`,outputLayout:[...Um],outputStrideFloats:zm,queryCount:e?.queryCount??0,outputs:e?.outputs??new Float32Array,cpuReference:t,gpuResult:n,webgpuStatus:r,webgpuParity:i,scientificValidation:!1,fullPhysicsValidation:!1}}function _h(e){return e?.reason||e?.message||`device lost`}function vh(e,t){e?.lost?.then&&e.lost.then(e=>{t(e)}).catch(e=>{t(e)})}var yh=8,bh=10;async function xh(e=globalThis.navigator,{onDeviceLost:t=null}={}){if(!e?.gpu)return{status:`blocked-webgpu-unavailable`,reason:`navigator.gpu unavailable`,device:null};let n=await e.gpu.requestAdapter();if(!n)return{status:`blocked-webgpu-unavailable`,reason:`requestAdapter returned null`,device:null};let r=Number(n.limits?.maxStorageBuffersPerShaderStage||0),i={};r>=bh&&(i.maxStorageBuffersPerShaderStage=Math.max(yh,bh));let a=Object.keys(i).length>0?{requiredLimits:i}:void 0,o=await n.requestDevice(a);return typeof t==`function`&&vh(o,t),{status:`webgpu-device-ready`,reason:`device acquired`,device:o,requiredLimits:i,adapterLimits:{maxStorageBuffersPerShaderStage:r||null}}}function Sh(e,t,n){let r=Math.max(4,n.byteLength),i=e.createBuffer({label:t,size:r,usage:Gm.STORAGE|Gm.COPY_DST});return n.byteLength>0&&e.queue.writeBuffer(i,0,n),i}function Ch({recordCount:e,queryCount:t}){let n=new ArrayBuffer(16),r=new DataView(n);return r.setUint32(0,e,!0),r.setUint32(4,t,!0),r.setUint32(8,0,!0),r.setUint32(12,0,!0),n}async function wh({device:e,table:t,lookup:n}){if(!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`runOpticalGpuLookup requires a WebGPU-like device with queue.writeBuffer`);if(t?.schema!==`peercompute.ulg.optical-gpu-table.v0`)throw TypeError(`runOpticalGpuLookup requires an optical GPU table`);if(n?.schema!==`peercompute.ulg.optical-gpu-lookup.v0`)throw TypeError(`runOpticalGpuLookup requires lookup queries`);let r=n.queryCount*zm*Float32Array.BYTES_PER_ELEMENT,i=Sh(e,`ulg-optical-lookup-records`,t.records),a=Sh(e,`ulg-optical-lookup-queries`,n.queries),o=e.createBuffer({label:`ulg-optical-lookup-outputs`,size:Math.max(4,r),usage:Gm.STORAGE|Gm.COPY_SRC}),s=e.createBuffer({label:`ulg-optical-lookup-params`,size:16,usage:Gm.UNIFORM|Gm.COPY_DST}),c=e.createBuffer({label:`ulg-optical-lookup-readback`,size:Math.max(4,r),usage:Gm.MAP_READ|Gm.COPY_DST});try{e.queue.writeBuffer(s,0,Ch({recordCount:t.recordCount,queryCount:n.queryCount}));let{pipeline:l,bindGroupLayout:u}=af(e,{label:`ulg-optical-lookup`,module:e.createShaderModule({code:Ad}),entryPoint:`main`,bindings:[$(0,`read-only-storage`),$(1,`read-only-storage`),$(2,`storage`),$(3,`uniform`)]}),d=e.createBindGroup({layout:u,entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:{buffer:a}},{binding:2,resource:{buffer:o}},{binding:3,resource:{buffer:s}}]}),f=e.createCommandEncoder(),p=f.beginComputePass();p.setPipeline(l),p.setBindGroup(0,d),p.dispatchWorkgroups(Math.max(1,Math.ceil(n.queryCount/64))),p.end(),f.copyBufferToBuffer(o,0,c,0,Math.max(4,r)),e.queue.submit([f.finish()]),await c.mapAsync(Km.READ);let m=new Float32Array(c.getMappedRange()).slice(0,n.queryCount*zm);return c.unmap(),{schema:au,backend:`webgpu`,outputLayout:[...Um],outputStrideFloats:zm,queryCount:n.queryCount,outputs:m,scientificValidation:!1,fullPhysicsValidation:!1}}finally{i.destroy?.(),a.destroy?.(),o.destroy?.(),s.destroy?.(),c.destroy?.()}}async function Th({table:e,lookup:t,cpuReference:n=null,preferWebGpu:r=!1,navigatorRef:i=globalThis.navigator,device:a=null,deviceResult:o=null,parityTolerance:s=1e-6,onDeviceLost:c=null,webGpuRunner:l=wh}={}){let u=n||ph(e,t);if(!r)return gh(u,{cpuReference:u,webgpuStatus:{status:`not-requested`,reason:`WebGPU optical lookup path not requested`}});try{let n=null,r=a?{status:`webgpu-device-ready`,reason:`provided device`,device:a}:o||await xh(i);if(r.device&&vh(r.device,e=>{n=e,typeof c==`function`&&c(e)}),!r.device)return gh(u,{cpuReference:u,webgpuStatus:{status:r.status,reason:r.reason,fallback:`cpu-reference`}});if(await Promise.resolve(),n)return gh(u,{cpuReference:u,webgpuStatus:{status:`webgpu-device-lost-fallback`,reason:_h(n),fallback:`cpu-reference`}});let d=await l({device:r.device,table:e,lookup:t});if(await Promise.resolve(),n)return gh(u,{cpuReference:u,gpuResult:d,webgpuStatus:{status:`webgpu-device-lost-fallback`,reason:_h(n),fallback:`cpu-reference`}});let f=mh({cpuReference:u,gpuResult:d,tolerance:s});return f.status===`pass`?gh(d,{cpuReference:u,gpuResult:d,webgpuStatus:{status:`webgpu-executed`,reason:`CPU/WebGPU optical lookup parity passed`},webgpuParity:f}):gh(u,{cpuReference:u,gpuResult:d,webgpuStatus:{status:`webgpu-parity-failed`,reason:`CPU/WebGPU optical lookup parity exceeded tolerance`,fallback:`cpu-reference`},webgpuParity:f})}catch(e){return gh(u,{cpuReference:u,webgpuStatus:{status:`webgpu-error-fallback`,reason:e instanceof Error?e.message:String(e),fallback:`cpu-reference`}})}}var Eh=8.314462618,Dh=1054571817e-43,Oh=1380649e-29,kh=602214076e15,Ah=Object.freeze([{species:`N2`,moleFraction:.7808,molarMassKgPerMol:.0280134,degreesOfFreedom:5},{species:`O2`,moleFraction:.2095,molarMassKgPerMol:.0319988,degreesOfFreedom:5},{species:`Ar`,moleFraction:.0093,molarMassKgPerMol:.039948,degreesOfFreedom:3},{species:`CO2`,moleFraction:4e-4,molarMassKgPerMol:.0440095,degreesOfFreedom:5}]);function jh(e=Ah){let t=0,n=0;for(let r of e)t+=r.moleFraction*r.molarMassKgPerMol,n+=r.moleFraction*(r.degreesOfFreedom/2)*Eh;let r=n+Eh;return{derivation:`equipartition-ideal-gas`,molarMassKgPerMol:t,cvJPerKgK:n/t,cpJPerKgK:r/t,gamma:r/n}}function Mh({soundSpeedMPerS:e,numberDensityPerM3:t}){return Dh*e/Oh*Math.cbrt(6*Math.PI*Math.PI*t)}function Nh({densityKgPerM3:e,molarMassKgPerMol:t,atomsPerFormula:n=1}){return e/t*kh*n}function Ph(e){if(e<=0)return 1;let t=0;for(let n=1;n<=256;n+=1){let r=e*(n-.5)/256,i=Math.exp(r);t+=r**4*i/(i-1)**2}return t*=e/256,3/e**3*t}function Fh(e,{debyeTemperatureK:t,molarMassKgPerMol:n,atomsPerFormula:r=1}){return 3*Eh*r/n*Ph(t/e)}function Ih(e){if(e<=0)return 0;let t=0;for(let n=1;n<=256;n+=1){let r=e*(n-.5)/256;t+=r**3/(Math.exp(r)-1)}return e/256*t}function Lh(e,{debyeTemperatureK:t,molarMassKgPerMol:n,atomsPerFormula:r=1}){if(e<=0)return 0;let i=t/e;return 9*(Eh*r/n)*e*(1/i**3)*Ih(i)}function Rh(e,t){return e.debyeTemperatureK?Lh(t,{debyeTemperatureK:e.debyeTemperatureK,molarMassKgPerMol:e.molarMassKgPerMol,atomsPerFormula:e.atomsPerFormula}):e.cpJPerKgK*t}function zh(e,t){return Rh(e,t)-Rh(e,e.tLo)}function Bh(e,t){if(!e.debyeTemperatureK)return e.tLo+t/e.cpJPerKgK;let n=e.tLo,r=e.tHi;for(let i=0;i<80;i+=1){let i=.5*(n+r);zh(e,i)<t?n=i:r=i}return .5*(n+r)}var Vh=new WeakMap;function Hh(e){let t=Vh.get(e);if(t)return t;let n=Uh(e);return Vh.set(e,n),n}function Uh(e){let t=e.phases||[],n=e.transitions||[],r=e.molarMassKgPerMol,i=e.atomsPerFormula??1,a=[],o=0;for(let e=0;e<t.length;e+=1){let s=t[e],c=s.temperatureRange[0],l=e<n.length?n[e].temperatureK:s.temperatureRange[1],u={type:`phase`,phase:s.name,tLo:c,tHi:l,cpJPerKgK:s.cpJPerKgK,debyeTemperatureK:s.debyeTemperatureK||null,molarMassKgPerMol:r,atomsPerFormula:i,eStart:o};if(o+=zh(u,l),u.eEnd=o,a.push(u),e<n.length){let t=n[e],r=o;o+=t.latentHeatJPerKg,a.push({type:`plateau`,from:t.from,to:t.to,temperatureK:t.temperatureK,latentHeatJPerKg:t.latentHeatJPerKg,eStart:r,eEnd:o})}}return a}function Wh(e,t){let n=Number(t);if(!Number.isFinite(n))throw TypeError(`temperatureK must be finite`);let r=Hh(e);for(let e of r)if(e.type===`phase`&&n<=e.tHi){let t=Math.max(n,e.tLo);return e.eStart+zh(e,t)}let i=r[r.length-1];return i.type===`phase`?i.eStart+zh(i,n):i.eEnd}function Gh(e,t){let n=Number(t);if(!Number.isFinite(n))throw TypeError(`specificEnergyJPerKg must be finite`);let r=Hh(e),i=r[0].eStart,a=r[r.length-1].eEnd;if(n<=i){let e=r[0];return{temperatureK:e.tLo,stablePhase:e.phase,phaseFractions:{[e.phase]:1},clamped:n<i?`low`:null}}if(n>=a){let e=r[r.length-1];return e.type===`phase`?{temperatureK:Bh(e,n-e.eStart),stablePhase:e.phase,phaseFractions:{[e.phase]:1},clamped:n>a?`high`:null}:{temperatureK:e.temperatureK,stablePhase:e.to,phaseFractions:{[e.to]:1},clamped:n>a?`high`:null}}for(let e of r){if(n<e.eStart||n>e.eEnd)continue;if(e.type===`phase`)return{temperatureK:Bh(e,n-e.eStart),stablePhase:e.phase,phaseFractions:{[e.phase]:1},clamped:null};let t=e.latentHeatJPerKg>0?(n-e.eStart)/e.latentHeatJPerKg:0,r=1-t;return{temperatureK:e.temperatureK,stablePhase:t>=.5?e.to:e.from,phaseFractions:{[e.from]:r,[e.to]:t},clamped:null}}let o=r[r.length-1];return{temperatureK:o.type===`phase`?o.tHi:o.temperatureK,stablePhase:null,phaseFractions:{},clamped:null}}var Kh=Xu.length,qh=Zu.length,Jh=sd.length,Yh=Object.freeze({ready:1,energyClampedLow:2,energyClampedHigh:3,missingMaterialProperties:255}),Xh=602214076e15,Zh=8.314462618,Qh=1,$h=40,eg=[`solid`,`liquid`,`gas`,`plasma`],tg=Object.freeze({disabled:0,taitCondensed:1,gasLinearized:2}),ng={COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128};function rg(e,t=0){let n=Number(e);return Number.isFinite(n)?n:t}function ig(e,t){return!t||!e?null:t[e]??t[String(e).toLowerCase()]??t[String(e).toUpperCase()]??null}function ag(e,t,n){let r=rg(n.restDensityKgPerM3,0);if(r>0)return r;let i=e?.phases?.find(e=>e.name===t),a=e?.phases?.find(e=>e.densityKgPerM3>0);return rg(i?.densityKgPerM3??a?.densityKgPerM3,0)}function og(e,t){let n=rg(e.massKg,0),r=rg(t?.molarMassKgPerMol,0);return n>0&&r>0?n/r*Xh:0}function sg(){return[1,0,0,0,1,0,0,0,1]}function cg(){return[0,0,0,0,0,0,0,0,0]}function lg(e,t){return(e&&e.length===9?Array.from(e):t).map(e=>rg(e,0))}function ug(e,t,n=null){return n?+!!n.solid:e.mpmSolid===!0?1:e.mpmSolid===!1?0:+(t?.stablePhase===`solid`)}function dg(e,t){return t?e?.clamped===`low`?Yh.energyClampedLow:e?.clamped===`high`?Yh.energyClampedHigh:Yh.ready:Yh.missingMaterialProperties}function fg(e){return eg.map(t=>rg(e?.phaseFractions?.[t],0))}function pg(e,t){return t?Gh(t,rg(e.specificInternalEnergyJPerKg,0)):{temperatureK:0,stablePhase:`unknown`,phaseFractions:{},clamped:null}}function mg(e,t){return e?.phases?.length?e.phases.find(e=>e.name===t)||e.phases[0]:null}function hg(e,{soundSpeedScale:t,minGasSoundSpeedMPerS:n}={}){let r=e?.gpuMechanics||{};return{soundSpeedScale:rg(t??r.soundSpeedScale,Qh),minGasSoundSpeedMPerS:rg(n??r.minGasSoundSpeedMPerS,$h)}}function gg(e,t,n,r,i){let a=rg(e?.molarMassKgPerMol,0),o=rg(t?.cpJPerKgK,0);if(!(a>0))return 0;let s=Zh/a,c=o>s?o/(o-s):1.33,l=Math.sqrt(Math.max(c*s*n,0));return Math.max(l*r,i)}function _g(e,t,n,r){if(!t)return{solid:!1,effectiveBulkModulusPa:0,shearModulusPa:0,lameLambdaPa:0,soundSpeedMPerS:0,eosModelId:tg.disabled,constitutiveStatus:Yh.missingMaterialProperties};let i=n?.stablePhase||`liquid`,a=mg(t,i),o=rg(r.soundSpeedScale,Qh),s=o*o,c=rg(a?.densityKgPerM3??e.restDensityKgPerM3,0),l=rg(a?.bulkModulusPa,0),u=i===`solid`?rg(a?.shearModulusPa,0):0;if(i===`gas`)return{solid:!1,effectiveBulkModulusPa:0,shearModulusPa:0,lameLambdaPa:0,soundSpeedMPerS:gg(t,a,rg(n?.temperatureK,0),o,rg(r.minGasSoundSpeedMPerS,$h)),eosModelId:tg.gasLinearized,constitutiveStatus:Yh.ready};let d=l*s,f=u*s;return{solid:i===`solid`&&f>0,effectiveBulkModulusPa:d,shearModulusPa:f,lameLambdaPa:i===`solid`?Math.max((l-2/3*u)*s,0):0,soundSpeedMPerS:c>0&&d>0?Math.sqrt(d/c):0,eosModelId:d>0?tg.taitCondensed:tg.disabled,constitutiveStatus:Yh.ready}}function vg(e,{materialProperties:t={}}={}){if(!e?.particles||!Array.isArray(e.particles))throw TypeError(`buildSphGpuParticleBuffers requires a SPH state with particles`);let n=e.particles.length,r=new Float32Array(n*Kh),i=new Float32Array(n*qh),a=[],o=rg(e.smoothingLengthM,0);for(let s=0;s<n;s+=1){let n=e.particles[s],c=n.material||`unknown`,l=ig(c,t),u=pg(n,l),d=u.stablePhase||`unknown`,f=fg(u),p=s*Kh,m=s*qh;r.set([rg(n.x?.[0]),rg(n.x?.[1]),rg(n.x?.[2]),rg(n.massKg),rg(n.v?.[0]),rg(n.v?.[1]),rg(n.v?.[2]),rg(n.specificInternalEnergyJPerKg)],p);let h=dg(u,l);i.set([l?ah(c):0,eh(d),rg(u.temperatureK),ag(l,d,n),f[0],f[1],f[2],f[3],o,og(n,l),h,0],m),a.push({id:n.id??`p${s}`,material:c,materialId:l?ah(c):0,phase:d,phaseId:eh(d),status:h})}return{schema:cu,status:`cpu-derived-gpu-buffer-ready`,particleCount:n,dimension:e.dimension??3,step:e.step??0,time:e.time??0,smoothingLengthM:o,phaseIds:{...qm},stateLayout:[...Xu],thermoLayout:[...Zu],stateStrideFloats:Kh,thermoStrideFloats:qh,stateStrideBytes:Kh*Float32Array.BYTES_PER_ELEMENT,thermoStrideBytes:qh*Float32Array.BYTES_PER_ELEMENT,state:r,thermo:i,metadata:a,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function yg(e,t,n){let r=Math.max(4,n.byteLength),i=e.createBuffer({label:t,size:r,usage:ng.STORAGE|ng.COPY_DST});return n.byteLength>0&&e.queue.writeBuffer(i,0,n),i}function bg(e,t){if(!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`uploadSphGpuParticleBuffers requires a WebGPU-like device with queue.writeBuffer`);if(t?.schema!==`peercompute.ulg.sph-gpu-particle-buffer.v0`)throw TypeError(`uploadSphGpuParticleBuffers requires a packed SPH GPU particle buffer`);return{schema:lu,status:`webgpu-uploaded`,sourceSchema:t.schema,particleCount:t.particleCount,stateStrideBytes:t.stateStrideBytes,thermoStrideBytes:t.thermoStrideBytes,stateBuffer:yg(e,`ulg-sph-particle-state`,t.state),thermoBuffer:yg(e,`ulg-sph-particle-thermo`,t.thermo),ownsStateBuffer:!0,ownsThermoBuffer:!0,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function xg(e,t={}){let{materialProperties:n={}}=t;if(!e?.particles||!Array.isArray(e.particles))throw TypeError(`buildMlsMpmGpuParticleBuffers requires a SPH state with particles`);let r=hg(e,t),i=e.particles.length,a=new Float32Array(i*Jh),o=[];for(let t=0;t<i;t+=1){let i=e.particles[t],s=i.material||`unknown`,c=ig(s,n),l=pg(i,c),u=_g(i,c,l,r),d=lg(i.mpmF,sg()),f=lg(i.mpmC,cg()),p=ag(c,l.stablePhase,i),m=rg(i.mpmVolume0,p>0?rg(i.massKg)/p:0),h=rg(i.mpmJ,1),g=dg(l,c),_=t*Jh;a.set([d[0],d[1],d[2],d[3],d[4],d[5],d[6],d[7],d[8],f[0],f[1],f[2],f[3],f[4],f[5],f[6],f[7],f[8],h,m,ug(i,l,u),g,u.effectiveBulkModulusPa,u.shearModulusPa,u.lameLambdaPa,u.soundSpeedMPerS,u.eosModelId,u.constitutiveStatus,0,0],_),o.push({id:i.id??`p${t}`,material:s,phase:l.stablePhase,solid:u.solid,status:g,effectiveBulkModulusPa:u.effectiveBulkModulusPa,shearModulusPa:u.shearModulusPa,lameLambdaPa:u.lameLambdaPa,soundSpeedMPerS:u.soundSpeedMPerS,eosModelId:u.eosModelId})}return{schema:yu,status:`cpu-derived-gpu-buffer-ready`,particleCount:i,step:e.step??0,time:e.time??0,mechanicsLayout:[...sd],mechanicsStrideFloats:Jh,mechanicsStrideBytes:Jh*Float32Array.BYTES_PER_ELEMENT,soundSpeedScale:r.soundSpeedScale,minGasSoundSpeedMPerS:r.minGasSoundSpeedMPerS,mechanicsDtS:rg(e.gpuMechanics?.dt,0),gridCflFactor:rg(e.gpuMechanics?.gridCflFactor,0),gravityMPerS2:Array.isArray(e.gpuMechanics?.gravityMPerS2)?e.gpuMechanics.gravityMPerS2.map(e=>rg(e,0)):[0,-9.80665,0],mechanics:a,metadata:o,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function Sg(e,t){if(!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`uploadMlsMpmGpuParticleBuffers requires a WebGPU-like device with queue.writeBuffer`);if(t?.schema!==`peercompute.ulg.mls-mpm-gpu-particle-buffer.v0`)throw TypeError(`uploadMlsMpmGpuParticleBuffers requires a packed MLS-MPM GPU particle buffer`);return{schema:bu,status:`webgpu-uploaded`,sourceSchema:t.schema,particleCount:t.particleCount,mechanicsStrideBytes:t.mechanicsStrideBytes,mechanicsBuffer:yg(e,`ulg-mls-mpm-particle-mechanics`,t.mechanics),ownsMechanicsBuffer:!0,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function Cg(e){!e||e.ownsMechanicsBuffer===!1||e.mechanicsBuffer?.destroy?.()}function wg(e){e&&(e.ownsStateBuffer!==!1&&e.stateBuffer?.destroy?.(),e.ownsThermoBuffer!==!1&&e.thermoBuffer?.destroy?.())}var Tg={MAP_READ:globalThis.GPUBufferUsage?.MAP_READ??1,COPY_SRC:globalThis.GPUBufferUsage?.COPY_SRC??4,COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64},Eg={READ:globalThis.GPUMapMode?.READ??1},Dg=Object.freeze([0,-9.80665,0]),Og=Object.freeze([5,5,5]),kg=`particle-local-ballistic-apic-deformation-predictor`;function Ag(e,t=0){let n=Number(e);return Number.isFinite(n)?n:t}function jg(e,t){let n=Array.isArray(e)?e:t;return[Ag(n?.[0],t[0]),Ag(n?.[1],t[1]),Ag(n?.[2],t[2])]}function Mg({sphParticleState:e,mlsMpmParticleState:t}){if(e?.schema!==`peercompute.ulg.sph-gpu-particle-buffer.v0`)throw TypeError(`MLS-MPM mechanics prediction requires a packed SPH GPU particle buffer`);if(t?.schema!==`peercompute.ulg.mls-mpm-gpu-particle-buffer.v0`)throw TypeError(`MLS-MPM mechanics prediction requires a packed MLS-MPM GPU particle buffer`);if(e.particleCount!==t.particleCount)throw RangeError(`SPH and MLS-MPM particle buffer counts must match`)}function Ng(e){return e[0]*(e[4]*e[8]-e[5]*e[7])-e[1]*(e[3]*e[8]-e[5]*e[6])+e[2]*(e[3]*e[7]-e[4]*e[6])}function Pg(e,t,n){let r=[1+n*t[0],n*t[1],n*t[2],n*t[3],1+n*t[4],n*t[5],n*t[6],n*t[7],1+n*t[8]];return[r[0]*e[0]+r[1]*e[3]+r[2]*e[6],r[0]*e[1]+r[1]*e[4]+r[2]*e[7],r[0]*e[2]+r[1]*e[5]+r[2]*e[8],r[3]*e[0]+r[4]*e[3]+r[5]*e[6],r[3]*e[1]+r[4]*e[4]+r[5]*e[7],r[3]*e[2]+r[4]*e[5]+r[5]*e[8],r[6]*e[0]+r[7]*e[3]+r[8]*e[6],r[6]*e[1]+r[7]*e[4]+r[8]*e[7],r[6]*e[2]+r[7]*e[5]+r[8]*e[8]]}function Fg(e){let t=Math.cbrt(Math.max(e,1e-12));return[t,0,0,0,t,0,0,0,t]}function Ig({backend:e,sphParticleState:t,mlsMpmParticleState:n,state:r,mechanics:i,dt:a,gravityMPerS2:o,boxDimsM:s}){return{schema:xu,backend:e,status:`predicted`,kernelScope:kg,particleCount:t.particleCount,sourceSchemas:{sphParticleState:t.schema,mlsMpmParticleState:n.schema},sourceStep:t.step??n.step??0,step:(t.step??n.step??0)+1,sourceTime:t.time??n.time??0,time:Ag(t.time??n.time,0)+a,dt:a,gravityMPerS2:[...o],boxDimsM:[...s],stateLayout:[...Xu],thermoLayout:[...Zu],mechanicsLayout:[...sd],stateStrideFloats:Kh,thermoStrideFloats:qh,mechanicsStrideFloats:Jh,state:r,mechanics:i,p2gValidation:!1,gridValidation:!1,g2pValidation:!1,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function Lg({sphParticleState:e,mlsMpmParticleState:t,dt:n=4e-4,gravityMPerS2:r=Dg,boxDimsM:i=Og}={}){Mg({sphParticleState:e,mlsMpmParticleState:t});let a=e.particleCount,o=Ag(n,4e-4),s=jg(r,Dg),c=jg(i,Og),l=new Float32Array(e.state),u=new Float32Array(t.mechanics);for(let e=0;e<a;e+=1){let t=e*Kh,n=e*Jh,r=[l[t],l[t+1],l[t+2]],i=[l[t+4]+s[0]*o,l[t+5]+s[1]*o,l[t+6]+s[2]*o];for(let e=0;e<3;e+=1)r[e]+=i[e]*o,r[e]<0?(r[e]=0,i[e]<0&&(i[e]=0)):r[e]>c[e]&&(r[e]=c[e],i[e]>0&&(i[e]=0));l[t]=r[0],l[t+1]=r[1],l[t+2]=r[2],l[t+4]=i[0],l[t+5]=i[1],l[t+6]=i[2];let a=Pg([u[n],u[n+1],u[n+2],u[n+3],u[n+4],u[n+5],u[n+6],u[n+7],u[n+8]],[u[n+9],u[n+10],u[n+11],u[n+12],u[n+13],u[n+14],u[n+15],u[n+16],u[n+17]],o),d=Ng(a);u[n+20]<.5&&(a=Fg(Math.max(d,.05)),d=Ng(a)),d<.1&&(a=Fg(.1),d=Ng(a)),u.set(a,n),u[n+18]=d}return Ig({backend:`cpu-reference`,sphParticleState:e,mlsMpmParticleState:t,state:l,mechanics:u,dt:o,gravityMPerS2:s,boxDimsM:c})}function Rg(e,t,n){let r=Math.max(4,n.byteLength),i=e.createBuffer({label:t,size:r,usage:Tg.STORAGE|Tg.COPY_DST});return n.byteLength>0&&e.queue.writeBuffer(i,0,n),i}function zg({particleCount:e,dt:t,gravityMPerS2:n,boxDimsM:r}){let i=new ArrayBuffer(32),a=new DataView(i);return a.setUint32(0,e,!0),a.setFloat32(4,t,!0),a.setFloat32(8,n[0],!0),a.setFloat32(12,n[1],!0),a.setFloat32(16,n[2],!0),a.setFloat32(20,r[0],!0),a.setFloat32(24,r[1],!0),a.setFloat32(28,r[2],!0),i}async function Bg({device:e,sphParticleState:t,mlsMpmParticleState:n,sphParticleUpload:r=null,mlsMpmParticleUpload:i=null,dt:a=4e-4,gravityMPerS2:o=Dg,boxDimsM:s=Og}={}){if(!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`runMlsMpmMechanicsPredictWebGpu requires a WebGPU-like device with queue.writeBuffer`);Mg({sphParticleState:t,mlsMpmParticleState:n});let c=Ag(a,4e-4),l=jg(o,Dg),u=jg(s,Og),d=t.particleCount,f=t.state.byteLength,p=n.mechanics.byteLength,m=r?.status===`webgpu-uploaded`?r.stateBuffer:null,h=r?.status===`webgpu-uploaded`?r.thermoBuffer:null,g=i?.status===`webgpu-uploaded`?i.mechanicsBuffer:null,_=m||Rg(e,`ulg-mls-mpm-predict-sph-state-in`,t.state),v=h||Rg(e,`ulg-mls-mpm-predict-sph-thermo-in`,t.thermo),y=g||Rg(e,`ulg-mls-mpm-predict-mechanics-in`,n.mechanics),b=e.createBuffer({label:`ulg-mls-mpm-predict-sph-state-out`,size:Math.max(4,f),usage:Tg.STORAGE|Tg.COPY_SRC}),x=e.createBuffer({label:`ulg-mls-mpm-predict-mechanics-out`,size:Math.max(4,p),usage:Tg.STORAGE|Tg.COPY_SRC}),S=e.createBuffer({label:`ulg-mls-mpm-predict-params`,size:32,usage:Tg.UNIFORM|Tg.COPY_DST}),C=e.createBuffer({label:`ulg-mls-mpm-predict-sph-state-readback`,size:Math.max(4,f),usage:Tg.MAP_READ|Tg.COPY_DST}),w=e.createBuffer({label:`ulg-mls-mpm-predict-mechanics-readback`,size:Math.max(4,p),usage:Tg.MAP_READ|Tg.COPY_DST});try{e.queue.writeBuffer(S,0,zg({particleCount:d,dt:c,gravityMPerS2:l,boxDimsM:u}));let{pipeline:r,bindGroupLayout:i}=af(e,{label:`ulg-mls-mpm-mechanics-predict`,module:e.createShaderModule({code:Fd}),entryPoint:`main`,bindings:[$(0,`read-only-storage`),$(1,`read-only-storage`),$(2,`read-only-storage`),$(3,`storage`),$(4,`storage`),$(5,`uniform`)]}),a=e.createBindGroup({layout:i,entries:[{binding:0,resource:{buffer:_}},{binding:1,resource:{buffer:v}},{binding:2,resource:{buffer:y}},{binding:3,resource:{buffer:b}},{binding:4,resource:{buffer:x}},{binding:5,resource:{buffer:S}}]}),o=e.createCommandEncoder(),s=o.beginComputePass();s.setPipeline(r),s.setBindGroup(0,a),s.dispatchWorkgroups(Math.max(1,Math.ceil(d/64))),s.end(),o.copyBufferToBuffer(b,0,C,0,Math.max(4,f)),o.copyBufferToBuffer(x,0,w,0,Math.max(4,p)),e.queue.submit([o.finish()]),await C.mapAsync(Eg.READ);let m=new Float32Array(C.getMappedRange()).slice(0,t.state.length);C.unmap(),await w.mapAsync(Eg.READ);let h=new Float32Array(w.getMappedRange()).slice(0,n.mechanics.length);return w.unmap(),Ig({backend:`webgpu`,sphParticleState:t,mlsMpmParticleState:n,state:m,mechanics:h,dt:c,gravityMPerS2:l,boxDimsM:u})}finally{m||_.destroy?.(),h||v.destroy?.(),g||y.destroy?.(),b.destroy?.(),x.destroy?.(),S.destroy?.(),C.destroy?.(),w.destroy?.()}}function Vg({cpuReference:e,gpuResult:t,tolerance:n=2e-5}={}){let r=e?.state,i=t?.state,a=e?.mechanics,o=t?.mechanics;if(!(r instanceof Float32Array)||!(i instanceof Float32Array)||!(a instanceof Float32Array)||!(o instanceof Float32Array))return{schema:Cu,status:`fail`,tolerance:n,maxStateAbs:1/0,maxMechanicsAbs:1/0,lengthMismatch:!0,reason:`missing mechanics prediction buffers`,cpuBackend:e?.backend||null,gpuBackend:t?.backend||null,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1};let s=Math.min(r.length,i.length),c=Math.min(a.length,o.length),l=0,u=0;for(let e=0;e<s;e+=1)l=Math.max(l,Math.abs(r[e]-i[e]));for(let e=0;e<c;e+=1)u=Math.max(u,Math.abs(a[e]-o[e]));let d=r.length!==i.length||a.length!==o.length;return{schema:Cu,status:!d&&l<=n&&u<=n?`pass`:`fail`,tolerance:n,maxStateAbs:l,maxMechanicsAbs:u,lengthMismatch:d,particleCount:e?.particleCount??t?.particleCount??0,cpuBackend:e.backend,gpuBackend:t.backend,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function Hg(e,{cpuReference:t=null,gpuResult:n=null,webgpuStatus:r,webgpuParity:i=null}={}){return{schema:Su,predictionSchema:e?.schema||`peercompute.ulg.mls-mpm-gpu-mechanics-prediction.v0`,backend:e?.backend||`cpu-reference`,status:e?.status||`predicted`,kernelScope:kg,particleCount:e?.particleCount??0,dt:e?.dt??0,step:e?.step??0,time:e?.time??0,stateLayout:[...Xu],mechanicsLayout:[...sd],stateStrideFloats:Kh,mechanicsStrideFloats:Jh,state:e?.state??new Float32Array,mechanics:e?.mechanics??new Float32Array,cpuReference:t,gpuResult:n,webgpuStatus:r,webgpuParity:i,p2gValidation:!1,gridValidation:!1,g2pValidation:!1,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function Ug(e){return e?.reason||e?.message||`device lost`}function Wg(e,t){e?.lost?.then&&e.lost.then(e=>t(e)).catch(e=>t(e))}async function Gg({sphParticleState:e,mlsMpmParticleState:t,sphParticleUpload:n=null,mlsMpmParticleUpload:r=null,dt:i=4e-4,gravityMPerS2:a=Dg,boxDimsM:o=Og,preferWebGpu:s=!1,navigatorRef:c=globalThis.navigator,device:l=null,deviceResult:u=null,parityTolerance:d=2e-5,onDeviceLost:f=null,webGpuRunner:p=Bg}={}){let m=Lg({sphParticleState:e,mlsMpmParticleState:t,dt:i,gravityMPerS2:a,boxDimsM:o});if(!s)return Hg(m,{cpuReference:m,webgpuStatus:{status:`not-requested`,reason:`WebGPU MLS-MPM mechanics prediction path not requested`}});try{let s=null,h=l?{status:`webgpu-device-ready`,reason:`provided device`,device:l}:u||await xh(c,{onDeviceLost(e){s=e,typeof f==`function`&&f(e)}});if(h.device&&l&&Wg(h.device,e=>{s=e,typeof f==`function`&&f(e)}),!h.device)return Hg(m,{cpuReference:m,webgpuStatus:{status:h.status,reason:h.reason,fallback:`cpu-reference`}});if(await Promise.resolve(),s)return Hg(m,{cpuReference:m,webgpuStatus:{status:`webgpu-device-lost-fallback`,reason:Ug(s),fallback:`cpu-reference`}});let g=await p({device:h.device,sphParticleState:e,mlsMpmParticleState:t,sphParticleUpload:n,mlsMpmParticleUpload:r,dt:i,gravityMPerS2:a,boxDimsM:o});if(await Promise.resolve(),s)return Hg(m,{cpuReference:m,gpuResult:g,webgpuStatus:{status:`webgpu-device-lost-fallback`,reason:Ug(s),fallback:`cpu-reference`}});let _=Vg({cpuReference:m,gpuResult:g,tolerance:d});return _.status===`pass`?Hg(g,{cpuReference:m,gpuResult:g,webgpuStatus:{status:`webgpu-executed`,reason:`CPU/WebGPU MLS-MPM mechanics prediction parity passed`},webgpuParity:_}):Hg(m,{cpuReference:m,gpuResult:g,webgpuStatus:{status:`webgpu-parity-failed`,reason:`CPU/WebGPU MLS-MPM mechanics prediction parity exceeded tolerance`,fallback:`cpu-reference`},webgpuParity:_})}catch(e){return Hg(m,{cpuReference:m,webgpuStatus:{status:`webgpu-error-fallback`,reason:e instanceof Error?e.message:String(e),fallback:`cpu-reference`}})}}var Kg=cd.length,qg={MAP_READ:globalThis.GPUBufferUsage?.MAP_READ??1,COPY_SRC:globalThis.GPUBufferUsage?.COPY_SRC??4,COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64},Jg={READ:globalThis.GPUMapMode?.READ??1},Yg=Object.freeze([5,5,5]),Xg=1,Zg=`gather-form-p2g-stress-momentum-projection`,Qg=`full-parity-readback`,$g=`no-full-readback`,e_=7,t_=Object.freeze({disabled:0,taitCondensed:1,gasLinearized:2});function n_(e,t=0){let n=Number(e);return Number.isFinite(n)?n:t}function r_(e,t){let n=Array.isArray(e)?e:t;return[n_(n?.[0],t[0]),n_(n?.[1],t[1]),n_(n?.[2],t[2])]}function i_({sphParticleState:e,mlsMpmParticleState:t}){if(e?.schema!==`peercompute.ulg.sph-gpu-particle-buffer.v0`)throw TypeError(`MLS-MPM grid projection requires a packed SPH GPU particle buffer`);if(t?.schema!==`peercompute.ulg.mls-mpm-gpu-particle-buffer.v0`)throw TypeError(`MLS-MPM grid projection requires a packed MLS-MPM GPU particle buffer`);if(e.particleCount!==t.particleCount)throw RangeError(`SPH and MLS-MPM particle buffer counts must match`)}function a_({boxDimsM:e=Yg,gridSpacingM:t,shift:n=Xg}={}){let r=r_(e,Yg),i=n_(t,0);if(!(i>0))throw RangeError(`createMlsMpmGridSpec requires a positive gridSpacingM`);let a=[Math.round(r[0]/i)+5,Math.round(r[1]/i)+5,Math.round(r[2]/i)+5];return{gridSpacingM:i,invGridSpacingM:1/i,boxDimsM:r,shift:n,gridDims:a,gridNodeCount:a[0]*a[1]*a[2]}}function o_(e){let t=1.5-e,n=e-1,r=e-.5;return[.5*t*t,.75-n*n,.5*r*r]}function s_(e,t){let[,n,r]=t.gridDims,i=n*r,a=Math.floor(e/i),o=e-a*i,s=Math.floor(o/r),c=o-s*r;return{i:a,j:s,k:c,nodeI:a-t.shift,nodeJ:s-t.shift,nodeK:c-t.shift}}function c_(e){return e[0]*(e[4]*e[8]-e[5]*e[7])-e[1]*(e[3]*e[8]-e[5]*e[6])+e[2]*(e[3]*e[7]-e[4]*e[6])}function l_(e,t,n){let[r,i,a,o,s,c,l,u,d]=e,f=r,p=i,m=a,h=o,g=s,_=c,v=l,y=u,b=d;for(let e=0;e<12;e+=1){let e=f*(g*b-_*y)-p*(h*b-_*v)+m*(h*y-g*v);if(Math.abs(e)<1e-12)break;let t=1/e,n=(g*b-_*y)*t,r=(m*y-p*b)*t,i=(p*_-m*g)*t,a=(_*v-h*b)*t,o=(f*b-m*v)*t,s=(m*h-f*_)*t,c=(h*y-g*v)*t,l=(p*v-f*y)*t,u=(f*g-p*h)*t,d=.5*(f+n),x=.5*(p+a),S=.5*(m+c),C=.5*(h+r),w=.5*(g+o),T=.5*(_+l),E=.5*(v+i),D=.5*(y+s),O=.5*(b+u),k=Math.abs(d-f)+Math.abs(w-g)+Math.abs(O-b);if(f=d,p=x,m=S,h=C,g=w,_=T,v=E,y=D,b=O,k<1e-10)break}let x=c_(e);if(Math.abs(x)<1e-12)return Array(9).fill(0);let S=1/x,C=(s*d-c*u)*S,w=(a*u-i*d)*S,T=(i*c-a*s)*S,E=(c*l-o*d)*S,D=(r*d-a*l)*S,O=(a*o-r*c)*S,k=(o*u-s*l)*S,A=(i*l-r*u)*S,j=(r*s-i*o)*S,M=n*(x-1)*x,N=2*t*(r-f)+M*C,P=2*t*(i-p)+M*E,F=2*t*(a-m)+M*k,I=2*t*(o-h)+M*w,ee=2*t*(s-g)+M*D,L=2*t*(c-_)+M*A,te=2*t*(l-v)+M*T,R=2*t*(u-y)+M*O,z=2*t*(d-b)+M*j;return[(N*r+P*i+F*a)*S,(N*o+P*s+F*c)*S,(N*l+P*u+F*d)*S,(I*r+ee*i+L*a)*S,(I*o+ee*s+L*c)*S,(I*l+ee*u+L*d)*S,(te*r+R*i+z*a)*S,(te*o+R*s+z*c)*S,(te*l+R*u+z*d)*S]}function u_({densityKgPerM3:e,restDensityKgPerM3:t,soundSpeedMPerS:n,eosModelId:r}){if(!(e>0)||!(t>0)||!(n>0))return 0;if(Math.round(r)===t_.gasLinearized)return Math.max(0,n*n*(e-t));if(Math.round(r)===t_.taitCondensed){let r=e/Math.max(t,1e-9);return t*n*n/e_*(r**e_-1)}return 0}function d_({sphParticleState:e,mlsMpmParticleState:t,stateOffset:n,thermoOffset:r,mechanicsOffset:i}){let a=[t.mechanics[i],t.mechanics[i+1],t.mechanics[i+2],t.mechanics[i+3],t.mechanics[i+4],t.mechanics[i+5],t.mechanics[i+6],t.mechanics[i+7],t.mechanics[i+8]],o=t.mechanics[i+19],s=n_(t.mechanics[i+18],c_(a)),c=Math.max(o*Math.max(s,1e-9),1e-30),l=e.state[n+3]/c,u=e.thermo[r+3],d=t.mechanics[i+20],f=t.mechanics[i+23],p=t.mechanics[i+24];if(d>.5&&f>0)return l_(a,f,p);let m=u_({densityKgPerM3:l,restDensityKgPerM3:u,soundSpeedMPerS:t.mechanics[i+25],eosModelId:t.mechanics[i+26]});return[-m,0,0,0,-m,0,0,0,-m]}function f_({backend:e,sphParticleState:t,mlsMpmParticleState:n,gridSpec:r,gridNodes:i,dt:a=0,readbackMode:o=Qg}){let s=o===$g;return{schema:wu,backend:e,status:`projected`,kernelScope:Zg,particleCount:t.particleCount,sourceSchemas:{sphParticleState:t.schema,mlsMpmParticleState:n.schema},sourceStep:t.step??n.step??0,sourceTime:t.time??n.time??0,dt:a,gridSpacingM:r.gridSpacingM,gridDims:[...r.gridDims],gridNodeCount:r.gridNodeCount,gridShift:r.shift,gridNodeLayout:[...cd],gridNodeStrideFloats:Kg,gridNodeStrideBytes:Kg*Float32Array.BYTES_PER_ELEMENT,gridNodes:i,readbackMode:o,fullReadbackPerformed:!s,normalHotLoopReadbackFree:s,p2gProjectionValidation:!1,stressProjectionValidation:!1,gridValidation:!1,g2pValidation:!1,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function p_({sphParticleState:e,mlsMpmParticleState:t,gridSpacingM:n=e?.smoothingLengthM,boxDimsM:r=Yg,dt:i=t?.mechanicsDtS??0}={}){i_({sphParticleState:e,mlsMpmParticleState:t});let a=a_({boxDimsM:r,gridSpacingM:n}),o=n_(i,0),s=new Float32Array(a.gridNodeCount*Kg);for(let n=0;n<a.gridNodeCount;n+=1){let{nodeI:r,nodeJ:i,nodeK:c}=s_(n,a),l=[r*a.gridSpacingM,i*a.gridSpacingM,c*a.gridSpacingM],u=0,d=[0,0,0];for(let n=0;n<e.particleCount;n+=1){let s=n*Kh,f=n*qh,p=n*Jh,m=[e.state[s],e.state[s+1],e.state[s+2]],h=m.map(e=>e*a.invGridSpacingM),g=h.map(e=>Math.floor(e-.5)),_=[r-g[0],i-g[1],c-g[2]];if(_.some(e=>e<0||e>2))continue;let v=o_(h[0]-g[0]),y=o_(h[1]-g[1]),b=o_(h[2]-g[2]),x=v[_[0]]*y[_[1]]*b[_[2]];if(x===0)continue;let S=e.state[s+3],C=[e.state[s+4],e.state[s+5],e.state[s+6]],w=[l[0]-m[0],l[1]-m[1],l[2]-m[2]],T=[t.mechanics[p+9],t.mechanics[p+10],t.mechanics[p+11],t.mechanics[p+12],t.mechanics[p+13],t.mechanics[p+14],t.mechanics[p+15],t.mechanics[p+16],t.mechanics[p+17]],E=Math.max(t.mechanics[p+19],0)*Math.max(t.mechanics[p+18],1e-9),D=o!==0&&E>0?d_({sphParticleState:e,mlsMpmParticleState:t,stateOffset:s,thermoOffset:f,mechanicsOffset:p}):Array(9).fill(0),O=-o*E*4*a.invGridSpacingM*a.invGridSpacingM,k=[S*T[0]+O*D[0],S*T[1]+O*D[1],S*T[2]+O*D[2],S*T[3]+O*D[3],S*T[4]+O*D[4],S*T[5]+O*D[5],S*T[6]+O*D[6],S*T[7]+O*D[7],S*T[8]+O*D[8]],A=[k[0]*w[0]+k[1]*w[1]+k[2]*w[2],k[3]*w[0]+k[4]*w[1]+k[5]*w[2],k[6]*w[0]+k[7]*w[1]+k[8]*w[2]];u+=x*S,d[0]+=x*(S*C[0]+A[0]),d[1]+=x*(S*C[1]+A[1]),d[2]+=x*(S*C[2]+A[2])}let f=n*Kg;s.set([u,d[0],d[1],d[2],l[0],l[1],l[2],+(u>0)],f)}return f_({backend:`cpu-reference`,sphParticleState:e,mlsMpmParticleState:t,gridSpec:a,gridNodes:s,dt:o})}function m_(e,t,n){let r=Math.max(4,n.byteLength),i=e.createBuffer({label:t,size:r,usage:qg.STORAGE|qg.COPY_DST});return n.byteLength>0&&e.queue.writeBuffer(i,0,n),i}function h_(e,t,n){let r=new ArrayBuffer(48),i=new DataView(r);return i.setUint32(0,t,!0),i.setUint32(4,e.gridNodeCount,!0),i.setUint32(8,e.gridDims[0],!0),i.setUint32(12,e.gridDims[1],!0),i.setUint32(16,e.gridDims[2],!0),i.setUint32(20,e.shift,!0),i.setFloat32(24,e.gridSpacingM,!0),i.setFloat32(28,e.invGridSpacingM,!0),i.setFloat32(32,n_(n,0),!0),r}async function g_({device:e,sphParticleState:t,mlsMpmParticleState:n,sphParticleUpload:r=null,mlsMpmParticleUpload:i=null,gridSpacingM:a=t?.smoothingLengthM,boxDimsM:o=Yg,dt:s=n?.mechanicsDtS??0,retainGridBuffer:c=!1,readbackMode:l=Qg}={}){if(!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`runMlsMpmP2gGridProjectionWebGpu requires a WebGPU-like device with queue.writeBuffer`);i_({sphParticleState:t,mlsMpmParticleState:n});let u=a_({boxDimsM:o,gridSpacingM:a}),d=u.gridNodeCount*Kg*Float32Array.BYTES_PER_ELEMENT,f=r?.status===`webgpu-uploaded`?r.stateBuffer:null,p=r?.status===`webgpu-uploaded`?r.thermoBuffer:null,m=i?.status===`webgpu-uploaded`?i.mechanicsBuffer:null,h=f||m_(e,`ulg-mls-mpm-p2g-sph-state-in`,t.state),g=p||m_(e,`ulg-mls-mpm-p2g-sph-thermo-in`,t.thermo),_=m||m_(e,`ulg-mls-mpm-p2g-mechanics-in`,n.mechanics),v=e.createBuffer({label:`ulg-mls-mpm-p2g-grid-out`,size:Math.max(4,d),usage:qg.STORAGE|qg.COPY_SRC}),y=e.createBuffer({label:`ulg-mls-mpm-p2g-params`,size:48,usage:qg.UNIFORM|qg.COPY_DST}),b=l===$g,x=b?null:e.createBuffer({label:`ulg-mls-mpm-p2g-grid-readback`,size:Math.max(4,d),usage:qg.MAP_READ|qg.COPY_DST}),S=!1;try{e.queue.writeBuffer(y,0,h_(u,t.particleCount,s));let{pipeline:r,bindGroupLayout:i}=af(e,{label:`ulg-mls-mpm-p2g-grid-projection`,module:e.createShaderModule({code:Id}),entryPoint:`main`,bindings:[$(0,`read-only-storage`),$(1,`read-only-storage`),$(2,`read-only-storage`),$(3,`storage`),$(4,`uniform`)]}),a=e.createBindGroup({layout:i,entries:[{binding:0,resource:{buffer:h}},{binding:1,resource:{buffer:g}},{binding:2,resource:{buffer:_}},{binding:3,resource:{buffer:v}},{binding:4,resource:{buffer:y}}]}),o=e.createCommandEncoder(),l=o.beginComputePass();l.setPipeline(r),l.setBindGroup(0,a),l.dispatchWorkgroups(Math.max(1,Math.ceil(u.gridNodeCount/64))),l.end(),b||o.copyBufferToBuffer(v,0,x,0,Math.max(4,d)),e.queue.submit([o.finish()]);let f=new Float32Array;b?e.queue?.onSubmittedWorkDone&&await e.queue.onSubmittedWorkDone():(await x.mapAsync(Jg.READ),f=new Float32Array(x.getMappedRange()).slice(0,u.gridNodeCount*Kg),x.unmap());let p=f_({backend:`webgpu`,sphParticleState:t,mlsMpmParticleState:n,gridSpec:u,gridNodes:f,dt:s,readbackMode:b?$g:Qg});return c&&(p.gridBuffer=v,p.gridBufferByteLength=d,p.destroyGridBuffer=()=>v.destroy?.(),S=!0),p}finally{f||h.destroy?.(),p||g.destroy?.(),m||_.destroy?.(),(!c||!S)&&v.destroy?.(),y.destroy?.(),x?.destroy?.()}}function __(e=.05){return{schema:Eu,status:`not-run-no-full-readback`,tolerance:e,maxGridAbs:null,lengthMismatch:null,reason:`Full P2G grid readback and CPU parity were skipped for resident WebGPU execution`,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function v_({cpuReference:e,gpuResult:t,tolerance:n=.05}={}){let r=e?.gridNodes,i=t?.gridNodes;if(!(r instanceof Float32Array)||!(i instanceof Float32Array))return{schema:Eu,status:`fail`,tolerance:n,maxGridAbs:1/0,lengthMismatch:!0,reason:`missing grid projection buffers`,cpuBackend:e?.backend||null,gpuBackend:t?.backend||null,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1};let a=Math.min(r.length,i.length),o=0;for(let e=0;e<a;e+=1)o=Math.max(o,Math.abs(r[e]-i[e]));let s=r.length!==i.length;return{schema:Eu,status:!s&&o<=n?`pass`:`fail`,tolerance:n,maxGridAbs:o,lengthMismatch:s,gridNodeCount:e?.gridNodeCount??t?.gridNodeCount??0,cpuBackend:e.backend,gpuBackend:t.backend,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function y_(e,{cpuReference:t=null,gpuResult:n=null,webgpuStatus:r,webgpuParity:i=null}={}){return{schema:Tu,projectionSchema:e?.schema||`peercompute.ulg.mls-mpm-gpu-grid-projection.v0`,backend:e?.backend||`cpu-reference`,status:e?.status||`projected`,kernelScope:Zg,particleCount:e?.particleCount??0,dt:e?.dt??0,gridSpacingM:e?.gridSpacingM??0,gridDims:e?.gridDims??[],gridNodeCount:e?.gridNodeCount??0,gridNodeStrideFloats:Kg,gridNodes:e?.gridNodes??new Float32Array,readbackMode:e?.readbackMode??Qg,fullReadbackPerformed:e?.fullReadbackPerformed??!0,normalHotLoopReadbackFree:e?.normalHotLoopReadbackFree??!1,cpuReference:t,gpuResult:n,webgpuStatus:r,webgpuParity:i,p2gProjectionValidation:!1,stressProjectionValidation:!1,gridValidation:!1,g2pValidation:!1,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function b_(e){return e?.reason||e?.message||`device lost`}function x_(e,t){e?.lost?.then&&e.lost.then(e=>t(e)).catch(e=>t(e))}async function S_({sphParticleState:e,mlsMpmParticleState:t,sphParticleUpload:n=null,mlsMpmParticleUpload:r=null,gridSpacingM:i=e?.smoothingLengthM,boxDimsM:a=Yg,dt:o=t?.mechanicsDtS??0,preferWebGpu:s=!1,navigatorRef:c=globalThis.navigator,device:l=null,deviceResult:u=null,parityTolerance:d=.05,retainGridBuffer:f=!1,onDeviceLost:p=null,webGpuRunner:m=g_,readbackMode:h=Qg}={}){let g=h===$g,_=null,v=()=>(_||=p_({sphParticleState:e,mlsMpmParticleState:t,gridSpacingM:i,boxDimsM:a,dt:o}),_);if(!s){let e=v();return y_(e,{cpuReference:e,webgpuStatus:{status:`not-requested`,reason:`WebGPU MLS-MPM P2G grid projection path not requested`}})}try{let s=null,h=l?{status:`webgpu-device-ready`,reason:`provided device`,device:l}:u||await xh(c,{onDeviceLost(e){s=e,typeof p==`function`&&p(e)}});if(h.device&&l&&x_(h.device,e=>{s=e,typeof p==`function`&&p(e)}),!h.device){let e=v();return y_(e,{cpuReference:e,webgpuStatus:{status:h.status,reason:h.reason,fallback:`cpu-reference`}})}if(await Promise.resolve(),s){let e=v();return y_(e,{cpuReference:e,webgpuStatus:{status:`webgpu-device-lost-fallback`,reason:b_(s),fallback:`cpu-reference`}})}let _=await m({device:h.device,sphParticleState:e,mlsMpmParticleState:t,sphParticleUpload:n,mlsMpmParticleUpload:r,gridSpacingM:i,boxDimsM:a,dt:o,retainGridBuffer:f,readbackMode:g?$g:Qg});if(await Promise.resolve(),s){let e=v();return y_(e,{cpuReference:e,gpuResult:_,webgpuStatus:{status:`webgpu-device-lost-fallback`,reason:b_(s),fallback:`cpu-reference`}})}if(g)return y_(_,{cpuReference:null,gpuResult:_,webgpuStatus:{status:`webgpu-executed-no-full-readback`,reason:`WebGPU MLS-MPM P2G grid projection executed without full grid readback`},webgpuParity:__(d)});let y=v(),b=v_({cpuReference:y,gpuResult:_,tolerance:d});return b.status===`pass`?y_(_,{cpuReference:y,gpuResult:_,webgpuStatus:{status:`webgpu-executed`,reason:`CPU/WebGPU MLS-MPM P2G grid projection parity passed`},webgpuParity:b}):(_.destroyGridBuffer?.(),y_(y,{cpuReference:y,gpuResult:_,webgpuStatus:{status:`webgpu-parity-failed`,reason:`CPU/WebGPU MLS-MPM P2G grid projection parity exceeded tolerance`,fallback:`cpu-reference`},webgpuParity:b}))}catch(e){let t=v();return y_(t,{cpuReference:t,webgpuStatus:{status:`webgpu-error-fallback`,reason:e instanceof Error?e.message:String(e),fallback:`cpu-reference`}})}}var C_=ld.length,w_={MAP_READ:globalThis.GPUBufferUsage?.MAP_READ??1,COPY_SRC:globalThis.GPUBufferUsage?.COPY_SRC??4,COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64},T_={READ:globalThis.GPUMapMode?.READ??1},E_=Object.freeze([0,-9.80665,0]),D_=Object.freeze([5,5,5]),O_=.6,k_=`mls-mpm-grid-velocity-update-gravity-cfl-walls`,A_=`full-parity-readback`,j_=`no-full-readback`;function M_(e,t=0){let n=Number(e);return Number.isFinite(n)?n:t}function N_(e,t){let n=Array.isArray(e)?e:t;return[M_(n?.[0],t[0]),M_(n?.[1],t[1]),M_(n?.[2],t[2])]}function P_(e,{requireGridNodes:t=!0}={}){let n=e?.projectionSchema||e?.schema;if(e?.schema!==`peercompute.ulg.mls-mpm-gpu-grid-projection.v0`&&e?.schema!==`peercompute.ulg.mls-mpm-gpu-grid-projection-execution.v0`&&n!==`peercompute.ulg.mls-mpm-gpu-grid-projection.v0`)throw TypeError(`MLS-MPM grid update requires a P2G grid projection artifact`);if(t&&!(e.gridNodes instanceof Float32Array))throw TypeError(`MLS-MPM grid update requires Float32Array gridNodes`);if(e.gridNodeStrideFloats!==Kg)throw RangeError(`MLS-MPM grid update requires the packed P2G grid node stride`)}function F_({backend:e,p2gGridProjection:t,updatedGridNodes:n,dt:r,gravityMPerS2:i,boxDimsM:a,cflFactor:o,readbackMode:s=A_}){let c=s===j_;return{schema:Du,backend:e,status:`updated`,kernelScope:k_,sourceSchema:t.schema,sourceProjectionSchema:t.projectionSchema||t.schema,sourceBackend:t.backend,particleCount:t.particleCount??0,gridSpacingM:t.gridSpacingM??0,gridDims:[...t.gridDims??[]],gridNodeCount:t.gridNodeCount??0,gridShift:t.gridShift??1,dt:r,gravityMPerS2:[...i],boxDimsM:[...a],cflFactor:o,sourceGridNodeLayout:[...cd],gridNodeLayout:[...ld],gridNodeStrideFloats:C_,gridNodeStrideBytes:C_*Float32Array.BYTES_PER_ELEMENT,updatedGridNodes:n,readbackMode:s,fullReadbackPerformed:!c,normalHotLoopReadbackFree:c,p2gProjectionValidation:!1,stressProjectionValidation:!1,gridUpdateValidation:!1,gridValidation:!1,g2pValidation:!1,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function I_({p2gGridProjection:e,dt:t=e?.dt??0,gravityMPerS2:n=E_,boxDimsM:r=D_,cflFactor:i=O_}={}){let a=M_(t,0),o=N_(n,E_),s=N_(r,D_),c=M_(i,O_),l=M_(e.gridSpacingM,0),u=a>0?c*l/a:1/0,d=u*u,f=e.gridNodes,p=new Float32Array(e.gridNodeCount*C_);for(let e=0;e<f.length;e+=Kg){let t=f[e],n=e,r=[f[e+4],f[e+5],f[e+6]],i=[0,0,0],c=0;if(t>0){i=[f[e+1]/t+a*o[0],f[e+2]/t+a*o[1],f[e+3]/t+a*o[2]];let n=i[0]**2+i[1]**2+i[2]**2;if(n>d){let e=u/Math.sqrt(n);i=i.map(t=>t*e)}(r[0]<l&&i[0]<0||r[0]>s[0]-l&&i[0]>0)&&(i[0]=0),(r[1]<l&&i[1]<0||r[1]>s[1]-l&&i[1]>0)&&(i[1]=0),(r[2]<l&&i[2]<0||r[2]>s[2]-l&&i[2]>0)&&(i[2]=0),c=1}p.set([t,i[0],i[1],i[2],r[0],r[1],r[2],c],n)}return F_({backend:`cpu-reference`,p2gGridProjection:e,updatedGridNodes:p,dt:a,gravityMPerS2:o,boxDimsM:s,cflFactor:c})}function L_(e,t,n){let r=Math.max(4,n.byteLength),i=e.createBuffer({label:t,size:r,usage:w_.STORAGE|w_.COPY_DST});return n.byteLength>0&&e.queue.writeBuffer(i,0,n),i}function R_({p2gGridProjection:e,dt:t,gravityMPerS2:n,boxDimsM:r,cflFactor:i}){let a=new ArrayBuffer(80),o=new DataView(a),s=e.gridDims??[1,1,1];return o.setUint32(0,e.gridNodeCount??0,!0),o.setUint32(4,s[0]??1,!0),o.setUint32(8,s[1]??1,!0),o.setUint32(12,s[2]??1,!0),o.setUint32(16,e.gridShift??1,!0),o.setFloat32(32,M_(e.gridSpacingM,0),!0),o.setFloat32(36,t,!0),o.setFloat32(40,n[0],!0),o.setFloat32(44,n[1],!0),o.setFloat32(48,n[2],!0),o.setFloat32(52,r[0],!0),o.setFloat32(56,r[1],!0),o.setFloat32(60,r[2],!0),o.setFloat32(64,i,!0),a}async function z_({device:e,p2gGridProjection:t,p2gGridBuffer:n=null,dt:r=t?.dt??0,gravityMPerS2:i=E_,boxDimsM:a=D_,cflFactor:o=O_,retainUpdatedGridBuffer:s=!1,readbackMode:c=A_}={}){if(!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`runMlsMpmGridUpdateWebGpu requires a WebGPU-like device with queue.writeBuffer`);P_(t);let l=M_(r,0),u=N_(i,E_),d=N_(a,D_),f=M_(o,O_),p=t.gridNodeCount*C_*Float32Array.BYTES_PER_ELEMENT,m=n||t.gridBuffer||t.gpuResult?.gridBuffer||null;P_(t,{requireGridNodes:!m});let h=m||L_(e,`ulg-mls-mpm-grid-update-p2g-in`,t.gridNodes),g=e.createBuffer({label:`ulg-mls-mpm-grid-update-out`,size:Math.max(4,p),usage:w_.STORAGE|w_.COPY_SRC}),_=e.createBuffer({label:`ulg-mls-mpm-grid-update-params`,size:80,usage:w_.UNIFORM|w_.COPY_DST}),v=c===j_,y=v?null:e.createBuffer({label:`ulg-mls-mpm-grid-update-readback`,size:Math.max(4,p),usage:w_.MAP_READ|w_.COPY_DST}),b=!1;try{e.queue.writeBuffer(_,0,R_({p2gGridProjection:t,dt:l,gravityMPerS2:u,boxDimsM:d,cflFactor:f}));let{pipeline:n,bindGroupLayout:r}=af(e,{label:`ulg-mls-mpm-grid-update`,module:e.createShaderModule({code:Ld}),entryPoint:`main`,bindings:[$(0,`read-only-storage`),$(1,`storage`),$(2,`uniform`)]}),i=e.createBindGroup({layout:r,entries:[{binding:0,resource:{buffer:h}},{binding:1,resource:{buffer:g}},{binding:2,resource:{buffer:_}}]}),a=e.createCommandEncoder(),o=a.beginComputePass();o.setPipeline(n),o.setBindGroup(0,i),o.dispatchWorkgroups(Math.max(1,Math.ceil(t.gridNodeCount/64))),o.end(),v||a.copyBufferToBuffer(g,0,y,0,Math.max(4,p)),e.queue.submit([a.finish()]);let c=new Float32Array;v?e.queue?.onSubmittedWorkDone&&await e.queue.onSubmittedWorkDone():(await y.mapAsync(T_.READ),c=new Float32Array(y.getMappedRange()).slice(0,t.gridNodeCount*C_),y.unmap());let m=F_({backend:`webgpu`,p2gGridProjection:t,updatedGridNodes:c,dt:l,gravityMPerS2:u,boxDimsM:d,cflFactor:f,readbackMode:v?j_:A_});return s&&(m.updatedGridBuffer=g,m.updatedGridBufferByteLength=p,m.destroyUpdatedGridBuffer=()=>g.destroy?.(),b=!0),m}finally{m||h.destroy?.(),(!s||!b)&&g.destroy?.(),_.destroy?.(),y?.destroy?.()}}function B_(e=1e-5){return{schema:ku,status:`not-run-no-full-readback`,tolerance:e,maxGridAbs:null,lengthMismatch:null,reason:`Full grid-update readback and CPU parity were skipped for resident WebGPU execution`,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function V_({cpuReference:e,gpuResult:t,tolerance:n=1e-5}={}){let r=e?.updatedGridNodes,i=t?.updatedGridNodes;if(!(r instanceof Float32Array)||!(i instanceof Float32Array))return{schema:ku,status:`fail`,tolerance:n,maxGridAbs:1/0,lengthMismatch:!0,reason:`missing updated grid buffers`,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1};let a=Math.min(r.length,i.length),o=0;for(let e=0;e<a;e+=1)o=Math.max(o,Math.abs(r[e]-i[e]));let s=r.length!==i.length;return{schema:ku,status:!s&&o<=n?`pass`:`fail`,tolerance:n,maxGridAbs:o,lengthMismatch:s,gridNodeCount:e?.gridNodeCount??t?.gridNodeCount??0,cpuBackend:e?.backend??null,gpuBackend:t?.backend??null,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function H_(e,{cpuReference:t=null,gpuResult:n=null,webgpuStatus:r,webgpuParity:i=null}={}){return{schema:Ou,updateSchema:e?.schema||`peercompute.ulg.mls-mpm-gpu-grid-update.v0`,backend:e?.backend||`cpu-reference`,status:e?.status||`updated`,kernelScope:k_,particleCount:e?.particleCount??0,gridSpacingM:e?.gridSpacingM??0,gridDims:e?.gridDims??[],gridNodeCount:e?.gridNodeCount??0,gridNodeStrideFloats:C_,dt:e?.dt??0,gravityMPerS2:e?.gravityMPerS2??[],boxDimsM:e?.boxDimsM??[],cflFactor:e?.cflFactor??0,updatedGridNodes:e?.updatedGridNodes??new Float32Array,readbackMode:e?.readbackMode??A_,fullReadbackPerformed:e?.fullReadbackPerformed??!0,normalHotLoopReadbackFree:e?.normalHotLoopReadbackFree??!1,cpuReference:t,gpuResult:n,webgpuStatus:r,webgpuParity:i,p2gProjectionValidation:!1,stressProjectionValidation:!1,gridUpdateValidation:!1,gridValidation:!1,g2pValidation:!1,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function U_(e){return e?.reason||e?.message||`device lost`}function W_(e,t){e?.lost?.then&&e.lost.then(e=>t(e)).catch(e=>t(e))}async function G_({p2gGridProjection:e,p2gGridBuffer:t=null,dt:n=e?.dt??0,gravityMPerS2:r=E_,boxDimsM:i=D_,cflFactor:a=O_,preferWebGpu:o=!1,navigatorRef:s=globalThis.navigator,device:c=null,deviceResult:l=null,parityTolerance:u=1e-5,retainUpdatedGridBuffer:d=!1,onDeviceLost:f=null,webGpuRunner:p=z_,readbackMode:m=A_}={}){let h=m===j_,g=null,_=()=>(g||=I_({p2gGridProjection:e,dt:n,gravityMPerS2:r,boxDimsM:i,cflFactor:a}),g);if(!o){let e=_();return H_(e,{cpuReference:e,webgpuStatus:{status:`not-requested`,reason:`WebGPU MLS-MPM grid update path not requested`}})}try{let o=null,m=c?{status:`webgpu-device-ready`,reason:`provided device`,device:c}:l||await xh(s,{onDeviceLost(e){o=e,typeof f==`function`&&f(e)}});if(m.device&&c&&W_(m.device,e=>{o=e,typeof f==`function`&&f(e)}),!m.device){let e=_();return H_(e,{cpuReference:e,webgpuStatus:{status:m.status,reason:m.reason,fallback:`cpu-reference`}})}if(await Promise.resolve(),o){let e=_();return H_(e,{cpuReference:e,webgpuStatus:{status:`webgpu-device-lost-fallback`,reason:U_(o),fallback:`cpu-reference`}})}let g=await p({device:m.device,p2gGridProjection:e,p2gGridBuffer:t,dt:n,gravityMPerS2:r,boxDimsM:i,cflFactor:a,retainUpdatedGridBuffer:d,readbackMode:h?j_:A_});if(await Promise.resolve(),o){g.destroyUpdatedGridBuffer?.();let e=_();return H_(e,{cpuReference:e,gpuResult:g,webgpuStatus:{status:`webgpu-device-lost-fallback`,reason:U_(o),fallback:`cpu-reference`}})}if(h)return H_(g,{cpuReference:null,gpuResult:g,webgpuStatus:{status:`webgpu-executed-no-full-readback`,reason:`WebGPU MLS-MPM grid update executed without full grid readback`},webgpuParity:B_(u)});let v=_(),y=V_({cpuReference:v,gpuResult:g,tolerance:u});return y.status===`pass`?H_(g,{cpuReference:v,gpuResult:g,webgpuStatus:{status:`webgpu-executed`,reason:`CPU/WebGPU MLS-MPM grid update parity passed`},webgpuParity:y}):(g.destroyUpdatedGridBuffer?.(),H_(v,{cpuReference:v,gpuResult:g,webgpuStatus:{status:`webgpu-parity-failed`,reason:`CPU/WebGPU MLS-MPM grid update parity exceeded tolerance`,fallback:`cpu-reference`},webgpuParity:y}))}catch(e){let t=_();return H_(t,{cpuReference:t,webgpuStatus:{status:`webgpu-error-fallback`,reason:e instanceof Error?e.message:String(e),fallback:`cpu-reference`}})}}var K_={MAP_READ:globalThis.GPUBufferUsage?.MAP_READ??1,COPY_SRC:globalThis.GPUBufferUsage?.COPY_SRC??4,COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64},q_={READ:globalThis.GPUMapMode?.READ??1},J_=Object.freeze([5,5,5]),Y_=`mls-mpm-g2p-velocity-affine-deformation-reconstruction`,X_=`full-parity-readback`,Z_=`no-full-readback`;function Q_(e,t=0){let n=Number(e);return Number.isFinite(n)?n:t}function $_(e,t){let n=Array.isArray(e)?e:t;return[Q_(n?.[0],t[0]),Q_(n?.[1],t[1]),Q_(n?.[2],t[2])]}function ev({sphParticleState:e,mlsMpmParticleState:t,gridUpdate:n,requireUpdatedGridNodes:r=!0}){if(e?.schema!==`peercompute.ulg.sph-gpu-particle-buffer.v0`)throw TypeError(`MLS-MPM G2P requires a packed SPH GPU particle buffer`);if(t?.schema!==`peercompute.ulg.mls-mpm-gpu-particle-buffer.v0`)throw TypeError(`MLS-MPM G2P requires a packed MLS-MPM GPU particle buffer`);if(e.particleCount!==t.particleCount)throw RangeError(`SPH and MLS-MPM particle counts must match`);if(n?.schema!==`peercompute.ulg.mls-mpm-gpu-grid-update.v0`&&n?.schema!==`peercompute.ulg.mls-mpm-gpu-grid-update-execution.v0`&&n?.updateSchema!==`peercompute.ulg.mls-mpm-gpu-grid-update.v0`)throw TypeError(`MLS-MPM G2P requires a grid update artifact`);if(r&&!(n.updatedGridNodes instanceof Float32Array))throw TypeError(`MLS-MPM G2P requires Float32Array updatedGridNodes`)}function tv(e){let t=1.5-e,n=e-1,r=e-.5;return[.5*t*t,.75-n*n,.5*r*r]}function nv(e){return e[0]*(e[4]*e[8]-e[5]*e[7])-e[1]*(e[3]*e[8]-e[5]*e[6])+e[2]*(e[3]*e[7]-e[4]*e[6])}function rv(e,t,n){let r=[1+n*t[0],n*t[1],n*t[2],n*t[3],1+n*t[4],n*t[5],n*t[6],n*t[7],1+n*t[8]];return[r[0]*e[0]+r[1]*e[3]+r[2]*e[6],r[0]*e[1]+r[1]*e[4]+r[2]*e[7],r[0]*e[2]+r[1]*e[5]+r[2]*e[8],r[3]*e[0]+r[4]*e[3]+r[5]*e[6],r[3]*e[1]+r[4]*e[4]+r[5]*e[7],r[3]*e[2]+r[4]*e[5]+r[5]*e[8],r[6]*e[0]+r[7]*e[3]+r[8]*e[6],r[6]*e[1]+r[7]*e[4]+r[8]*e[7],r[6]*e[2]+r[7]*e[5]+r[8]*e[8]]}function iv(e){let t=Math.cbrt(Math.max(e,1e-12));return[t,0,0,0,t,0,0,0,t]}function av(e,t,n,r){let[,i,a]=e.gridDims;return((t+e.gridShift)*i+(n+e.gridShift))*a+(r+e.gridShift)}function ov(e,t,n,r){let[i,a,o]=e.gridDims;return t+e.gridShift>=0&&t+e.gridShift<i&&n+e.gridShift>=0&&n+e.gridShift<a&&r+e.gridShift>=0&&r+e.gridShift<o}function sv({backend:e,sphParticleState:t,mlsMpmParticleState:n,gridUpdate:r,state:i,mechanics:a,dt:o,boxDimsM:s,readbackMode:c=X_}){let l=c===Z_;return{schema:Au,backend:e,status:`reconstructed`,kernelScope:Y_,sourceSchemas:{sphParticleState:t.schema,mlsMpmParticleState:n.schema,gridUpdate:r.schema},particleCount:t.particleCount,gridNodeCount:r.gridNodeCount,gridSpacingM:r.gridSpacingM,gridDims:[...r.gridDims],gridShift:r.gridShift,dt:o,boxDimsM:[...s],stateStrideFloats:Kh,thermoStrideFloats:qh,mechanicsStrideFloats:Jh,state:i,mechanics:a,readbackMode:c,fullReadbackPerformed:!l,normalHotLoopReadbackFree:l,p2gProjectionValidation:!1,stressProjectionValidation:!1,gridUpdateValidation:!1,g2pValidation:!1,gridValidation:!1,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function cv({sphParticleState:e,mlsMpmParticleState:t,gridUpdate:n,dt:r=n?.dt??t?.mechanicsDtS??0,boxDimsM:i=J_}={}){ev({sphParticleState:e,mlsMpmParticleState:t,gridUpdate:n});let a=Q_(r,0),o=$_(i,J_),s=1/n.gridSpacingM,c=new Float32Array(e.state),l=new Float32Array(t.mechanics);for(let t=0;t<e.particleCount;t+=1){let e=t*Kh,r=t*Jh,i=[c[e],c[e+1],c[e+2]],u=i.map(e=>e*s),d=u.map(e=>Math.floor(e-.5)),f=[tv(u[0]-d[0]),tv(u[1]-d[1]),tv(u[2]-d[2])],p=[0,0,0],m=Array(9).fill(0);for(let e=0;e<3;e+=1)for(let t=0;t<3;t+=1)for(let r=0;r<3;r+=1){let i=d[0]+e,a=d[1]+t,o=d[2]+r;if(!ov(n,i,a,o))continue;let c=f[0][e]*f[1][t]*f[2][r],l=av(n,i,a,o)*C_,h=[n.updatedGridNodes[l+1],n.updatedGridNodes[l+2],n.updatedGridNodes[l+3]];p[0]+=c*h[0],p[1]+=c*h[1],p[2]+=c*h[2];let g=[(i-u[0])*n.gridSpacingM,(a-u[1])*n.gridSpacingM,(o-u[2])*n.gridSpacingM],_=4*s*s*c;m[0]+=_*h[0]*g[0],m[1]+=_*h[0]*g[1],m[2]+=_*h[0]*g[2],m[3]+=_*h[1]*g[0],m[4]+=_*h[1]*g[1],m[5]+=_*h[1]*g[2],m[6]+=_*h[2]*g[0],m[7]+=_*h[2]*g[1],m[8]+=_*h[2]*g[2]}let h=[i[0]+a*p[0],i[1]+a*p[1],i[2]+a*p[2]];for(let e=0;e<3;e+=1)h[e]<0?(h[e]=0,p[e]<0&&(p[e]=0)):h[e]>o[e]&&(h[e]=o[e],p[e]>0&&(p[e]=0));c[e]=h[0],c[e+1]=h[1],c[e+2]=h[2],c[e+4]=p[0],c[e+5]=p[1],c[e+6]=p[2];let g=rv(Array.from(l.slice(r,r+9)),m,a),_=nv(g);l[r+20]<.5&&(g=iv(Math.max(_,.05)),_=nv(g)),_<.1&&(g=iv(.1),_=nv(g)),l.set(g,r),l.set(m,r+9),l[r+18]=_}return sv({backend:`cpu-reference`,sphParticleState:e,mlsMpmParticleState:t,gridUpdate:n,state:c,mechanics:l,dt:a,boxDimsM:o})}function lv(e,t,n){let r=Math.max(4,n.byteLength),i=e.createBuffer({label:t,size:r,usage:K_.STORAGE|K_.COPY_DST});return n.byteLength>0&&e.queue.writeBuffer(i,0,n),i}function uv({particleCount:e,gridUpdate:t,dt:n,boxDimsM:r}){let i=new ArrayBuffer(64),a=new DataView(i);return a.setUint32(0,e,!0),a.setUint32(4,t.gridNodeCount,!0),a.setUint32(8,t.gridDims[0],!0),a.setUint32(12,t.gridDims[1],!0),a.setUint32(16,t.gridDims[2],!0),a.setUint32(20,t.gridShift,!0),a.setFloat32(32,t.gridSpacingM,!0),a.setFloat32(36,1/t.gridSpacingM,!0),a.setFloat32(40,n,!0),a.setFloat32(44,r[0],!0),a.setFloat32(48,r[1],!0),a.setFloat32(52,r[2],!0),i}async function dv({device:e,sphParticleState:t,mlsMpmParticleState:n,gridUpdate:r,sphParticleUpload:i=null,mlsMpmParticleUpload:a=null,updatedGridBuffer:o=null,dt:s=r?.dt??n?.mechanicsDtS??0,boxDimsM:c=J_,retainOutputParticleBuffers:l=!1,readbackMode:u=X_}={}){if(!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`runMlsMpmG2pWebGpu requires a WebGPU-like device with queue.writeBuffer`);ev({sphParticleState:t,mlsMpmParticleState:n,gridUpdate:r});let d=Q_(s,0),f=$_(c,J_),p=t.state.byteLength,m=n.mechanics.byteLength,h=i?.status===`webgpu-uploaded`?i.stateBuffer:null,g=i?.status===`webgpu-uploaded`?i.thermoBuffer:null,_=a?.status===`webgpu-uploaded`?a.mechanicsBuffer:null,v=o||r.gpuResult?.updatedGridBuffer||r.updatedGridBuffer||null;ev({sphParticleState:t,mlsMpmParticleState:n,gridUpdate:r,requireUpdatedGridNodes:!v});let y=h||lv(e,`ulg-mls-mpm-g2p-sph-state-in`,t.state),b=g||lv(e,`ulg-mls-mpm-g2p-sph-thermo-in`,t.thermo),x=_||lv(e,`ulg-mls-mpm-g2p-mechanics-in`,n.mechanics),S=v||lv(e,`ulg-mls-mpm-g2p-grid-in`,r.updatedGridNodes),C=e.createBuffer({label:`ulg-mls-mpm-g2p-state-out`,size:Math.max(4,p),usage:K_.STORAGE|K_.COPY_SRC}),w=e.createBuffer({label:`ulg-mls-mpm-g2p-mechanics-out`,size:Math.max(4,m),usage:K_.STORAGE|K_.COPY_SRC}),T=e.createBuffer({label:`ulg-mls-mpm-g2p-params`,size:64,usage:K_.UNIFORM|K_.COPY_DST}),E=u===Z_,D=E?null:e.createBuffer({label:`ulg-mls-mpm-g2p-state-readback`,size:Math.max(4,p),usage:K_.MAP_READ|K_.COPY_DST}),O=E?null:e.createBuffer({label:`ulg-mls-mpm-g2p-mechanics-readback`,size:Math.max(4,m),usage:K_.MAP_READ|K_.COPY_DST}),k=!1;try{e.queue.writeBuffer(T,0,uv({particleCount:t.particleCount,gridUpdate:r,dt:d,boxDimsM:f}));let{pipeline:i,bindGroupLayout:a}=af(e,{label:`ulg-mls-mpm-g2p-reconstruct`,module:e.createShaderModule({code:Rd}),entryPoint:`main`,bindings:[$(0,`read-only-storage`),$(1,`read-only-storage`),$(2,`read-only-storage`),$(3,`read-only-storage`),$(4,`storage`),$(5,`storage`),$(6,`uniform`)]}),o=e.createBindGroup({layout:a,entries:[{binding:0,resource:{buffer:y}},{binding:1,resource:{buffer:b}},{binding:2,resource:{buffer:x}},{binding:3,resource:{buffer:S}},{binding:4,resource:{buffer:C}},{binding:5,resource:{buffer:w}},{binding:6,resource:{buffer:T}}]}),s=e.createCommandEncoder(),c=s.beginComputePass();c.setPipeline(i),c.setBindGroup(0,o),c.dispatchWorkgroups(Math.max(1,Math.ceil(t.particleCount/64))),c.end(),E||(s.copyBufferToBuffer(C,0,D,0,Math.max(4,p)),s.copyBufferToBuffer(w,0,O,0,Math.max(4,m))),e.queue.submit([s.finish()]);let u=new Float32Array,h=new Float32Array;E?e.queue?.onSubmittedWorkDone&&await e.queue.onSubmittedWorkDone():(await D.mapAsync(q_.READ),await O.mapAsync(q_.READ),u=new Float32Array(D.getMappedRange()).slice(0,t.state.length),h=new Float32Array(O.getMappedRange()).slice(0,n.mechanics.length),D.unmap(),O.unmap());let g=sv({backend:`webgpu`,sphParticleState:t,mlsMpmParticleState:n,gridUpdate:r,state:u,mechanics:h,dt:d,boxDimsM:f,readbackMode:E?Z_:X_});return l&&(g.stateBuffer=C,g.mechanicsBuffer=w,g.stateBufferByteLength=p,g.mechanicsBufferByteLength=m,g.retainedOutputParticleBuffers=!0,g.destroyOutputParticleBuffers=()=>{C.destroy?.(),w.destroy?.()},k=!0),g}finally{h||y.destroy?.(),g||b.destroy?.(),_||x.destroy?.(),v||S.destroy?.(),(!l||!k)&&(C.destroy?.(),w.destroy?.()),T.destroy?.(),D?.destroy?.(),O?.destroy?.()}}function fv(e=.05){return{schema:Mu,status:`not-run-no-full-readback`,tolerance:e,maxStateAbs:null,maxMechanicsAbs:null,lengthMismatch:null,reason:`Full G2P particle readback and CPU parity were skipped for resident WebGPU execution`,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function pv({cpuReference:e,gpuResult:t,tolerance:n=.05}={}){if(!(e?.state instanceof Float32Array)||!(t?.state instanceof Float32Array))return{schema:Mu,status:`fail`,tolerance:n,maxStateAbs:1/0,maxMechanicsAbs:1/0,lengthMismatch:!0,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1};let r=Math.min(e.state.length,t.state.length),i=Math.min(e.mechanics.length,t.mechanics.length),a=0,o=0;for(let n=0;n<r;n+=1)a=Math.max(a,Math.abs(e.state[n]-t.state[n]));for(let n=0;n<i;n+=1)o=Math.max(o,Math.abs(e.mechanics[n]-t.mechanics[n]));let s=e.state.length!==t.state.length||e.mechanics.length!==t.mechanics.length;return{schema:Mu,status:!s&&a<=n&&o<=n?`pass`:`fail`,tolerance:n,maxStateAbs:a,maxMechanicsAbs:o,lengthMismatch:s,particleCount:e.particleCount??t.particleCount??0,cpuBackend:e.backend,gpuBackend:t.backend,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function mv(e,{cpuReference:t=null,gpuResult:n=null,webgpuStatus:r,webgpuParity:i=null}={}){return{schema:ju,reconstructionSchema:e?.schema||`peercompute.ulg.mls-mpm-gpu-g2p-reconstruction.v0`,backend:e?.backend||`cpu-reference`,status:e?.status||`reconstructed`,kernelScope:Y_,particleCount:e?.particleCount??0,gridNodeCount:e?.gridNodeCount??0,dt:e?.dt??0,stateStrideFloats:Kh,mechanicsStrideFloats:Jh,state:e?.state??new Float32Array,mechanics:e?.mechanics??new Float32Array,stateBuffer:e?.stateBuffer??null,mechanicsBuffer:e?.mechanicsBuffer??null,stateBufferByteLength:e?.stateBufferByteLength??0,mechanicsBufferByteLength:e?.mechanicsBufferByteLength??0,retainedOutputParticleBuffers:!!e?.retainedOutputParticleBuffers,destroyOutputParticleBuffers:e?.destroyOutputParticleBuffers??null,readbackMode:e?.readbackMode??X_,fullReadbackPerformed:e?.fullReadbackPerformed??!0,normalHotLoopReadbackFree:e?.normalHotLoopReadbackFree??!1,cpuReference:t,gpuResult:n,webgpuStatus:r,webgpuParity:i,p2gProjectionValidation:!1,stressProjectionValidation:!1,gridUpdateValidation:!1,g2pValidation:!1,gridValidation:!1,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function hv(e){return e?.reason||e?.message||`device lost`}function gv(e,t){e?.lost?.then&&e.lost.then(e=>t(e)).catch(e=>t(e))}async function _v({sphParticleState:e,mlsMpmParticleState:t,gridUpdate:n,sphParticleUpload:r=null,mlsMpmParticleUpload:i=null,updatedGridBuffer:a=null,dt:o=n?.dt??t?.mechanicsDtS??0,boxDimsM:s=J_,preferWebGpu:c=!1,navigatorRef:l=globalThis.navigator,device:u=null,deviceResult:d=null,parityTolerance:f=.05,retainOutputParticleBuffers:p=!1,onDeviceLost:m=null,webGpuRunner:h=dv,readbackMode:g=X_}={}){let _=g===Z_,v=null,y=()=>(v||=cv({sphParticleState:e,mlsMpmParticleState:t,gridUpdate:n,dt:o,boxDimsM:s}),v);if(!c){let e=y();return mv(e,{cpuReference:e,webgpuStatus:{status:`not-requested`,reason:`WebGPU MLS-MPM G2P path not requested`}})}try{let c=null,g=u?{status:`webgpu-device-ready`,reason:`provided device`,device:u}:d||await xh(l,{onDeviceLost(e){c=e,typeof m==`function`&&m(e)}});if(g.device&&u&&gv(g.device,e=>{c=e,typeof m==`function`&&m(e)}),!g.device){let e=y();return mv(e,{cpuReference:e,webgpuStatus:{status:g.status,reason:g.reason,fallback:`cpu-reference`}})}if(await Promise.resolve(),c){let e=y();return mv(e,{cpuReference:e,webgpuStatus:{status:`webgpu-device-lost-fallback`,reason:hv(c),fallback:`cpu-reference`}})}let v=await h({device:g.device,sphParticleState:e,mlsMpmParticleState:t,gridUpdate:n,sphParticleUpload:r,mlsMpmParticleUpload:i,updatedGridBuffer:a,dt:o,boxDimsM:s,retainOutputParticleBuffers:p,readbackMode:_?Z_:X_});if(await Promise.resolve(),c){v.destroyOutputParticleBuffers?.();let e=y();return mv(e,{cpuReference:e,gpuResult:v,webgpuStatus:{status:`webgpu-device-lost-fallback`,reason:hv(c),fallback:`cpu-reference`}})}if(_)return mv(v,{cpuReference:null,gpuResult:v,webgpuStatus:{status:`webgpu-executed-no-full-readback`,reason:`WebGPU MLS-MPM G2P executed without full particle readback`},webgpuParity:fv(f)});let b=y(),x=pv({cpuReference:b,gpuResult:v,tolerance:f});return x.status===`pass`?mv(v,{cpuReference:b,gpuResult:v,webgpuStatus:{status:`webgpu-executed`,reason:`CPU/WebGPU MLS-MPM G2P parity passed`},webgpuParity:x}):(v.destroyOutputParticleBuffers?.(),mv(b,{cpuReference:b,gpuResult:v,webgpuStatus:{status:`webgpu-parity-failed`,reason:`CPU/WebGPU MLS-MPM G2P parity exceeded tolerance`,fallback:`cpu-reference`},webgpuParity:x}))}catch(e){let t=y();return mv(t,{cpuReference:t,webgpuStatus:{status:`webgpu-error-fallback`,reason:e instanceof Error?e.message:String(e),fallback:`cpu-reference`}})}}var vv=ud.length;vv/4;var yv={MAP_READ:globalThis.GPUBufferUsage?.MAP_READ??1,COPY_SRC:globalThis.GPUBufferUsage?.COPY_SRC??4,COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64},bv={READ:globalThis.GPUMapMode?.READ??1},xv=`mls-mpm-resident-compact-gpu-summary`,Sv=64;function Cv({sphParticleState:e,mlsMpmParticleState:t}){if(e?.schema!==`peercompute.ulg.sph-gpu-particle-buffer.v0`)throw TypeError(`MLS-MPM resident summary requires a packed SPH GPU particle buffer`);if(t?.schema!==`peercompute.ulg.mls-mpm-gpu-particle-buffer.v0`)throw TypeError(`MLS-MPM resident summary requires a packed MLS-MPM GPU particle buffer`);if(e.particleCount!==t.particleCount)throw RangeError(`SPH and MLS-MPM particle counts must match for resident summary`)}function wv(e,t,n){let r=Math.max(4,n.byteLength),i=e.createBuffer({label:t,size:r,usage:yv.STORAGE|yv.COPY_DST});return n.byteLength>0&&e.queue.writeBuffer(i,0,n),i}function Tv({particleCount:e,gridNodeCount:t,partialCount:n}){let r=new ArrayBuffer(16),i=new DataView(r);return i.setUint32(0,e,!0),i.setUint32(4,t,!0),i.setUint32(8,n,!0),r}function Ev(e,t){return e?.gpuResult?.[t]??e?.[t]??null}function Dv(e){return e?.gpuResult?.updatedGridBuffer??e?.updatedGridBuffer??null}function Ov(e){return e?.status===`webgpu-uploaded`?e.stateBuffer:null}function kv(e){return e?.status===`webgpu-uploaded`?e.mechanicsBuffer:null}function Av(e,{particleCount:t=e?.[0]??0,gridNodeCount:n=e?.[1]??0,readbackMode:r=`compact-summary-readback`,reductionStrategy:i=`two-pass-workgroup-reduction`}={}){if(!(e instanceof Float32Array)||e.length<vv)throw TypeError(`decodeMlsMpmResidentSummaryValues requires a compact resident summary Float32Array`);let a=[e[6],e[7],e[8]],o=[e[9],e[10],e[11]],s=[e[12],e[13],e[14]];return{schema:Iu,executionSchema:Lu,backend:`webgpu`,status:e[19]>0?`compact-summary-ready`:`compact-summary-empty`,kernelScope:xv,reductionStrategy:i,particleCount:t,gridNodeCount:n,activeGridNodeCount:e[2],sourceMassKg:e[3],nextMassKg:e[4],massDeltaKg:e[5],sourceMomentumKgMPerS:a,nextMomentumKgMPerS:o,momentumDeltaKgMPerS:s,maxSpeedMPerS:e[15],maxDisplacementM:e[16],minVolumeRatioJ:e[17],maxVolumeRatioJ:e[18],readbackMode:r,compactGpuSummaryAvailable:!0,fullParticleReadbackPerformed:!1,fullGridReadbackPerformed:!1,rowLayout:[...ud],summaryStrideFloats:vv,summaryStrideBytes:vv*Float32Array.BYTES_PER_ELEMENT,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}async function jv({device:e,sphParticleState:t,mlsMpmParticleState:n,sphParticleUpload:r=null,mlsMpmParticleUpload:i=null,gridUpdate:a,g2pReconstruction:o}={}){if(!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`runMlsMpmResidentSummaryWebGpu requires a WebGPU-like device with queue.writeBuffer`);Cv({sphParticleState:t,mlsMpmParticleState:n});let s=t.particleCount,c=a?.gridNodeCount??o?.gridNodeCount??0,l=Math.max(1,Math.ceil(Math.max(s,c)/Sv)),u=Ev(o,`stateBuffer`),d=Ev(o,`mechanicsBuffer`),f=Dv(a);if(!u||!d||!f)throw TypeError(`MLS-MPM resident summary requires retained G2P state/mechanics and updated-grid buffers`);let p=Ov(r),m=kv(i),h=p||wv(e,`ulg-mls-mpm-summary-source-sph-state`,t.state),g=m||wv(e,`ulg-mls-mpm-summary-source-mechanics`,n.mechanics),_=vv*Float32Array.BYTES_PER_ELEMENT,v=l*_,y=e.createBuffer({label:`ulg-mls-mpm-resident-summary-partials`,size:Math.max(4,v),usage:yv.STORAGE}),b=e.createBuffer({label:`ulg-mls-mpm-resident-summary-out`,size:_,usage:yv.STORAGE|yv.COPY_SRC}),x=e.createBuffer({label:`ulg-mls-mpm-resident-summary-readback`,size:_,usage:yv.MAP_READ|yv.COPY_DST}),S=e.createBuffer({label:`ulg-mls-mpm-resident-summary-params`,size:16,usage:yv.UNIFORM|yv.COPY_DST});try{e.queue.writeBuffer(S,0,Tv({particleCount:s,gridNodeCount:c,partialCount:l}));let{pipeline:t,bindGroupLayout:n}=af(e,{label:`ulg-mls-mpm-resident-summary-partials`,module:e.createShaderModule({code:zd}),entryPoint:`main`,bindings:[$(0,`read-only-storage`),$(1,`read-only-storage`),$(2,`read-only-storage`),$(3,`read-only-storage`),$(4,`read-only-storage`),$(5,`storage`),$(6,`uniform`)]}),r=e.createBindGroup({layout:n,entries:[{binding:0,resource:{buffer:h}},{binding:1,resource:{buffer:u}},{binding:2,resource:{buffer:g}},{binding:3,resource:{buffer:d}},{binding:4,resource:{buffer:f}},{binding:5,resource:{buffer:y}},{binding:6,resource:{buffer:S}}]}),{pipeline:i,bindGroupLayout:a}=af(e,{label:`ulg-mls-mpm-resident-summary-finalize`,module:e.createShaderModule({code:Bd}),entryPoint:`main`,bindings:[$(0,`read-only-storage`),$(1,`storage`),$(2,`uniform`)]}),o=e.createBindGroup({layout:a,entries:[{binding:0,resource:{buffer:y}},{binding:1,resource:{buffer:b}},{binding:2,resource:{buffer:S}}]}),C=e.createCommandEncoder(),w=C.beginComputePass();w.setPipeline(t),w.setBindGroup(0,r),w.dispatchWorkgroups(l),w.end();let T=C.beginComputePass();T.setPipeline(i),T.setBindGroup(0,o),T.dispatchWorkgroups(1),T.end(),C.copyBufferToBuffer(b,0,x,0,_),e.queue.submit([C.finish()]),await x.mapAsync(bv.READ);let E=new Float32Array(x.getMappedRange()).slice(0,vv);return x.unmap(),{...Av(E,{particleCount:s,gridNodeCount:c,readbackMode:`compact-summary-readback`,reductionStrategy:`two-pass-workgroup-reduction`}),compactReadbackFloatCount:vv,compactReadbackByteLength:_,compactPartialSummaryCount:l,compactPartialSummaryByteLength:v,compactReductionWorkgroupSize:Sv,sourceStateBufferMode:p?`borrowed-webgpu-upload`:`temporary-source-upload`,sourceMechanicsBufferMode:m?`borrowed-webgpu-upload`:`temporary-source-upload`,sourceStateStrideFloats:Kh,sourceMechanicsStrideFloats:Jh}}finally{p||h.destroy?.(),m||g.destroy?.(),y.destroy?.(),b.destroy?.(),x.destroy?.(),S.destroy?.()}}zu.length,Vu.length,Hu.length,Ru.length,globalThis.GPUBufferUsage?.MAP_READ,globalThis.GPUBufferUsage?.COPY_SRC,globalThis.GPUBufferUsage?.COPY_DST,globalThis.GPUBufferUsage?.STORAGE,globalThis.GPUBufferUsage?.UNIFORM,globalThis.GPUMapMode?.READ;var Mv=Qu.length,Nv=$u.length,Pv=ed.length,Fv=td.length,Iv=Object.freeze({specificInternalEnergyJPerKg:0,temperatureK:1,dTemperatureKdSpecificInternalEnergyJPerKg:2}),Lv=Object.freeze({dominantAtHalf:1}),Rv=Object.freeze({dominantAtHalf:1}),zv=`sph-thermal-closure-table-conduction-walls`,Bv=Object.freeze({phase:1,plateau:2}),Vv=Object.freeze({ready:1,missingMaterial:255}),Hv=[`xMin`,`xMax`,`yMin`,`yMax`,`zMin`,`zMax`],Uv=`full-parity-readback`,Wv=`no-full-readback`,Gv={MAP_READ:globalThis.GPUBufferUsage?.MAP_READ??1,COPY_SRC:globalThis.GPUBufferUsage?.COPY_SRC??4,COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64},Kv={READ:globalThis.GPUMapMode?.READ??1};function qv(e,t=0){let n=Number(e);return Number.isFinite(n)?n:t}function Jv(e,t){let n=Array.isArray(e)?e:t;return[qv(n?.[0],t[0]),qv(n?.[1],t[1]),qv(n?.[2],t[2])]}function Yv(e){if(e?.schema!==`peercompute.ulg.sph-gpu-particle-buffer.v0`)throw TypeError(`SPH thermal GPU step requires a packed SPH GPU particle buffer`)}function Xv(e){if(e?.schema!==`peercompute.ulg.sph-gpu-thermal-material-table.v0`)throw TypeError(`Expected a packed SPH thermal material table`)}function Zv(e,t){let n=e?.phases?.find(e=>e.name===t),r=e?.phases?.find(e=>e.densityKgPerM3>0);return qv(n?.densityKgPerM3??r?.densityKgPerM3,0)}function Qv(e){return e.type===`phase`?e.phase:e.to}function $v(e){return Object.entries(e||{}).filter(([,e])=>e?.phases?.length).sort(([e],[t])=>String(e).localeCompare(String(t)))}function ey(e={}){let t=[],n=[],r=[];for(let[i,a]of $v(e)){let e=ah(i),o=Hh(a),s=n.length/Nv;for(let t of o)if(t.type===`phase`){let r=eh(t.phase);n.push(e,Bv.phase,r,r,qv(t.eStart),qv(t.eEnd),qv(t.tLo),qv(t.tHi),Zv(a,t.phase),Zv(a,t.phase),Vv.ready,0)}else n.push(e,Bv.plateau,eh(t.from),eh(t.to),qv(t.eStart),qv(t.eEnd),qv(t.temperatureK),qv(t.temperatureK),Zv(a,t.from),Zv(a,t.to),Vv.ready,0);t.push(e,s,o.length,Vv.ready),r.push({material:i,materialId:e,segmentOffset:s,segmentCount:o.length,phaseNames:[...new Set(o.map(Qv))]})}return{schema:uu,status:`closure-derived-thermal-table-ready`,materialCount:t.length/Mv,segmentCount:n.length/Nv,recordLayout:[...Qu],segmentLayout:[...$u],recordStrideFloats:Mv,segmentStrideFloats:Nv,records:new Float32Array(t),segments:new Float32Array(n),metadata:r,scientificValidation:!1,materialValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function ty(e){let t=new Map;for(let n of e.metadata||[])t.set(n.materialId,n),t.set(new Float32Array([n.materialId])[0],n);return t}function ny(e){return Math.round(e)===Bv.plateau?`plateau`:`phase`}function ry({segment:e,segmentIndex:t,materialMetadata:n}){let r=qv(e.energyStartJPerKg),i=qv(e.energyEndJPerKg);if(!(i>r))return null;let a=qv(e.temperatureStartK),o=qv(e.temperatureEndK),s=(o-a)/(i-r),c=n?.material||`material-${Math.round(e.materialId)}`;return{...Ed({graphId:`sph-thermal:${c}:${Math.round(e.materialId)}:segment-${t}:temperature-vs-energy`,nodes:[{op:`tableLinear`,inputSlot:Iv.specificInternalEnergyJPerKg,outputSlot:Iv.temperatureK,derivativeSlot:Iv.dTemperatureKdSpecificInternalEnergyJPerKg,sampleOffset:0,sampleCount:2,domainMin:r,domainMax:i,interpolation:`linear`,statusFlagId:0,provenanceIndex:t,materialId:e.materialId,phaseId:e.phaseFromId}],edges:[],samples:[{axis:r,value:a,derivative:s},{axis:i,value:o,derivative:s}],slotCount:3,initialSlots:{0:r},statusCount:1,strategy:`sph-thermal-segment-flat-closure-law-graph`}),sourceSchema:uu,sourceSegmentIndex:t,sourceSegmentType:ny(e.segmentType),sourceMaterial:c,sourceMaterialId:e.materialId,sourcePhaseFromId:e.phaseFromId,sourcePhaseToId:e.phaseToId,axisName:`specificInternalEnergyJPerKg`,outputName:`temperatureK`,outputSlots:{...Iv},derivativeName:`dTemperatureKdSpecificInternalEnergyJPerKg`,compilerBackend:`cpu-reference`,compilerStatus:`cpu-validated-sph-thermal-segment-closure-law-graph`,materialValidation:!1,sphValidation:!1,phaseChangeValidation:!1}}function iy({graphs:e=[],metadata:t=[]}={}){let n=[],r=[],i=[],a=[],o=[],s=[],c=0,l=0,u=0,d=0,f=0;return e.forEach((e,p)=>{let m=new Float32Array(e.nodeRows);for(let t=0;t<e.nodeCount;t+=1){let n=t*e.nodeStrideFloats;m[n+4]+=u,m[n+8]+=l,m[n+11]+=f}n.push(...m),r.push(...e.edgeRows||new Float32Array),i.push(...e.sampleRows),a.push(...e.slotRows),o.push(...e.statusRows),s.push({graphIndex:p,graphId:e.graphId,nodeOffset:c,nodeCount:e.nodeCount,edgeOffset:l,edgeCount:e.edgeCount,sampleOffset:u,sampleCount:e.sampleCount,slotOffset:d,slotCount:e.slotCount,statusOffset:f,statusCount:e.statusCount,sourceSegmentIndex:t[p]?.segmentIndex??e.sourceSegmentIndex??p,materialId:t[p]?.materialId??e.sourceMaterialId??0,phaseFromId:t[p]?.phaseFromId??e.sourcePhaseFromId??0,phaseToId:t[p]?.phaseToId??e.sourcePhaseToId??0}),c+=e.nodeCount,l+=e.edgeCount,u+=e.sampleCount,d+=e.slotCount,f+=e.statusCount}),{schema:fu,status:`packed-thermal-temperature-closure-graph-bank-ready`,graphSchema:ru,graphCount:e.length,nodeCount:c,edgeCount:l,sampleCount:u,slotCount:d,statusCount:f,nodeRows:new Float32Array(n),edgeRows:new Float32Array(r),sampleRows:new Float32Array(i),slotRows:new Float32Array(a),statusRows:new Float32Array(o),graphRecords:s,scientificValidation:!1,materialValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function ay(e){if(e?.schema!==`peercompute.ulg.sph-gpu-thermal-closure-graph-set.v0`)throw TypeError(`buildSphThermalClosureGraphBank requires an SPH thermal closure graph set`);return iy({graphs:e.graphs,metadata:e.metadata})}function oy(e={}){let t=e?.schema===`peercompute.ulg.sph-gpu-thermal-material-table.v0`?e:ey(e);Xv(t);let n=ty(t),r=[],i=[],a=[];for(let e=0;e<t.segmentCount;e+=1){let o=sy(t,e),s=n.get(o.materialId)||null,c=ry({segment:o,segmentIndex:e,materialMetadata:s});if(!c){a.push({segmentIndex:e,material:s?.material||null,materialId:o.materialId,segmentType:ny(o.segmentType),reason:`non-positive-energy-domain`});continue}let l=r.length;r.push(c),i.push({graphIndex:l,graphId:c.graphId,material:s?.material||null,materialId:o.materialId,segmentIndex:e,segmentType:ny(o.segmentType),phaseFromId:o.phaseFromId,phaseToId:o.phaseToId,energyStartJPerKg:o.energyStartJPerKg,energyEndJPerKg:o.energyEndJPerKg,temperatureStartK:o.temperatureStartK,temperatureEndK:o.temperatureEndK,derivativeKdPerJPerKg:(o.temperatureEndK-o.temperatureStartK)/(o.energyEndJPerKg-o.energyStartJPerKg),graphSchema:c.schema,graphStatus:c.status})}let o=iy({graphs:r,metadata:i});return{schema:du,status:a.length?`thermal-segment-closure-law-graphs-ready-with-skipped-segments`:`thermal-segment-closure-law-graphs-ready`,sourceSchema:t.schema,graphSchema:ru,graphBankSchema:fu,axisName:`specificInternalEnergyJPerKg`,outputName:`temperatureK`,outputSlots:{...Iv},derivativeName:`dTemperatureKdSpecificInternalEnergyJPerKg`,materialCount:t.materialCount,segmentCount:t.segmentCount,graphCount:r.length,skippedSegmentCount:a.length,graphBank:o,graphs:r,metadata:i,skippedSegments:a,scientificValidation:!1,materialValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function sy(e,t){let n=t*Nv;return{materialId:e.segments[n],segmentType:e.segments[n+1],phaseFromId:e.segments[n+2],phaseToId:e.segments[n+3],energyStartJPerKg:e.segments[n+4],energyEndJPerKg:e.segments[n+5],temperatureStartK:e.segments[n+6],temperatureEndK:e.segments[n+7],densityFromKgPerM3:e.segments[n+8],densityToKgPerM3:e.segments[n+9],status:e.segments[n+10]}}function cy(e){let t=new Map;for(let n of e?.metadata||[])t.set(n.segmentIndex,n.graphIndex);return t}function ly(e={},t=null){let n=e?.schema===`peercompute.ulg.sph-gpu-thermal-material-table.v0`?e:ey(e);Xv(n);let r=t||oy(n);if(r?.schema!==`peercompute.ulg.sph-gpu-thermal-closure-graph-set.v0`)throw TypeError(`buildSphThermalPhaseResponseTable requires an SPH thermal closure graph set`);let i=cy(r),a=[],o=[],s=[];for(let e=0;e<n.materialCount;e+=1){let t=e*Mv,r=n.records[t],c=n.records[t+1],l=n.records[t+2],u=o.length/Fv;for(let e=0;e<l;e+=1){let t=c+e,r=sy(n,t),a=Math.round(r.segmentType)===Bv.plateau,s=i.get(t)??-1;o.push(r.materialId,r.segmentType,s,s>=0?Vv.ready:Vv.missingMaterial,r.energyStartJPerKg,r.energyEndJPerKg,r.phaseFromId,r.phaseToId,r.densityFromKgPerM3,r.densityToKgPerM3,Lv.dominantAtHalf,Rv.dominantAtHalf,a?-1:0,1,+!!a,0)}a.push(r,u,l,Vv.ready),s.push({materialId:r,responseOffset:u,responseCount:l})}return{schema:pu,status:`closure-derived-phase-response-table-ready`,sourceSchema:n.schema,graphSetSchema:r.schema,graphBankSchema:r.graphBank?.schema??`peercompute.ulg.sph-gpu-thermal-closure-graph-bank.v0`,materialCount:n.materialCount,responseCount:o.length/Fv,recordLayout:[...ed],responseLayout:[...td],recordStrideFloats:Pv,responseStrideFloats:Fv,records:new Float32Array(a),responses:new Float32Array(o),metadata:s,scientificValidation:!1,materialValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function uy(e,t){return qv(e?.[t],0)}function dy({backend:e,sphParticleState:t,thermalMaterialTable:n,thermalClosureGraphSet:r=null,thermalClosureGraphBank:i=null,thermalPhaseResponseTable:a=null,state:o,thermo:s,wallHeatJ:c,dtS:l,conductionRate:u,wallRate:d,wallLayerM:f,boxDimsM:p,stateBuffer:m=null,thermoBuffer:h=null,stateBufferByteLength:g=o.byteLength,thermoBufferByteLength:_=s.byteLength,retainedOutputParticleBuffers:v=!1,destroyOutputParticleBuffers:y=null,readbackMode:b=Uv}){return{schema:mu,backend:e,status:`thermal-step-executed`,kernelScope:zv,sourceSchema:t.schema,materialTableSchema:n.schema,thermalClosureGraphSetSchema:r?.schema??null,thermalClosureGraphBankSchema:i?.schema??null,thermalPhaseResponseTableSchema:a?.schema??null,particleCount:t.particleCount,materialCount:n.materialCount,segmentCount:n.segmentCount,responseCount:a?.responseCount??null,thermalGraphCount:i?.graphCount??r?.graphCount??null,sourceStep:t.step??0,step:(t.step??0)+1,sourceTime:t.time??0,time:qv(t.time,0)+l,dtS:l,conductionRate:u,wallRate:d,wallLayerM:f,boxDimsM:[...p],stateLayout:[...Xu],thermoLayout:[...Zu],stateStrideFloats:Kh,thermoStrideFloats:qh,state:o,thermo:s,stateBuffer:m,thermoBuffer:h,stateBufferByteLength:g,thermoBufferByteLength:_,retainedOutputParticleBuffers:v,destroyOutputParticleBuffers:y,readbackMode:b,fullReadbackPerformed:b!==Wv,normalHotLoopReadbackFree:b===Wv,wallHeatJ:{...c},scientificValidation:!1,materialValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function fy(e,t,n,r=0){let i=Math.max(4,n.byteLength),a=e.createBuffer({label:t,size:i,usage:Gv.STORAGE|Gv.COPY_DST|r});return n.byteLength>0&&e.queue.writeBuffer(a,0,n),a}function py({particleCount:e,materialCount:t,segmentCount:n,dtS:r,smoothingLengthM:i,conductionRate:a,wallRate:o,wallLayerM:s,boxDimsM:c,wallTemperaturesK:l}){let u=new ArrayBuffer(80),d=new DataView(u);return d.setUint32(0,e,!0),d.setUint32(4,t,!0),d.setUint32(8,n,!0),d.setUint32(12,0,!0),d.setFloat32(16,r,!0),d.setFloat32(20,i,!0),d.setFloat32(24,a,!0),d.setFloat32(28,o,!0),d.setFloat32(32,s,!0),d.setFloat32(36,c[0],!0),d.setFloat32(40,c[1],!0),d.setFloat32(44,c[2],!0),d.setFloat32(48,uy(l,`xMin`),!0),d.setFloat32(52,uy(l,`xMax`),!0),d.setFloat32(56,uy(l,`yMin`),!0),d.setFloat32(60,uy(l,`yMax`),!0),d.setFloat32(64,uy(l,`zMin`),!0),d.setFloat32(68,uy(l,`zMax`),!0),d.setFloat32(72,0,!0),d.setFloat32(76,0,!0),u}async function my(e,t,n){let r=e.createBuffer({label:`ulg-sph-thermal-readback`,size:Math.max(4,n),usage:Gv.MAP_READ|Gv.COPY_DST}),i=e.createCommandEncoder();i.copyBufferToBuffer(t,0,r,0,n),e.queue.submit([i.finish()]),await r.mapAsync(Kv.READ);let a=r.getMappedRange().slice(0);return r.unmap(),r.destroy?.(),a}async function hy({device:e,sphParticleState:t,thermalMaterialTable:n,thermalClosureGraphSet:r=null,thermalClosureGraphBank:i=null,thermalPhaseResponseTable:a=null,sphParticleUpload:o=null,sourceStateBuffer:s=null,sourceThermoBuffer:c=null,wallTemperaturesK:l={},boxDimsM:u=[5,5,5],dtS:d=0,conductionRate:f=15e3,wallRate:p=6e4,wallLayerM:m=t?.smoothingLengthM,retainOutputParticleBuffers:h=!1,readbackMode:g=Uv}={}){if(Yv(t),!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`runSphThermalStepWebGpu requires a WebGPU-like device`);let _=Jv(u,[5,5,5]),v=qv(m,t.smoothingLengthM),y=g===Wv,b=s||o?.stateBuffer||null,x=c||o?.thermoBuffer||null,S=b||fy(e,`ulg-sph-thermal-source-state`,t.state),C=x||fy(e,`ulg-sph-thermal-source-thermo`,t.thermo),w=r||oy(n),T=i||w.graphBank||ay(w),E=a||ly(n,w),D=fy(e,`ulg-sph-thermal-phase-response-records`,E.records),O=fy(e,`ulg-sph-thermal-phase-responses`,E.responses),k=fy(e,`ulg-sph-thermal-graph-nodes`,T.nodeRows),A=fy(e,`ulg-sph-thermal-graph-samples`,T.sampleRows),j=fy(e,`ulg-sph-thermal-output-state`,new Float32Array(t.state.length),Gv.COPY_SRC),M=fy(e,`ulg-sph-thermal-output-thermo`,new Float32Array(t.thermo.length),Gv.COPY_SRC),N=e.createBuffer({label:`ulg-sph-thermal-params`,size:80,usage:Gv.UNIFORM|Gv.COPY_DST});e.queue.writeBuffer(N,0,py({particleCount:t.particleCount,materialCount:E.materialCount,segmentCount:E.responseCount,dtS:qv(d,0),smoothingLengthM:qv(t.smoothingLengthM,0),conductionRate:f,wallRate:p,wallLayerM:v,boxDimsM:_,wallTemperaturesK:l}));let{pipeline:P,bindGroupLayout:F}=af(e,{label:`ulg-sph-thermal-step`,module:e.createShaderModule({label:`ulg-sph-thermal-step`,code:jd}),entryPoint:`main`,bindings:[$(0,`read-only-storage`),$(1,`read-only-storage`),$(2,`read-only-storage`),$(3,`read-only-storage`),$(4,`read-only-storage`),$(5,`read-only-storage`),$(6,`storage`),$(7,`storage`),$(8,`uniform`)]}),I=e.createBindGroup({layout:F,entries:[{binding:0,resource:{buffer:S}},{binding:1,resource:{buffer:C}},{binding:2,resource:{buffer:D}},{binding:3,resource:{buffer:O}},{binding:4,resource:{buffer:k}},{binding:5,resource:{buffer:A}},{binding:6,resource:{buffer:j}},{binding:7,resource:{buffer:M}},{binding:8,resource:{buffer:N}}]}),ee=e.createCommandEncoder(),L=ee.beginComputePass();L.setPipeline(P),L.setBindGroup(0,I),L.dispatchWorkgroups(Math.ceil(t.particleCount/64)),L.end(),e.queue.submit([ee.finish()]);let te=new Float32Array,R=new Float32Array;if(y)e.queue?.onSubmittedWorkDone&&await e.queue.onSubmittedWorkDone();else{let[n,r]=await Promise.all([my(e,j,t.state.byteLength),my(e,M,t.thermo.byteLength)]);te=new Float32Array(n),R=new Float32Array(r)}b||S.destroy?.(),x||C.destroy?.();for(let e of[D,O,k,A,N])e.destroy?.();return h||(j.destroy?.(),M.destroy?.()),dy({backend:`webgpu`,sphParticleState:t,thermalMaterialTable:n,thermalClosureGraphSet:w,thermalClosureGraphBank:T,thermalPhaseResponseTable:E,state:te,thermo:R,wallHeatJ:Object.fromEntries(Hv.map(e=>[e,null])),dtS:qv(d,0),conductionRate:f,wallRate:p,wallLayerM:v,boxDimsM:_,stateBuffer:h?j:null,thermoBuffer:h?M:null,stateBufferByteLength:t.state.byteLength,thermoBufferByteLength:t.thermo.byteLength,retainedOutputParticleBuffers:h,destroyOutputParticleBuffers:h?()=>{j.destroy?.(),M.destroy?.()}:null,readbackMode:y?Wv:Uv})}var gy=nd.length,_y=rd.length,vy=`sph-reaction-mutual-contact-derived-network`,yy=Object.freeze({ready:1,missingProductMaterial:255,invalidReaction:254}),by=Object.freeze({ready:1,missingPhase:255}),xy=`full-parity-readback`,Sy=`no-full-readback`,Cy=8.314462618,wy=1,Ty=40,Ey=Object.freeze({disabled:0,taitCondensed:1,gasLinearized:2}),Dy={MAP_READ:globalThis.GPUBufferUsage?.MAP_READ??1,COPY_SRC:globalThis.GPUBufferUsage?.COPY_SRC??4,COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64},Oy={READ:globalThis.GPUMapMode?.READ??1};function ky(e,t=0){let n=Number(e);return Number.isFinite(n)?n:t}function Ay(e){if(e?.schema!==`peercompute.ulg.sph-gpu-particle-buffer.v0`)throw TypeError(`SPH reaction GPU step requires a packed SPH GPU particle buffer`)}function jy(e){if(e?.schema!==`peercompute.ulg.mls-mpm-gpu-particle-buffer.v0`)throw TypeError(`SPH reaction GPU step requires a packed MLS-MPM GPU particle buffer`)}function My({sphParticleState:e,mlsMpmParticleState:t,reactionTable:n,thermalMaterialTable:r}){if(Ay(e),jy(t),e.particleCount!==t.particleCount)throw RangeError(`SPH reaction step requires matching SPH and MLS-MPM particle counts`);if(n?.schema!==`peercompute.ulg.sph-gpu-reaction-table.v0`)throw TypeError(`SPH reaction step requires a packed reaction table`);if(r?.schema!==`peercompute.ulg.sph-gpu-thermal-material-table.v0`)throw TypeError(`SPH reaction step requires a packed thermal material table`)}function Ny(e,t){return!t||!e?null:t[e]??t[String(e).toLowerCase()]??t[String(e).toUpperCase()]??null}function Py(e){return!e||e.length===0?0:e.reduce((e,t)=>{let n=eh(t);return n>0?e|1<<n:e},0)}function Fy(e){if(Number.isFinite(e?.temperatureK))return e.temperatureK;if(Array.isArray(e?.temperatureRange)&&e.temperatureRange.length>=2){let t=ky(e.temperatureRange[0],293.15);return(t+ky(e.temperatureRange[1],t))/2}return 293.15}function Iy(e,t,{soundSpeedScale:n=wy,minGasSoundSpeedMPerS:r=Ty}={}){let i=ky(e?.molarMassKgPerMol,0);if(!(i>0))return 0;let a=Cy/i,o=ky(t?.cpJPerKgK,0),s=o>a?o/(o-a):1.33;return Math.max(Math.sqrt(Math.max(s*a*Fy(t),0))*n,r)}function Ly(e,t,n,r){let i=ah(e),a=eh(n?.name),o=ky(n?.densityKgPerM3,0),s=ky(n?.bulkModulusPa,0),c=n?.name===`solid`?ky(n?.shearModulusPa,0):0,l=ky(r.soundSpeedScale,wy),u=l*l,d=s*u,f=c*u,p=n?.name===`solid`?Math.max((s-2/3*c)*u,0):0,m=n?.name===`gas`;return[i,a,o,d,f,p,m?Iy(t,n,r):o>0&&d>0?Math.sqrt(d/o):0,m?Ey.gasLinearized:d>0?Ey.taitCondensed:Ey.disabled,+(n?.name===`solid`&&f>0),by.ready,0,0]}function Ry({product:e,materialProperties:t,productPhaseKeys:n,productPhaseRecords:r,metadata:i,options:a}){if(n.has(e))return;n.add(e);let o=Ny(e,t);if(!o?.phases?.length){i.push({material:e,materialId:ah(e),status:by.missingPhase,phaseCount:0});return}let s=[];for(let t of o.phases)r.push(...Ly(e,o,t,a)),s.push(t.name);i.push({material:e,materialId:ah(e),status:by.ready,phaseCount:o.phases.length,phaseNames:s})}function zy(e=[],{materialProperties:t={},contactRadiusM:n=0,soundSpeedScale:r=wy,minGasSoundSpeedMPerS:i=Ty}={}){let a=[],o=[],s=[],c=[],l=new Set,u={soundSpeedScale:r,minGasSoundSpeedMPerS:i};for(let r of e||[]){let e=r?.a,i=r?.b,d=r?.product,f=ah(e),p=ah(i),m=ah(d),h=Ny(d,t),g=ky(r?.activationTemperatureK,0),_=ky(r?.specificEnthalpyJPerKg,0),v=ky(r?.contactRadiusM??n,0),y=e&&i&&d&&v>0&&h?.phases?.length?yy.ready:h?.phases?.length?yy.invalidReaction:yy.missingProductMaterial,b=Py(r?.phaseRequirements?.[e]),x=Py(r?.phaseRequirements?.[i]);a.push(f,p,m,g,_,v,b,x,y,0,0,0),o.push({a:e,b:i,product:d,aMaterialId:f,bMaterialId:p,productMaterialId:m,activationTemperatureK:g,specificEnthalpyJPerKg:_,contactRadiusM:v,phaseMaskA:b,phaseMaskB:x,status:y,energyModel:r?.energyModel??null,activationModel:r?.activationModel??null}),Ry({product:d,materialProperties:t,productPhaseKeys:l,productPhaseRecords:s,metadata:c,options:u})}return{schema:hu,status:a.length?`derived-reaction-table-ready`:`no-derived-reactions`,reactionCount:a.length/gy,productPhaseCount:s.length/_y,combinedRecordCount:(a.length+s.length)/gy,recordLayout:[...nd],productPhaseLayout:[...rd],recordStrideFloats:gy,productPhaseStrideFloats:_y,records:new Float32Array(a),productPhaseRecords:new Float32Array(s),combinedRecords:new Float32Array([...a,...s]),metadata:o,productPhaseMetadata:c,scientificValidation:!1,materialValidation:!1,chemistryValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function By({backend:e,sphParticleState:t,mlsMpmParticleState:n,reactionTable:r,thermalMaterialTable:i,state:a,thermo:o,mechanics:s,proposals:c,eventCount:l,conversionCount:u,stateBuffer:d=null,thermoBuffer:f=null,mechanicsBuffer:p=null,stateBufferByteLength:m=a.byteLength,thermoBufferByteLength:h=o.byteLength,mechanicsBufferByteLength:g=s.byteLength,retainedOutputParticleBuffers:_=!1,destroyOutputParticleBuffers:v=null,readbackMode:y=xy}){return{schema:gu,backend:e,status:`reaction-step-executed`,kernelScope:vy,sourceSchema:t.schema,sourceMechanicsSchema:n.schema,reactionTableSchema:r.schema,thermalMaterialTableSchema:i.schema,particleCount:t.particleCount,reactionCount:r.reactionCount,productPhaseCount:r.productPhaseCount,materialCount:i.materialCount,segmentCount:i.segmentCount,sourceStep:t.step??0,step:(t.step??0)+1,sourceTime:t.time??0,time:t.time??0,stateLayout:[...Xu],thermoLayout:[...Zu],mechanicsLayout:[...sd],reactionRecordLayout:[...nd],productPhaseLayout:[...rd],stateStrideFloats:Kh,thermoStrideFloats:qh,mechanicsStrideFloats:Jh,state:a,thermo:o,mechanics:s,proposals:c,eventCount:l,conversionCount:u,stateBuffer:d,thermoBuffer:f,mechanicsBuffer:p,stateBufferByteLength:m,thermoBufferByteLength:h,mechanicsBufferByteLength:g,retainedOutputParticleBuffers:_,destroyOutputParticleBuffers:v,readbackMode:y,fullReadbackPerformed:y!==Sy,normalHotLoopReadbackFree:y===Sy,scientificValidation:!1,materialValidation:!1,chemistryValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function Vy(e,t,n,r=0){let i=Math.max(4,n.byteLength),a=e.createBuffer({label:t,size:i,usage:Dy.STORAGE|Dy.COPY_DST|r});return n.byteLength>0&&e.queue.writeBuffer(a,0,n),a}function Hy({particleCount:e,reactionCount:t,productPhaseCount:n,materialCount:r,segmentCount:i,resetMechanics:a}){let o=new ArrayBuffer(32),s=new DataView(o);return s.setUint32(0,e,!0),s.setUint32(4,t,!0),s.setUint32(8,n,!0),s.setUint32(12,r,!0),s.setUint32(16,i,!0),s.setUint32(20,+!!a,!0),s.setUint32(24,0,!0),s.setUint32(28,0,!0),o}async function Uy(e,t,n,r){let i=e.createBuffer({label:r,size:Math.max(4,n),usage:Dy.MAP_READ|Dy.COPY_DST}),a=e.createCommandEncoder();a.copyBufferToBuffer(t,0,i,0,n),e.queue.submit([a.finish()]),await i.mapAsync(Oy.READ);let o=i.getMappedRange().slice(0);return i.unmap(),i.destroy?.(),o}async function Wy({device:e,sphParticleState:t,mlsMpmParticleState:n,reactionTable:r,thermalMaterialTable:i,sphParticleUpload:a=null,mlsMpmParticleUpload:o=null,sourceStateBuffer:s=null,sourceThermoBuffer:c=null,sourceMechanicsBuffer:l=null,retainOutputParticleBuffers:u=!1,resetMechanics:d=!0,readbackMode:f=xy}={}){if(My({sphParticleState:t,mlsMpmParticleState:n,reactionTable:r,thermalMaterialTable:i}),!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`runSphReactionStepWebGpu requires a WebGPU-like device`);let p=f===Sy,m=s||a?.stateBuffer||null,h=c||a?.thermoBuffer||null,g=l||o?.mechanicsBuffer||null,_=m||Vy(e,`ulg-sph-reaction-source-state`,t.state),v=h||Vy(e,`ulg-sph-reaction-source-thermo`,t.thermo),y=g||Vy(e,`ulg-sph-reaction-source-mechanics`,n.mechanics),b=Vy(e,`ulg-sph-reaction-records-and-product-phases`,r.combinedRecords||new Float32Array([...r.records,...r.productPhaseRecords])),x=Vy(e,`ulg-sph-reaction-thermal-records`,i.records),S=Vy(e,`ulg-sph-reaction-thermal-segments`,i.segments),C=Vy(e,`ulg-sph-reaction-proposals`,new Float32Array(t.particleCount*4),Dy.COPY_SRC),w=Vy(e,`ulg-sph-reaction-output-state`,new Float32Array(t.state.length),Dy.COPY_SRC),T=Vy(e,`ulg-sph-reaction-output-thermo`,new Float32Array(t.thermo.length),Dy.COPY_SRC),E=Vy(e,`ulg-sph-reaction-output-mechanics`,new Float32Array(n.mechanics.length),Dy.COPY_SRC),D=e.createBuffer({label:`ulg-sph-reaction-params`,size:32,usage:Dy.UNIFORM|Dy.COPY_DST});e.queue.writeBuffer(D,0,Hy({particleCount:t.particleCount,reactionCount:r.reactionCount,productPhaseCount:r.productPhaseCount,materialCount:i.materialCount,segmentCount:i.segmentCount,resetMechanics:d}));let O=e.createShaderModule({label:`ulg-sph-reaction-step`,code:Md}),k=[$(0,`read-only-storage`),$(1,`read-only-storage`),$(3,`read-only-storage`),$(7,`storage`),$(11,`uniform`)],A=[$(0,`read-only-storage`),$(1,`read-only-storage`),$(2,`read-only-storage`),$(3,`read-only-storage`),$(5,`read-only-storage`),$(6,`read-only-storage`),$(7,`storage`),$(8,`storage`),$(9,`storage`),$(10,`storage`),$(11,`uniform`)],{pipeline:j,bindGroupLayout:M}=af(e,{label:`ulg-sph-reaction-propose`,module:O,entryPoint:`propose`,bindings:k}),{pipeline:N,bindGroupLayout:P}=af(e,{label:`ulg-sph-reaction-resolve`,module:O,entryPoint:`resolve`,bindings:A}),F=e=>({layout:e,entries:[{binding:0,resource:{buffer:_}},{binding:1,resource:{buffer:v}},{binding:3,resource:{buffer:b}},{binding:7,resource:{buffer:C}},{binding:11,resource:{buffer:D}}]}),I=e=>({layout:e,entries:[{binding:0,resource:{buffer:_}},{binding:1,resource:{buffer:v}},{binding:2,resource:{buffer:y}},{binding:3,resource:{buffer:b}},{binding:5,resource:{buffer:x}},{binding:6,resource:{buffer:S}},{binding:7,resource:{buffer:C}},{binding:8,resource:{buffer:w}},{binding:9,resource:{buffer:T}},{binding:10,resource:{buffer:E}},{binding:11,resource:{buffer:D}}]}),ee=e.createBindGroup(F(M)),L=e.createBindGroup(I(P)),te=e.createCommandEncoder(),R=te.beginComputePass();R.setPipeline(j),R.setBindGroup(0,ee),R.dispatchWorkgroups(Math.ceil(t.particleCount/64)),R.setPipeline(N),R.setBindGroup(0,L),R.dispatchWorkgroups(Math.ceil(t.particleCount/64)),R.end(),e.queue.submit([te.finish()]);let z=new Float32Array,ne=new Float32Array,re=new Float32Array,ie=new Float32Array;if(p)e.queue?.onSubmittedWorkDone&&await e.queue.onSubmittedWorkDone();else{let[r,i,a,o]=await Promise.all([Uy(e,w,t.state.byteLength,`ulg-sph-reaction-state-readback`),Uy(e,T,t.thermo.byteLength,`ulg-sph-reaction-thermo-readback`),Uy(e,E,n.mechanics.byteLength,`ulg-sph-reaction-mechanics-readback`),Uy(e,C,t.particleCount*4*Float32Array.BYTES_PER_ELEMENT,`ulg-sph-reaction-proposal-readback`)]);z=new Float32Array(r),ne=new Float32Array(i),re=new Float32Array(a),ie=new Float32Array(o)}m||_.destroy?.(),h||v.destroy?.(),g||y.destroy?.();for(let e of[b,x,S,C,D])e.destroy?.();return u||(w.destroy?.(),T.destroy?.(),E.destroy?.()),By({backend:`webgpu`,sphParticleState:t,mlsMpmParticleState:n,reactionTable:r,thermalMaterialTable:i,state:z,thermo:ne,mechanics:re,proposals:ie,eventCount:null,conversionCount:null,stateBuffer:u?w:null,thermoBuffer:u?T:null,mechanicsBuffer:u?E:null,stateBufferByteLength:t.state.byteLength,thermoBufferByteLength:t.thermo.byteLength,mechanicsBufferByteLength:n.mechanics.byteLength,retainedOutputParticleBuffers:u,destroyOutputParticleBuffers:u?()=>{w.destroy?.(),T.destroy?.(),E.destroy?.()}:null,readbackMode:p?Sy:xy})}var Gy=`mls-mpm-resident-step-p2g-grid-update-g2p`,Ky=Object.freeze([5,5,5]),qy=Object.freeze([0,-9.80665,0]),Jy=.6,Yy=`full-parity-readback`,Xy=`no-full-readback`;function Zy(e,t=0){let n=Number(e);return Number.isFinite(n)?n:t}function Qy(e,t){let n=Array.isArray(e)?e:t;return[Zy(n?.[0],t[0]),Zy(n?.[1],t[1]),Zy(n?.[2],t[2])]}function $y({sphParticleState:e,mlsMpmParticleState:t}){if(e?.schema!==`peercompute.ulg.sph-gpu-particle-buffer.v0`)throw TypeError(`MLS-MPM resident step requires a packed SPH GPU particle buffer`);if(t?.schema!==`peercompute.ulg.mls-mpm-gpu-particle-buffer.v0`)throw TypeError(`MLS-MPM resident step requires a packed MLS-MPM GPU particle buffer`);if(e.particleCount!==t.particleCount)throw RangeError(`SPH and MLS-MPM particle counts must match`)}function eb({sourceState:e,sourceMechanics:t,nextState:n,nextMechanics:r,particleCount:i}){let a=0,o=0,s=[0,0,0],c=[0,0,0],l=0,u=0,d=1/0,f=0;for(let p=0;p<i;p+=1){let i=p*Kh,m=p*Jh,h=e[i+3]??0,g=n?.[i+3]??h;a+=h,o+=g;for(let t=0;t<3;t+=1)s[t]+=h*(e[i+4+t]??0),c[t]+=g*(n?.[i+4+t]??0);let _=n?.[i+4]??0,v=n?.[i+5]??0,y=n?.[i+6]??0;l=Math.max(l,Math.hypot(_,v,y));let b=(n?.[i]??e[i])-e[i],x=(n?.[i+1]??e[i+1])-e[i+1],S=(n?.[i+2]??e[i+2])-e[i+2];u=Math.max(u,Math.hypot(b,x,S));let C=Zy(r?.[m+18]??t?.[m+18],1);d=Math.min(d,C),f=Math.max(f,C)}return{sourceMassKg:a,nextMassKg:o,massDeltaKg:o-a,sourceMomentumKgMPerS:s,nextMomentumKgMPerS:c,momentumDeltaKgMPerS:c.map((e,t)=>e-s[t]),maxSpeedMPerS:l,maxDisplacementM:u,minVolumeRatioJ:Number.isFinite(d)?d:0,maxVolumeRatioJ:f}}function tb(e){let t=e?.updatedGridNodes,n=e?.gridNodeStrideFloats??8;if(!(t instanceof Float32Array)||n<=0)return 0;let r=0;for(let e=0;e<t.length;e+=n)(t[e]??0)>0&&(r+=1);return r}function nb({sphParticleState:e,mlsMpmParticleState:t,p2gGridProjection:n,gridUpdate:r,g2pReconstruction:i,compactGpuSummary:a=null,readbackMode:o=Yy}={}){if($y({sphParticleState:e,mlsMpmParticleState:t}),a?.compactGpuSummaryAvailable)return{particleCount:a.particleCount,gridNodeCount:a.gridNodeCount,activeGridNodeCount:a.activeGridNodeCount,sourceMassKg:a.sourceMassKg,nextMassKg:a.nextMassKg,massDeltaKg:a.massDeltaKg,sourceMomentumKgMPerS:a.sourceMomentumKgMPerS,nextMomentumKgMPerS:a.nextMomentumKgMPerS,momentumDeltaKgMPerS:a.momentumDeltaKgMPerS,maxSpeedMPerS:a.maxSpeedMPerS,maxDisplacementM:a.maxDisplacementM,minVolumeRatioJ:a.minVolumeRatioJ,maxVolumeRatioJ:a.maxVolumeRatioJ,readbackMode:o,compactGpuSummaryAvailable:!0,compactGpuSummaryStatus:a.status,compactGpuSummaryReadbackMode:a.readbackMode,compactReadbackByteLength:a.compactReadbackByteLength??0,compactSummaryReductionStrategy:a.reductionStrategy??null,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1};if(o===Xy)return{particleCount:e.particleCount,gridNodeCount:r?.gridNodeCount??n?.gridNodeCount??0,activeGridNodeCount:null,sourceMassKg:null,nextMassKg:null,massDeltaKg:null,sourceMomentumKgMPerS:null,nextMomentumKgMPerS:null,momentumDeltaKgMPerS:null,maxSpeedMPerS:null,maxDisplacementM:null,minVolumeRatioJ:null,maxVolumeRatioJ:null,readbackMode:o,compactGpuSummaryAvailable:!1,compactGpuSummaryStatus:a?.status??`not-run`,compactGpuSummaryReason:a?.reason??null,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1};let s=eb({sourceState:e.state,sourceMechanics:t.mechanics,nextState:i?.state,nextMechanics:i?.mechanics,particleCount:e.particleCount});return{particleCount:e.particleCount,gridNodeCount:r?.gridNodeCount??n?.gridNodeCount??0,activeGridNodeCount:tb(r),...s,readbackMode:o,compactGpuSummaryAvailable:!1,compactGpuSummaryStatus:a?.status??`not-run`,compactGpuSummaryReason:a?.reason??null,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function rb(e){return e?.webgpuStatus?.status||e?.status||`missing`}function ib(e){let t=e.map(e=>e?.backend||`missing`);return t.every(e=>e===`webgpu`)?`webgpu`:t.every(e=>e===`cpu-reference`)?`cpu-reference`:`mixed-fallback`}function ab({p2gGridProjection:e,gridUpdate:t}){return!!((e?.gpuResult?.gridBuffer||e?.gridBuffer)&&(t?.gpuResult?.updatedGridBuffer||t?.updatedGridBuffer))}function ob(e){let t=e?.gpuResult||e;return{stateBuffer:t?.stateBuffer||null,mechanicsBuffer:t?.mechanicsBuffer||null,stateBufferByteLength:t?.stateBufferByteLength||0,mechanicsBufferByteLength:t?.mechanicsBufferByteLength||0,destroyOutputParticleBuffers:t?.destroyOutputParticleBuffers||null}}function sb(e){let t=e?.result||e;return{stateBuffer:t?.stateBuffer||null,thermoBuffer:t?.thermoBuffer||null,stateBufferByteLength:t?.stateBufferByteLength||0,thermoBufferByteLength:t?.thermoBufferByteLength||0,destroyOutputParticleBuffers:t?.destroyOutputParticleBuffers||null}}function cb(e){let t=e?.result||e;return{stateBuffer:t?.stateBuffer||null,thermoBuffer:t?.thermoBuffer||null,mechanicsBuffer:t?.mechanicsBuffer||null,stateBufferByteLength:t?.stateBufferByteLength||0,thermoBufferByteLength:t?.thermoBufferByteLength||0,mechanicsBufferByteLength:t?.mechanicsBufferByteLength||0,destroyOutputParticleBuffers:t?.destroyOutputParticleBuffers||null}}function lb({sphParticleState:e,mlsMpmParticleState:t,sphParticleUpload:n,g2pReconstruction:r,thermalStep:i=null,reactionStep:a=null,particlePingPong:o}){let s=ob(r),c=sb(i),l=cb(a),u=l.stateBuffer||c.stateBuffer||s.stateBuffer,d=l.thermoBuffer||c.thermoBuffer||(n?.status===`webgpu-uploaded`?n.thermoBuffer:null),f=l.mechanicsBuffer||s.mechanicsBuffer;return!u||!f||!d?null:{sphParticleUpload:{schema:lu,status:`webgpu-uploaded`,sourceSchema:e.schema,particleCount:e.particleCount,stateStrideBytes:e.stateStrideBytes,thermoStrideBytes:e.thermoStrideBytes,stateBuffer:u,thermoBuffer:d,ownsStateBuffer:!0,ownsThermoBuffer:!!(l.thermoBuffer||c.thermoBuffer),slot:o.nextSlot,sourceSlot:o.sourceSlot,nextSlot:o.nextSlot,step:o.nextStep,time:o.nextTime,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1},mlsMpmParticleUpload:{schema:bu,status:`webgpu-uploaded`,sourceSchema:t.schema,particleCount:t.particleCount,mechanicsStrideBytes:t.mechanicsStrideBytes,mechanicsBuffer:f,ownsMechanicsBuffer:!0,slot:o.nextSlot,sourceSlot:o.sourceSlot,nextSlot:o.nextSlot,step:o.nextStep,time:o.nextTime,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}}function ub({sphParticleState:e,mlsMpmParticleState:t,sphParticleUpload:n=null,mlsMpmParticleUpload:r=null,p2gGridProjection:i,gridUpdate:a,g2pReconstruction:o,thermalStep:s=null,reactionStep:c=null,compactGpuSummary:l=null,dt:u,gravityMPerS2:d,boxDimsM:f,cflFactor:p,preferWebGpu:m,sourceSlot:h=0}){let g=[i,a,o,...[s,c].filter(Boolean).map(e=>e?.result||e)],_=ib(g),v=ab({p2gGridProjection:i,gridUpdate:a}),y=ob(o),b=sb(s),x=cb(c),S=!!(y.stateBuffer&&y.mechanicsBuffer),C=!!s,w=!!c,T=C&&!!(b.stateBuffer&&b.thermoBuffer),E=w&&!!(x.stateBuffer&&x.thermoBuffer&&x.mechanicsBuffer),D=v&&S&&(!C||T)&&(!w||E),O=D&&g.every(e=>e?.backend===`webgpu`&&e?.readbackMode===Xy),k=O?Xy:Yy,A=Zy(e.step??t.step,0),j=Zy(e.time??t.time,0),M={sourceSlot:h,nextSlot:+(h===0),step:A,nextStep:A+1,time:j,nextTime:j+u},N=lb({sphParticleState:e,mlsMpmParticleState:t,sphParticleUpload:n,g2pReconstruction:o,thermalStep:s,reactionStep:c,particlePingPong:M}),P=nb({sphParticleState:e,mlsMpmParticleState:t,sphParticleUpload:n,mlsMpmParticleUpload:r,p2gGridProjection:i,gridUpdate:a,g2pReconstruction:o,thermalStep:s,compactGpuSummary:l,readbackMode:k});return{schema:Pu,stepSchema:Nu,backend:_,status:_===`webgpu`?`resident-step-webgpu-executed`:`resident-step-cpu-or-fallback`,kernelScope:Gy,preferWebGpu:m,particleCount:e.particleCount,gridNodeCount:a?.gridNodeCount??i?.gridNodeCount??0,dt:u,gravityMPerS2:[...d],boxDimsM:[...f],cflFactor:p,stateStrideFloats:Kh,mechanicsStrideFloats:Jh,state:(c?.state?.length?c.state:s?.state?.length?s.state:o?.state)??new Float32Array,mechanics:(c?.mechanics?.length?c.mechanics:o?.mechanics)??new Float32Array,p2gGridProjection:i,gridUpdate:a,g2pReconstruction:o,thermalStep:s,reactionStep:c,stageStatus:{p2g:rb(i),gridUpdate:rb(a),g2p:rb(o),thermal:rb(s?.result||s),reaction:rb(c?.result||c)},stageBackends:{p2g:i?.backend||null,gridUpdate:a?.backend||null,g2p:o?.backend||null,thermal:s?.backend||s?.result?.backend||null,reaction:c?.backend||c?.result?.backend||null},residentBuffersRetained:D,stageBuffersRetained:v,g2pOutputBuffersRetained:S,thermalOutputBuffersRetained:T,reactionOutputBuffersRetained:E,residentBufferMode:D?`retained-stage-and-output-buffers`:`cpu-artifact-fallback`,particlePingPong:M,nextParticleUploads:N,nextParticleBufferMode:N?x.stateBuffer?`retained-reaction-output-buffers`:b.stateBuffer?`retained-thermal-output-and-g2p-mechanics-buffers`:`retained-g2p-output-buffers`:`not-available`,nextParticleStateBufferByteLength:x.stateBufferByteLength||b.stateBufferByteLength||y.stateBufferByteLength,nextParticleThermoBufferByteLength:x.thermoBufferByteLength||b.thermoBufferByteLength,nextParticleMechanicsBufferByteLength:x.mechanicsBufferByteLength||y.mechanicsBufferByteLength,g2pStateBufferReplacedByThermalStep:!!b.stateBuffer,thermalOutputReplacedByReactionStep:!!x.stateBuffer,g2pMechanicsBufferReplacedByReactionStep:!!x.mechanicsBuffer,readbackMode:k,compactGpuSummary:l,normalHotLoopReadbackFree:O,renderStateReadbackAvailable:!O,gpuAuthoritativeState:!1,diagnostics:P,p2gProjectionValidation:!1,stressProjectionValidation:!1,gridUpdateValidation:!1,g2pValidation:!1,gridValidation:!1,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}async function db({sphParticleState:e,mlsMpmParticleState:t,sphParticleUpload:n=null,mlsMpmParticleUpload:r=null,gridSpacingM:i=e?.smoothingLengthM,boxDimsM:a=Ky,dt:o=t?.mechanicsDtS??0,gravityMPerS2:s=t?.gravityMPerS2??qy,cflFactor:c=t?.gridCflFactor||Jy,preferWebGpu:l=!1,navigatorRef:u=globalThis.navigator,device:d=null,deviceResult:f=null,parityTolerances:p={},onDeviceLost:m=null,p2gRunner:h=void 0,gridUpdateRunner:g=void 0,g2pRunner:_=void 0,summaryRunner:v=jv,thermalMaterialTable:y=null,thermalStepRunner:b=hy,thermalStepOptions:x={},reactionTable:S=null,reactionStepRunner:C=Wy,reactionStepOptions:w={},sourceSlot:T=n?.slot??0,readbackMode:E=Yy}={}){$y({sphParticleState:e,mlsMpmParticleState:t});let D=Qy(a,Ky),O=Qy(s,qy),k=Zy(o,0),A=E===Xy?Xy:Yy,j=null,M=l&&!d&&!f?await xh(u,{onDeviceLost(e){j=e,typeof m==`function`&&m(e)}}):f,N=d||M?.device||null,P=N?{status:`webgpu-device-ready`,reason:d?`provided device`:M?.reason||`resident step shared device`,device:N}:M,F=await S_({sphParticleState:e,mlsMpmParticleState:t,sphParticleUpload:n,mlsMpmParticleUpload:r,gridSpacingM:i,boxDimsM:D,dt:k,preferWebGpu:l,navigatorRef:u,device:N,deviceResult:P,parityTolerance:p.p2g??.05,retainGridBuffer:!0,readbackMode:A,webGpuRunner:h,onDeviceLost(e){j=e,typeof m==`function`&&m(e)}}),I=await G_({p2gGridProjection:F,p2gGridBuffer:F?.gpuResult?.gridBuffer??F?.gridBuffer??null,dt:k,gravityMPerS2:O,boxDimsM:D,cflFactor:c,preferWebGpu:l&&F.backend===`webgpu`&&!j,navigatorRef:u,device:N,deviceResult:P,parityTolerance:p.gridUpdate??1e-5,retainUpdatedGridBuffer:!0,readbackMode:A,webGpuRunner:g,onDeviceLost(e){j=e,typeof m==`function`&&m(e)}}),ee=await _v({sphParticleState:e,mlsMpmParticleState:t,gridUpdate:I,sphParticleUpload:n,mlsMpmParticleUpload:r,updatedGridBuffer:I?.gpuResult?.updatedGridBuffer??I?.updatedGridBuffer??null,dt:k,boxDimsM:D,preferWebGpu:l&&I.backend===`webgpu`&&!j,navigatorRef:u,device:N,deviceResult:P,parityTolerance:p.g2p??.05,retainOutputParticleBuffers:!0,readbackMode:A,webGpuRunner:_,onDeviceLost(e){j=e,typeof m==`function`&&m(e)}}),L=null;if(y&&typeof b==`function`&&ee?.backend===`webgpu`&&n?.status===`webgpu-uploaded`){let t=ob(ee);t.stateBuffer&&(L=await b({device:N,sphParticleState:e,thermalMaterialTable:y,sphParticleUpload:n,sourceStateBuffer:t.stateBuffer,sourceThermoBuffer:n.thermoBuffer,boxDimsM:D,dtS:k,retainOutputParticleBuffers:!0,readbackMode:A,...x}))}let te=null;if(S?.reactionCount>0&&y&&typeof C==`function`&&ee?.backend===`webgpu`&&n?.status===`webgpu-uploaded`){let i=ob(ee),a=sb(L),o=a.stateBuffer||i.stateBuffer,s=a.thermoBuffer||n.thermoBuffer;o&&s&&i.mechanicsBuffer&&(te=await C({device:N,sphParticleState:e,mlsMpmParticleState:t,reactionTable:S,thermalMaterialTable:y,sphParticleUpload:n,mlsMpmParticleUpload:r,sourceStateBuffer:o,sourceThermoBuffer:s,sourceMechanicsBuffer:i.mechanicsBuffer,retainOutputParticleBuffers:!0,readbackMode:A,...w}))}let R=!!(N?.createBuffer&&N.queue?.writeBuffer),z=v&&v!==jv,ne=null;if(A===Xy&&typeof v==`function`&&(R||z))try{ne=await v({device:N,sphParticleState:e,mlsMpmParticleState:t,sphParticleUpload:n,mlsMpmParticleUpload:r,gridUpdate:I,g2pReconstruction:ee,thermalStep:L,reactionStep:te})}catch(e){ne={schema:Lu,backend:`webgpu`,status:`compact-summary-unavailable`,reason:e instanceof Error?e.message:String(e),compactGpuSummaryAvailable:!1,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}return ub({sphParticleState:e,mlsMpmParticleState:t,p2gGridProjection:F,gridUpdate:I,g2pReconstruction:ee,thermalStep:L,reactionStep:te,compactGpuSummary:ne,dt:k,gravityMPerS2:O,boxDimsM:D,cflFactor:c,preferWebGpu:l,sphParticleUpload:n,mlsMpmParticleUpload:r,sourceSlot:T})}function fb(e){if(e?.p2gGridProjection?.gpuResult?.destroyGridBuffer?.(),e?.p2gGridProjection?.destroyGridBuffer?.(),e?.gridUpdate?.gpuResult?.destroyUpdatedGridBuffer?.(),e?.gridUpdate?.destroyUpdatedGridBuffer?.(),e?.nextParticleUploads){let t=e.nextParticleUploads.sphParticleUpload?.stateBuffer||null,n=e.nextParticleUploads.sphParticleUpload?.thermoBuffer||null,r=e.nextParticleUploads.mlsMpmParticleUpload?.mechanicsBuffer||null,i=ob(e.g2pReconstruction),a=sb(e.thermalStep);wg(e.nextParticleUploads.sphParticleUpload),Cg(e.nextParticleUploads.mlsMpmParticleUpload),i.stateBuffer&&i.stateBuffer!==t&&i.stateBuffer.destroy?.(),i.mechanicsBuffer&&i.mechanicsBuffer!==r&&i.mechanicsBuffer.destroy?.(),a.stateBuffer&&a.stateBuffer!==t&&a.stateBuffer.destroy?.(),a.thermoBuffer&&a.thermoBuffer!==n&&a.thermoBuffer.destroy?.()}else e?.g2pReconstruction?.destroyOutputParticleBuffers?e.g2pReconstruction.destroyOutputParticleBuffers():e?.reactionStep?.destroyOutputParticleBuffers?e.reactionStep.destroyOutputParticleBuffers():e?.thermalStep?.destroyOutputParticleBuffers?e.thermalStep.destroyOutputParticleBuffers():e?.g2pReconstruction?.gpuResult?.destroyOutputParticleBuffers?.()}function pb(e,t){let n=t.readbackMode===Xy,r=t.reactionStep?.result||t.reactionStep,i=t.thermalStep?.result||t.thermalStep;return{...e,status:n?`gpu-resident-unread-ready`:`gpu-resident-readback-ready`,step:t.particlePingPong?.nextStep??(e.step??0)+1,time:t.particlePingPong?.nextTime??(e.time??0)+(t.dt??0),state:n?e.state:r?.state?.length?r.state:i?.state?.length?i.state:t.state,cpuStateStale:n,thermo:n?e.thermo:r?.thermo?.length?r.thermo:i?.thermo?.length?i.thermo:e.thermo}}function mb(e,t){let n=t.readbackMode===Xy,r=t.reactionStep?.result||t.reactionStep;return{...e,status:n?`gpu-resident-unread-ready`:`gpu-resident-readback-ready`,step:t.particlePingPong?.nextStep??(e.step??0)+1,time:t.particlePingPong?.nextTime??(e.time??0)+(t.dt??0),mechanics:n?e.mechanics:r?.mechanics?.length?r.mechanics:t.mechanics,cpuStateStale:n}}function hb(e,t){return{index:t,backend:e.backend,status:e.status,stageStatus:{...e.stageStatus},stageBackends:{...e.stageBackends},residentBuffersRetained:e.residentBuffersRetained,stageBuffersRetained:e.stageBuffersRetained,g2pOutputBuffersRetained:e.g2pOutputBuffersRetained,thermalStepRetained:!!(e.thermalStep?.retainedOutputParticleBuffers||e.thermalStep?.result?.retainedOutputParticleBuffers),reactionStepRetained:!!(e.reactionStep?.retainedOutputParticleBuffers||e.reactionStep?.result?.retainedOutputParticleBuffers),nextParticleBufferMode:e.nextParticleBufferMode,particlePingPong:{...e.particlePingPong},diagnostics:{particleCount:e.diagnostics?.particleCount??0,gridNodeCount:e.diagnostics?.gridNodeCount??0,activeGridNodeCount:e.diagnostics?.activeGridNodeCount??null,massDeltaKg:e.diagnostics?.massDeltaKg??null,maxSpeedMPerS:e.diagnostics?.maxSpeedMPerS??null,maxDisplacementM:e.diagnostics?.maxDisplacementM??null,compactGpuSummaryAvailable:e.diagnostics?.compactGpuSummaryAvailable??!1,compactGpuSummaryStatus:e.diagnostics?.compactGpuSummaryStatus??null},readbackMode:e.readbackMode,normalHotLoopReadbackFree:e.normalHotLoopReadbackFree,renderStateReadbackAvailable:e.renderStateReadbackAvailable,gpuAuthoritativeState:e.gpuAuthoritativeState,fullPhysicsValidation:!1}}async function gb({stepCount:e=1,retainIntermediateSteps:t=!1,...n}={}){let r=Math.max(1,Math.round(Zy(e,1))),i=n.sphParticleState,a=n.mlsMpmParticleState,o=n.sphParticleUpload??null,s=n.mlsMpmParticleUpload??null,c=n.sourceSlot??o?.slot??0,l=null,u=[],d=[];for(let e=0;e<r;e+=1){let r=await db({...n,sphParticleState:i,mlsMpmParticleState:a,sphParticleUpload:o,mlsMpmParticleUpload:s,sourceSlot:c});r.sequenceIndex=e,d.push(hb(r,e)),l&&!t?fb(l):l&&u.push(l),l=r,i=pb(i,r),a=mb(a,r),o=r.nextParticleUploads?.sphParticleUpload??null,s=r.nextParticleUploads?.mlsMpmParticleUpload??null,c=r.particlePingPong?.nextSlot??+(c===0)}return{schema:Fu,backend:l?.backend||`cpu-reference`,status:`resident-steps-executed`,stepCount:r,completedStepCount:d.length,retainIntermediateSteps:t,retainedIntermediateStepCount:u.length,retainedSteps:u,finalStep:l,stepSummaries:d,nextSphParticleState:i,nextMlsMpmParticleState:a,nextParticleUploads:l?.nextParticleUploads??null,nextParticleBufferMode:l?.nextParticleBufferMode??`not-available`,readbackMode:l?.readbackMode??Yy,normalHotLoopReadbackFree:!!l?.normalHotLoopReadbackFree,renderStateReadbackAvailable:l?.renderStateReadbackAvailable??!0,gpuAuthoritativeState:!1,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function _b(e){for(let t of e?.retainedSteps??[])fb(t);fb(e?.finalStep)}var vb=.01438777;function yb(e,t,n,r){let i=(e-t)*(e<t?1/n:1/r);return Math.exp(-.5*i*i)}function bb(e){return 1.056*yb(e,599.8,37.9,31)+.362*yb(e,442,16,26.7)-.065*yb(e,501.1,20.4,26.2)}function xb(e){return .821*yb(e,568.8,46.9,40.5)+.286*yb(e,530.9,16.3,31.1)}function Sb(e){return 1.217*yb(e,437,11.8,36)+.681*yb(e,459,26,13.8)}function Cb(e,t){let n=e*1e-9,r=vb/(n*t);return 1/(n**5*Math.expm1(r))}function wb(e){let t=Math.min(1,Math.max(0,e));return t<=.0031308?12.92*t:1.055*t**(1/2.4)-.055}function Tb(e){let t=0,n=0,r=0;for(let i=380;i<=780;i+=5){let a=Cb(i,e);t+=a*bb(i),n+=a*xb(i),r+=a*Sb(i)}let i=t+n+r;if(!(i>0))return{r:0,g:0,b:0};t/=i,n/=i,r/=i;let a=3.2406*t-1.5372*n-.4986*r,o=-.9689*t+1.8758*n+.0415*r,s=.0557*t-.204*n+1.057*r;a=Math.max(0,a),o=Math.max(0,o),s=Math.max(0,s);let c=Math.max(a,o,s,1e-9);return{r:wb(a/c),g:wb(o/c),b:wb(s/c)}}function Eb(e,{emissivity:t=1}={}){if(!(Number(e)>=800))return{visible:!1,srgb:[0,0,0],temperatureK:e,emissivity:t,closureBacked:!0};let n=Tb(e);return{visible:!0,srgb:[n.r,n.g,n.b],temperatureK:e,emissivity:t,closureBacked:!0}}var Db=id.length,Ob=ad.length,kb=od.length,Ab=`sph-resident-render-row-extraction`,jb=`sph-resident-render-field-splat`,Mb=Object.freeze(Object.fromEntries(Object.entries(qm).map(([e,t])=>[t,e]))),Nb={MAP_READ:globalThis.GPUBufferUsage?.MAP_READ??1,COPY_SRC:globalThis.GPUBufferUsage?.COPY_SRC??4,COPY_DST:globalThis.GPUBufferUsage?.COPY_DST??8,STORAGE:globalThis.GPUBufferUsage?.STORAGE??128,UNIFORM:globalThis.GPUBufferUsage?.UNIFORM??64},Pb={READ:globalThis.GPUMapMode?.READ??1};function Fb(e){if(e?.schema!==`peercompute.ulg.sph-gpu-particle-buffer.v0`)throw TypeError(`SPH render rows require a packed SPH GPU particle buffer`)}function Ib(e,t=0){let n=Number(e);return Number.isFinite(n)?n:t}function Lb(e,t,n){return Math.min(n,Math.max(t,e))}function Rb(e){return Mb[Math.round(Ib(e,0))]||`unknown`}function zb(e,t){return e===`h2o`&&t===`solid`?`ice`:e===`h2o`&&t===`gas`?`steam`:e||`unknown`}function Bb(e={},t=null){let n=new Map;for(let t of Object.keys(e||{}))n.set(ah(t),t);for(let e of t?.metadata||[])e.product&&n.set(e.productMaterialId,e.product),e.a&&n.set(e.aMaterialId,e.a),e.b&&n.set(e.bMaterialId,e.b);return n}function Vb({material:e,phase:t,temperatureK:n,materialProperties:r}){let i=Eb(n);if(i.visible)return[...i.srgb];let a=Fm({material:e,phase:t,properties:r?.[e]??r?.[String(e).toLowerCase()]??r?.[String(e).toUpperCase()]??null});return a.baseColorSrgb??a.pbr?.baseColorSrgb??[1,1,1]}function Hb(e=[]){let t={};for(let n of e||[]){let e=Eb(n.temperatureK);if(!e.visible)continue;let r=.2126*e.srgb[0]+.7152*e.srgb[1]+.0722*e.srgb[2],i=[n.material,n.renderKey].filter(Boolean);for(let n of i){let i=t[n]||(t[n]={r:0,g:0,b:0,w:0});i.r+=e.srgb[0]*r,i.g+=e.srgb[1]*r,i.b+=e.srgb[2]*r,i.w+=r}}let n={};for(let[e,r]of Object.entries(t))n[e]=r.w>0?[r.r/r.w,r.g/r.w,r.b/r.w]:null;return n}function Ub(e,{materialProperties:t={},reactionTable:n=null,materialMap:r=Bb(t,n)}={}){if(!(e instanceof Float32Array))throw TypeError(`decodeSphRenderRows requires Float32Array render rows`);if(e.length%Db!==0)throw RangeError(`SPH render rows length must align to the render row stride`);let i=e.length/Db,a=new Float32Array(i*3),o=new Float32Array(i*3),s=Array(i),c=[];for(let n=0;n<i;n+=1){let i=n*Db,l=e[i+4],u=e[i+5],d=r.get(l)||`unknown`,f=Rb(u),p=zb(d,f),m=e[i+6],h=Vb({material:d,phase:f,temperatureK:m,materialProperties:t});a.set([e[i],e[i+1],e[i+2]],n*3),o.set(h,n*3),s[n]={material:d,phase:f,renderKey:p},c.push({index:n,positionM:[e[i],e[i+1],e[i+2]],massKg:e[i+3],materialId:l,material:d,phaseId:u,phase:f,temperatureK:m,status:e[i+7],restDensityKgPerM3:e[i+8],phaseFractionGas:e[i+9],representedEntityCount:e[i+10],renderKey:p})}return{schema:_u,status:`render-rows-decoded`,particleCount:i,positionsM:a,colorsRgb:o,materials:s,rows:c,emissiveByMaterial:Hb(c),scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function Wb(e,t,n,r=0){let i=Math.max(4,n.byteLength),a=e.createBuffer({label:t,size:i,usage:Nb.STORAGE|Nb.COPY_DST|r});return n.byteLength>0&&e.queue.writeBuffer(a,0,n),a}function Gb(e){let t=new ArrayBuffer(16),n=new DataView(t);return n.setUint32(0,e,!0),n.setUint32(4,0,!0),n.setUint32(8,0,!0),n.setUint32(12,0,!0),t}function Kb({particleCount:e,surfaceCount:t,totalFieldCells:n,fieldPadding:r,refEdgeM:i}){let a=new ArrayBuffer(32),o=new DataView(a);return o.setUint32(0,e,!0),o.setUint32(4,t,!0),o.setUint32(8,n,!0),o.setUint32(12,0,!0),o.setFloat32(16,r,!0),o.setFloat32(20,i,!0),o.setFloat32(24,0,!0),o.setFloat32(28,0,!0),a}async function qb(e,t,n,r=`ulg-sph-render-readback`){let i=e.createBuffer({label:r,size:Math.max(4,n),usage:Nb.MAP_READ|Nb.COPY_DST}),a=e.createCommandEncoder();a.copyBufferToBuffer(t,0,i,0,n),e.queue.submit([a.finish()]),await i.mapAsync(Pb.READ);let o=i.getMappedRange().slice(0);return i.unmap(),i.destroy?.(),o}function Jb(e=[],{defaultResolution:t=32,defaultIsolation:n=80,defaultSubtract:r=24}={}){if(!Array.isArray(e))throw TypeError(`surfaceDescriptors must be an array`);let i=new Float32Array(e.length*Ob),a=[],o=0,s=0;return e.forEach((e,c)=>{let l=Math.max(4,Math.round(Ib(e.resolution,t))),u=l**3,d=Ib(e.isolation,n),f=Math.max(1e-12,Ib(e.subtract,r)),p=Lb(Ib(e.radiusNorm,.05),.001,.5),m=Number.isFinite(e.strength)?e.strength:(d+f)*p*p,h=Array.isArray(e.colorLinear)||ArrayBuffer.isView(e.colorLinear)?e.colorLinear:[1,1,1],g=Ib(e.materialId??(e.material?ah(e.material):0),0),_=Ib(e.phaseId??(e.phase?eh(e.phase):qm.unknown),qm.unknown),v=c*Ob;i.set([g,_,o,u,l,d,f,m,p,Lb(Ib(h[0],1),0,1),Lb(Ib(h[1],1),0,1),Lb(Ib(h[2],1),0,1),Ib(e.status,1),0,0,0],v);let y={index:c,surfaceKey:e.surfaceKey??`${g}|${_}`,material:e.material??null,phase:e.phase??null,renderKey:e.renderKey??e.material??null,materialId:g,phaseId:_,fieldOffset:o,fieldCellCount:u,resolution:l,isolation:d,subtract:f,strength:m,radiusNorm:p,colorLinear:[Lb(Ib(h[0],1),0,1),Lb(Ib(h[1],1),0,1),Lb(Ib(h[2],1),0,1)],status:Ib(e.status,1)};a.push(y),o+=u,s=Math.max(s,u)}),{schema:vu,status:`render-field-surface-table-built`,surfaceCount:e.length,rowLayout:[...ad],rowStrideFloats:Ob,records:i,metadata:a,totalFieldCells:o,maxFieldCellCount:s,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}function Yb(e){if(e?.schema!==`peercompute.ulg.sph-gpu-render-field.v0`||!(e.records instanceof Float32Array))throw TypeError(`SPH render field requires a render-field surface table`)}function Xb(e){if(e?.schema!==`peercompute.ulg.sph-gpu-render-field.v0`||!(e.fieldRows instanceof Float32Array))throw TypeError(`splitSphRenderFieldBySurface requires an SPH render field`);return e.surfaceTable.metadata.map(t=>{let n=new Float32Array(t.fieldCellCount),r=new Float32Array(t.fieldCellCount*3);for(let i=0;i<t.fieldCellCount;i+=1){let a=(t.fieldOffset+i)*kb;n[i]=e.fieldRows[a],r[i*3]=e.fieldRows[a+1],r[i*3+1]=e.fieldRows[a+2],r[i*3+2]=e.fieldRows[a+3]}return{...t,field:n,palette:r}})}async function Zb({device:e,renderRows:t,renderRowsBuffer:n=null,surfaceTable:r,particleCount:i=null,fieldPadding:a=.22,refEdgeM:o=10}={}){if(!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`buildSphRenderFieldWebGpu requires a WebGPU-like device`);if(!n&&!(t instanceof Float32Array))throw TypeError(`buildSphRenderFieldWebGpu requires renderRows or renderRowsBuffer`);if(t&&t.length%Db!==0)throw RangeError(`SPH render rows length must align to the render row stride`);Yb(r);let s=i??(t?.length?t.length/Db:0),c=n||null,l=c?`resident-render-rows-buffer`:`uploaded-render-rows`,u=c||Wb(e,`ulg-sph-render-field-source-rows`,t,Nb.COPY_SRC),d=Wb(e,`ulg-sph-render-field-surfaces`,r.records),f=Wb(e,`ulg-sph-render-field-cells`,new Float32Array(r.totalFieldCells*kb),Nb.COPY_SRC),p=e.createBuffer({label:`ulg-sph-render-field-params`,size:32,usage:Nb.UNIFORM|Nb.COPY_DST});e.queue.writeBuffer(p,0,Kb({particleCount:s,surfaceCount:r.surfaceCount,totalFieldCells:r.totalFieldCells,fieldPadding:a,refEdgeM:o}));let{pipeline:m,bindGroupLayout:h}=af(e,{label:`ulg-sph-render-field`,module:e.createShaderModule({label:`ulg-sph-render-field`,code:Pd}),entryPoint:`main`,bindings:[$(0,`read-only-storage`),$(1,`read-only-storage`),$(2,`storage`),$(3,`uniform`)]}),g=e.createBindGroup({layout:h,entries:[{binding:0,resource:{buffer:u}},{binding:1,resource:{buffer:d}},{binding:2,resource:{buffer:f}},{binding:3,resource:{buffer:p}}]}),_=e.createCommandEncoder(),v=_.beginComputePass();v.setPipeline(m),v.setBindGroup(0,g),v.dispatchWorkgroups(Math.ceil(Math.max(1,r.maxFieldCellCount)/64),Math.max(1,r.surfaceCount)),v.end(),e.queue.submit([_.finish()]);let y=await qb(e,f,r.totalFieldCells*kb*Float32Array.BYTES_PER_ELEMENT,`ulg-sph-render-field-readback`),b=new Float32Array(y);return c||u.destroy?.(),d.destroy?.(),f.destroy?.(),p.destroy?.(),{schema:vu,backend:`webgpu`,status:`render-field-built`,kernelScope:jb,particleCount:s,surfaceCount:r.surfaceCount,totalFieldCells:r.totalFieldCells,maxFieldCellCount:r.maxFieldCellCount,surfaceTable:r,rowLayout:[...od],rowStrideFloats:kb,fieldRows:b,fieldRowByteLength:b.byteLength,fieldPadding:a,refEdgeM:o,renderFieldInputSource:l,renderFieldReadback:!0,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}async function Qb({device:e,sphParticleState:t,sphParticleUpload:n=null,sourceStateBuffer:r=null,sourceThermoBuffer:i=null,retainRenderRowsBuffer:a=!1}={}){if(Fb(t),!e?.createBuffer||!e.queue?.writeBuffer)throw TypeError(`extractSphRenderRowsWebGpu requires a WebGPU-like device`);let o=r||n?.stateBuffer||null,s=i||n?.thermoBuffer||null,c=o||Wb(e,`ulg-sph-render-source-state`,t.state),l=s||Wb(e,`ulg-sph-render-source-thermo`,t.thermo),u=Wb(e,`ulg-sph-render-rows`,new Float32Array(t.particleCount*Db),Nb.COPY_SRC),d=e.createBuffer({label:`ulg-sph-render-rows-params`,size:16,usage:Nb.UNIFORM|Nb.COPY_DST});e.queue.writeBuffer(d,0,Gb(t.particleCount));let{pipeline:f,bindGroupLayout:p}=af(e,{label:`ulg-sph-render-rows`,module:e.createShaderModule({label:`ulg-sph-render-rows`,code:Nd}),entryPoint:`main`,bindings:[$(0,`read-only-storage`),$(1,`read-only-storage`),$(2,`storage`),$(3,`uniform`)]}),m=e.createBindGroup({layout:p,entries:[{binding:0,resource:{buffer:c}},{binding:1,resource:{buffer:l}},{binding:2,resource:{buffer:u}},{binding:3,resource:{buffer:d}}]}),h=e.createCommandEncoder(),g=h.beginComputePass();g.setPipeline(f),g.setBindGroup(0,m),g.dispatchWorkgroups(Math.ceil(t.particleCount/64)),g.end(),e.queue.submit([h.finish()]);let _=await qb(e,u,t.particleCount*Db*Float32Array.BYTES_PER_ELEMENT),v=new Float32Array(_),y=!1,b=()=>{y||(y=!0,u.destroy?.())};o||c.destroy?.(),s||l.destroy?.(),a||b(),d.destroy?.();let x={schema:_u,backend:`webgpu`,status:`render-rows-extracted`,kernelScope:Ab,particleCount:t.particleCount,rowLayout:[...id],rowStrideFloats:Db,renderRows:v,renderRowByteLength:v.byteLength,renderRowsBufferRetained:!!a,renderRowsBufferByteLength:t.particleCount*Db*Float32Array.BYTES_PER_ELEMENT,compactRenderReadback:!0,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1};return a&&(x.renderRowsBuffer=u,x.renderRowsBufferOwned=!0,x.destroyRenderRowsBuffer=b),x}var $b=`continuous-marching-cubes`,ex=`no-full-readback`,tx=`full-parity-readback`,nx=`no-full-readback`,rx={h2o:{resolution:48,subtract:24,isolation:80,maxPolyCount:12e4},fe:{resolution:46,subtract:26,isolation:82,maxPolyCount:12e4},steam:{resolution:36,subtract:10,isolation:24,maxPolyCount:12e4},default:{resolution:46,subtract:24,isolation:80,maxPolyCount:12e4}};function ix(e,t,n){return Math.min(n,Math.max(t,e))}function ax(e){return e===tx?tx:nx}var ox=.22,sx=32;function cx(e){return typeof e==`string`&&e.length>0?e:`default`}function lx(e){if(e&&typeof e==`object`){let t=cx(e.renderKey??e.key??e.material),n=cx(e.material??(t===`steam`||t===`ice`?`h2o`:t)),r=e.phase??(t===`steam`?`gas`:t===`ice`?`solid`:null);return{renderKey:t,material:n,phase:r,surfaceKey:`${t}|${n}|${r??`phase-unspecified`}`}}let t=cx(e);return{renderKey:t,material:t===`steam`||t===`ice`?`h2o`:t,phase:t===`steam`?`gas`:t===`ice`?`solid`:null,surfaceKey:`${t}|${t===`steam`||t===`ice`?`h2o`:t}|${t===`steam`?`gas`:t===`ice`?`solid`:`phase-unspecified`}`}}function ux(e,t){if(!t)return null;let n=e.material,r=e.renderKey;return t[n]??t[n?.toLowerCase?.()]??t[r]??t[r?.toLowerCase?.()]??null}function dx(e,t=null){return{material:e.material,phase:e.phase??(e.renderKey===`steam`?`gas`:e.renderKey===`ice`?`solid`:`liquid`),properties:t}}function fx(e={},t={}){return t.phase??e.phase??(t.renderKey===`steam`?`gas`:null)}function px(e={},t={}){let n=ix(Number.isFinite(e.opacity)?e.opacity:1,0,1),r=ix(Number.isFinite(e.transmission)?e.transmission:0,0,1),i=ix(Number.isFinite(e.metalness)?e.metalness:0,0,1),a=fx(e,t),o=t.material??e.material??null,s=t.renderKey??t.renderMaterialKey??null;return r>.01&&i<.1&&!(a===`gas`||o===`steam`||s===`steam`)?1:n}function mx(e={},t={}){let n=ix(Number.isFinite(e.transmission)?e.transmission:0,0,1),r=px(e,t);return!(n>.01||r<.999)||r>.5&&n<=.01}function hx(e,t=null){let n=lx(e),r=Fm(dx(n,t)),i=r.transmission>.01,a=px(r,n),o=i||a<.999,s=r.baseColorSrgb??r.pbr?.baseColorSrgb??[1,1,1],c=new Zi({color:new X().setRGB(s[0],s[1],s[2],Pe),vertexColors:r.vertexColorPolicy===`particle-diagnostic`,side:2,clearcoat:r.metalness>.5?.18:.05,metalness:r.metalness,roughness:r.roughness,ior:r.ior??1.5,transmission:r.transmission,thickness:i?.6:0,envMapIntensity:r.metalness>.5?1.3:.85,transparent:o,depthWrite:mx(r,n),opacity:a});return r.attenuationColor&&(c.attenuationColor=new X().setRGB(r.attenuationColor[0],r.attenuationColor[1],r.attenuationColor[2],Pe),c.attenuationDistance=Math.max(.05,r.attenuationDistanceM)),c.userData.optical=r,c.userData.opticalRenderAlpha=a,c.userData.renderDescriptor=n,c}function gx(){return{min:[1/0,1/0,1/0],max:[-1/0,-1/0,-1/0]}}function _x(e,t,n,r){e.min[0]=Math.min(e.min[0],t),e.min[1]=Math.min(e.min[1],n),e.min[2]=Math.min(e.min[2],r),e.max[0]=Math.max(e.max[0],t),e.max[1]=Math.max(e.max[1],n),e.max[2]=Math.max(e.max[2],r)}function vx(e,t,n){if(t<=1)return n*.045;let r=e.max.map((t,r)=>Math.max(t-e.min[r],n*.025)),i=r[0]*r[1]*r[2];return ix(Math.cbrt(i/Math.max(1,t))*1.65,n*.025,n*.11)}function yx({positionsM:e,colorsRgb:t,materials:n=null,boxEdgeM:r=10,boxDimsM:i=null}={}){if(!e||!t)throw Error(`positionsM and colorsRgb are required for SPH continuous surfaces`);if(e.length!==t.length||e.length%3!=0)throw Error(`positionsM and colorsRgb must be matching vec3 arrays`);let a=i??[r,r,r],o=Math.max(a[0],a[1],a[2]),s=new Map,c=e.length/3;for(let r=0;r<c;r+=1){let i=lx(n?.[r]),a=s.get(i.surfaceKey);a||(a={surfaceKey:i.surfaceKey,renderKey:i.renderKey,material:i.material,phase:i.phase,descriptor:i,positionsM:[],normalizedPositions:[],colorsRgb:[],bounds:gx(),count:0},s.set(i.surfaceKey,a));let c=e[r*3],l=e[r*3+1],u=e[r*3+2];a.positionsM.push(c,l,u);let d=1-2*ox;a.normalizedPositions.push(ix(ox+c/o*d,.001,.999),ix(ox+l/o*d,.001,.999),ix(ox+u/o*d,.001,.999)),a.colorsRgb.push(ix(t[r*3],0,1),ix(t[r*3+1],0,1),ix(t[r*3+2],0,1)),_x(a.bounds,c,l,u),a.count+=1}return[...s.values()].map(e=>({...e,surfaceRadiusM:vx(e.bounds,e.count,o)}))}function bx(e,{materialProperties:t=null}={}){return lh(e.map(e=>({material:e.material,phase:e.phase??dx(e.descriptor).phase,renderKey:e.renderKey,properties:ux(e.descriptor,t)})),{materialProperties:t||{}})}function xx(e,t){let n=fh(e,t.map(e=>({material:e.material,phase:e.phase??dx(e.descriptor).phase})));return{lookup:n,cpuReference:ph(e,n),surfaceKeys:t.map(e=>e.surfaceKey),signature:Sx(e,n)}}function Sx(e,t){return[e.recordCount,t.queryCount,Array.from(t.queries).join(`,`),Array.from(e.records).join(`,`)].join(`|`)}function Cx(e,{boxEdgeM:t=10,boxDimsM:n=null,surfaceRadiusM:r=null,surfaceRadiusScale:i=1,preferWebGpuOpticalLookup:a=!0,navigatorRef:o=globalThis.navigator}={}){let s=n??[t,t,t],c=Math.max(s[0],s[1],s[2]),l=i,u=new Mn;u.background=new X(1581611);let d=e.clientWidth||800,f=e.clientHeight||520,p=new Aa(46,d/f,.05,500),m=new J(s[0]/2,s[1]/2,s[2]/2);p.position.set(m.x+c*.85,m.y+c*.55,m.z+c*1.15);let h=new bl({antialias:!0,preserveDrawingBuffer:!1});h.setPixelRatio(Math.min(window.devicePixelRatio,2)),h.setSize(d,f),h.outputColorSpace=Pe,h.toneMapping=4,h.toneMappingExposure=1.08,e.appendChild(h.domElement);let g=new Do(h),_=g.fromScene(new ql,.04);u.environment=_.texture;let v=new jl(p,h.domElement);v.enableDamping=!0,v.target.copy(m),u.add(new Ia(16777215,1.4)),u.add(new va(14548991,2107952,.9));let y=new Fa(16777215,1.1);y.position.set(4,8,6),u.add(y);let b=new Fa(12577279,.5);b.position.set(-6,3,-4),u.add(b);let x=new Oi(new Ri(new Ni(s[0],s[1],s[2])),new gi({color:3593892,transparent:!0,opacity:.6}));x.position.set(s[0]/2,s[1]/2,s[2]/2),u.add(x);let S=new eo(Math.max(s[0],s[2]),20,1936237,865067);S.position.set(s[0]/2,0,s[2]/2),u.add(S);let C=new Map,w=lh([]),T=xx(w,[]),E=0,D=null,O=null,k=null,A=null,j=null,M=null,N=null,P=null,F=null,I=null,ee=null,L=null,te=null,R=null,z=null,ne=null,re=null,ie=null,ae=null,oe=null,se=null,ce=null,le=null,ue=null,de=null,fe=null,pe=null,me=null,he=null,ge=null,_e=null,ve=null,ye=null;u.userData.opticalGpuTable=w,u.userData.opticalGpuLookup=T,u.userData.opticalGpuLookupExecution=null,u.userData.opticalGpuLookupDrawState=null,u.userData.sphGpuParticleState=null,u.userData.sphGpuParticleUpload=null,u.userData.mlsMpmGpuParticleState=null,u.userData.mlsMpmGpuParticleUpload=null,u.userData.mlsMpmMechanicsPrediction=null,u.userData.mlsMpmP2gGridProjection=null,u.userData.mlsMpmGridUpdate=null,u.userData.mlsMpmG2pReconstruction=null,u.userData.mlsMpmResidentStep=null,u.userData.mlsMpmResidentSteps=null,u.userData.mlsMpmResidentRequestedReadbackMode=ex,u.userData.sphThermalMaterialTable=null,u.userData.sphThermalClosureGraphBuffers=null,u.userData.sphThermalPhaseResponseTable=null,u.userData.sphReactionTable=null,u.userData.sphResidentRenderState=null;function be(e,t=T){if(!e?.outputs)return[];let n=hh(e,t.lookup),r=[];for(let i of n){let n=t.surfaceKeys?.[i.queryIndex],a=n?C.get(n):null;if(!a||i.status===255||i.recordIndex<0)continue;let{mesh:o}=a,s=o.material;s.color.setRGB(ix(i.baseColorLinear[0],0,1),ix(i.baseColorLinear[1],0,1),ix(i.baseColorLinear[2],0,1),Fe);let c=px(i,i);s.opacity=c,s.transparent=i.transmission>.01||c<.999,s.depthWrite=mx(i,i),s.metalness=ix(i.metalness,0,1),s.roughness=ix(i.roughness,0,1),s.transmission=ix(i.transmission,0,1),s.ior=Math.max(1,i.ior||1),s.vertexColors=i.vertexColorPolicyId===2,s.needsUpdate=!0,o.userData.opticalGpuLookupOutput={...i,renderAlpha:c},o.userData.opticalGpuExecutionBackend=e.backend,r.push({surfaceKey:n,row:i})}return u.userData.opticalGpuLookupDrawState={schema:`peercompute.ulg.optical-gpu-draw-state.v0`,sourceExecutionSchema:e.schema,backend:e.backend,appliedCount:r.length,rows:n,scientificValidation:!1,fullPhysicsValidation:!1},r}function xe(e=o){return O||=xh(e).then(e=>(e.device?.lost?.then&&e.device.lost.finally(()=>{O&&=null}).catch(()=>{}),e)).catch(e=>(O=null,{status:`webgpu-error-fallback`,reason:e instanceof Error?e.message:String(e),device:null})),O}async function Se({preferWebGpu:e=a,force:t=!1,navigatorRef:n=o,device:r=null,deviceResult:i=null,parityTolerance:s=1e-6,webGpuRunner:c=void 0}={}){let l=E,d=w,f=T,p=f.signature;if(!t&&f.execution?.signature===p)return f;if(!t&&D?.signature===p)return D.promise;let m=(async()=>{let t=e&&!r&&!i?await xe(n):i,a=await Th({table:d,lookup:f.lookup,cpuReference:f.cpuReference,preferWebGpu:e,navigatorRef:n,device:r,deviceResult:t,parityTolerance:s,webGpuRunner:c,onDeviceLost(){O=null}});return a.signature=p,!Ye||l!==E||T.signature!==p?{...f,execution:{...a,stale:!0}}:(T={...f,execution:a},u.userData.opticalGpuLookup=T,u.userData.opticalGpuLookupExecution=a,be(a,T),T)})();D={signature:p,promise:m};try{return await m}finally{D?.promise===m&&(D=null)}}function Ce(e){return e?[e.particleCount,e.step,e.time,e.state?.byteLength??0,e.thermo?.byteLength??0].join(`|`):null}function we(e){return e?[e.particleCount,e.step,e.time,e.mechanics?.byteLength??0,e.mechanicsDtS??0,e.soundSpeedScale??0,e.minGasSoundSpeedMPerS??0].join(`|`):null}function Te(e=ve){return e?[e.reactionCount??0,e.productPhaseCount??0,Array.from(e.records||[]).join(`,`),Array.from(e.productPhaseRecords||[]).join(`,`)].join(`|`):`no-reaction-table`}function B({sphParticleState:e=k,mlsMpmParticleState:t=N,dt:n=4e-4,gravityMPerS2:r=[0,-9.80665,0]}={}){let i=Ce(e),a=we(t);return!i||!a?null:[i,a,n,r.join(`,`),s.join(`,`)].join(`|`)}function Ee({sphParticleState:e=k,mlsMpmParticleState:t=N,gridSpacingM:n=k?.smoothingLengthM??0}={}){let r=Ce(e),i=we(t);return!r||!i?null:[r,i,n,s.join(`,`)].join(`|`)}function De({p2gGridProjection:e=R,dt:t=N?.mechanicsDtS??e?.dt??0,gravityMPerS2:n=N?.gravityMPerS2??[0,-9.80665,0],cflFactor:r=N?.gridCflFactor||.6}={}){return e?.schema?[e.signature??[e.schema,e.backend,e.gridNodeCount,e.gridSpacingM,e.dt??0].join(`:`),t,n.join(`,`),r,s.join(`,`)].join(`|`):null}function Oe({sphParticleState:e=k,mlsMpmParticleState:t=N,gridUpdate:n=re,dt:r=n?.dt??t?.mechanicsDtS??0}={}){let i=Ce(e),a=we(t);return!i||!a||!n?.schema?null:[i,a,n.signature??`${n.schema}|${n.backend}|${n.gridNodeCount}|${n.dt??0}`,r,s.join(`,`)].join(`|`)}function V({sphParticleState:e=k,mlsMpmParticleState:t=N,gridSpacingM:n=e?.smoothingLengthM??0,dt:r=t?.mechanicsDtS??0,gravityMPerS2:i=t?.gravityMPerS2??[0,-9.80665,0],cflFactor:a=t?.gridCflFactor||.6,readbackMode:o=ex}={}){let c=Ce(e),l=we(t);if(!c||!l)return null;let u=ax(o);return[c,l,n,r,i.join(`,`),a,u,Te(),s.join(`,`)].join(`|`)}function ke(e){let t=Number(e);return Number.isFinite(t)?Math.max(1,Math.round(t)):1}function H({stepCount:e=1,retainIntermediateSteps:t=!1,residentSourceMode:n=`cpu-packed-state`,...r}={}){let i=V(r);return i?[i,ke(e),!!t,n].join(`|`):null}function U(){fe?_b(fe):(R?.gpuResult?.destroyGridBuffer?.(),R?.destroyGridBuffer?.(),re?.gpuResult?.destroyUpdatedGridBuffer?.(),re?.destroyUpdatedGridBuffer?.(),oe?.destroyOutputParticleBuffers?oe.destroyOutputParticleBuffers():oe?.gpuResult?.destroyOutputParticleBuffers?.()),R=null,z=null,u.userData.mlsMpmP2gGridProjection=null,re=null,ie=null,u.userData.mlsMpmGridUpdate=null,oe=null,se=null,u.userData.mlsMpmG2pReconstruction=null,le=null,ue=null,u.userData.mlsMpmResidentStep=null,fe=null,pe=null,u.userData.mlsMpmResidentSteps=null}function Ae(e,t,{stepsExecution:n=null,stepsSignature:r=null}={}){fe=n,pe=r,u.userData.mlsMpmResidentSteps=n,le=e,ue=n?null:t,R=e?.p2gGridProjection??null,z=t,re=e?.gridUpdate??null,ie=t,oe=e?.g2pReconstruction??null,se=t,u.userData.mlsMpmResidentStep=e,u.userData.mlsMpmP2gGridProjection=R,u.userData.mlsMpmGridUpdate=re,u.userData.mlsMpmG2pReconstruction=oe}async function je({preferWebGpu:e=!0,force:t=!1,navigatorRef:n=o,device:r=null,deviceResult:i=null}={}){if(!k)return A=null,u.userData.sphGpuParticleUpload=null,null;let a=Ce(k);if(!t&&j===a&&A)return A;if(!t&&M?.signature===a)return M.promise;let s=(async()=>{if(!e){let e={schema:lu,status:`not-requested`,sourceSchema:k.schema,particleCount:k.particleCount,reason:`WebGPU SPH particle upload not requested`,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1};return A=e,j=a,u.userData.sphGpuParticleUpload=e,e}let t=r?{status:`webgpu-device-ready`,reason:`provided device`,device:r}:i||await xe(n);if(!t.device){let e={schema:lu,status:t.status,sourceSchema:k.schema,particleCount:k.particleCount,reason:t.reason,fallback:`cpu-packed-buffer`,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1};return A=e,j=a,u.userData.sphGpuParticleUpload=e,e}let o=bg(t.device,k);return o.signature=a,o.step=k.step,o.time=k.time,!Ye||Ce(k)!==a?(wg(o),{...o,status:`stale-upload-discarded`}):(A?.status===`webgpu-uploaded`&&wg(A),A=o,j=a,u.userData.sphGpuParticleUpload=o,o)})();M={signature:a,promise:s};try{return await s}finally{M?.promise===s&&(M=null)}}async function Me({preferWebGpu:e=!0,force:t=!1,navigatorRef:n=o,device:r=null,deviceResult:i=null}={}){if(!N)return P=null,u.userData.mlsMpmGpuParticleUpload=null,null;let a=we(N);if(!t&&F===a&&P)return P;if(!t&&I?.signature===a)return I.promise;let s=(async()=>{if(!e){let e={schema:bu,status:`not-requested`,sourceSchema:N.schema,particleCount:N.particleCount,reason:`WebGPU MLS-MPM particle upload not requested`,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1};return P=e,F=a,u.userData.mlsMpmGpuParticleUpload=e,e}let t=r?{status:`webgpu-device-ready`,reason:`provided device`,device:r}:i||await xe(n);if(!t.device){let e={schema:bu,status:t.status,sourceSchema:N.schema,particleCount:N.particleCount,reason:t.reason,fallback:`cpu-packed-buffer`,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1};return P=e,F=a,u.userData.mlsMpmGpuParticleUpload=e,e}let o=Sg(t.device,N);return o.signature=a,o.step=N.step,o.time=N.time,!Ye||we(N)!==a?(Cg(o),{...o,status:`stale-upload-discarded`}):(P?.status===`webgpu-uploaded`&&Cg(P),P=o,F=a,u.userData.mlsMpmGpuParticleUpload=o,o)})();I={signature:a,promise:s};try{return await s}finally{I?.promise===s&&(I=null)}}async function Ne({preferWebGpu:e=!0,force:t=!1,navigatorRef:n=o,device:r=null,deviceResult:i=null,dt:a=4e-4,gravityMPerS2:c=[0,-9.80665,0],parityTolerance:l=2e-5,webGpuRunner:d=void 0}={}){if(!k||!N)return ee=null,u.userData.mlsMpmMechanicsPrediction=null,null;let f=B({dt:a,gravityMPerS2:c});if(!t&&L===f&&ee)return ee;if(!t&&te?.signature===f)return te.promise;let p=(async()=>{let t=e&&!r&&!i?await xe(n):i,o=e?await je({preferWebGpu:e,navigatorRef:n,device:r,deviceResult:t}):A,p=e?await Me({preferWebGpu:e,navigatorRef:n,device:r,deviceResult:t}):P,m=await Gg({sphParticleState:k,mlsMpmParticleState:N,sphParticleUpload:o,mlsMpmParticleUpload:p,dt:a,gravityMPerS2:c,boxDimsM:s,preferWebGpu:e,navigatorRef:n,device:r,deviceResult:t,parityTolerance:l,webGpuRunner:d,onDeviceLost(){O=null}});return m.signature=f,!Ye||B({dt:a,gravityMPerS2:c})!==f?{...m,stale:!0}:(ee=m,L=f,u.userData.mlsMpmMechanicsPrediction=m,m)})();te={signature:f,promise:p};try{return await p}finally{te?.promise===p&&(te=null)}}async function Ie({preferWebGpu:e=!0,force:t=!1,navigatorRef:n=o,device:r=null,deviceResult:i=null,gridSpacingM:a=k?.smoothingLengthM,parityTolerance:c=.05,webGpuRunner:l=void 0}={}){if(!k||!N)return R=null,u.userData.mlsMpmP2gGridProjection=null,null;let d=Ee({gridSpacingM:a});if(!t&&z===d&&R)return R;if(!t&&ne?.signature===d)return ne.promise;let f=(async()=>{let t=e&&!r&&!i?await xe(n):i,o=e?await je({preferWebGpu:e,navigatorRef:n,device:r,deviceResult:t}):A,f=e?await Me({preferWebGpu:e,navigatorRef:n,device:r,deviceResult:t}):P,p=await S_({sphParticleState:k,mlsMpmParticleState:N,sphParticleUpload:o,mlsMpmParticleUpload:f,gridSpacingM:a,boxDimsM:s,preferWebGpu:e,navigatorRef:n,device:r,deviceResult:t,parityTolerance:c,retainGridBuffer:!0,webGpuRunner:l,onDeviceLost(){O=null}});return p.signature=d,!Ye||Ee({gridSpacingM:a})!==d?{...p,stale:!0}:(R=p,z=d,u.userData.mlsMpmP2gGridProjection=p,p)})();ne={signature:d,promise:f};try{return await f}finally{ne?.promise===f&&(ne=null)}}async function Le({preferWebGpu:e=!0,force:t=!1,navigatorRef:n=o,device:r=null,deviceResult:i=null,p2gGridProjection:a=R,dt:c=N?.mechanicsDtS??a?.dt??0,gravityMPerS2:l=N?.gravityMPerS2??[0,-9.80665,0],cflFactor:d=N?.gridCflFactor||.6,parityTolerance:f=1e-5,webGpuRunner:p=void 0}={}){if(!a?.schema)return re=null,u.userData.mlsMpmGridUpdate=null,null;let m=De({p2gGridProjection:a,dt:c,gravityMPerS2:l,cflFactor:d});if(!t&&ie===m&&re)return re;if(!t&&ae?.signature===m)return ae.promise;let h=(async()=>{let t=e&&!r&&!i?await xe(n):i,o=await G_({p2gGridProjection:a,p2gGridBuffer:a?.gpuResult?.gridBuffer??a?.gridBuffer??null,dt:c,gravityMPerS2:l,boxDimsM:s,cflFactor:d,preferWebGpu:e,navigatorRef:n,device:r,deviceResult:t,parityTolerance:f,retainUpdatedGridBuffer:!0,webGpuRunner:p,onDeviceLost(){O=null}});return o.signature=m,!Ye||De({p2gGridProjection:a,dt:c,gravityMPerS2:l,cflFactor:d})!==m?{...o,stale:!0}:(re=o,ie=m,u.userData.mlsMpmGridUpdate=o,o)})();ae={signature:m,promise:h};try{return await h}finally{ae?.promise===h&&(ae=null)}}async function Re({preferWebGpu:e=!0,force:t=!1,navigatorRef:n=o,device:r=null,deviceResult:i=null,gridUpdate:a=re,dt:c=a?.dt??N?.mechanicsDtS??0,parityTolerance:l=.05,webGpuRunner:d=void 0}={}){if(!k||!N||!a?.schema)return oe=null,u.userData.mlsMpmG2pReconstruction=null,null;let f=Oe({gridUpdate:a,dt:c});if(!t&&se===f&&oe)return oe;if(!t&&ce?.signature===f)return ce.promise;let p=(async()=>{let t=e&&!r&&!i?await xe(n):i,o=e?await je({preferWebGpu:e,navigatorRef:n,device:r,deviceResult:t}):A,p=e?await Me({preferWebGpu:e,navigatorRef:n,device:r,deviceResult:t}):P,m=await _v({sphParticleState:k,mlsMpmParticleState:N,gridUpdate:a,sphParticleUpload:o,mlsMpmParticleUpload:p,updatedGridBuffer:a?.gpuResult?.updatedGridBuffer??a?.updatedGridBuffer??null,dt:c,boxDimsM:s,preferWebGpu:e,navigatorRef:n,device:r,deviceResult:t,parityTolerance:l,webGpuRunner:d,onDeviceLost(){O=null}});return m.signature=f,!Ye||Oe({gridUpdate:a,dt:c})!==f?{...m,stale:!0}:(oe=m,se=f,u.userData.mlsMpmG2pReconstruction=m,m)})();ce={signature:f,promise:p};try{return await p}finally{ce?.promise===p&&(ce=null)}}async function ze({preferWebGpu:e=!0,force:t=!1,navigatorRef:n=o,device:r=null,deviceResult:i=null,gridSpacingM:a=k?.smoothingLengthM,dt:c=N?.mechanicsDtS??0,gravityMPerS2:l=N?.gravityMPerS2??[0,-9.80665,0],cflFactor:d=N?.gridCflFactor||.6,readbackMode:f=ex,parityTolerances:p=void 0,p2gRunner:m=void 0,gridUpdateRunner:h=void 0,g2pRunner:g=void 0}={}){if(!k||!N)return U(),null;let _=ax(f);u.userData.mlsMpmResidentRequestedReadbackMode=_;let v=V({gridSpacingM:a,dt:c,gravityMPerS2:l,cflFactor:d,readbackMode:_});if(!t&&ue===v&&le)return le;if(!t&&de?.signature===v)return de.promise;let y=(async()=>{let t=e&&!r&&!i?await xe(n):i,o=e?await je({preferWebGpu:e,navigatorRef:n,device:r,deviceResult:t}):A,u=e?await Me({preferWebGpu:e,navigatorRef:n,device:r,deviceResult:t}):P,f=await db({sphParticleState:k,mlsMpmParticleState:N,sphParticleUpload:o,mlsMpmParticleUpload:u,gridSpacingM:a,boxDimsM:s,dt:c,gravityMPerS2:l,cflFactor:d,preferWebGpu:e,navigatorRef:n,device:r,deviceResult:t,readbackMode:_,thermalMaterialTable:he,thermalStepOptions:{thermalClosureGraphSet:ge,thermalClosureGraphBank:ge?.graphBank??null,thermalPhaseResponseTable:_e},reactionTable:ve,parityTolerances:p,p2gRunner:m,gridUpdateRunner:h,g2pRunner:g,onDeviceLost(){O=null}});return f.requestedReadbackMode=_,f.signature=v,!Ye||V({gridSpacingM:a,dt:c,gravityMPerS2:l,cflFactor:d,readbackMode:_})!==v?{...f,stale:!0}:(U(),Ae(f,v),f)})();de={signature:v,promise:y};try{return await y}finally{de?.promise===y&&(de=null)}}async function Be({preferWebGpu:e=!0,force:t=!1,navigatorRef:n=o,device:r=null,deviceResult:i=null,gridSpacingM:a=k?.smoothingLengthM,dt:c=N?.mechanicsDtS??0,gravityMPerS2:l=N?.gravityMPerS2??[0,-9.80665,0],cflFactor:d=N?.gridCflFactor||.6,readbackMode:f=ex,parityTolerances:p=void 0,p2gRunner:m=void 0,gridUpdateRunner:h=void 0,g2pRunner:g=void 0,stepCount:_=1,retainIntermediateSteps:v=!1,continueFromResidentState:y=!1}={}){if(!k||!N)return U(),null;let b=ke(_),x=ax(f);u.userData.mlsMpmResidentRequestedReadbackMode=x;let S=fe?.nextParticleUploads??null,C=!!(y&&x===nx&&fe?.nextSphParticleState&&fe?.nextMlsMpmParticleState&&S?.sphParticleUpload?.status===`webgpu-uploaded`&&S?.mlsMpmParticleUpload?.status===`webgpu-uploaded`),w=C?fe.nextSphParticleState:k,T=C?fe.nextMlsMpmParticleState:N,E=C?`previous-gpu-resident-output`:`cpu-packed-state`,D=H({sphParticleState:w,mlsMpmParticleState:T,gridSpacingM:a,dt:c,gravityMPerS2:l,cflFactor:d,readbackMode:x,stepCount:b,retainIntermediateSteps:v,residentSourceMode:E});if(!t&&pe===D&&fe)return fe;if(!t&&me?.signature===D)return me.promise;let j=(async()=>{let t=e&&!r&&!i?await xe(n):i,o=await gb({sphParticleState:w,mlsMpmParticleState:T,sphParticleUpload:C?S.sphParticleUpload:e?await je({preferWebGpu:e,navigatorRef:n,device:r,deviceResult:t}):A,mlsMpmParticleUpload:C?S.mlsMpmParticleUpload:e?await Me({preferWebGpu:e,navigatorRef:n,device:r,deviceResult:t}):P,gridSpacingM:a,boxDimsM:s,dt:c,gravityMPerS2:l,cflFactor:d,preferWebGpu:e,navigatorRef:n,device:r,deviceResult:t,readbackMode:x,thermalMaterialTable:he,thermalStepOptions:{thermalClosureGraphSet:ge,thermalClosureGraphBank:ge?.graphBank??null,thermalPhaseResponseTable:_e},reactionTable:ve,parityTolerances:p,p2gRunner:m,gridUpdateRunner:h,g2pRunner:g,stepCount:b,retainIntermediateSteps:v,onDeviceLost(){O=null}});o.requestedReadbackMode=x,o.residentSourceMode=E,o.continuedFromResidentState=C,o.continuationAvailable=!!o.nextParticleUploads,o.finalStep&&(o.finalStep.requestedReadbackMode=x);for(let e of o.stepSummaries??[])e.requestedReadbackMode=x;return o.signature=D,!Ye||H({sphParticleState:w,mlsMpmParticleState:T,gridSpacingM:a,dt:c,gravityMPerS2:l,cflFactor:d,readbackMode:x,stepCount:b,retainIntermediateSteps:v,residentSourceMode:E})!==D?{...o,stale:!0}:(U(),Ae(o.finalStep,D,{stepsExecution:o,stepsSignature:D}),o)})();me={signature:D,promise:j};try{return await j}finally{me?.promise===j&&(me=null)}}function Ve(e,t=null,n=null){let r=lx(e),i=r.surfaceKey,a=n||rx[r.renderKey]||rx.default,o=C.get(i);if(o)if(o.properties!==t||o.config.resolution!==a.resolution||o.config.isolation!==a.isolation||o.config.subtract!==a.subtract||o.config.maxPolyCount!==a.maxPolyCount)u.remove(o.mesh),o.mesh.geometry?.dispose?.(),o.mesh.material.dispose(),C.delete(i);else return o;let s=new Wl(a.resolution,hx(r,t),!1,!0,a.maxPolyCount);return s.isolation=a.isolation,s.scale.setScalar(c/(2*(1-2*ox))),s.position.set(c/2,c/2,c/2),s.frustumCulled=!1,s.userData.renderMode=$b,s.userData.materialKey=r.material,s.userData.renderKey=r.renderKey,s.userData.phase=r.phase,s.userData.optical=s.material.userData.optical,u.add(s),o={mesh:s,config:a,properties:t,descriptor:r},C.set(i,o),o}Ve(`h2o`),Ve(`fe`);function He(e,{materialProperties:t=null}={}){w=bx(e,{materialProperties:t}),T=xx(w,e),E+=1,u.userData.opticalGpuTable=w,u.userData.opticalGpuLookup=T,u.userData.opticalGpuLookupExecution=null,u.userData.opticalGpuLookupDrawState=null}function Ue(e,{emissiveByMaterial:t=null,materialProperties:n=null,renderSource:i=`cpu-particles`,renderRowsExecution:a=null}={}){let o=new Set,s=new Map(w.recordMetadata.map(e=>[`${e.material}|${e.phase}`,e]));for(let u of e){let e=ux(u.descriptor,n),{mesh:d,config:f}=Ve(u.descriptor,e);d.userData.optical=d.material.userData.optical,d.userData.materialKey=u.material,d.userData.renderKey=u.renderKey,d.userData.phase=u.phase,d.userData.renderSource=i,d.userData.renderRowsExecutionSchema=a?.schema||null,d.userData.renderRowsBackend=a?.backend||null,d.userData.opticalGpuRecord=s.get(`${u.material}|${u.phase}`)||null;let p=t?.[u.material]??t?.[u.renderKey]??null;p?(d.material.emissive.setRGB(p[0],p[1],p[2],Pe),d.material.emissiveIntensity=1.8):(d.material.emissive.setRGB(0,0,0),d.material.emissiveIntensity=0),d.reset();let m=(Number.isFinite(r)?r:u.surfaceRadiusM)*l,h=ix(m/c,.006,.14),g=(d.isolation+f.subtract)*h*h;for(let e=0;e<u.count;e+=1)d.addBall(u.normalizedPositions[e*3],u.normalizedPositions[e*3+1],u.normalizedPositions[e*3+2],g,f.subtract,[u.colorsRgb[e*3],u.colorsRgb[e*3+1],u.colorsRgb[e*3+2]]);d.update(),d.visible=u.count>0,d.userData.particleCount=u.count,d.userData.surfaceRadiusM=m,o.add(u.surfaceKey)}for(let[e,t]of C)o.has(e)||(t.mesh.reset(),t.mesh.update(),t.mesh.visible=!1,t.mesh.userData.renderSource=i)}function We(e){if(!e?.colorsRgb?.length||!e.count)return[1,1,1];let t=0,n=0,r=0;for(let i=0;i<e.count;i+=1)t+=e.colorsRgb[i*3],n+=e.colorsRgb[i*3+1],r+=e.colorsRgb[i*3+2];return[t/e.count,n/e.count,r/e.count].map(e=>ix(e,0,1))}function Ge(e){return Jb(e.map(e=>{let t=rx[e.renderKey]||rx.default,n=ix((Number.isFinite(r)?r:e.surfaceRadiusM)*l/c,.006,.14);return{surfaceKey:e.surfaceKey,material:e.material,phase:e.phase,renderKey:e.renderKey,resolution:Math.min(t.resolution,sx),isolation:t.isolation,subtract:t.subtract,radiusNorm:n,strength:(t.isolation+t.subtract)*n*n,colorLinear:We(e),status:1}}))}function Ke(e,{emissiveByMaterial:t=null,materialProperties:n=null,renderSource:r=`resident-gpu-render-field`,renderRowsExecution:i=null,renderFieldExecution:a=null}={}){let o=new Set,s=new Map(w.recordMetadata.map(e=>[`${e.material}|${e.phase}`,e]));for(let l of e){let e=lx({material:l.material,phase:l.phase,renderKey:l.renderKey}),{mesh:u}=Ve(e,ux(e,n),{...rx[e.renderKey]||rx.default,resolution:l.resolution});if(u.field.length!==l.field.length||u.palette.length!==l.palette.length)throw Error(`Render field size mismatch for ${e.surfaceKey}`);u.userData.optical=u.material.userData.optical,u.userData.materialKey=e.material,u.userData.renderKey=e.renderKey,u.userData.phase=e.phase,u.userData.renderSource=r,u.userData.renderRowsExecutionSchema=i?.schema||null,u.userData.renderRowsBackend=i?.backend||null,u.userData.renderFieldExecutionSchema=a?.schema||null,u.userData.renderFieldBackend=a?.backend||null,u.userData.renderFieldInputSource=a?.renderFieldInputSource||null,u.userData.opticalGpuRecord=s.get(`${e.material}|${e.phase}`)||null;let d=t?.[e.material]??t?.[e.renderKey]??null;d?(u.material.emissive.setRGB(d[0],d[1],d[2],Pe),u.material.emissiveIntensity=1.8):(u.material.emissive.setRGB(0,0,0),u.material.emissiveIntensity=0),u.reset(),u.field.set(l.field),u.palette.set(l.palette),u.update();let f=0;for(let e=0;e<l.field.length;e+=1)l.field[e]>f&&(f=l.field[e]);u.visible=f>=l.isolation,u.userData.particleCount=null,u.userData.surfaceRadiusM=l.radiusNorm*c,u.userData.renderFieldResolution=l.resolution,u.userData.renderFieldCells=l.fieldCellCount,u.userData.renderFieldMaxDensity=f,o.add(e.surfaceKey)}for(let[e,t]of C)o.has(e)||(t.mesh.reset(),t.mesh.update(),t.mesh.visible=!1,t.mesh.userData.renderSource=r)}function qe({positionsM:e,colorsRgb:n,materials:r=null,emissiveByMaterial:i=null,materialProperties:a=null,reactions:o=null,reactionContactRadiusM:c=null,sphGpuParticleState:l=null,mlsMpmGpuParticleState:d=null}){let f=yx({positionsM:e,colorsRgb:n,materials:r,boxEdgeM:t,boxDimsM:s});he=a?ey(a):null,ge=he?oy(he):null,_e=he&&ge?ly(he,ge):null,ve=a?zy(o||[],{materialProperties:a,contactRadiusM:c??l?.smoothingLengthM??0}):null,He(f,{materialProperties:a}),u.userData.sphThermalMaterialTable=he,u.userData.sphThermalClosureGraphBuffers=ge,u.userData.sphThermalPhaseResponseTable=_e,u.userData.sphReactionTable=ve,ye=null,u.userData.sphResidentRenderState=null,A?.status===`webgpu-uploaded`&&j!==Ce(l)&&wg(A),k=l,u.userData.sphGpuParticleState=k,A=null,j=null,u.userData.sphGpuParticleUpload=null,P?.status===`webgpu-uploaded`&&F!==we(d)&&Cg(P),N=d,u.userData.mlsMpmGpuParticleState=N,P=null,F=null,u.userData.mlsMpmGpuParticleUpload=null,ee=null,L=null,u.userData.mlsMpmMechanicsPrediction=null,U(),Ue(f,{emissiveByMaterial:i,materialProperties:a,renderSource:`cpu-particles`})}async function Je({preferWebGpu:e=!0,navigatorRef:n=o,device:r=null,deviceResult:i=null,residentSteps:a=fe,materialProperties:l=null}={}){let d=a?.finalStep||le||null,f=a?.nextSphParticleState||k,p=a?.nextParticleUploads?.sphParticleUpload||d?.nextParticleUploads?.sphParticleUpload||null;if(!f?.schema||p?.status!==`webgpu-uploaded`)return ye={schema:`peercompute.ulg.sph-resident-render-state.v0`,status:`resident-render-rows-unavailable`,source:`cpu-particles`,reason:`retained resident SPH buffers are not available`,particleCount:f?.particleCount??0,gpuAuthoritativeState:!1,compactRenderReadback:!1,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1},u.userData.sphResidentRenderState=ye,ye;let m=r?{status:`webgpu-device-ready`,reason:`provided device`,device:r}:i||(e?await xe(n):null);if(!m?.device)return ye={schema:`peercompute.ulg.sph-resident-render-state.v0`,status:`resident-render-webgpu-unavailable`,source:`cpu-particles`,reason:m?.reason||`WebGPU render-row extraction not available`,particleCount:f.particleCount,gpuAuthoritativeState:!1,compactRenderReadback:!1,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1},u.userData.sphResidentRenderState=ye,ye;let h=null;try{h=await Qb({device:m.device,sphParticleState:f,sphParticleUpload:p,sourceStateBuffer:p.stateBuffer,sourceThermoBuffer:p.thermoBuffer,retainRenderRowsBuffer:!0});let i=Ub(h.renderRows,{materialProperties:l||{},reactionTable:ve}),a=yx({positionsM:i.positionsM,colorsRgb:i.colorsRgb,materials:i.materials,boxEdgeM:t,boxDimsM:s});He(a,{materialProperties:l});let o=Ge(a),d=null,g=`resident-gpu-render-field`;try{d=await Zb({device:m.device,renderRows:h.renderRows,renderRowsBuffer:h.renderRowsBuffer||null,surfaceTable:o,particleCount:h.particleCount,fieldPadding:ox,refEdgeM:c}),Ke(Xb(d),{emissiveByMaterial:i.emissiveByMaterial,materialProperties:l,renderSource:g,renderRowsExecution:h,renderFieldExecution:d})}catch(e){g=`resident-gpu-render-rows`,Ue(a,{emissiveByMaterial:i.emissiveByMaterial,materialProperties:l,renderSource:g,renderRowsExecution:h}),d={schema:`peercompute.ulg.sph-gpu-render-field.v0`,backend:`cpu-fallback`,status:`render-field-fallback-to-render-rows`,reason:e instanceof Error?e.message:String(e),surfaceCount:o.surfaceCount,totalFieldCells:o.totalFieldCells,renderFieldInputSource:null,renderFieldReadback:!1,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1}}return await Se({preferWebGpu:e,navigatorRef:n,device:r,deviceResult:m}),ye={schema:`peercompute.ulg.sph-resident-render-state.v0`,status:g===`resident-gpu-render-field`?`resident-render-field-applied`:`resident-render-rows-applied`,source:g,sourceExecutionSchema:g===`resident-gpu-render-field`?d.schema:h.schema,backend:g===`resident-gpu-render-field`?d.backend:h.backend,particleCount:i.particleCount,surfaceCount:a.length,rowStrideFloats:h.rowStrideFloats,renderRowByteLength:h.renderRowByteLength,renderFieldCellStrideFloats:d?.rowStrideFloats??null,renderFieldByteLength:d?.fieldRowByteLength??0,renderFieldReadback:!!d?.renderFieldReadback,renderFieldStatus:d?.status??null,renderFieldBackend:d?.backend??null,renderFieldInputSource:d?.renderFieldInputSource??null,renderFieldSurfaceCount:d?.surfaceCount??o.surfaceCount,renderFieldTotalCells:d?.totalFieldCells??o.totalFieldCells,renderRowsBufferRetained:!!h.renderRowsBufferRetained,renderRowsBufferByteLength:h.renderRowsBufferByteLength??0,compactRenderReadback:!0,materialKeys:[...new Set(i.materials.map(e=>e.material))],phaseKeys:[...new Set(i.materials.map(e=>e.phase))],gpuAuthoritativeState:!0,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1},u.userData.sphResidentRenderState=ye,ye}catch(e){return ye={schema:`peercompute.ulg.sph-resident-render-state.v0`,status:`resident-render-rows-error`,source:`cpu-particles`,reason:e instanceof Error?e.message:String(e),particleCount:f.particleCount,gpuAuthoritativeState:!1,compactRenderReadback:!1,scientificValidation:!1,sphValidation:!1,phaseChangeValidation:!1,fullPhysicsValidation:!1},u.userData.sphResidentRenderState=ye,ye}finally{h?.destroyRenderRowsBuffer?.()}}let Ye=!0;function W(){Ye&&(v.update(),h.render(u,p),requestAnimationFrame(W))}W();function G(){let t=e.clientWidth||d,n=e.clientHeight||f;p.aspect=t/n,p.updateProjectionMatrix(),h.setSize(t,n)}window.addEventListener(`resize`,G);function Xe(){Ye=!1,window.removeEventListener(`resize`,G),v.dispose();for(let{mesh:e}of C.values())e.geometry.dispose(),e.material.dispose();_.dispose(),g.dispose(),A?.status===`webgpu-uploaded`&&wg(A),P?.status===`webgpu-uploaded`&&Cg(P),U(),h.dispose(),h.domElement.parentNode&&h.domElement.parentNode.removeChild(h.domElement)}function Ze(e){Number.isFinite(e)&&e>0&&(l=e)}return{setParticles:qe,setSurfaceRadiusScale:Ze,dispose:Xe,scene:u,camera:p,getOpticalGpuTable(){return w},getOpticalGpuLookup(){return T},getSphThermalMaterialTable(){return he},getSphThermalClosureGraphBuffers(){return ge},getSphThermalPhaseResponseTable(){return _e},getSphReactionTable(){return ve},getOpticalGpuDrawState(){return u.userData.opticalGpuLookupDrawState},getSphGpuParticleState(){return k},getSphGpuParticleUpload(){return A},getMlsMpmGpuParticleState(){return N},getMlsMpmGpuParticleUpload(){return P},getMlsMpmMechanicsPrediction(){return ee},getMlsMpmP2gGridProjection(){return R},getMlsMpmGridUpdate(){return re},getMlsMpmG2pReconstruction(){return oe},getMlsMpmResidentStep(){return le},getMlsMpmResidentSteps(){return fe},getMlsMpmResidentRequestedReadbackMode(){return u.userData.mlsMpmResidentRequestedReadbackMode},getSphResidentRenderState(){return ye},refreshOpticalGpuLookup:Se,refreshSphGpuParticleBuffers:je,refreshMlsMpmGpuParticleBuffers:Me,refreshMlsMpmMechanicsPrediction:Ne,refreshMlsMpmP2gGridProjection:Ie,refreshMlsMpmGridUpdate:Le,refreshMlsMpmG2pReconstruction:Re,refreshMlsMpmResidentStep:ze,refreshMlsMpmResidentSteps:Be,refreshSphResidentRenderState:Je,requestOpticalGpuDevice:xe}}var wx=Rf/zf**3,Tx=27.211386245988,Ex=-.895929;function Dx(e,{emptyCoreRadiusBohr:t=0,madelungCoefficient:n=Ex,valence:r=1}={}){let i=n*r**(2/3)/e,a=1.5*r*t*t/(e*e*e);return tp(e)+i+a}function Ox(e={},{lo:t=1,hi:n=8,iterations:r=200}={}){let i=(Math.sqrt(5)-1)/2,a=t,o=n,s=o-i*(o-a),c=a+i*(o-a),l=t=>Dx(t,e);for(let e=0;e<r;e+=1)l(s)<l(c)?o=c:a=s,s=o-i*(o-a),c=a+i*(o-a);return .5*(a+o)}function kx(e,t={}){let n=e=>4*Math.PI/3*e**3,r=e=>(3*e/(4*Math.PI))**(1/3),i=n(e),a=i*.001,o=Dx(r(i+a),t),s=Dx(e,t),c=Dx(r(i-a),t);return i*((o-2*s+c)/(a*a))*wx}function Ax({atomicMassKg:e,valenceElectronsPerAtom:t=1,emptyCoreRadiusBohr:n=0,madelungCoefficient:r=Ex}){let i={emptyCoreRadiusBohr:n,madelungCoefficient:r,valence:t},a=Ox(i);return{equilibriumRsBohr:a,equilibriumDensityKgPerM3:e/(t*(4*Math.PI/3*(a*zf)**3)),bulkModulusPa:kx(a,i),bindingEnergyEvPerElectron:Dx(a,i)*Tx,numberDensityPerBohr3:Kf(a)}}var jx=`ulg.material-property-provenance.v0`,Mx=Object.freeze({LOWER_LEVEL_SIMULATION:`lower-level-simulation`,DERIVED_FROM_LOWER_LEVEL:`derived-from-lower-level`,PHYSICAL_LAW:`physical-law`,EXACT_CONSTANT:`exact-constant`,REFERENCE_FALLBACK:`reference-fallback`,REDUCED_ESTIMATE:`reduced-estimate`,BLOCKED:`blocked`});new Set([Mx.LOWER_LEVEL_SIMULATION,Mx.DERIVED_FROM_LOWER_LEVEL,Mx.PHYSICAL_LAW,Mx.EXACT_CONSTANT]);var Nx=new Set([Mx.REFERENCE_FALLBACK,Mx.REDUCED_ESTIMATE,Mx.BLOCKED]),Px=class extends Error{constructor(e,{material:t=null,context:n=null,blockers:r=[],summary:i=null}={}){super(e),this.name=`MaterialFirstPrinciplesResolutionError`,this.code=`material-properties-not-first-principles`,this.material=t,this.context=n,this.blockers=r,this.summary=i}};function Fx(e){if(!Array.isArray(e)||e.length===0)throw TypeError(`provenance entry requires non-empty paths`);return e.map(e=>{if(typeof e!=`string`||e.length===0)throw TypeError(`provenance path must be a non-empty string`);return e})}function Ix({paths:e,status:t,source:n,method:r,inputs:i=[],accuracy:a=`evidence-only`,blockers:o=[]}){if(!Object.values(Mx).includes(t))throw TypeError(`unknown property derivation status: ${t}`);return{paths:Fx(e),status:t,source:n,method:r,inputs:i,accuracy:a,blockers:o}}function Lx(e){let t=[];for(let n of e.phases||[]){let e=`phases.${n.name}`;for(let r of[`cpJPerKgK`,`densityKgPerM3`,`bulkModulusPa`,`shearModulusPa`,`debyeTemperatureK`])n[r]!==void 0&&n[r]!==null&&t.push(`${e}.${r}`);if(Array.isArray(n.temperatureRange)&&t.push(`${e}.temperatureRange`),n.eos)for(let r of[`gruneisen`,`bulkModulusPa`,`referenceDensityKgPerM3`,`referenceTemperatureK`])n.eos[r]!==void 0&&n.eos[r]!==null&&t.push(`${e}.eos.${r}`)}return t}function Rx(e){let t=[];for(let n of e.transitions||[]){let e=`${n.from}->${n.to}`;for(let r of[`temperatureK`,`latentHeatJPerKg`])n[r]!==void 0&&n[r]!==null&&t.push(`transitions.${e}.${r}`)}return t}function zx(e={}){let t=[];for(let n of[`molarMassKgPerMol`,`atomsPerFormula`,`conductionElectronDensityPerM3`,`intrinsicColorSrgb`,`opticalInterbandOscillators`,`idealGas`])e[n]!==void 0&&e[n]!==null&&t.push(n);return t.push(...Lx(e)),t.push(...Rx(e)),t}function Bx(e,t){if(e===t||e===`*`)return!0;let n=e.split(`.`),r=t.split(`.`);return n.length===r.length?n.every((e,t)=>e===`*`||e===r[t]):!1}function Vx(e={},t){return(e.propertyProvenance?.entries||[]).filter(e=>e.paths.some(e=>Bx(e,t)))}function Hx(e={}){return zx(e).filter(t=>Vx(e,t).length===0)}function Ux({entries:e,notes:t=[]}={}){if(!Array.isArray(e))throw TypeError(`property provenance ledger requires entries`);return{schema:jx,entries:e,notes:t}}function Wx(e,{entries:t,notes:n=[]}){return{...e,propertyProvenance:Ux({entries:t,notes:n})}}function Gx(e={}){let t=e.propertyProvenance?.entries||[],n={};for(let e of t)n[e.status]=(n[e.status]||0)+e.paths.length;let r=Hx(e),i=t.filter(e=>Nx.has(e.status)),a=[...new Set(i.flatMap(e=>e.blockers||[]))];return{schema:jx,trackedPropertyCount:zx(e).length,entryCount:t.length,counts:n,unprovenanced:r,fullyLowerLevelDerived:r.length===0&&i.length===0,hasReferenceFallbacks:i.some(e=>e.status===Mx.REFERENCE_FALLBACK),hasReducedEstimates:i.some(e=>e.status===Mx.REDUCED_ESTIMATE),blockers:a}}function Kx(e={}){let t=Hx(e);if(t.length>0)throw Error(`material properties missing provenance: ${t.join(`, `)}`);return!0}function qx(e={},{material:t=null,context:n=`material-resolution`}={}){Kx(e);let r=Gx(e);if(!r.fullyLowerLevelDerived)throw new Px(`${t?`${t} `:``}material properties are not first-principles-derived`,{material:t,context:n,blockers:r.blockers,summary:r});return!0}function Jx(e={},{context:t=`material-map`}={}){for(let[n,r]of Object.entries(e))qx(r,{material:n,context:t});return!0}var Yx=1054571817e-43,Xx=1380649e-29,Zx=602214076e15,Qx=1602176634e-28,$x=1e6,eS=.3,tS=.07,nS=.05,rS=8.314462618,iS=43597447222071e-31,aS=.68,oS=.16,sS=new Set([2,10,18,36,54,86,118]);function cS(e,t,{gridPointsN:n=700,rMaxBohr:r=30}={}){let i=e-t;if(i<=0)return 0;let{r:a,rho:o,dx:s}=Cp(e,{returnRadialDensity:!0,gridPointsN:n,rMaxBohr:r,maxScf:200}).radialGrid,c=0;for(let e=0;e<a.length;e+=1)if(c+=o[e]*4*Math.PI*a[e]*a[e]*a[e]*s,c>=i)return a[e];return a[a.length-1]}function lS(e,t,{gridPointsN:n=700,rMaxBohr:r=30}={}){let i=Cp(e,{returnRadialDensity:!0,gridPointsN:n,rMaxBohr:r,maxScf:200}),{r:a,rho:o,dx:s}=i.radialGrid,c=0;for(let e=0;e<a.length;e+=1)if(c+=o[e]*4*Math.PI*a[e]*a[e]*a[e]*s,c>=t)return{radiusBohr:a[e],atom:i};return{radiusBohr:a[a.length-1],atom:i}}function uS(e){let t=2*(2*e.l+1);return e.occupancy<=0||e.occupancy>=t?0:e.occupancy}function dS(e){let t=Qd(e),n=t.reduce((e,t)=>Math.max(e,t.n),0),r=t.filter(e=>e.n===n&&(e.l===0||e.l===1)).reduce((e,t)=>e+t.occupancy,0),i=t.filter(e=>e.l===2||e.l===3).reduce((e,t)=>e+uS(t),0);return Math.max(1,r+i)}function fS(e){return Qd(e).some(e=>(e.l===2||e.l===3)&&uS(e)>0)}function pS(e,t){let n=Qd(t),r=n.reduce((e,t)=>Math.max(e,t.n),0),i=new Set(n.filter(e=>e.n===r||(e.l===2||e.l===3)&&uS(e)>0).map(e=>`${e.n}:${e.l}`)),a=0,o=0;for(let t of e.orbitals||[])i.has(`${t.n}:${t.l}`)&&(a+=Math.abs(t.energyHa)*t.occupancy,o+=t.occupancy);return o>0?a:Math.abs(e.orbitals?.at(-1)?.energyHa??.05)}function mS(e,t,n={}){let r=bm({atomicNumberZ:e,conductionElectronDensityPerM3:t,interbandOptions:n.opticalInterbandOptions||{}});return{srgb:[r.r,r.g,r.b],plasmaRadPerS:r.plasmaRadPerS,interbandOscillators:r.interbandOscillators}}function hS(e,t={}){let n=qd(e),r=nf(e),i=dS(e),a=Wd(e),o=a*Zx;if(sS.has(e))return{atomicNumberZ:e,symbol:n,configuration:$d(e),valenceElectrons:r,bondingElectrons:i,molarMassKgPerMol:o,metallicModelApplicable:!1,note:sS.has(e)?`noble gas: closed shell`:r<=0?`closed-shell: no free-electron valence`:`full sp shell: not a free-electron metal`,closureBacked:!0,validation:{eosValidation:!1,thermalValidation:!1,opticalValidation:!1,scientificValidation:!1}};let s=fS(e)||r<=0||r>=8,c=s?null:cS(e,r,t),l;if(s){let n=Math.max(.5,e-Math.max(.5,i/4)),{radiusBohr:r,atom:o}=lS(e,n,t),s=4*Math.PI/3*(r*zf)**3/aS,c=a/s,u=Math.max(.005*Qx,pS(o,e)*iS*oS);l={equilibriumRsBohr:r,equilibriumDensityKgPerM3:c,bulkModulusPa:Math.max(1e6,2*u/s),bindingEnergyEvPerElectron:u/(Qx*i),radialPackingRadiusBohr:r,radialPackingTargetElectrons:n,quantumDensityModel:`atomic-kohn-sham-radial-density-packing`}}else l=Ax({atomicMassKg:a,valenceElectronsPerAtom:r,emptyCoreRadiusBohr:c});let u=l.equilibriumDensityKgPerM3,d=l.bulkModulusPa,f=u/a,p=Math.sqrt(Math.max(d,0)/u),m=Mh({soundSpeedMPerS:p,numberDensityPerM3:f}),h=Fh(300,{debyeTemperatureK:m,molarMassKgPerMol:o,atomsPerFormula:1}),g=mS(e,r*f,t),_=d*(3*(1-2*eS))/(2*1.3),v=(1/f)**(1/3),y=s?nS:tS,b=y*y/3*v*v*a*Xx*m*m/(Yx*Yx);return{atomicNumberZ:e,symbol:n,configuration:$d(e),valenceElectrons:r,bondingElectrons:i,molarMassKgPerMol:o,metallicModelApplicable:!s,condensedModelApplicable:!0,emptyCoreRadiusBohr:c,radialPackingRadiusBohr:l.radialPackingRadiusBohr,radialPackingTargetElectrons:l.radialPackingTargetElectrons,equilibriumWignerSeitzRadiusBohr:l.equilibriumRsBohr,densityKgPerM3:u,bulkModulusPa:d,shearModulusPa:_,soundSpeedMPerS:p,debyeTemperatureK:m,cpJPerKgK:h,conductionElectronDensityPerM3:r*f,opticalColorSrgb:g.srgb,opticalInterbandOscillators:g.interbandOscillators,plasmaFrequencyRadPerS:g.plasmaRadPerS,meltingPointK:b,lindemannRatio:y,derivation:s?`atomic-DFT radial density -> quantum packing/cohesion-density cold curve -> Debye (cp, θ_D) -> Lindemann melt + Poisson shear; scalar-relativistic Kohn-Sham Drude-Lorentz colour`:`atomic-DFT core radius -> polyvalent jellium cohesion (density, B) -> Debye (cp, θ_D) -> Lindemann melt + Poisson shear; scalar-relativistic Kohn-Sham Drude-Lorentz colour`,closureBacked:!0,validation:{eosValidation:!1,thermalValidation:!1,opticalValidation:!1,scientificValidation:!1}}}var gS=new Map;function _S(e,t={}){let n=t.allowReducedEstimates===!0;if(gS.has(e)){let t=gS.get(e);return t&&!n&&qx(t.properties,{material:t.symbol,context:`elementMaterialClosure`}),t}let r=hS(e,t);if(!r.condensedModelApplicable&&!r.metallicModelApplicable)return gS.set(e,null),null;let i=r.meltingPointK,a=r.densityKgPerM3*(1-3*r.lindemannRatio*r.lindemannRatio),o=i*rS/r.molarMassKgPerMol,s=Wx({molarMassKgPerMol:r.molarMassKgPerMol,atomsPerFormula:1,heatCapacityModel:{solid:`debye`,liquid:`derived-high-temperature-debye-limit`},derivation:r.derivation,conductionElectronDensityPerM3:r.conductionElectronDensityPerM3,intrinsicColorSrgb:r.opticalColorSrgb,opticalInterbandOscillators:r.opticalInterbandOscillators,phases:[{name:`solid`,cpJPerKgK:r.cpJPerKgK,densityKgPerM3:r.densityKgPerM3,temperatureRange:[0,i],debyeTemperatureK:r.debyeTemperatureK,bulkModulusPa:r.bulkModulusPa,shearModulusPa:r.shearModulusPa},{name:`liquid`,cpJPerKgK:r.cpJPerKgK*(1+r.lindemannRatio),densityKgPerM3:a,temperatureRange:[i,$x],bulkModulusPa:r.bulkModulusPa*(a/r.densityKgPerM3),shearModulusPa:0}],transitions:[{from:`solid`,to:`liquid`,temperatureK:i,latentHeatJPerKg:o}],closureBacked:!0,validation:{eosValidation:!1,thermalValidation:!1,opticalValidation:!1,scientificValidation:!1}},{entries:[Ix({paths:[`molarMassKgPerMol`,`atomsPerFormula`],status:Mx.EXACT_CONSTANT,source:`periodic-table-atomic-mass`,method:`element formula mass from atomic mass`}),Ix({paths:[`conductionElectronDensityPerM3`,`intrinsicColorSrgb`,`opticalInterbandOscillators`,`phases.solid.cpJPerKgK`,`phases.solid.densityKgPerM3`,`phases.solid.bulkModulusPa`,`phases.solid.shearModulusPa`,`phases.solid.debyeTemperatureK`,`phases.solid.temperatureRange`,`transitions.solid->liquid.temperatureK`,`phases.liquid.cpJPerKgK`,`phases.liquid.densityKgPerM3`,`phases.liquid.bulkModulusPa`,`phases.liquid.temperatureRange`],status:Mx.LOWER_LEVEL_SIMULATION,source:`atomic-dft+jellium-debye-lindemann`,method:`atomic lower-level cold curve plus Debye/Lindemann model; liquid volume and bulk follow the Lindemann displacement at melt`}),Ix({paths:[`phases.liquid.shearModulusPa`],status:Mx.PHYSICAL_LAW,source:`continuum-mechanics`,method:`liquid phase has no static shear modulus`}),Ix({paths:[`transitions.solid->liquid.latentHeatJPerKg`],status:Mx.PHYSICAL_LAW,source:`richards-rule`,method:`universal fusion entropy law applied to the derived melting point`})],notes:[`Element closure is generalized across the periodic table domain; validation is evidence-only until DFT/MD benchmarks are produced.`]}),c={symbol:r.symbol,atomicNumberZ:e,properties:s,materialDerivation:Gx(s)};return gS.set(e,c),n||qx(s,{material:r.symbol,context:`elementMaterialClosure`}),c}function vS(){let e=[];for(let t=1;t<=118;t+=1){let n=nf(t);n>=1&&n<8&&![2,10,18,36,54,86,118].includes(t)&&e.push({Z:t,symbol:qd(t)})}return e}var yS=Object.freeze([{symbol:`H`,name:`Hydrogen`,Z:1,period:1,group:1,category:`nonmetal`},{symbol:`He`,name:`Helium`,Z:2,period:1,group:18,category:`noble`},{symbol:`Li`,name:`Lithium`,Z:3,period:2,group:1,category:`alkali`},{symbol:`Be`,name:`Beryllium`,Z:4,period:2,group:2,category:`alkaline`},{symbol:`B`,name:`Boron`,Z:5,period:2,group:13,category:`metalloid`},{symbol:`C`,name:`Carbon`,Z:6,period:2,group:14,category:`nonmetal`},{symbol:`N`,name:`Nitrogen`,Z:7,period:2,group:15,category:`nonmetal`},{symbol:`O`,name:`Oxygen`,Z:8,period:2,group:16,category:`nonmetal`},{symbol:`F`,name:`Fluorine`,Z:9,period:2,group:17,category:`halogen`},{symbol:`Ne`,name:`Neon`,Z:10,period:2,group:18,category:`noble`},{symbol:`Na`,name:`Sodium`,Z:11,period:3,group:1,category:`alkali`},{symbol:`Mg`,name:`Magnesium`,Z:12,period:3,group:2,category:`alkaline`},{symbol:`Al`,name:`Aluminum`,Z:13,period:3,group:13,category:`post-transition`},{symbol:`Si`,name:`Silicon`,Z:14,period:3,group:14,category:`metalloid`},{symbol:`P`,name:`Phosphorus`,Z:15,period:3,group:15,category:`nonmetal`},{symbol:`S`,name:`Sulfur`,Z:16,period:3,group:16,category:`nonmetal`},{symbol:`Cl`,name:`Chlorine`,Z:17,period:3,group:17,category:`halogen`},{symbol:`Ar`,name:`Argon`,Z:18,period:3,group:18,category:`noble`},{symbol:`K`,name:`Potassium`,Z:19,period:4,group:1,category:`alkali`},{symbol:`Ca`,name:`Calcium`,Z:20,period:4,group:2,category:`alkaline`},{symbol:`Sc`,name:`Scandium`,Z:21,period:4,group:3,category:`transition`},{symbol:`Ti`,name:`Titanium`,Z:22,period:4,group:4,category:`transition`},{symbol:`V`,name:`Vanadium`,Z:23,period:4,group:5,category:`transition`},{symbol:`Cr`,name:`Chromium`,Z:24,period:4,group:6,category:`transition`},{symbol:`Mn`,name:`Manganese`,Z:25,period:4,group:7,category:`transition`},{symbol:`Fe`,name:`Iron`,Z:26,period:4,group:8,category:`transition`},{symbol:`Co`,name:`Cobalt`,Z:27,period:4,group:9,category:`transition`},{symbol:`Ni`,name:`Nickel`,Z:28,period:4,group:10,category:`transition`},{symbol:`Cu`,name:`Copper`,Z:29,period:4,group:11,category:`transition`},{symbol:`Zn`,name:`Zinc`,Z:30,period:4,group:12,category:`transition`},{symbol:`Ga`,name:`Gallium`,Z:31,period:4,group:13,category:`post-transition`},{symbol:`Ge`,name:`Germanium`,Z:32,period:4,group:14,category:`metalloid`},{symbol:`As`,name:`Arsenic`,Z:33,period:4,group:15,category:`metalloid`},{symbol:`Se`,name:`Selenium`,Z:34,period:4,group:16,category:`nonmetal`},{symbol:`Br`,name:`Bromine`,Z:35,period:4,group:17,category:`halogen`},{symbol:`Kr`,name:`Krypton`,Z:36,period:4,group:18,category:`noble`},{symbol:`Rb`,name:`Rubidium`,Z:37,period:5,group:1,category:`alkali`},{symbol:`Sr`,name:`Strontium`,Z:38,period:5,group:2,category:`alkaline`},{symbol:`Y`,name:`Yttrium`,Z:39,period:5,group:3,category:`transition`},{symbol:`Zr`,name:`Zirconium`,Z:40,period:5,group:4,category:`transition`},{symbol:`Nb`,name:`Niobium`,Z:41,period:5,group:5,category:`transition`},{symbol:`Mo`,name:`Molybdenum`,Z:42,period:5,group:6,category:`transition`},{symbol:`Tc`,name:`Technetium`,Z:43,period:5,group:7,category:`transition`},{symbol:`Ru`,name:`Ruthenium`,Z:44,period:5,group:8,category:`transition`},{symbol:`Rh`,name:`Rhodium`,Z:45,period:5,group:9,category:`transition`},{symbol:`Pd`,name:`Palladium`,Z:46,period:5,group:10,category:`transition`},{symbol:`Ag`,name:`Silver`,Z:47,period:5,group:11,category:`transition`},{symbol:`Cd`,name:`Cadmium`,Z:48,period:5,group:12,category:`transition`},{symbol:`In`,name:`Indium`,Z:49,period:5,group:13,category:`post-transition`},{symbol:`Sn`,name:`Tin`,Z:50,period:5,group:14,category:`post-transition`},{symbol:`Sb`,name:`Antimony`,Z:51,period:5,group:15,category:`metalloid`},{symbol:`Te`,name:`Tellurium`,Z:52,period:5,group:16,category:`metalloid`},{symbol:`I`,name:`Iodine`,Z:53,period:5,group:17,category:`halogen`},{symbol:`Xe`,name:`Xenon`,Z:54,period:5,group:18,category:`noble`},{symbol:`Cs`,name:`Cesium`,Z:55,period:6,group:1,category:`alkali`},{symbol:`Ba`,name:`Barium`,Z:56,period:6,group:2,category:`alkaline`},{symbol:`La`,name:`Lanthanum`,Z:57,period:8,group:4,category:`lanthanide`},{symbol:`Ce`,name:`Cerium`,Z:58,period:8,group:5,category:`lanthanide`},{symbol:`Pr`,name:`Praseodymium`,Z:59,period:8,group:6,category:`lanthanide`},{symbol:`Nd`,name:`Neodymium`,Z:60,period:8,group:7,category:`lanthanide`},{symbol:`Pm`,name:`Promethium`,Z:61,period:8,group:8,category:`lanthanide`},{symbol:`Sm`,name:`Samarium`,Z:62,period:8,group:9,category:`lanthanide`},{symbol:`Eu`,name:`Europium`,Z:63,period:8,group:10,category:`lanthanide`},{symbol:`Gd`,name:`Gadolinium`,Z:64,period:8,group:11,category:`lanthanide`},{symbol:`Tb`,name:`Terbium`,Z:65,period:8,group:12,category:`lanthanide`},{symbol:`Dy`,name:`Dysprosium`,Z:66,period:8,group:13,category:`lanthanide`},{symbol:`Ho`,name:`Holmium`,Z:67,period:8,group:14,category:`lanthanide`},{symbol:`Er`,name:`Erbium`,Z:68,period:8,group:15,category:`lanthanide`},{symbol:`Tm`,name:`Thulium`,Z:69,period:8,group:16,category:`lanthanide`},{symbol:`Yb`,name:`Ytterbium`,Z:70,period:8,group:17,category:`lanthanide`},{symbol:`Lu`,name:`Lutetium`,Z:71,period:8,group:18,category:`lanthanide`},{symbol:`Hf`,name:`Hafnium`,Z:72,period:6,group:4,category:`transition`},{symbol:`Ta`,name:`Tantalum`,Z:73,period:6,group:5,category:`transition`},{symbol:`W`,name:`Tungsten`,Z:74,period:6,group:6,category:`transition`},{symbol:`Re`,name:`Rhenium`,Z:75,period:6,group:7,category:`transition`},{symbol:`Os`,name:`Osmium`,Z:76,period:6,group:8,category:`transition`},{symbol:`Ir`,name:`Iridium`,Z:77,period:6,group:9,category:`transition`},{symbol:`Pt`,name:`Platinum`,Z:78,period:6,group:10,category:`transition`},{symbol:`Au`,name:`Gold`,Z:79,period:6,group:11,category:`transition`},{symbol:`Hg`,name:`Mercury`,Z:80,period:6,group:12,category:`transition`},{symbol:`Tl`,name:`Thallium`,Z:81,period:6,group:13,category:`post-transition`},{symbol:`Pb`,name:`Lead`,Z:82,period:6,group:14,category:`post-transition`},{symbol:`Bi`,name:`Bismuth`,Z:83,period:6,group:15,category:`post-transition`},{symbol:`Po`,name:`Polonium`,Z:84,period:6,group:16,category:`post-transition`},{symbol:`At`,name:`Astatine`,Z:85,period:6,group:17,category:`halogen`},{symbol:`Rn`,name:`Radon`,Z:86,period:6,group:18,category:`noble`},{symbol:`Fr`,name:`Francium`,Z:87,period:7,group:1,category:`alkali`},{symbol:`Ra`,name:`Radium`,Z:88,period:7,group:2,category:`alkaline`},{symbol:`Ac`,name:`Actinium`,Z:89,period:9,group:4,category:`actinide`},{symbol:`Th`,name:`Thorium`,Z:90,period:9,group:5,category:`actinide`},{symbol:`Pa`,name:`Protactinium`,Z:91,period:9,group:6,category:`actinide`},{symbol:`U`,name:`Uranium`,Z:92,period:9,group:7,category:`actinide`},{symbol:`Np`,name:`Neptunium`,Z:93,period:9,group:8,category:`actinide`},{symbol:`Pu`,name:`Plutonium`,Z:94,period:9,group:9,category:`actinide`},{symbol:`Am`,name:`Americium`,Z:95,period:9,group:10,category:`actinide`},{symbol:`Cm`,name:`Curium`,Z:96,period:9,group:11,category:`actinide`},{symbol:`Bk`,name:`Berkelium`,Z:97,period:9,group:12,category:`actinide`},{symbol:`Cf`,name:`Californium`,Z:98,period:9,group:13,category:`actinide`},{symbol:`Es`,name:`Einsteinium`,Z:99,period:9,group:14,category:`actinide`},{symbol:`Fm`,name:`Fermium`,Z:100,period:9,group:15,category:`actinide`},{symbol:`Md`,name:`Mendelevium`,Z:101,period:9,group:16,category:`actinide`},{symbol:`No`,name:`Nobelium`,Z:102,period:9,group:17,category:`actinide`},{symbol:`Lr`,name:`Lawrencium`,Z:103,period:9,group:18,category:`actinide`},{symbol:`Rf`,name:`Rutherfordium`,Z:104,period:7,group:4,category:`transition`},{symbol:`Db`,name:`Dubnium`,Z:105,period:7,group:5,category:`transition`},{symbol:`Sg`,name:`Seaborgium`,Z:106,period:7,group:6,category:`transition`},{symbol:`Bh`,name:`Bohrium`,Z:107,period:7,group:7,category:`transition`},{symbol:`Hs`,name:`Hassium`,Z:108,period:7,group:8,category:`transition`},{symbol:`Mt`,name:`Meitnerium`,Z:109,period:7,group:9,category:`transition`},{symbol:`Ds`,name:`Darmstadtium`,Z:110,period:7,group:10,category:`transition`},{symbol:`Rg`,name:`Roentgenium`,Z:111,period:7,group:11,category:`transition`},{symbol:`Cn`,name:`Copernicium`,Z:112,period:7,group:12,category:`transition`},{symbol:`Nh`,name:`Nihonium`,Z:113,period:7,group:13,category:`post-transition`},{symbol:`Fl`,name:`Flerovium`,Z:114,period:7,group:14,category:`post-transition`},{symbol:`Mc`,name:`Moscovium`,Z:115,period:7,group:15,category:`post-transition`},{symbol:`Lv`,name:`Livermorium`,Z:116,period:7,group:16,category:`post-transition`},{symbol:`Ts`,name:`Tennessine`,Z:117,period:7,group:17,category:`halogen`},{symbol:`Og`,name:`Oganesson`,Z:118,period:7,group:18,category:`noble`}]),bS=new Set(vS().map(e=>e.symbol));function xS(e){return e===`Fe`?`fe`:e}var SS=Object.freeze(yS.filter(e=>bS.has(e.symbol)).map(e=>({...e,key:xS(e.symbol),kind:`element`,label:`${e.name} (${e.symbol}, Z=${e.Z}) - derived element`}))),CS=SS.find(e=>e.symbol===`Fe`),wS=Object.freeze([{key:`h2o`,label:`Water (H2O) - derived compound`,kind:`compound`,formula:`H2O`},{key:`h2`,label:`Hydrogen gas (H2) - first-principles gas`,kind:`compound`,formula:`H2`},{key:`o2`,label:`Oxygen gas (O2) - first-principles gas`,kind:`compound`,formula:`O2`}]),TS=Object.freeze([CS,...wS,...SS.filter(e=>e.symbol!==`Fe`)].filter(Boolean));Object.freeze(Object.fromEntries(TS.map(e=>[e.key,e])));var ES=`peercompute.ulg.reference-material-fixture.v0`,DS=Object.freeze({gasConstantJPerMolK:8.314462618,avogadroPerMol:602214076e15,standardAtmospherePa:101325}),OS=Object.freeze({h2o:{schema:ES,key:`h2o`,name:`water`,formula:`H2O`,molarMassKgPerMol:.0180153,densityKgPerM3:{solid:917,liquid:1e3,gas:.804},meltingPointK:273.15,boilingPointK:373.15,latentHeatFusionJPerKg:333550,latentHeatVaporizationJPerKg:2256e3,cpJPerKgK:{solid:2090,liquid:4186,gas:1996},provenance:{source:`reference-fixture`,closureBacked:!1,scientificValidation:!1,notes:[`Standard reference constants for H2O ice/liquid/vapor near 1 atm.`,`Not derived from a validated MoonLab/Eshkol microphysics closure (demo plan P2).`]}},fe:{schema:ES,key:`fe`,name:`iron`,formula:`Fe`,molarMassKgPerMol:.055845,densityKgPerM3:{solid:7874,liquid:7e3},meltingPointK:1811,latentHeatFusionJPerKg:247e3,cpJPerKgK:{solid:449,liquid:820},provenance:{source:`reference-fixture`,closureBacked:!1,scientificValidation:!1,notes:[`Standard reference constants for solid/liquid Fe.`,`Not derived from a validated MoonLab/Eshkol microphysics closure (demo plan P2).`]}},air:{schema:ES,key:`air`,name:`air`,formula:`N2-O2-Ar mixture`,molarMassKgPerMol:.0289647,cpJPerKgK:1005,cvJPerKgK:718,provenance:{source:`reference-fixture`,closureBacked:!1,scientificValidation:!1,notes:[`Dry-air mean molar mass and specific heats near standard conditions.`,`Sealed rigid box uses cv (constant volume); humidity/condensation deferred to demo plan P5.`]}}});function kS(e,t){let n=Number(e);if(!Number.isFinite(n)||n<=0)throw TypeError(`${t} must be a positive finite number`);return n}function AS({pressurePa:e,temperatureK:t,molarMassKgPerMol:n}={}){let r=kS(e,`pressurePa`),i=kS(t,`temperatureK`);return r*kS(n,`molarMassKgPerMol`)/(DS.gasConstantJPerMolK*i)}var jS=Object.freeze({service:`moonlab`,library:`libquantumsim.so`,method:`exact-diagonalization-of-jordan-wigner-molecular-hamiltonian`,solver:`shifted-power-iteration`,driver:`tools/moonlab-microphysics/h2_h2o_microphysics.c`});Object.freeze([{bondAngstrom:.4,totalEnergyHa:-.240069635},{bondAngstrom:.5,totalEnergyHa:-.566231085},{bondAngstrom:.6,totalEnergyHa:-.824082483},{bondAngstrom:.7,totalEnergyHa:-1.051742907},{bondAngstrom:.7414,totalEnergyHa:-1.14217064},{bondAngstrom:.8,totalEnergyHa:-1.127417488},{bondAngstrom:.9,totalEnergyHa:-1.101722002},{bondAngstrom:1,totalEnergyHa:-1.077807444},{bondAngstrom:1.1,totalEnergyHa:-1.057012205},{bondAngstrom:1.4,totalEnergyHa:-1.015582709},{bondAngstrom:1.8,totalEnergyHa:-.99903091},{bondAngstrom:2.2,totalEnergyHa:-1.006900662},{bondAngstrom:2.5,totalEnergyHa:-1.019782801}]);var MS=Object.freeze({numQubits:8,nuclearRepulsionHa:9.18953443,electronicHa:-77.084392034,totalEnergyHa:-67.894857604,quantitative:!1}),NS=27.211386245988;function PS(){return tu({artifactId:`moonlab:h2o-microphysics.v0`,species:`h2o`,producer:jS,data:{groundState:MS},derived:{totalEnergyHa:MS.totalEnergyHa,totalEnergyEv:MS.totalEnergyHa*NS},comparison:{note:`Minimal 8-qubit model Hamiltonian; full ab-initio H2O is ~-76.4 Ha.`},quantitative:!1,provenance:{notes:[`Exact ground state of MoonLab model H2O Hamiltonian; model-quality only.`]}})}function FS(e){return{schema:e.schema,species:e.species,status:e.status,quantitative:e.quantitative,artifactHash:Dd(e)}}var IS=8.314462618;function LS({meltingPointK:e,molarMassKgPerMol:t,entropyOfFusionJPerMolK:n=IS}){return e*n/t}var RS=529177210903e-22,zS=new Map;function BS(e){let t=2*(2*e.l+1);return e.occupancy<=0||e.occupancy>=t?0:e.occupancy}function VS(e){let t=Qd(e),n=t.reduce((e,t)=>Math.max(e,t.n),0),r=t.filter(e=>e.n===n&&(e.l===0||e.l===1)).reduce((e,t)=>e+t.occupancy,0),i=t.filter(e=>e.l===2||e.l===3).reduce((e,t)=>e+BS(t),0);return Math.max(1,Math.min(8,r+i))}function HS(e,t){let{r:n,rho:r,dx:i}=e.radialGrid,a=0;for(let e=0;e<n.length;e+=1)if(a+=r[e]*4*Math.PI*n[e]*n[e]*n[e]*i,a>=t)return n[e];return n[n.length-1]}function US(e,t){let n=Qd(t),r=n.reduce((e,t)=>Math.max(e,t.n),0),i=new Set(n.filter(e=>e.n===r||(e.l===2||e.l===3)&&BS(e)>0).map(e=>`${e.n}:${e.l}`)),a=0,o=0;for(let t of e.orbitals||[])i.has(`${t.n}:${t.l}`)&&(a+=Math.abs(t.energyHa)*t.occupancy,o+=t.occupancy);return o>0?a/o:Math.abs(e.orbitals?.at(-1)?.energyHa??.05)}function WS(e,t={}){let n=`${e}:${t.gridPointsN??520}:${t.rMaxBohr??42}`;if(zS.has(n))return zS.get(n);let r=Cp(e,{returnRadialDensity:!0,gridPointsN:t.gridPointsN??520,rMaxBohr:t.rMaxBohr??42,maxScf:t.maxScf??200}),i=VS(e),a=HS(r,Math.max(.2,e-i/2)),o=HS(r,Math.max(.5,e-.25)),s=US(r,e),c={Z:e,symbol:qd(e),atomicEnergyHa:r.totalEnergyHa,atomicMassKg:Wd(e),valenceElectrons:nf(e),bondingElectrons:i,coreRadiusBohr:a,valenceRadiusBohr:o,orbitalBindingHa:s,electronegativityHa:s,radialSolve:{totalEnergyHa:r.totalEnergyHa,integratedElectrons:r.integratedElectrons,configuration:r.configuration}};return zS.set(n,c),c}function GS(e,t){let n=e.position[0]-t.position[0],r=e.position[1]-t.position[1],i=e.position[2]-t.position[2];return Math.sqrt(n*n+r*r+i*i)}function KS(e,t){let n=e.coreRadiusBohr+t.coreRadiusBohr,r=e.valenceRadiusBohr+t.valenceRadiusBohr,i=Math.max(.9,.42*n+.18*r),a=Math.sqrt(Math.max(e.electronegativityHa*t.electronegativityHa,1e-8)),o=Math.abs(e.electronegativityHa-t.electronegativityHa)/Math.max(e.electronegativityHa+t.electronegativityHa,1e-8),s=Math.sqrt(e.bondingElectrons*t.bondingElectrons);return{equilibriumBohr:i,depthHa:Math.max(.005,a*(.05+.04*o)*Math.min(3,s)/2),stiffness:1.55/Math.max(i,.9),polarity:o,capacity:s}}function qS(e,t){let n=Math.exp(-t.stiffness*(e-t.equilibriumBohr));return t.depthHa*(n*n-2*n)}function JS(e){return e.reduce((e,t)=>e+t.Z,0)}function YS(e,t={}){if(!Array.isArray(e)||e.length===0)throw TypeError(`atoms must be a non-empty array`);let n=e.map(e=>WS(e.Z,t)),r=n.reduce((e,t)=>e+t.atomicEnergyHa,0),i=0,a=[];for(let t=0;t<e.length;t+=1)for(let r=t+1;r<e.length;r+=1){let o=GS(e[t],e[r]),s=KS(n[t],n[r]),c=qS(o,s);i+=c,a.push({i:t,j:r,Zi:e[t].Z,Zj:e[r].Z,distanceBohr:o,energyHa:c,...s})}let o=e.length*(e.length-1)/2,s=n.reduce((e,t)=>e+t.bondingElectrons,0)/2,c=o>s?.015*(o-s)**2:0;return{method:`atomic-kohn-sham-tight-binding-v0`,totalEnergyHa:r+i+c,atomicReferenceEnergyHa:r,pairEnergyHa:i,saturationPenaltyHa:c,nAtoms:e.length,nElectrons:JS(e),descriptors:n,pairTerms:a,provenance:{source:`atomic-kohn-sham-radial-density-universal-pair-hamiltonian`,lowerLevelInputs:[`atomic Kohn-Sham total energy`,`radial density containment radii`,`outer orbital energies`,`ground-state electron configuration`],validation:!1}}}function XS(e,t={}){return YS(Array.isArray(e)?e:e.atoms,t).totalEnergyHa}function ZS(e,t,n={}){return KS(WS(e,n),WS(t,n)).equilibriumBohr*RS}var QS=8.314462618,$S=1.4387768766;function eC(e){let t=e.map(e=>Hd[e.Z-1]),n=t.reduce((e,t)=>e+t,0),r=[0,0,0];e.forEach((e,n)=>{for(let i=0;i<3;i+=1)r[i]+=t[n]*e.position[i]});for(let e=0;e<3;e+=1)r[e]/=n;let i=[[0,0,0],[0,0,0],[0,0,0]];return e.forEach((e,n)=>{let a=e.position.map((e,t)=>e-r[t]),o=a[0]*a[0]+a[1]*a[1]+a[2]*a[2];for(let e=0;e<3;e+=1)for(let r=0;r<3;r+=1)i[e][r]+=t[n]*((e===r?o:0)-a[e]*a[r])}),of(i,3).values.slice().sort((e,t)=>e-t)}function tC(e){if(e.length<=2)return!0;let t=eC(e),n=t[2];return t[0]<.001*n}function nC(e,t){if(e<=0)return 0;let n=$S*e/t;if(n>60)return 0;let r=Math.exp(n);return n*n*r/((r-1)*(r-1))}function rC(e,t,n){let r=tC(e),i=r?1:1.5,a=0;for(let e of t)a+=nC(e,n);let o=1.5+i+a;return{cvJPerMolK:o*QS,cpJPerMolK:(o+1)*QS,linear:r,rotationalDof:r?2:3,vibrationalCvOverR:a}}var iC=1.8897259886,aC=602214076e15,oC=8.314462618,sC=27.211386245988,cC=43597447222071e-31,lC=1e6,uC=273.15,dC=18,fC=2,pC=.07,mC=.35,hC=.8,gC=.14,_C=Object.freeze({h2:{formula:`H2`,phaseModel:`ideal-gas`},o2:{formula:`O2`,phaseModel:`ideal-gas`},n2:{formula:`N2`,phaseModel:`ideal-gas`},co2:{formula:`CO2`,phaseModel:`ideal-gas`},ar:{formula:`Ar`,phaseModel:`ideal-gas`},h2o:{formula:`H2O`,phaseModel:`molecular-condensed`},air:{phaseModel:`ideal-gas-mixture`,components:[{formula:`N2`,moleFraction:.7808},{formula:`O2`,moleFraction:.2095},{formula:`Ar`,moleFraction:.0093},{formula:`CO2`,moleFraction:4e-4}]}});function vC(e,t,n=1){for(let[r,i]of Object.entries(t))e[r]=(e[r]||0)+i*n;return e}function yC(e){if(typeof e!=`string`||e.length===0)throw TypeError(`formula must be a non-empty string`);let t=0,n=()=>{let n=``;for(;t<e.length&&/[0-9]/.test(e[t]);)n+=e[t++];return n?Number(n):1},r=()=>{let i={};for(;t<e.length;){let a=e[t];if(a===`)`){t+=1;break}if(a===`(`){t+=1,vC(i,r(),n());continue}if(!/[A-Z]/.test(a))throw Error(`invalid formula '${e}' at '${a}'`);let o=e[t++];t<e.length&&/[a-z]/.test(e[t])&&(o+=e[t++]);let s=Jd(o);if(s==null)throw Error(`unknown element symbol '${o}' in formula '${e}'`);i[s]=(i[s]||0)+n()}return i},i=r();if(t!==e.length)throw Error(`could not parse formula '${e}'`);return i}function bC(e){return Object.entries(e).sort(([e],[t])=>Number(e)-Number(t)).map(([e,t])=>`${qd(Number(e))}${t===1?``:t}`).join(``)}function xC(e){return Object.entries(e).reduce((e,[t,n])=>e+Number(n)*Wd(Number(t))*aC,0)}function SC(e){return Object.values(e).reduce((e,t)=>e+t,0)}function CC(e){let t=[];for(let[n,r]of Object.entries(e).sort(([e],[t])=>Number(t)-Number(e)))for(let e=0;e<r;e+=1)t.push(Number(n));return t}function wC(e,t){if(t===1)return[0,0,1];let n=Math.acos(1-2*(e+.5)/t),r=Math.PI*(1+Math.sqrt(5))*e;return[Math.sin(n)*Math.cos(r),Math.sin(n)*Math.sin(r),Math.cos(n)]}function TC(e){let t=CC(e);if(t.length===0)return[];if(t.length===1)return[{Z:t[0],position:[0,0,0]}];if(t.length===2){let e=1.15*iC;return[{Z:t[0],position:[0,0,-.5*e]},{Z:t[1],position:[0,0,.5*e]}]}let n=t.findIndex(e=>e>1),r=[{Z:n>=0?t.splice(n,1)[0]:t.shift(),position:[0,0,0]}],i=1*iC;return t.forEach((e,n)=>{let a=wC(n,t.length);r.push({Z:e,position:a.map(e=>e*i)})}),r}function EC(e){return Object.keys(e).every(e=>Number(e)<=dC)}function DC(e){try{let t=Af(e),n=t.orbitalEnergies;if(n&&t.nOcc>0&&t.nOcc<n.length){let e=(n[t.nOcc]-n[t.nOcc-1])*sC;if(!(e>0))return{color:[.55,.55,.58],gapEv:e};let r=1239.841984/e;if(r<380)return{color:[.93,.95,.97],gapEv:e};if(r>780)return{color:[.3,.28,.32],gapEv:e};let i=(r-380)/400;return{color:[Math.max(.08,1-.9*(1-i)),Math.max(.08,1-.55*Math.sin(Math.PI*i)),Math.max(.08,1-.9*i)],gapEv:e}}}catch{}return null}function OC(e,t){let n=0,r=0,i=0,a=0;for(let[o,s]of Object.entries(e)){let e=Number(o),c=Number(s),l=hS(e,t),u=l.densityKgPerM3??0,d=u>0?Wd(e)/u:Wd(e)/1;n+=c*d,r+=c*d*(l.bulkModulusPa??1e5),i+=c*(l.conductionElectronDensityPerM3??0)*d,a+=c}return{volumePerFormulaM3:n,bulkPa:n>0?r/n:1e5,conductionElectronDensityPerM3:n>0?i/n:null,totalAtoms:a}}function kC(e,t,n,r={}){if(EC(e))try{let e=Lf(t,{moleculeOptions:r.moleculeOptions||{}});if(e.atomizationEnergyHa>0)return{value:e.atomizationEnergyHa*cC*pC,source:`molecular-hartree-fock-atomization-energy`,atomizationEnergyHa:e.atomizationEnergyHa}}catch{}try{let e=YS(t,r.allElementMolecularOptions||{}),n=e.atomicReferenceEnergyHa-e.totalEnergyHa;if(n>0)return{value:n*cC*pC,source:`all-element-atomic-kohn-sham-tight-binding-atomization-energy`,atomizationEnergyHa:n}}catch{}return{value:Math.max(1e-22,n.bulkPa*n.volumePerFormulaM3*mC),source:`atomic-dft-derived-elemental-cohesion-density`,atomizationEnergyHa:null}}function AC(e,t,n,r){if(EC(e))try{return rC(t,[],n).cpJPerMolK/r}catch{}let i=SC(e);return((1.5+(i<=1?0:i===2?1:1.5))*oC+oC)/r}function jC({key:e=null,formula:t=null,atomCounts:n=null,geometry:r=null,phaseModel:i=`molecular-condensed`,options:a={}}={}){let o=n||yC(t),s=t||bC(o),c=xC(o),l=SC(o),u=r||TC(o);if(i===`ideal-gas`)return Wx({molarMassKgPerMol:c,atomsPerFormula:l,formula:s,idealGas:!0,heatCapacityModel:{gas:`molecular-equipartition`},phases:[{name:`gas`,cpJPerKgK:AC(o,u,uC,c),densityKgPerM3:AS({pressurePa:DS.standardAtmospherePa,temperatureK:uC,molarMassKgPerMol:c}),temperatureRange:[0,lC],bulkModulusPa:null,shearModulusPa:0}],transitions:[]},{entries:[Ix({paths:[`molarMassKgPerMol`,`atomsPerFormula`],status:Mx.EXACT_CONSTANT,source:`periodic-table-atomic-masses`,method:`formula molar mass and atom count from parsed chemical formula`,inputs:[s]}),Ix({paths:[`idealGas`,`phases.gas.cpJPerKgK`,`phases.gas.densityKgPerM3`,`phases.gas.temperatureRange`,`phases.gas.shearModulusPa`],status:Mx.PHYSICAL_LAW,source:`molecular-statistical-mechanics+ideal-gas-law`,method:`rigid-rotor/equipartition heat capacity plus rho=pM/RT`})],notes:[`${e||s} gas closure is derived from formula mass and molecular statistical mechanics.`]});let d=OC(o,a),f=d.volumePerFormulaM3*fC,p=c/(aC*f),m=kC(o,u,d,a),h=m.value/f,g=Math.max(1e6,h*hC),_=g*.35,v=Nh({densityKgPerM3:p,molarMassKgPerMol:c,atomsPerFormula:l}),y=Mh({soundSpeedMPerS:Math.sqrt(g/p),numberDensityPerM3:v}),b=Fh(uC,{debyeTemperatureK:y,molarMassKgPerMol:c,atomsPerFormula:l}),x=3*oC*l/c,S=(f/Math.max(1,l))**(1/3),C=c/aC,w=Math.max(1,gC**2/3*S*S*C*1380649e-29*y*y/1054571817e-43**2),T=LS({meltingPointK:w,molarMassKgPerMol:c,entropyOfFusionJPerMolK:oC*Math.sqrt(l)}),E=Math.max(m.value*aC/c,T*2),D=oC*(10+Math.sqrt(l)),O=Math.max(w*1.15,E*c/D),k=AC(o,u,O,c),A=AS({pressurePa:DS.standardAtmospherePa,temperatureK:O,molarMassKgPerMol:c}),j=DC(u)||{color:d.conductionElectronDensityPerM3>0?[.74,.74,.76]:[.9,.92,.94],gapEv:null};return Wx({molarMassKgPerMol:c,atomsPerFormula:l,formula:s,compound:!0,derivation:`generic-formula-material: ${m.source}; atomic-volume packing; Debye/Lindemann phase model`,intrinsicColorSrgb:j.color,electronicGapEv:j.gapEv,phases:[{name:`solid`,cpJPerKgK:b,densityKgPerM3:p,temperatureRange:[0,w],debyeTemperatureK:y,bulkModulusPa:g,shearModulusPa:_},{name:`liquid`,cpJPerKgK:x*1.1400000000000001,densityKgPerM3:p*(1-3*gC*gC),temperatureRange:[w,O],bulkModulusPa:g*.75,shearModulusPa:0},{name:`gas`,cpJPerKgK:k,densityKgPerM3:A,temperatureRange:[O,lC],bulkModulusPa:null,shearModulusPa:0}],transitions:[{from:`solid`,to:`liquid`,temperatureK:w,latentHeatJPerKg:T},{from:`liquid`,to:`gas`,temperatureK:O,latentHeatJPerKg:E}],closureBacked:!0,validation:{eosValidation:!1,thermalValidation:!1,opticalValidation:!1,scientificValidation:!1}},{entries:[Ix({paths:[`molarMassKgPerMol`,`atomsPerFormula`],status:Mx.EXACT_CONSTANT,source:`periodic-table-atomic-masses`,method:`formula molar mass and atom count from parsed chemical formula`,inputs:[s]}),Ix({paths:[`intrinsicColorSrgb`,`phases.*.cpJPerKgK`,`phases.*.densityKgPerM3`,`phases.solid.debyeTemperatureK`,`phases.solid.bulkModulusPa`,`phases.solid.shearModulusPa`,`phases.liquid.bulkModulusPa`,`phases.*.temperatureRange`,`transitions.*.temperatureK`,`transitions.*.latentHeatJPerKg`],status:Mx.LOWER_LEVEL_SIMULATION,source:`generic-formula-electronic-structure+atomic-dft+statistical-mechanics`,method:`formula geometry/electronic energy or atomic DFT cohesion -> condensed EOS -> Debye/Lindemann phase model`}),Ix({paths:[`phases.liquid.shearModulusPa`,`phases.gas.shearModulusPa`],status:Mx.PHYSICAL_LAW,source:`continuum-mechanics`,method:`fluid phases have no static shear modulus`})],notes:[`${e||s} closure uses the generic formula pipeline; validation remains evidence-only.`]})}function MC({key:e,components:t}){let n=0,r=0,i=[];for(let e of t){let t=yC(e.formula),a=xC(t),o=AC(t,TC(t),uC,a)*a-oC;n+=e.moleFraction*a,r+=e.moleFraction*o,i.push(`${e.formula}:${e.moleFraction}`)}if(!(n>0)){let e=jh();n=e.molarMassKgPerMol,r=e.cvJPerKgK*e.molarMassKgPerMol}let a=AS({pressurePa:DS.standardAtmospherePa,temperatureK:uC,molarMassKgPerMol:n});return Wx({molarMassKgPerMol:n,idealGas:!0,mixture:!0,heatCapacityModel:{gas:`component-statistical-mechanics`},phases:[{name:`gas`,cpJPerKgK:r/n,densityKgPerM3:a,temperatureRange:[0,lC],bulkModulusPa:null,shearModulusPa:0}],transitions:[]},{entries:[Ix({paths:[`molarMassKgPerMol`],status:Mx.EXACT_CONSTANT,source:`declared-gas-mixture-composition`,method:`mole-fraction-weighted formula molar mass`,inputs:i}),Ix({paths:[`idealGas`,`phases.gas.cpJPerKgK`,`phases.gas.densityKgPerM3`,`phases.gas.temperatureRange`,`phases.gas.shearModulusPa`],status:Mx.PHYSICAL_LAW,source:`component-statistical-mechanics+ideal-gas-law`,method:`component ideal-gas heat capacities mixed by mole fraction plus rho=pM/RT`})],notes:[`${e} is a declared ideal-gas mixture; composition is an input condition, not a material-property fallback.`]})}function NC(e,t={}){if(t[e])return t[e];let n=typeof e==`string`?e.toLowerCase():e;if(_C[n])return _C[n];let r=e?e[0].toUpperCase()+e.slice(1).toLowerCase():``;if(Jd(r)!=null)return{formula:r,phaseModel:`element`};if(/^[A-Z][A-Za-z0-9()]*$/.test(e||``))return{formula:e,phaseModel:`molecular-condensed`};if(/^[a-z0-9()]+$/.test(e||``))return{formula:e.replace(/(^|[0-9(])([a-z])/g,(e,t,n)=>`${t}${n.toUpperCase()}`),phaseModel:`molecular-condensed`};throw Error(`Cannot resolve material spec for '${e}'`)}function PC(e,t={}){let n=NC(e,t.materialSpecs||{});if(n.phaseModel===`ideal-gas-mixture`)return MC({key:e,components:n.components});if(n.phaseModel===`element`){let r=_S(Jd(n.formula),t.elementOptions||{});return r?r.properties:jC({key:e,formula:n.formula,phaseModel:`ideal-gas`,options:t.elementOptions||{}})}return jC({key:e,formula:n.formula,atomCounts:n.atomCounts,geometry:n.geometry,phaseModel:n.phaseModel,options:t.elementOptions||{}})}function FC(e,t={}){let n=PC(e,t);Kx(n),qx(n,{material:e,context:`createDerivedMaterialClosure`});let r=Gx(n),i=t.validityDomain||{temperatureK:[0,6e3],pressurePa:[1,1e9],composition:n.formula||(n.mixture?`declared-mixture`:`pure`)},a=Dd({material:e,spec:NC(e,t.materialSpecs||{}),provenance:n.propertyProvenance}),o=Dd({method:`ulg.generic-first-principles-material-derivation.v0`,properties:n}),s=nu({closureFamily:`material`,closureId:`ulg-derived-${e}-material-closure`,material:e,inputRefs:[{schema:`ulg.first-principles-material-input.v0`,material:e,status:`produced`,inputHash:a}],producer:{service:`ulg-runtime`,commit:null,toolchain:`generic-electronic-statmech-material-derivation`},validityDomain:i,units:{density:`kg/m^3`,heatCapacity:`J/(kg*K)`,specificInternalEnergy:`J/kg`,latentHeat:`J/kg`,temperature:`K`},properties:n,derivatives:!0,materialDerivation:r,validation:{status:`first-principles-model-unvalidated`,evidenceRefs:[]},provenance:{source:`generic-first-principles-material-derivation`,inputHash:a,methodHash:o,notes:[`Material closure for ${e}; fullyLowerLevelDerived=${r.fullyLowerLevelDerived}.`,`Derived values are model evidence, not measured validation.`]}});return{...s,materialDerivation:r,inputHash:a,methodHash:o,execution:{mode:`generic-first-principles-material-derivation`},validity:{temperatureK:i.temperatureK},provenance:{...s.provenance,inputHash:a,methodHash:o}}}function IC(e,t={}){return Object.fromEntries(e.map(e=>[e,FC(e,t)]))}var LC=1e6,RC=602214076e15,zC=273.15;function BC(e){return Object.entries(e).reduce((e,[t,n])=>e+Number(n)*Wd(Number(t))*RC,0)}var VC=jh(),HC=Mh({soundSpeedMPerS:3600,numberDensityPerM3:Nh({densityKgPerM3:OS.fe.densityKgPerM3.solid,molarMassKgPerMol:OS.fe.molarMassKgPerMol})});function UC(e){return e===`h2o`?[FS(PS())]:[{schema:{fe:`moonlab.ulg.fe-microphysics-reference.v0`,air:`moonlab.ulg.air-mixture-reference.v0`}[e]??`moonlab.ulg.${e}-microphysics-reference.v0`,status:`pending-not-yet-produced`}]}var WC={h2:{atomCounts:{1:2}},o2:{atomCounts:{8:2}}};function GC(e){let t=WC[e],n=BC(t.atomCounts),r=AS({pressurePa:DS.standardAtmospherePa,temperatureK:zC,molarMassKgPerMol:n});return Wx({molarMassKgPerMol:n,idealGas:!0,heatCapacityModel:{gas:`equipartition`},phases:[{name:`gas`,cpJPerKgK:5/2*(8.314462618/n),densityKgPerM3:r,temperatureRange:[0,LC],bulkModulusPa:null,shearModulusPa:0}],transitions:[]},{entries:[Ix({paths:[`molarMassKgPerMol`],status:Mx.EXACT_CONSTANT,source:`periodic-table-atomic-masses`,method:`formula molar mass from atomic masses`,inputs:Object.keys(t.atomCounts).map(e=>`Z=${e}`)}),Ix({paths:[`idealGas`,`phases.gas.cpJPerKgK`,`phases.gas.densityKgPerM3`,`phases.gas.temperatureRange`,`phases.gas.shearModulusPa`],status:Mx.PHYSICAL_LAW,source:`statistical-mechanics+ideal-gas-law`,method:`diatomic equipartition plus rho=pM/RT at the declared standard state`,inputs:[`P=${DS.standardAtmospherePa}Pa`,`T=${zC}K`]})],notes:[`${e} gas properties derive from formula mass, equipartition, and ideal-gas density.`]})}function KC(e){if(WC[e])return GC(e);let t=OS[e];if(e===`h2o`)return Wx({molarMassKgPerMol:BC({1:2,8:1}),phases:[{name:`solid`,cpJPerKgK:t.cpJPerKgK.solid,densityKgPerM3:t.densityKgPerM3.solid,temperatureRange:[0,t.meltingPointK],bulkModulusPa:88e8,shearModulusPa:35e8},{name:`liquid`,cpJPerKgK:t.cpJPerKgK.liquid,densityKgPerM3:t.densityKgPerM3.liquid,temperatureRange:[t.meltingPointK,t.boilingPointK],bulkModulusPa:22e8,shearModulusPa:0},{name:`gas`,cpJPerKgK:t.cpJPerKgK.gas,densityKgPerM3:t.densityKgPerM3.gas,temperatureRange:[t.boilingPointK,LC],bulkModulusPa:null,shearModulusPa:0}],transitions:[{from:`solid`,to:`liquid`,temperatureK:t.meltingPointK,latentHeatJPerKg:t.latentHeatFusionJPerKg},{from:`liquid`,to:`gas`,temperatureK:t.boilingPointK,latentHeatJPerKg:t.latentHeatVaporizationJPerKg}]},{entries:[Ix({paths:[`molarMassKgPerMol`],status:Mx.EXACT_CONSTANT,source:`periodic-table-atomic-masses`,method:`H2O formula molar mass from atomic masses`,inputs:[`H:2`,`O:1`]}),Ix({paths:[`phases.*.cpJPerKgK`,`phases.*.densityKgPerM3`,`phases.solid.bulkModulusPa`,`phases.liquid.bulkModulusPa`,`phases.solid.shearModulusPa`,`phases.*.temperatureRange`,`transitions.*.temperatureK`,`transitions.*.latentHeatJPerKg`],status:Mx.REFERENCE_FALLBACK,source:`reference-material-fixture`,method:`tabulated water phase constants pending molecular/condensed-phase closure`,blockers:[`h2o-condensed-phase-md-or-dft-eos-not-produced`,`h2o-phase-boundary-free-energy-closure-not-produced`]}),Ix({paths:[`phases.liquid.shearModulusPa`,`phases.gas.shearModulusPa`],status:Mx.PHYSICAL_LAW,source:`continuum-mechanics`,method:`fluids have no static shear modulus`})],notes:[`H2O still uses reference phase/EOS constants; the ledger marks these as fallback instead of lower-level-derived.`]});if(e===`fe`)return Wx({molarMassKgPerMol:BC({26:1}),atomsPerFormula:1,heatCapacityModel:{solid:`debye`,liquid:`constant-reference`},densityModel:{solid:`gruneisen-debye-thermal-expansion`,liquid:`constant-reference`},conductionElectronDensityPerM3:2*(t.densityKgPerM3.solid/t.molarMassKgPerMol)*602214076e15,latentModel:{fusion:`richards-rule`},phases:[{name:`solid`,cpJPerKgK:t.cpJPerKgK.solid,densityKgPerM3:t.densityKgPerM3.solid,temperatureRange:[0,t.meltingPointK],debyeTemperatureK:HC,eos:{gruneisen:1.7,bulkModulusPa:17e10,referenceDensityKgPerM3:t.densityKgPerM3.solid,referenceTemperatureK:293},bulkModulusPa:17e10,shearModulusPa:82e9},{name:`liquid`,cpJPerKgK:t.cpJPerKgK.liquid,densityKgPerM3:t.densityKgPerM3.liquid,temperatureRange:[t.meltingPointK,LC],bulkModulusPa:11e10,shearModulusPa:0}],transitions:[{from:`solid`,to:`liquid`,temperatureK:t.meltingPointK,latentHeatJPerKg:LS({meltingPointK:t.meltingPointK,molarMassKgPerMol:t.molarMassKgPerMol})}]},{entries:[Ix({paths:[`molarMassKgPerMol`,`atomsPerFormula`],status:Mx.EXACT_CONSTANT,source:`periodic-table-atomic-mass`,method:`Fe formula mass from atomic mass`}),Ix({paths:[`conductionElectronDensityPerM3`],status:Mx.REFERENCE_FALLBACK,source:`reference-density-with-electron-count`,method:`2 conduction electrons per atom times reference solid number density`,blockers:[`fe-band-structure-or-validated-conduction-electron-closure-not-produced`]}),Ix({paths:[`phases.solid.debyeTemperatureK`,`phases.solid.cpJPerKgK`],status:Mx.REFERENCE_FALLBACK,source:`debye-model-over-reference-sound-speed`,method:`Debye heat capacity from sound speed and reference atomic density`,blockers:[`fe-elastic-tensor-from-dft-not-produced`]}),Ix({paths:[`phases.solid.densityKgPerM3`,`phases.liquid.densityKgPerM3`,`phases.solid.eos.*`,`phases.solid.bulkModulusPa`,`phases.solid.shearModulusPa`,`phases.liquid.cpJPerKgK`,`phases.liquid.bulkModulusPa`,`phases.*.temperatureRange`,`transitions.solid->liquid.temperatureK`],status:Mx.REFERENCE_FALLBACK,source:`reference-material-fixture`,method:`tabulated Fe condensed-phase constants pending DFT/MD closure`,blockers:[`fe-condensed-phase-dft-eos-not-produced`,`fe-liquid-md-closure-not-produced`]}),Ix({paths:[`transitions.solid->liquid.latentHeatJPerKg`],status:Mx.REFERENCE_FALLBACK,source:`richards-rule-over-reference-melting-point`,method:`universal fusion entropy law with reference melting point`,blockers:[`fe-free-energy-melting-closure-not-produced`]}),Ix({paths:[`phases.liquid.shearModulusPa`],status:Mx.PHYSICAL_LAW,source:`continuum-mechanics`,method:`liquid phase has no static shear modulus`})],notes:[`Fe is explicitly not lower-level-derived yet; the transition-metal jellium path is not accurate enough for iron.`]});if(e===`air`)return Wx({molarMassKgPerMol:VC.molarMassKgPerMol,idealGas:!0,heatCapacityModel:{gas:`equipartition`},phases:[{name:`gas`,cpJPerKgK:VC.cvJPerKgK,densityKgPerM3:null,temperatureRange:[0,LC]}],transitions:[]},{entries:[Ix({paths:[`molarMassKgPerMol`,`phases.gas.cpJPerKgK`],status:Mx.REFERENCE_FALLBACK,source:`standard-dry-air-composition`,method:`equipartition over a reference atmospheric mixture`,blockers:[`air-composition-transport-closure-not-produced`]}),Ix({paths:[`idealGas`,`phases.gas.temperatureRange`],status:Mx.PHYSICAL_LAW,source:`ideal-gas-law`,method:`dilute-gas EOS with density sampled from pM/RT`})],notes:[`Air cp is law-derived for a reference dry-air composition; composition itself is a fallback input.`]});throw Error(`Unknown material key: ${e}`)}var qC={h2o:[150,1500],fe:[200,4e3],air:[100,2e3]};function JC(e){let t=KC(e);Kx(t);let n=Gx(t),r={temperatureK:qC[e]??[100,6e3],pressurePa:[1,1e8],composition:`pure`},i=nu({closureFamily:`material`,closureId:`sph-phase-${e}-material-closure`,material:e,inputRefs:UC(e),producer:{service:`eshkol`,commit:null,toolchain:`reference-fixture`},validityDomain:r,units:{density:`kg/m^3`,heatCapacity:`J/(kg*K)`,specificInternalEnergy:`J/kg`,latentHeat:`J/kg`,temperature:`K`},properties:t,derivatives:!0,materialDerivation:n,provenance:{source:`reference-fixture`,notes:[`Material closure for ${e}; microphysics refs: ${UC(e).map(e=>`${e.schema}:${e.status}`).join(`, `)}.`,`fullyLowerLevelDerived=${n.fullyLowerLevelDerived}; blockers=${n.blockers.join(`,`)||`none`}.`]}}),a=Dd({material:e,family:`material`,source:`reference-fixture`}),o=Dd({properties:t});return{...i,materialDerivation:n,inputHash:a,methodHash:o,execution:{mode:`material-property-closure`},validity:{temperatureK:r.temperatureK},provenance:{...i.provenance,inputHash:a,methodHash:o}}}function YC(){return{h2o:JC(`h2o`),fe:JC(`fe`),air:JC(`air`),h2:JC(`h2`),o2:JC(`o2`)}}function XC(){let e=IC([`h2o`,`fe`,`air`,`h2`,`o2`]);for(let[t,n]of Object.entries(e))qx(n.properties,{material:t,context:`createFirstPrinciplesMaterialClosures`});return e}var ZC=`peercompute.ulg.sph-state.v0`;function QC(e,t,n){if(!Array.isArray(e)||e.length!==t||e.some(e=>!Number.isFinite(e)))throw Error(`${n} must be a length-${t} finite vector`);return[...e]}function $C({particles:e=[],smoothingLengthM:t,dimension:n=3,time:r=0,step:i=0}={}){if(!Number.isFinite(t)||t<=0)throw Error(`createSphState requires a positive smoothingLengthM`);return{schema:ZC,dimension:n,smoothingLengthM:t,time:r,step:i,particles:e.map((e,t)=>({id:e.id??`p${t}`,material:e.material??`unknown`,x:QC(e.x,n,`particles[${t}].x`),v:QC(e.v??Array(n).fill(0),n,`particles[${t}].v`),massKg:Number(e.massKg),specificInternalEnergyJPerKg:Number(e.specificInternalEnergyJPerKg??0)}))}}function ew(e){return{...e,particles:e.particles.map(e=>({...e,x:[...e.x],v:[...e.v]}))}}var tw={1:2/3,2:10/(7*Math.PI),3:1/Math.PI};function nw(e,t,n){let r=tw[n]/t**n,i=e/t;return i<1?r*(1-1.5*i*i+.75*i*i*i):i<2?r*.25*(2-i)**3:0}function rw(e,t,n){let r=tw[n]/t**n,i=e/t;return i<1?r/t*(-3*i+2.25*i*i):i<2?r/t*(-.75*(2-i)**2):0}function iw(e,t,n){let r=e.length,i=2*t,a=Array(r);for(let o=0;o<r;o+=1){let s=e[o].x,c=0;for(let a=0;a<r;a+=1){let r=e[a].x,o=0;for(let e=0;e<n;e+=1){let t=s[e]-r[e];o+=t*t}o<i*i&&(c+=e[a].massKg*nw(Math.sqrt(o),t,n))}a[o]=c}return a}function aw(e,t,n){let r=(n-1)*e*Math.max(0,t);return{pressurePa:r,soundSpeedMPerS:Math.sqrt(Math.max(0,n*r/Math.max(e,1e-30)))}}function ow(e,t={}){let{h:n,dimension:r,gamma:i=1.4,gravity:a=null,alpha:o=0,beta:s=0,epsilon:c=.01,eos:l=null}=t,u=iw(e,n,r),d=[],f=[];for(let t=0;t<e.length;t+=1){let{pressurePa:n,soundSpeedMPerS:r}=l?l({density:u[t],specificInternalEnergyJPerKg:e[t].specificInternalEnergyJPerKg,particle:e[t],gamma:i}):aw(u[t],e[t].specificInternalEnergyJPerKg,i);d.push(n),f.push(r)}let p=e.length,m=e.map(()=>Array(r).fill(0)),h=Array(p).fill(0),g=2*n;for(let t=0;t<p;t+=1){let i=e[t],l=i.x,_=i.v,v=m[t],y=d[t]/(u[t]*u[t]),b=0;for(let i=0;i<p;i+=1){if(i===t)continue;let a=e[i],p=a.x,m=0;for(let e=0;e<r;e+=1){let t=l[e]-p[e];m+=t*t}if(m>=g*g||m<=0)continue;let h=Math.sqrt(m),x=rw(h,n,r)/h,S=d[i]/(u[i]*u[i]),C=0,w=0;for(let e=0;e<r;e+=1)w+=(_[e]-a.v[e])*(l[e]-p[e]);if(w<0){let e=.5*(u[t]+u[i]),r=.5*(f[t]+f[i]),a=n*w/(m+c*n*n);C=(-o*r*a+s*a*a)/e}let T=y+S+C,E=a.massKg,D=0;for(let e=0;e<r;e+=1){let t=x*(l[e]-p[e]);v[e]-=E*T*t,D+=(_[e]-a.v[e])*t}b+=.5*E*T*D}if(h[t]=b,Array.isArray(a))for(let e=0;e<r;e+=1)v[e]+=a[e]}return{accelerations:m,energyRates:h,pressures:d,soundSpeeds:f,densities:u}}function sw(e){let t=Array(e.dimension).fill(0);for(let n of e.particles)for(let r=0;r<e.dimension;r+=1)t[r]+=n.massKg*n.v[r];return t}function cw(e){let t=0;for(let n of e.particles){let e=n.v.reduce((e,t)=>e+t*t,0);t+=.5*n.massKg*e}return t}function lw(e){return e.particles.reduce((e,t)=>e+t.massKg*t.specificInternalEnergyJPerKg,0)}function uw(e){let t=sw(e),n=cw(e),r=lw(e);return{massKg:e.particles.reduce((e,t)=>e+t.massKg,0),momentumKgMPerS:t,momentumMagnitudeKgMPerS:Math.sqrt(t.reduce((e,t)=>e+t*t,0)),kineticEnergyJ:n,thermalEnergyJ:r,totalEnergyJ:n+r}}function dw(e={}){let{dimension:t=3,gamma:n=1.4,gravity:r=null,alpha:i=0,beta:a=0,dt:o=1e-4,eos:s=null}=e,c={dimension:t,gamma:n,gravity:r,alpha:i,beta:a,eos:s};function l(e){let n=ew(e),r=ow(n.particles,{...c,h:n.smoothingLengthM});for(let e=0;e<n.particles.length;e+=1){let i=n.particles[e];for(let n=0;n<t;n+=1)i.v[n]+=.5*o*r.accelerations[e][n];i.specificInternalEnergyJPerKg+=.5*o*r.energyRates[e]}for(let e of n.particles)for(let n=0;n<t;n+=1)e.x[n]+=o*e.v[n];let i=ow(n.particles,{...c,h:n.smoothingLengthM});for(let e=0;e<n.particles.length;e+=1){let r=n.particles[e];for(let n=0;n<t;n+=1)r.v[n]+=.5*o*i.accelerations[e][n];r.specificInternalEnergyJPerKg+=.5*o*i.energyRates[e]}return n.step=(e.step??0)+1,n.time=(e.time??0)+o,{state:n,fields:i}}function u(e,t=1){let n=Number(t);if(!Number.isInteger(n)||n<1)throw Error(`SPH carrier steps must be a positive integer`);let r=ew(e),i=[uw(r)];for(let e=0;e<n;e+=1)r=l(r).state,i.push(uw(r));return{backend:`cpu-reference`,integrator:`leapfrog-kdk`,dt:o,steps:n,finalState:r,totalsSeries:i}}return{backend:`cpu-reference`,integrator:`leapfrog-kdk`,dt:o,step:l,run:u}}var fw=[{id:`xMin`,axis:0,atMax:!1},{id:`xMax`,axis:0,atMax:!0},{id:`yMin`,axis:1,atMax:!1},{id:`yMax`,axis:1,atMax:!0},{id:`zMin`,axis:2,atMax:!1},{id:`zMax`,axis:2,atMax:!0}];function pw(e,t){return e.particles.map(e=>{let n=Gh(t[e.material],e.specificInternalEnergyJPerKg);return{material:e.material,temperatureK:n.temperatureK,phase:n.stablePhase,phaseFractions:n.phaseFractions}})}function mw(e,{materialProperties:t,wallTemperaturesK:n,boxEdgeM:r,boxDimsM:i,dtS:a,conductionRate:o=15e3,wallRate:s=6e4,wallLayerM:c=null}={}){let l=e.particles,u=l.length,d=i??[r,r,r],f=e.smoothingLengthM,p=c??f,m=pw(e,t),h=m.map(e=>e.temperatureK),g=new Float64Array(u),_={};for(let e of fw)_[e.id]=0;for(let e=0;e<u;e+=1){let t=l[e];for(let n=e+1;n<u;n+=1){let r=l[n],i=t.x[0]-r.x[0],s=t.x[1]-r.x[1],c=t.x[2]-r.x[2],u=Math.sqrt(i*i+s*s+c*c);if(u>=2*f)continue;let d=1-u/(2*f),p=o*(h[n]-h[e])*d*a;g[e]+=p/t.massKg,g[n]-=p/r.massKg}}for(let e=0;e<u;e+=1){let t=l[e];for(let r of fw){let i=t.x[r.axis],o=r.atMax?d[r.axis]-i:i;if(o>=p)continue;let c=s*(n[r.id]-h[e])*(1-o/p)*a;g[e]+=c/t.massKg,_[r.id]+=c}}for(let e=0;e<u;e+=1)l[e].specificInternalEnergyJPerKg+=g[e];return{wallHeatJ:_,thermal:m}}function hw(e,t,n=9.80665){return e>0?(t/e-1)*n:0}function gw(e,t){let n={},r=0,i=0,a=0;for(let o of e.particles){let e=Gh(t[o.material],o.specificInternalEnergyJPerKg).stablePhase;n[o.material]=n[o.material]||{},n[o.material][e]=(n[o.material][e]||0)+o.massKg,o.material===`h2o`&&(e===`gas`?r+=o.massKg:e===`liquid`?i+=o.massKg:a+=o.massKg)}return{byMaterialPhase:n,waterIceMassKg:a,waterLiquidMassKg:i,waterSteamMassKg:r}}var _w=7,vw=8.314462618;function yw(e,{soundSpeedScale:t=1,minGasSoundSpeedMPerS:n=0}={}){return function({density:r,specificInternalEnergyJPerKg:i,particle:a}){let o=e[a?.material];if(!o)return{pressurePa:0,soundSpeedMPerS:0};let s=Gh(o,i),c=s.stablePhase||`liquid`,l=o.phases.find(e=>e.name===c)||o.phases[0],u=Number.isFinite(l.densityKgPerM3)?l.densityKgPerM3:r;if(c===`gas`){let e=vw/o.molarMassKgPerMol,i=l.cpJPerKgK,a=i>e?i/(i-e):1.33,c=Math.sqrt(Math.max(a*e*s.temperatureK,0)),d=Math.max(c*t,n);return{pressurePa:Math.max(0,d*d*(r-u)),soundSpeedMPerS:d}}let d=(l.bulkModulusPa?Math.sqrt(l.bulkModulusPa/u):0)*t,f=r/Math.max(u,1e-9);return{pressurePa:u*d*d/_w*(f**_w-1),soundSpeedMPerS:d}}}function bw(e,t){let n=new Float64Array(9);for(let r=0;r<3;r+=1)for(let i=0;i<3;i+=1){let a=0;for(let n=0;n<3;n+=1)a+=e[r*3+n]*t[n*3+i];n[r*3+i]=a}return n}function xw(e){return e[0]*(e[4]*e[8]-e[5]*e[7])-e[1]*(e[3]*e[8]-e[5]*e[6])+e[2]*(e[3]*e[7]-e[4]*e[6])}function Sw(e,t,n){let r=e[0],i=e[1],a=e[2],o=e[3],s=e[4],c=e[5],l=e[6],u=e[7],d=e[8],f=r,p=i,m=a,h=o,g=s,_=c,v=l,y=u,b=d;for(let e=0;e<12;e+=1){let e=1/(f*(g*b-_*y)-p*(h*b-_*v)+m*(h*y-g*v)),t=(g*b-_*y)*e,n=(m*y-p*b)*e,r=(p*_-m*g)*e,i=(_*v-h*b)*e,a=(f*b-m*v)*e,o=(m*h-f*_)*e,s=(h*y-g*v)*e,c=(p*v-f*y)*e,l=(f*g-p*h)*e,u=.5*(f+t),d=.5*(p+i),x=.5*(m+s),S=.5*(h+n),C=.5*(g+a),w=.5*(_+c),T=.5*(v+r),E=.5*(y+o),D=.5*(b+l),O=Math.abs(u-f)+Math.abs(C-g)+Math.abs(D-b);if(f=u,p=d,m=x,h=S,g=C,_=w,v=T,y=E,b=D,O<1e-10)break}let x=r*(s*d-c*u)-i*(o*d-c*l)+a*(o*u-s*l),S=1/x,C=(s*d-c*u)*S,w=(a*u-i*d)*S,T=(i*c-a*s)*S,E=(c*l-o*d)*S,D=(r*d-a*l)*S,O=(a*o-r*c)*S,k=(o*u-s*l)*S,A=(i*l-r*u)*S,j=(r*s-i*o)*S,M=n*(x-1)*x,N=2*t*(r-f)+M*C,P=2*t*(i-p)+M*E,F=2*t*(a-m)+M*k,I=2*t*(o-h)+M*w,ee=2*t*(s-g)+M*D,L=2*t*(c-_)+M*A,te=2*t*(l-v)+M*T,R=2*t*(u-y)+M*O,z=2*t*(d-b)+M*j;return new Float64Array([(N*r+P*i+F*a)*S,(N*o+P*s+F*c)*S,(N*l+P*u+F*d)*S,(I*r+ee*i+L*a)*S,(I*o+ee*s+L*c)*S,(I*l+ee*u+L*d)*S,(te*r+R*i+z*a)*S,(te*o+R*s+z*c)*S,(te*l+R*u+z*d)*S])}var Cw=()=>new Float64Array([1,0,0,0,1,0,0,0,1]);function ww(e){let t=1.5-e,n=e-1,r=e-.5;return[.5*t*t,.75-n*n,.5*r*r]}function Tw({gridSpacingM:e,boxEdgeM:t,boxDimsM:n,dt:r=4e-4,gravity:i=[0,-9.80665,0],eos:a,restDensityOf:o,constitutiveOf:s=()=>({solid:!1}),cflFactor:c=.6}={}){let l=n??[t,t,t],u=c*e/r,d=u*u,f=e,p=1/f,m=Math.round(l[0]/f)+5,h=Math.round(l[1]/f)+5,g=Math.round(l[2]/f)+5,_=(e,t,n)=>((e+1)*h+(t+1))*g+(n+1),v=e=>e+1>=0&&e+1<m,y=e=>e+1>=0&&e+1<h,b=e=>e+1>=0&&e+1<g;function x(e){if(e.mpmF===void 0){e.mpmF=Cw(),e.mpmJ=1,e.mpmC=new Float64Array(9);let t=o(e);e.mpmVolume0=e.massKg/t}}function S(e){let t=e.particles,n=t.length,o=m*h*g,c=new Float64Array(o),S=new Float64Array(o*3);for(let e=0;e<n;e+=1){let n=t[e];x(n);let i=xw(n.mpmF),o=n.mpmVolume0*i,l=n.massKg/o,u=s(n);n.mpmSolid=u.solid;let d;if(u.solid)d=Sw(n.mpmF,u.shearModulusPa,u.lambdaPa);else{let e=a({density:l,specificInternalEnergyJPerKg:n.specificInternalEnergyJPerKg,particle:n}).pressurePa;d=new Float64Array([-e,0,0,0,-e,0,0,0,-e])}let m=-r*o*4*p*p,h=n.mpmC,g=new Float64Array(9);for(let e=0;e<9;e+=1)g[e]=n.massKg*h[e]+m*d[e];let C=Math.floor(n.x[0]*p-.5),w=Math.floor(n.x[1]*p-.5),T=Math.floor(n.x[2]*p-.5),E=n.x[0]*p-C,D=n.x[1]*p-w,O=n.x[2]*p-T,k=ww(E),A=ww(D),j=ww(O);for(let e=0;e<3;e+=1)if(v(C+e)){for(let t=0;t<3;t+=1)if(y(w+t))for(let r=0;r<3;r+=1){if(!b(T+r))continue;let i=k[e]*A[t]*j[r],a=(C+e-n.x[0]*p)*f,o=(w+t-n.x[1]*p)*f,s=(T+r-n.x[2]*p)*f,l=_(C+e,w+t,T+r);c[l]+=i*n.massKg,S[l*3]+=i*(n.massKg*n.v[0]+g[0]*a+g[1]*o+g[2]*s),S[l*3+1]+=i*(n.massKg*n.v[1]+g[3]*a+g[4]*o+g[5]*s),S[l*3+2]+=i*(n.massKg*n.v[2]+g[6]*a+g[7]*o+g[8]*s)}}}for(let e=0;e<m;e+=1)for(let t=0;t<h;t+=1)for(let n=0;n<g;n+=1){let a=(e*h+t)*g+n,o=c[a];if(o<=0)continue;let s=S[a*3]/o+r*i[0],p=S[a*3+1]/o+r*i[1],m=S[a*3+2]/o+r*i[2],_=s*s+p*p+m*m;if(_>d){let e=u/Math.sqrt(_);s*=e,p*=e,m*=e}let v=(e-1)*f,y=(t-1)*f,b=(n-1)*f;(v<f&&s<0||v>l[0]-f&&s>0)&&(s=0),(y<f&&p<0||y>l[1]-f&&p>0)&&(p=0),(b<f&&m<0||b>l[2]-f&&m>0)&&(m=0),S[a*3]=s,S[a*3+1]=p,S[a*3+2]=m}for(let e=0;e<n;e+=1){let n=t[e],i=Math.floor(n.x[0]*p-.5),a=Math.floor(n.x[1]*p-.5),o=Math.floor(n.x[2]*p-.5),s=n.x[0]*p-i,c=n.x[1]*p-a,u=n.x[2]*p-o,d=ww(s),m=ww(c),h=ww(u),g=0,x=0,C=0,w=new Float64Array(9);for(let e=0;e<3;e+=1)if(v(i+e)){for(let t=0;t<3;t+=1)if(y(a+t))for(let r=0;r<3;r+=1){if(!b(o+r))continue;let s=d[e]*m[t]*h[r],c=_(i+e,a+t,o+r),l=S[c*3],u=S[c*3+1],v=S[c*3+2];g+=s*l,x+=s*u,C+=s*v;let y=(i+e-n.x[0]*p)*f,T=(a+t-n.x[1]*p)*f,E=(o+r-n.x[2]*p)*f,D=4*p*p*s;w[0]+=D*l*y,w[1]+=D*l*T,w[2]+=D*l*E,w[3]+=D*u*y,w[4]+=D*u*T,w[5]+=D*u*E,w[6]+=D*v*y,w[7]+=D*v*T,w[8]+=D*v*E}}n.v[0]=g,n.v[1]=x,n.v[2]=C,n.mpmC=w,n.x[0]+=r*g,n.x[1]+=r*x,n.x[2]+=r*C;let T=bw(new Float64Array([1+r*w[0],r*w[1],r*w[2],r*w[3],1+r*w[4],r*w[5],r*w[6],r*w[7],1+r*w[8]]),n.mpmF);if(n.mpmSolid)n.mpmF=T;else{let e=xw(T);e<.05&&(e=.05);let t=Math.cbrt(e);n.mpmF=new Float64Array([t,0,0,0,t,0,0,0,t])}if(n.mpmJ=xw(n.mpmF),n.mpmJ<.1){let e=Math.cbrt(.1);n.mpmF=new Float64Array([e,0,0,0,e,0,0,0,e]),n.mpmJ=.1}for(let e=0;e<3;e+=1)n.x[e]<0?(n.x[e]=0,n.v[e]<0&&(n.v[e]=0)):n.x[e]>l[e]&&(n.x[e]=l[e],n.v[e]>0&&(n.v[e]=0))}return e.step=(e.step??0)+1,e.time=(e.time??0)+r,{state:e}}return{backend:`mls-mpm`,integrator:`apic`,dt:r,gridNodesPerAxis:[m,h,g],step:S}}function Ew(e,t,n){if(typeof n==`function`){let t=n(e);if(Number.isFinite(t)&&t>0)return t}let r=t?.[e.material];if(!r)return null;let i=Gh(r,e.specificInternalEnergyJPerKg),a=(r.phases?.find(e=>e.name===i.stablePhase)||r.phases?.[0])?.densityKgPerM3;return Number.isFinite(a)&&a>0?a:null}function Dw(e,t){e.restDensityKgPerM3=t,e.mpmVolume0!==void 0&&(e.mpmVolume0=e.massKg/t),e.mpmF!==void 0&&(e.mpmF=new Float64Array([1,0,0,0,1,0,0,0,1]),e.mpmJ=1),e.mpmC!==void 0&&(e.mpmC=new Float64Array(9)),e.mpmSolid!==void 0&&(e.mpmSolid=!1)}function Ow(e,t,n){if(typeof n==`function`){let t=n(e);if(t)return t}let r=t?.[e.material];return r?Gh(r,e.specificInternalEnergyJPerKg).stablePhase:null}function kw(e,t,n,r){let i=t.phaseRequirements?.[e.material];if(!i||i.length===0)return!0;let a=Ow(e,n,r);return i.includes(a)}function Aw(e,{reactions:t,materialProperties:n,contactRadiusM:r,temperatureOf:i,phaseOf:a=null,restDensityOf:o=null}){if(!t||t.length===0)return 0;let s=e.particles,c=s.length,l=r*r,u=new Uint8Array(c),d=0;for(let e of t)for(let t=0;t<c;t+=1){if(u[t]||s[t].material!==e.a)continue;let r=i(s[t]);for(let f=0;f<c;f+=1){if(u[f]||f===t||s[f].material!==e.b||!kw(s[t],e,n,a)||!kw(s[f],e,n,a))continue;let c=Number.isFinite(e.activationTemperatureK)?e.activationTemperatureK:0;if(Math.max(r,i(s[f]))<c)continue;let p=s[t].x[0]-s[f].x[0],m=s[t].x[1]-s[f].x[1],h=s[t].x[2]-s[f].x[2];if(p*p+m*m+h*h>l)continue;let g=-e.specificEnthalpyJPerKg;for(let r of[s[t],s[f]]){r.material=e.product,r.specificInternalEnergyJPerKg+=g;let t=Ew(r,n,o);t&&Dw(r,t)}u[t]=1,u[f]=1,d+=1;break}}return d}function jw({key:e,label:t,atomCounts:n,geometry:r,reactants:i=[],allowReducedEstimates:a=!1}){let o={...jC({key:e,atomCounts:n,geometry:r,phaseModel:`molecular-condensed`}),label:t,compound:!0},s={key:e,properties:o,materialDerivation:Gx(o)};return a||qx(o,{material:e,context:`deriveCompoundClosure`}),s}var Mw=1.8897259886,Nw=529177210903e-22,Pw=43597447222071e-31,Fw=602214076e15,Iw=18,Lw=`sto-3g-rhf-uhf`,Rw=`atomic-kohn-sham-tight-binding-v0`,zw=(e,t,n,r)=>({Z:e,position:[t,n,r]}),Bw=e=>e.atoms.every(e=>e.Z<=Iw);function Vw(...e){return e.every(Bw)?Lw:Rw}function Hw(e,t=Vw(e)){return t===Rw?XS(e):(e.multiplicity&&e.multiplicity>1?jf(e.atoms,{multiplicity:e.multiplicity}):Af(e.atoms)).totalEnergyHa}function Uw(e,t){try{return ZS(e,t)/Nw}catch{return null}}var Ww={atoms:[zw(1,0,0,0),zw(1,0,0,.741*Mw)],multiplicity:1},Gw={atoms:[zw(8,0,0,0),zw(8,0,0,1.208*Mw)],multiplicity:3},Kw={atoms:[zw(8,0,0,0),zw(1,.757*Mw,0,.587*Mw),zw(1,-.757*Mw,0,.587*Mw)],multiplicity:1},qw=e=>e%2==1?2:1,Jw=e=>qw(e),Yw={h2o:{elements:{1:2,8:1},species:Kw,role:`water`},o2:{elements:{8:2},species:Gw,role:`oxidizer`},h2:{elements:{1:2},species:Ww,role:`fuel`}},Xw=null,Zw=null,Qw=new Map;function $w(e){if(typeof e!=`string`||e.length===0)return null;let t=e[0].toUpperCase()+e.slice(1).toLowerCase();return Jd(t)==null?null:t}function eT(e,t={}){if(t.materialProperties?.[e])return t.materialProperties[e];let n=typeof e==`string`?e.toLowerCase():e;if(t.materialProperties?.[n])return t.materialProperties[n];let r=t.allowFixtureMaterialProperties===!0;r&&!Zw&&(Zw=Object.fromEntries(Object.entries(YC()).map(([e,t])=>[e,t.properties]))),!r&&!Xw&&(Xw=Object.fromEntries(Object.entries(XC()).map(([e,t])=>[e,t.properties])));let i=r?Zw:Xw;if(i[e])return i[e];if(i[n])return i[n];if(!r){let t=n||e;if(Qw.has(t))return Qw.get(t);try{let n=PC(e);return qx(n,{material:e,context:`reactionDiscovery.deriveMaterialProperties`}),Qw.set(t,n),n}catch{Qw.set(t,null)}}return null}function tT(e,t,n){return e?.transitions?.find(e=>e.from===t&&e.to===n)?.temperatureK??null}function nT(e,t){let n=e?.phases||[];return t===`water`?n.find(e=>e.name===`liquid`)||n.find(e=>e.densityKgPerM3>0&&e.bulkModulusPa>0)||n.find(e=>e.densityKgPerM3>0)||null:n.find(e=>e.name===`solid`&&e.densityKgPerM3>0)||n.find(e=>e.densityKgPerM3>0&&e.bulkModulusPa>0)||n.find(e=>e.densityKgPerM3>0)||null}function rT(e,t){let n=nT(e,t);return{densityKgPerM3:n?.densityKgPerM3??0,bulkModulusPa:n?.bulkModulusPa??n?.eos?.bulkModulusPa??0}}function iT(e){return(e?.phases?.map(e=>e.name)||[]).filter(e=>e===`liquid`||e===`gas`)}function aT(e,t={}){let n=typeof e==`string`?e.toLowerCase():e,r=eT(e,t),i=Yw[n];if(i){let e=rT(r,i.role);return{elements:i.elements,species:i.species,molarMassKgPerMol:r?.molarMassKgPerMol??Object.entries(i.elements).reduce((e,[t,n])=>e+Number(n)*Wd(Number(t))*Fw,0),meltingPointK:tT(r,`solid`,`liquid`)??0,reactivePhases:i.role===`water`?iT(r):r?.phases?.map(e=>e.name)||[],role:i.role,...e,materialDerivation:r?Gx(r):null}}let a=$w(e),o=a?Jd(a):null;if(o==null)return null;let s=hS(o),c=r||null,l=s.condensedModelApplicable===!0&&(s.conductionElectronDensityPerM3??0)>0,u=l?`metal`:`nonmetal`,d=r?rT(r,u):{densityKgPerM3:s.densityKgPerM3??0,bulkModulusPa:s.bulkModulusPa??0};return{elements:{[o]:1},species:{atoms:[zw(o,0,0,0)],multiplicity:Jw(o)},molarMassKgPerMol:c?.molarMassKgPerMol??Wd(o)*Fw,meltingPointK:tT(c,`solid`,`liquid`)??(l?s.meltingPointK:0),valence:s.valenceElectrons,metal:l,...d,Z:o,role:u,materialDerivation:c?Gx(c):null}}function oT(e,t,n={}){if(n.allowFixtureMaterialProperties===!0)return;if(!t)throw new Px(`${e} has no first-principles material closure`,{material:e,context:`reactionDiscovery.materialComposition`,blockers:[`first-principles-material-closure-not-produced`]});let r=eT(e,n);if(!r||!t.materialDerivation)throw new Px(`${e} material composition is not backed by a first-principles closure`,{material:e,context:`reactionDiscovery.materialComposition`,blockers:[`first-principles-material-closure-not-produced`]});qx(r,{material:e,context:`reactionDiscovery.materialComposition`})}function sT(e){let t=Uw(e,8)??1.95*Mw,n=Uw(8,1)??.96*Mw;return[zw(e,0,0,0),zw(8,0,0,t),zw(1,.9*n,0,t+.4*n)]}function cT(e){return[zw(e,0,0,0),zw(8,0,0,Uw(e,8)??1.8*Mw)]}function lT(e){return e.map(e=>({densityKgPerM3:e.densityKgPerM3??0,bulkModulusPa:e.bulkModulusPa??0,molarMassKgPerMol:e.molarMassKgPerMol}))}function uT(e,t,n,r={}){let i=t.Z,a=sT(i),o={atoms:a,multiplicity:qw(i+8+1)},s=Vw(o,t.species,n.species,Ww),c=Hw(o,s),l=Hw(t.species,s),u=Hw(n.species,s),d=c+.5*Hw(Ww,s)-l-u,f=(Wd(i)+Wd(8)+Wd(1))*Fw,p=d*Pw*Fw/f,m=qd(i),h=`${m.toLowerCase()}oh`;return{dHHa:d,productKey:h,closure:jw({key:h,label:`${m}OH`,atomCounts:{[i]:1,8:1,1:1},geometry:a,reactants:lT([t,n]),allowReducedEstimates:r.allowReducedProductProperties===!0}),energyModel:s,specificEnthalpyJPerKg:p,reactant:e,partner:`h2o`,activationTemperatureK:0,activationModel:`barrier-not-yet-derived-reacts-on-exothermic-contact-with-liquid-water`,phaseRequirements:{h2o:n.reactivePhases?.length?n.reactivePhases:[`liquid`,`gas`]}}}function dT(e,t,n,r={}){let i=t.Z,a=cT(i),o={atoms:a,multiplicity:qw(i+8)},s=Vw(o,t.species,Gw),c=Hw(o,s),l=Hw(t.species,s),u=Hw(Gw,s),d=c-l-.5*u,f=(Wd(i)+Wd(8))*Fw,p=d*Pw*Fw/f,m=qd(i),h=`${m.toLowerCase()}o`;return{dHHa:d,productKey:h,closure:jw({key:h,label:`${m}O`,atomCounts:{[i]:1,8:1},geometry:a,reactants:lT([t,n]),allowReducedEstimates:r.allowReducedProductProperties===!0}),energyModel:s,specificEnthalpyJPerKg:p,reactant:e,partner:`o2`,phaseRequirements:{o2:[`gas`]}}}function fT(){let e=Vw(Ww,Gw,Kw),t=Hw(Ww,e),n=Hw(Gw,e),r=Hw(Kw,e)-t-.5*n;return{dHHa:r,productKey:`h2o`,closure:null,energyModel:e,specificEnthalpyJPerKg:r*Pw*Fw/.0180153,phaseRequirements:{h2:[`gas`],o2:[`gas`]}}}var pT=new Map;function mT(e,t,n={}){let r=n.materialProperties||n.allowFixtureMaterialProperties||n.allowReducedProductProperties?null:[e,t].sort().join(`+`);if(pT.has(r))return pT.get(r);let i=hT(e,t,n);return r&&pT.set(r,i),i}function hT(e,t,n={}){let r={reactions:[],productClosures:{},note:null};if(e===t)return r.note=`same material on both blocks: no reaction`,r;let i=aT(e,n),a=aT(t,n);if(!i||!a)return r.note=`unknown material`,r;oT(e,i,n),oT(t,a,n);let o=[[e,i,t,a],[t,a,e,i]],s=null;for(let[e,t,r,i]of o)if(t.role===`metal`&&i.role===`water`){s=uT(e,t,i,n);break}if(!s)for(let[e,t,r,i]of o){if(i.role===`oxidizer`&&t.role===`metal`){s=dT(e,t,i,n);break}if(t.role===`fuel`&&i.role===`oxidizer`){s=fT(),s.reactant=e,s.partner=r;break}}if(s||=gT(e,i,t,a,n),!s)return r.note=`no reaction family or candidate found for ${e}+${t}`,r;if(!(s.specificEnthalpyJPerKg<0))return r.note=`${e}+${t} is endothermic (ΔH=${s.dHHa.toFixed(3)} Ha): no spontaneous reaction`,r;let c=s.activationTemperatureK??Math.max(i.meltingPointK,a.meltingPointK);if(s.closure&&(r.productClosures[s.productKey]=s.closure),!s.closure&&n.allowFixtureMaterialProperties!==!0){let e=eT(s.productKey,n);if(!e)throw new Px(`${s.productKey} product material closure is not first-principles-derived`,{material:s.productKey,context:`reactionDiscovery.product`,blockers:[`first-principles-product-material-closure-not-produced`]});qx(e,{material:s.productKey,context:`reactionDiscovery.product`})}return r.reactions.push({a:e,b:t,product:s.productKey,activationTemperatureK:c,activationModel:s.activationModel??`reduced-thermal-mobility-proxy-pending-derived-barrier`,phaseRequirements:s.phaseRequirements??null,energyModel:s.energyModel??Lw,specificEnthalpyJPerKg:s.specificEnthalpyJPerKg}),r.note=`${e}+${t} → ${s.productKey} (ΔH=${(s.specificEnthalpyJPerKg/1e6).toFixed(2)} MJ/kg, derived)`,r}function gT(e,t,n,r,i={}){let a=t.role===`metal`||r.role===`metal`,o=t.role===`nonmetal`||r.role===`nonmetal`||t.role===`water`||r.role===`water`;if(!a||!o)return null;let s={};for(let e of[t,r])for(let[t,n]of Object.entries(e.elements))s[t]=(s[t]||0)+n;let c=_T(s),l={atoms:c,multiplicity:qw(c.reduce((e,t)=>e+t.Z,0))},u=Vw(l,t.species,r.species),d;try{d=Hw(l,u)}catch{return null}let f;try{f=Hw(t.species,u)+Hw(r.species,u)}catch{return null}let p=d-f;if(!(p<-.02))return null;let m=Object.entries(s).reduce((e,[t,n])=>e+n*Wd(Number(t))*Fw,0),h=p*Pw*Fw/m,g=Object.entries(s).map(([e,t])=>`${qd(Number(e))}${t>1?t:``}`).join(``),_=`cmpd-${g.toLowerCase()}`;return{dHHa:p,productKey:_,closure:jw({key:_,label:g,atomCounts:s,geometry:c,reactants:lT([t,r]),allowReducedEstimates:i.allowReducedProductProperties===!0}),energyModel:u,specificEnthalpyJPerKg:h,reactant:e,partner:n}}function _T(e){let t=[],n=[];for(let[t,r]of Object.entries(e))for(let e=0;e<r;e+=1)n.push(Number(t));let r=1.6*Mw,i=n.length;return n.forEach((e,n)=>{if(i===1){t.push(zw(e,0,0,0));return}let a=Math.acos(1-2*(n+.5)/i),o=Math.PI*(1+Math.sqrt(5))*n;t.push(zw(e,r*Math.sin(a)*Math.cos(o),r*Math.sin(a)*Math.sin(o),r*Math.cos(a)))}),t}var vT=`sph-phase-ice-on-molten-iron`,yT=[`xMin`,`xMax`,`yMin`,`yMax`,`zMin`,`zMax`],bT=233.15;function xT(e){return e*e*e}function ST(e){return Math.cbrt(e)}function CT(e={}){let t=e.iceEdgeM??1,n=xT(t),r=e.ironVolumeFractionOfIce??1/8,i=e.ironVolumeM3??n*r,a=e.boxEdgeM??10,o=e.boxDimensionsM??[a,a,a],s=e.wallModel??`infinite-fixed-temperature-reservoir`,c=e.wallTemperatureK??bT,l={};for(let t of yT)l[t]=e.wallFaces?.[t]??c;return{scenarioId:vT,box:{edgeM:a,dimensionsM:o,volumeM3:o[0]*o[1]*o[2]},gravityMPerS2:e.gravityMPerS2??9.80665,ice:{material:`h2o`,edgeM:t,volumeM3:n,initialTemperatureK:e.iceInitialTemperatureK??bT,targetPhase:`solid`},iron:{material:`fe`,volumeM3:i,edgeM:ST(i),volumeFractionOfIce:i/n,initialTemperatureK:e.ironInitialTemperatureK??OS.fe.meltingPointK+39,targetPhase:`solid`},gas:{material:`air`,pressurePa:e.gasPressurePa??DS.standardAtmospherePa,initialTemperatureK:e.gasInitialTemperatureK??bT},walls:{model:s,faces:l},particleResolution:{h2o:e.particleResolution?.h2o??4096,fe:e.particleResolution?.fe??2048,gas:e.particleResolution?.gas??8192}}}function wT({material:e,min:t,size:n,spacing:r,particlesPerEdge:i,temperatureK:a,properties:o,densityKgPerM3:s}){let c=[],l=Math.max(1,Math.round(i??n/r)),u=n/l,d=s*(u*u*u),f=Wh(o,a);for(let n=0;n<l;n+=1)for(let r=0;r<l;r+=1)for(let i=0;i<l;i+=1)c.push({material:e,x:[t[0]+(n+.5)*u,t[1]+(r+.5)*u,t[2]+(i+.5)*u],v:[0,0,0],massKg:d,specificInternalEnergyJPerKg:f,temperatureK:a,restDensityKgPerM3:s});return c}function TT(e,t){if(e.idealGas)return AS({pressurePa:DS.standardAtmospherePa,temperatureK:t,molarMassKgPerMol:e.molarMassKgPerMol});let n=Gh(e,Wh(e,t)).stablePhase;return(e.phases.find(e=>e.name===n)||e.phases[0]).densityKgPerM3}function ET({scenario:e=CT(),closures:t=null,allowFixtureMaterialProperties:n=!1,dropMaterial:r=`fe`,baseMaterial:i=`h2o`,dropTemperatureK:a,baseTemperatureK:o,dropParticleEdge:s=3,baseParticleEdge:c=5,iceBaseHeightM:l,ironBaseHeightM:u}={}){let d=t??(n?YC():XC()),f=e.box.dimensionsM??[e.box.edgeM,e.box.edgeM,e.box.edgeM],p=e.iron.edgeM,m=e.ice.edgeM,h=f[0]/2,g=f[2]/2,_=p/s,v=m/c,y=l??0,b=u??y+m+Math.max(m,1),x={...d};for(let e of[r,i]){if(x[e])continue;let t=Jd(e),r=t==null?null:_S(t,{allowReducedEstimates:n});if(r){x[e]=r;continue}try{x[e]=FC(e);continue}catch{throw new Px(`No first-principles material closure for '${e}'`,{material:e,context:`buildSphPhaseDemoState`,blockers:[`first-principles-material-closure-not-produced`]})}}if(!n)for(let[e,t]of Object.entries(x))qx(t.properties,{material:e,context:`buildSphPhaseDemoState`});let S=x[r].properties,C=x[i].properties,w=S.transitions?.find(e=>e.from===`solid`&&e.to===`liquid`)?.temperatureK??null,T=a??e.iron.initialTemperatureK,E=a==null&&w!=null?Math.max(T,w+39):T,D=o??e.ice.initialTemperatureK,O=wT({material:r,min:[h-p/2,b,g-p/2],size:p,particlesPerEdge:s,temperatureK:E,properties:S,densityKgPerM3:TT(S,E)}),k=wT({material:i,min:[h-m/2,y,g-m/2],size:m,particlesPerEdge:c,temperatureK:D,properties:C,densityKgPerM3:TT(C,D)}),A=[...k,...O],j=$C({particles:A,smoothingLengthM:1.6*Math.min(_,v),dimension:3});return j.particles.forEach((e,t)=>{e.material=A[t].material,e.temperatureK=A[t].temperatureK,e.restDensityKgPerM3=A[t].restDensityKgPerM3}),{scenario:e,closures:d,allowFixtureMaterialProperties:n,state:j,box:{dimensionsM:f,edgeM:Math.max(...f)},dropMaterial:r,baseMaterial:i,initialTemperaturesK:{drop:E,base:D,gas:e.gas.initialTemperatureK},counts:{drop:O.length,base:k.length,total:A.length},materialProperties:Object.fromEntries(Object.entries(x).map(([e,t])=>[e,t.properties]))}}function DT(e){return e.state.particles.map(t=>{let n=e.materialProperties[t.material],r=Gh(n,t.specificInternalEnergyJPerKg);return{material:t.material,temperatureK:r.temperatureK,phase:r.stablePhase}})}function OT(e){return e.state.particles.map(t=>{let n=e.materialProperties[t.material],r=Gh(n,t.specificInternalEnergyJPerKg),i=Eb(r.temperatureK);if(i.visible)return{rgb:[...i.srgb],closureBacked:!0,source:`radiation-closure`};if(n.intrinsicColorSrgb)return{rgb:[...n.intrinsicColorSrgb],closureBacked:!0,source:`material-closure`};let a=Om({material:t.material,phase:r.stablePhase,conductionElectronDensityPerM3:n.conductionElectronDensityPerM3});return{rgb:[a.r,a.g,a.b],closureBacked:!0,source:`optical-closure`}})}function kT(e){return e.state.particles.map(t=>{let n=e.materialProperties[t.material],r=Gh(n,t.specificInternalEnergyJPerKg).stablePhase,i=t.material;return t.material===`h2o`&&(r===`gas`&&(i=`steam`),r===`solid`&&(i=`ice`)),{material:t.material,phase:r,renderKey:i}})}function AT(e){let t={};for(let n of e.state.particles){let r=e.materialProperties[n.material],i=Eb(Gh(r,n.specificInternalEnergyJPerKg).temperatureK);if(!i.visible)continue;let a=.2126*i.srgb[0]+.7152*i.srgb[1]+.0722*i.srgb[2],o=t[n.material]||(t[n.material]={r:0,g:0,b:0,w:0});o.r+=i.srgb[0]*a,o.g+=i.srgb[1]*a,o.b+=i.srgb[2]*a,o.w+=a}let n={};for(let[e,r]of Object.entries(t))n[e]=r.w>0?[r.r/r.w,r.g/r.w,r.b/r.w]:null;return n}function jT(e){let t={},n=0,r=0;return e.state.particles.forEach(i=>{let a=e.materialProperties[i.material],o=Gh(a,i.specificInternalEnergyJPerKg).stablePhase;t[i.material]=t[i.material]||{},t[i.material][o]=(t[i.material][o]||0)+i.massKg,i.material===`fe`&&(r+=i.massKg,o===`solid`&&(n+=i.massKg))}),{byMaterialPhase:t,ironSolidFraction:r>0?n/r:null}}function MT(e,t,n,r){let i=n.molarMassKgPerMol>0?t/n.molarMassKgPerMol*602214076e15:null;return{material:e,macroParticleCount:r,totalEntities:i,entitiesPerMacroParticle:r>0&&i!=null?i/r:null}}function NT(e){let t=t=>e.reduce((e,n)=>e+n.massKg*Wh(n.properties,t),0),n=e.reduce((e,t)=>e+t.massKg*Wh(t.properties,t.initialTemperatureK),0),r=Math.min(...e.map(e=>e.initialTemperatureK)),i=Math.max(...e.map(e=>e.initialTemperatureK));for(let e=0;e<200;e+=1){let e=.5*(r+i);t(e)<n?r=e:i=e}return .5*(r+i)}function PT(e){let t=e.scenario,n=e.materialProperties[e.dropMaterial],r=e.materialProperties[e.baseMaterial],i=e.materialProperties.air,a=e.initialTemperaturesK?.drop??t.iron.initialTemperatureK,o=e.initialTemperaturesK?.base??t.ice.initialTemperatureK,s=e.initialTemperaturesK?.gas??t.gas.initialTemperatureK,c=Object.values(t.walls.faces),l=Math.max(...c),u=c.reduce((e,t)=>e+t,0)/c.length,d=t.walls.model===`adiabatic`,f=TT(n,a),p=TT(r,o),m=t.box.volumeM3-t.iron.volumeM3-t.ice.volumeM3,h=i?AS({pressurePa:t.gas.pressurePa,temperatureK:s,molarMassKgPerMol:i.molarMassKgPerMol}):0,g=t.iron.volumeM3*f,_=t.ice.volumeM3*p,v=m*h,y=[{massKg:g,properties:n,initialTemperatureK:a},{massKg:_,properties:r,initialTemperatureK:o}];i&&y.push({massKg:v,properties:i,initialTemperatureK:s});let b=NT(y),x=d?b:u,S=d?b:l,C=y.reduce((e,t)=>e+t.massKg*Wh(t.properties,t.initialTemperatureK),0),w=y.reduce((e,t)=>e+t.massKg*Wh(t.properties,x),0),T=d?0:C-w,E=Gh(r,Wh(r,S)).stablePhase,D=Gh(n,Wh(n,S)).stablePhase,O=E===`solid`&&D===`solid`,k=T>0?c.length:0,A=Object.entries(t.walls.faces).map(([e,n])=>({faceId:e,temperatureK:n,role:T>0?`sink`:`balanced`,areaM2:t.box.edgeM*t.box.edgeM,areaFraction:1/6,heatJ:k>0?T/k:0})),j={[e.baseMaterial]:MT(e.baseMaterial,_,r,t.particleResolution.h2o),[e.dropMaterial]:MT(e.dropMaterial,g,n,t.particleResolution.fe),gas:i?MT(`air`,v,i,t.particleResolution.gas):null};return{scenarioId:t.scenarioId,status:O?`preflight-feasible-derived-closures`:`preflight-infeasible-derived-closures`,masses:{ironMassKg:g,iceMassKg:_,airMassKg:v,airDensityKgPerM3:h,dropMassKg:g,baseMassKg:_},energyBudget:{initialInternalEnergyJ:C,finalInternalEnergyJ:w,heatExportedToWallsJ:T,wallLedger:A},boundary:{model:t.walls.model,wallTemperaturesK:{...t.walls.faces},maxWallTempK:l,meanWallTempK:u,asymptoticInteriorTempK:x,adiabaticEquilibriumK:b},feasibility:{feasible:O,bindingInteriorTempK:S,finalH2oPhase:e.baseMaterial===`h2o`?E:null,finalFePhase:e.dropMaterial===`fe`?D:null,finalBasePhase:E,finalDropPhase:D,reason:O?`closure-derived wall equilibrium leaves both demo materials in their solid phase`:`closure-derived wall equilibrium does not leave both demo materials solid`},particleResolution:{h2o:j.h2o||j[e.baseMaterial],fe:j.fe||j[e.dropMaterial],gas:j.gas,...j},closureBacked:!0,scientificValidation:!1,fullPhysicsValidation:!1,materialValidation:!1,eosValidation:!1,sphValidation:!1,phaseChangeValidation:!1,blockers:[`derived-material-models-unvalidated`]}}function FT(e={}){let t=ET(e);t.allowFixtureMaterialProperties||Jx(t.materialProperties,{context:`createSphPhaseDemo.initial-materials`}),t.wallHeatLedgerJ={xMin:0,xMax:0,yMin:0,yMax:0,zMin:0,zMax:0};let n=t.materialProperties.h2o.phases.find(e=>e.name===`gas`).densityKgPerM3,r=t.materialProperties.h2o.phases.find(e=>e.name===`liquid`).densityKgPerM3,i=e.buoyancyCapMPerS2??45,a=e.mechanics??`mlsmpm`,o=e.dt??(a===`mlsmpm`?5e-4:3e-4),s=e.mechanicalSubsteps??(a===`mlsmpm`?16:24),c=e.gridSpacingM??Math.max(.15,t.state.smoothingLengthM),l=a===`mlsmpm`?c:t.state.smoothingLengthM,u=e=>e.bulkModulusPa&&e.densityKgPerM3?Math.sqrt(e.bulkModulusPa/e.densityKgPerM3):0,d=0;for(let e of Object.values(t.materialProperties))for(let t of e.phases||[])d=Math.max(d,u(t));let f=e.cflSafety??.4,p=e.gridCflFactor??.6,m=e.gravity??[0,-9.80665,0],h=f*l/o,g=Math.min(1,d>0?h/d:1),_=g*g,v=e.minGasSoundSpeedMPerS??40,y={integrator:a,gridSpacingM:c,dt:o,mechanicalSubsteps:s,soundSpeedScale:g,modulusScale:_,minGasSoundSpeedMPerS:v,cflSafety:f,gridCflFactor:p,gravityMPerS2:m};t.gpuMechanics=y,t.state.gpuMechanics=y;let b=yw(t.materialProperties,{soundSpeedScale:g,minGasSoundSpeedMPerS:v}),x;x=a===`mlsmpm`?Tw({gridSpacingM:c,boxEdgeM:t.box.edgeM,boxDimsM:t.box.dimensionsM,dt:o,gravity:m,eos:b,restDensityOf:e=>e.restDensityKgPerM3||t.materialProperties[e.material].phases[0].densityKgPerM3,constitutiveOf:e=>{let n=t.materialProperties[e.material],r=Gh(n,e.specificInternalEnergyJPerKg).stablePhase,i=n.phases.find(e=>e.name===r);return r!==`solid`||!i||!(i.shearModulusPa>0)?{solid:!1}:{solid:!0,shearModulusPa:i.shearModulusPa*_,lambdaPa:Math.max((i.bulkModulusPa-2/3*i.shearModulusPa)*_,0)}},cflFactor:p}):dw({dimension:3,gamma:e.gamma??1.4,gravity:m,alpha:e.alpha??1,beta:e.beta??2,dt:o,eos:b});let S=s*o,C=mT(t.dropMaterial,t.baseMaterial,{materialProperties:t.materialProperties,allowFixtureMaterialProperties:t.allowFixtureMaterialProperties,allowReducedProductProperties:t.allowFixtureMaterialProperties}),w=C.reactions;for(let[e,n]of Object.entries(C.productClosures))t.allowFixtureMaterialProperties||qx(n.properties,{material:e,context:`createSphPhaseDemo.product-material`}),t.materialProperties[e]=n.properties;t.reactionNote=C.note;let T=c*2.5,E=e=>Gh(t.materialProperties[e.material],e.specificInternalEnergyJPerKg).temperatureK;return t.reactions=w,t.reactionContactRadiusM=T,{demo:t,preflight(){return PT(t)},step(){for(let e=0;e<s;e+=1)t.state=x.step(t.state).state,t.state.gpuMechanics=y;let{wallHeatJ:a,thermal:o}=mw(t.state,{materialProperties:t.materialProperties,wallTemperaturesK:t.scenario.walls.faces,boxEdgeM:t.box.edgeM,boxDimsM:t.box.dimensionsM,dtS:S,conductionRate:e.conductionRate,wallRate:e.wallRate});for(let e of Object.keys(t.wallHeatLedgerJ))t.wallHeatLedgerJ[e]+=a[e];let c=Math.min(i,hw(n,r));t.state.particles.forEach((e,t)=>{e.material===`h2o`&&o[t].phase===`gas`&&(e.v[1]+=c*S)}),w.length&&Aw(t.state,{reactions:w,materialProperties:t.materialProperties,contactRadiusM:T,temperatureOf:E});let l=t.box.dimensionsM,u=e.maxDisplaySpeedMPerS??25;for(let e of t.state.particles){for(let t=0;t<3;t+=1)e.x[t]<0?(e.x[t]=0,e.v[t]=Math.abs(e.v[t])*.4):e.x[t]>l[t]&&(e.x[t]=l[t],e.v[t]=-Math.abs(e.v[t])*.4);let t=Math.hypot(e.v[0],e.v[1],e.v[2]);if(t>u){let n=u/t;e.v[0]*=n,e.v[1]*=n,e.v[2]*=n}}return t.state.gpuMechanics=y,t.state},totals(){return uw(t.state)},thermalState(){return DT(t)},phaseMassSummary(){return jT(t)},steamSummary(){return gw(t.state,t.materialProperties)},wallHeatLedgerJ(){return{...t.wallHeatLedgerJ}}}}var IT=[`xMin`,`xMax`,`yMin`,`yMax`,`zMin`,`zMax`],LT=283.15,RT=0,zT=2.5,BT={x:5,y:5,z:5},VT=3,HT=5,UT=1,WT=1850,GT=233.15,KT=2,qT=2;function JT(e,t=2){return e==null||!Number.isFinite(e)?`—`:Math.abs(e)>=1e9?e.toExponential(2):Math.abs(e)>=1e6?`${(e/1e6).toFixed(t)}M`:Math.abs(e)>=1e3?`${(e/1e3).toFixed(t)}k`:e.toFixed(t)}function YT(e={}){return Object.entries(e).map(([e,t])=>`${e}:${Object.entries(t).map(([e,t])=>`${e} ${JT(t)}kg`).join(`/`)}`).join(`  `)}function XT(){let e=document.createElement(`div`);return e.id=`sph-phase-overlay`,e.style.cssText=`position:fixed;inset:0;z-index:50;background:#04070a;color:#bfe9d8;font-family:ui-monospace,monospace;`,e.innerHTML=`
    <style>
      #sph-phase-overlay button { background:#14342c;color:#bfe9d8;border:1px solid #1d8b6d;border-radius:6px;padding:8px 12px;margin:0 4px 4px 0;font:600 13px ui-monospace,monospace;cursor:pointer;min-height:40px;touch-action:manipulation; }
      #sph-phase-overlay button:active { background:#1d8b6d;color:#04070a; }
      #sph-phase-overlay input, #sph-phase-overlay select { min-height:36px;font-size:16px;box-sizing:border-box; }
      #sph-phase-overlay select { width:100%;background:#0a1418;color:#bfe9d8;border:1px solid #14342c; }
      .sph-material-row { display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px;align-items:center; }
      .sph-picker-button { width:42px;padding:8px 0!important;margin:0!important; }
      .sph-element-picker-overlay { position:fixed;inset:0;z-index:90;background:rgba(2,6,8,.78);display:flex;align-items:center;justify-content:center;padding:14px; }
      .sph-element-picker { width:min(1080px,96vw);max-height:min(760px,92vh);box-sizing:border-box;border:1px solid #1d8b6d;background:#071114;color:#bfe9d8;padding:12px;box-shadow:0 18px 60px rgba(0,0,0,.58);display:flex;flex-direction:column;gap:10px; }
      .sph-picker-head { display:flex;justify-content:space-between;gap:10px;align-items:start; }
      .sph-picker-title { color:#75f7b4;font-weight:700;line-height:1.3; }
      .sph-picker-subtitle { color:#75c7f7;font-size:11px;opacity:.8;margin-top:3px; }
      .sph-picker-search { width:100%;background:#0a1418;color:#bfe9d8;border:1px solid #14342c;padding:8px; }
      .sph-element-grid-scroll { overflow:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px; }
      .sph-element-grid { display:grid;grid-template-columns:repeat(18,48px);grid-auto-rows:48px;gap:4px;width:max-content;min-width:100%; }
      #sph-phase-overlay .sph-element-cell { position:relative;margin:0!important;padding:3px!important;min-height:48px;border-radius:4px;background:#0b181d;border-color:#245447;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px; }
      #sph-phase-overlay .sph-element-cell:hover { border-color:#75f7b4;background:#102823; }
      #sph-phase-overlay .sph-element-cell.selected { border-color:#fff2a8;box-shadow:0 0 0 2px rgba(255,242,168,.25); }
      .sph-element-number { font-size:9px;color:#75c7f7;line-height:1; }
      .sph-element-symbol { font-size:15px;font-weight:800;line-height:1; }
      .sph-element-name { font-size:8px;line-height:1;max-width:42px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.86; }
      .sph-cat-alkali { background:#182412!important; }
      .sph-cat-alkaline { background:#202512!important; }
      .sph-cat-transition { background:#112127!important; }
      .sph-cat-post-transition { background:#211c25!important; }
      .sph-cat-metalloid { background:#1e2418!important; }
      .sph-cat-nonmetal { background:#162225!important; }
      .sph-cat-halogen { background:#241b17!important; }
      .sph-cat-lanthanide { background:#1d1d2a!important; }
      .sph-cat-actinide { background:#251b22!important; }
      .sph-picker-legend { display:flex;flex-wrap:wrap;gap:5px;font-size:10px;color:#75c7f7; }
      .sph-legend-chip { border:1px solid #245447;padding:3px 6px;background:#0a1418; }
      #sph-panel { transition:transform .25s ease; }
      #sph-panel.collapsed { transform:translateX(110%); }
      @media (max-width:700px) { #sph-panel { width:min(340px,92vw); } #sph-status { font-size:13px; } .sph-element-grid { grid-template-columns:repeat(18,42px);grid-auto-rows:42px; } #sph-phase-overlay .sph-element-cell { min-height:42px; } .sph-element-name { display:none; } }
    </style>
    <div id="sph-scene" style="position:absolute;inset:0;"></div>
    <button id="sph-toggle" type="button" aria-label="Toggle controls" style="position:absolute;top:12px;left:12px;z-index:60;">☰ menu</button>
    <aside id="sph-panel" style="position:absolute;top:0;right:0;height:100%;width:min(360px,92vw);box-sizing:border-box;border-left:1px solid #14342c;padding:14px;padding-top:56px;overflow:auto;-webkit-overflow-scrolling:touch;background:rgba(5,11,14,0.96);z-index:55;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <strong style="color:#75f7b4;">SPH PHASE — two materials interacting</strong>
        <button id="sph-close" type="button">close</button>
      </div>
      <p style="opacity:.6;font-size:11px;line-height:1.4;">Strict first-principles mode. The demo will not run reference or reduced material constants as physics; missing condensed, liquid, optical, or product closures are reported as blockers.</p>
      <div style="margin:8px 0;display:flex;flex-wrap:wrap;">
        <button id="sph-preflight" type="button">Preflight</button>
        <button id="sph-play" type="button">Play</button>
        <button id="sph-step" type="button">Step</button>
        <button id="sph-reset" type="button">Reset</button>
      </div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">wall temperatures (K)</div>
      <div id="sph-walls" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:4px 0;"></div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">materials — auto-applies</div>
      <div id="sph-elements" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:4px 0;"></div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">initial temperature (K) — auto-applies</div>
      <div id="sph-temps" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:4px 0;"></div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">initial block height (m, bottom face) — auto-applies</div>
      <div id="sph-heights" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:4px 0;"></div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">container box size (m, X·Y·Z) — auto-applies</div>
      <div id="sph-box" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin:4px 0;"></div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">particles per block edge (N → N³ particles) — auto-applies</div>
      <div id="sph-counts" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:4px 0;"></div>
      <div style="font-size:11px;color:#75c7f7;margin-top:6px;">isosurface blob size (× — independent of box) — live</div>
      <div id="sph-blob" style="display:grid;grid-template-columns:1fr;gap:6px;margin:4px 0;"></div>
      <div class="terminal-head"><span>status</span></div>
      <pre id="sph-status" style="white-space:pre-wrap;font-size:12px;line-height:1.5;margin:6px 0;"></pre>
    </aside>
  `,e}function ZT(e){return String(e||`element`).replace(/-/g,` `)}function QT(e,t){let n=document.createElement(`span`);return n.className=e,n.textContent=t,n}function $T({overlay:e,select:t,roleLabel:n}){e.querySelector(`.sph-element-picker-overlay`)?.remove();let r=document.createElement(`div`);r.className=`sph-element-picker-overlay`;let i=document.createElement(`section`);i.className=`sph-element-picker`,i.setAttribute(`role`,`dialog`),i.setAttribute(`aria-modal`,`true`),i.setAttribute(`aria-label`,`Choose element for ${n}`);let a=document.createElement(`div`);a.className=`sph-picker-head`;let o=document.createElement(`div`),s=document.createElement(`div`);s.className=`sph-picker-title`,s.textContent=`periodic table - ${n}`;let c=document.createElement(`div`);c.className=`sph-picker-subtitle`,c.textContent=`Selectable cells resolve through the derived element material closure.`,o.append(s,c);let l=document.createElement(`button`);l.type=`button`,l.textContent=`close`,a.append(o,l);let u=document.createElement(`input`);u.className=`sph-picker-search`,u.type=`search`,u.placeholder=`filter by name, symbol, or Z`;let d=document.createElement(`div`);d.className=`sph-element-grid-scroll`;let f=document.createElement(`div`);f.className=`sph-element-grid`,d.appendChild(f);let p=document.createElement(`div`);p.className=`sph-picker-legend`;let m=[...new Set(SS.map(e=>e.category))];for(let e of m){let t=document.createElement(`span`);t.className=`sph-legend-chip sph-cat-${e}`,t.textContent=ZT(e),p.appendChild(t)}let h=!1,g=()=>{h||(h=!0,window.removeEventListener(`keydown`,_),r.remove(),t.focus())};function _(e){e.key===`Escape`&&g()}function v(){let e=u.value.trim().toLowerCase();f.replaceChildren();for(let n of SS){let r=`${n.name} ${n.symbol} ${n.Z}`.toLowerCase();if(e&&!r.includes(e))continue;let i=document.createElement(`button`);i.type=`button`,i.className=`sph-element-cell sph-cat-${n.category}`,n.key===t.value&&i.classList.add(`selected`),i.style.gridColumn=String(n.group),i.style.gridRow=String(n.period),i.title=n.label,i.setAttribute(`aria-label`,n.label),i.append(QT(`sph-element-number`,String(n.Z)),QT(`sph-element-symbol`,n.symbol),QT(`sph-element-name`,n.name)),i.addEventListener(`click`,()=>{t.value=n.key,t.dispatchEvent(new Event(`change`,{bubbles:!0})),g()}),f.appendChild(i)}}l.addEventListener(`click`,g),r.addEventListener(`click`,e=>{e.target===r&&g()}),u.addEventListener(`input`,v),window.addEventListener(`keydown`,_),i.append(a,u,d,p),r.appendChild(i),e.appendChild(r),v(),u.focus()}function eE(){let e=XT();document.body.appendChild(e);let t=e.querySelector(`#sph-walls`),n={};for(let e of IT){let r=document.createElement(`label`);r.style.cssText=`font-size:11px;display:flex;flex-direction:column;gap:2px;`,r.textContent=e;let i=document.createElement(`input`);i.type=`number`,i.value=String(LT),i.step=`5`,i.style.cssText=`width:100%;background:#0a1418;color:#bfe9d8;border:1px solid #14342c;`,r.appendChild(i),t.appendChild(r),n[e]=i}let r=e.querySelector(`#sph-heights`),i={};for(let[e,t,n]of[[`ice`,`ice base`,RT],[`iron`,`iron base`,zT]]){let a=document.createElement(`label`);a.style.cssText=`font-size:11px;display:flex;flex-direction:column;gap:2px;`,a.textContent=t;let o=document.createElement(`input`);o.type=`number`,o.value=String(n),o.step=`0.25`,o.style.cssText=`width:100%;background:#0a1418;color:#bfe9d8;border:1px solid #14342c;`,a.appendChild(o),r.appendChild(a),i[e]=o}let a=e.querySelector(`#sph-box`),o={};for(let[e,t,n]of[[`x`,`X`,BT.x],[`y`,`Y`,BT.y],[`z`,`Z`,BT.z]]){let r=document.createElement(`label`);r.style.cssText=`font-size:11px;display:flex;flex-direction:column;gap:2px;`,r.textContent=t;let i=document.createElement(`input`);i.type=`number`,i.value=String(n),i.step=`0.5`,i.min=`1`,i.style.cssText=`width:100%;background:#0a1418;color:#bfe9d8;border:1px solid #14342c;`,r.appendChild(i),a.appendChild(r),o[e]=i}let s=e.querySelector(`#sph-counts`),c={};for(let[e,t,n]of[[`drop`,`drop edge`,VT],[`base`,`base edge`,HT]]){let r=document.createElement(`label`);r.style.cssText=`font-size:11px;display:flex;flex-direction:column;gap:2px;`,r.textContent=t;let i=document.createElement(`input`);i.type=`number`,i.value=String(n),i.step=`1`,i.min=`1`,i.style.cssText=`width:100%;background:#0a1418;color:#bfe9d8;border:1px solid #14342c;`,r.appendChild(i),s.appendChild(r),c[e]=i}let l=e.querySelector(`#sph-blob`),u=document.createElement(`input`);u.type=`number`,u.value=String(UT),u.step=`0.1`,u.min=`0.1`,u.style.cssText=`width:100%;background:#0a1418;color:#bfe9d8;border:1px solid #14342c;`,l.appendChild(u);let d=e.querySelector(`#sph-elements`),f={};for(let[t,n,r]of[[`drop`,`drop block`,`fe`],[`base`,`base block`,`h2o`]]){let i=document.createElement(`label`);i.style.cssText=`font-size:11px;display:flex;flex-direction:column;gap:2px;`,i.textContent=n;let a=document.createElement(`div`);a.className=`sph-material-row`;let o=document.createElement(`select`);o.className=`sph-material-select`;for(let e of TS){let t=document.createElement(`option`);t.value=e.key,t.textContent=e.label,e.key===r&&(t.selected=!0),o.appendChild(t)}let s=document.createElement(`button`);s.type=`button`,s.className=`sph-picker-button`,s.textContent=`PT`,s.title=`Open periodic table for ${n}`,s.setAttribute(`aria-label`,`Open periodic table for ${n}`),s.addEventListener(`click`,()=>$T({overlay:e,select:o,roleLabel:n})),a.append(o,s),i.appendChild(a),d.appendChild(i),f[t]=o}let p=e.querySelector(`#sph-temps`),m={};for(let[e,t,n]of[[`drop`,`drop block T`,WT],[`base`,`base block T`,GT]]){let r=document.createElement(`label`);r.style.cssText=`font-size:11px;display:flex;flex-direction:column;gap:2px;`,r.textContent=t;let i=document.createElement(`input`);i.type=`number`,i.value=String(n),i.step=`10`,i.style.cssText=`width:100%;background:#0a1418;color:#bfe9d8;border:1px solid #14342c;`,r.appendChild(i),p.appendChild(r),m[e]=i}let h=e.querySelector(`#sph-status`),g=e.querySelector(`#sph-scene`),_={wxmin:n.xMin,wxmax:n.xMax,wymin:n.yMin,wymax:n.yMax,wzmin:n.zMin,wzmax:n.zMax,drop:f.drop,base:f.base,dropt:m.drop,baset:m.base,iceh:i.ice,ironh:i.iron,boxx:o.x,boxy:o.y,boxz:o.z,dropn:c.drop,basen:c.base,blob:u};function v(){let e=new URLSearchParams(window.location.hash.replace(/^#/,``));for(let[t,n]of Object.entries(_)){let r=e.get(t);r!=null&&r!==``&&(n.value=r)}}function y(){let e=new URLSearchParams;for(let[t,n]of Object.entries(_))e.set(t,n.value);window.history.replaceState(null,``,`#${e.toString()}`)}v(),y();function b(){let e=(e,t)=>{let n=Number(e.value);return Number.isFinite(n)&&n>0?n:t};return[e(o.x,BT.x),e(o.y,BT.y),e(o.z,BT.z)]}function x(){let e={};for(let t of IT)e[t]=Number(n[t].value)||LT;return CT({wallFaces:e,boxDimensionsM:b()})}function S(){let e=Number(i.ice.value),t=Number(i.iron.value),n=Number(m.drop.value),r=Number(m.base.value),a=Math.round(Number(c.drop.value)),o=Math.round(Number(c.base.value));return{scenario:x(),dropMaterial:f.drop.value,baseMaterial:f.base.value,dropTemperatureK:Number.isFinite(n)?n:WT,baseTemperatureK:Number.isFinite(r)?r:GT,iceBaseHeightM:Number.isFinite(e)?e:RT,ironBaseHeightM:Number.isFinite(t)?t:zT,dropParticleEdge:Number.isFinite(a)&&a>=1?a:VT,baseParticleEdge:Number.isFinite(o)&&o>=1?o:HT}}let C=()=>{let e=Number(u.value);return Number.isFinite(e)&&e>0?e:UT},w=null,T=null;function E(){try{let e=FT(S());return w=null,e}catch(e){return w=e,null}}T=E();let D=Cx(g,{boxDimsM:T?.demo.box.dimensionsM??b(),surfaceRadiusScale:C()});e.__sphScene=D,e.__sphDriver=T,e.__sphOpticalGpuLookup=D.getOpticalGpuLookup?.()||null,e.__sphThermalMaterialTable=D.getSphThermalMaterialTable?.()||null,e.__sphReactionTable=D.getSphReactionTable?.()||null,e.__sphResidentRenderState=D.getSphResidentRenderState?.()||null,e.__sphGpuParticleState=D.getSphGpuParticleState?.()||null,e.__sphGpuParticleUpload=D.getSphGpuParticleUpload?.()||null,e.__mlsMpmGpuParticleState=D.getMlsMpmGpuParticleState?.()||null,e.__mlsMpmGpuParticleUpload=D.getMlsMpmGpuParticleUpload?.()||null,e.__mlsMpmMechanicsPrediction=D.getMlsMpmMechanicsPrediction?.()||null,e.__mlsMpmP2gGridProjection=D.getMlsMpmP2gGridProjection?.()||null,e.__mlsMpmGridUpdate=D.getMlsMpmGridUpdate?.()||null,e.__mlsMpmG2pReconstruction=D.getMlsMpmG2pReconstruction?.()||null,e.__mlsMpmResidentStep=D.getMlsMpmResidentStep?.()||null,e.__mlsMpmResidentSteps=D.getMlsMpmResidentSteps?.()||null,e.__mlsMpmResidentRequestedReadbackMode=D.getMlsMpmResidentRequestedReadbackMode?.()||`no-full-readback`;let O=null,k=null,A=null,j=null,M=null,N=null,P=0;function F(){let t=D.getOpticalGpuLookup?.(),n=t?.signature;n&&(t.execution?.signature===n||k===n||(k=n,D.refreshOpticalGpuLookup?.({preferWebGpu:!0}).then(t=>{e.__sphOpticalGpuLookup=t}).catch(t=>{e.__sphOpticalGpuLookupError=t instanceof Error?t.message:String(t)}).finally(()=>{k===n&&(k=null)})))}function I(e){return e?[e.particleCount,e.step,e.time,e.state?.byteLength??0,e.thermo?.byteLength??0].join(`|`):null}function ee(){let t=D.getSphGpuParticleState?.(),n=I(t);!n||A===n||(A=n,D.refreshSphGpuParticleBuffers?.({preferWebGpu:!0}).then(t=>{e.__sphGpuParticleUpload=t}).catch(t=>{e.__sphGpuParticleUploadError=t instanceof Error?t.message:String(t)}).finally(()=>{A===n&&(A=null)}))}function L(e){return e?[e.particleCount,e.step,e.time,e.mechanics?.byteLength??0,e.mechanicsDtS??0,e.soundSpeedScale??0,e.minGasSoundSpeedMPerS??0].join(`|`):null}function te(){let t=D.getMlsMpmGpuParticleState?.(),n=L(t);!n||j===n||(j=n,D.refreshMlsMpmGpuParticleBuffers?.({preferWebGpu:!0}).then(t=>{e.__mlsMpmGpuParticleUpload=t}).catch(t=>{e.__mlsMpmGpuParticleUploadError=t instanceof Error?t.message:String(t)}).finally(()=>{j===n&&(j=null)}))}function R(){let e=D.getSphGpuParticleState?.(),t=D.getMlsMpmGpuParticleState?.(),n=I(e),r=L(t);return n&&r?`${n}|${r}`:null}function z(){let t=R();!t||M===t||(M=t,D.refreshMlsMpmMechanicsPrediction?.({preferWebGpu:!0}).then(t=>{e.__mlsMpmMechanicsPrediction=t}).catch(t=>{e.__mlsMpmMechanicsPredictionError=t instanceof Error?t.message:String(t)}).finally(()=>{M===t&&(M=null)}))}function ne({stepCount:e=KT,readbackMode:t=ex}={}){let n=D.getSphGpuParticleState?.(),r=D.getMlsMpmGpuParticleState?.(),i=I(n),a=L(r);return!i||!a?null:[i,a,n?.smoothingLengthM??0,r?.mechanicsDtS??0,(r?.gravityMPerS2??[0,-9.80665,0]).join(`,`),r?.gridCflFactor??.6,Math.max(1,Math.round(Number(e)||1)),t].join(`|`)}function re({stepCount:t=KT,readbackMode:n=ex,continueFromResidentState:r=!1,continuationBudget:i=qT,generation:a=P}={}){let o=Math.max(1,Math.round(Number(t)||1)),s=ne({stepCount:o,readbackMode:n}),c=s?`${s}|sync=${a}|continue=${!!r}`:null;if(!c||N===c)return;e.__mlsMpmResidentRequestedReadbackMode=n,N=c;let l=!1;D.refreshMlsMpmResidentSteps?.({preferWebGpu:!0,stepCount:o,readbackMode:n,continueFromResidentState:r}).then(async t=>{if(e.__mlsMpmResidentSteps=t,e.__mlsMpmResidentStep=D.getMlsMpmResidentStep?.()||t?.finalStep||null,e.__mlsMpmP2gGridProjection=D.getMlsMpmP2gGridProjection?.()||t?.finalStep?.p2gGridProjection||null,e.__mlsMpmGridUpdate=D.getMlsMpmGridUpdate?.()||t?.finalStep?.gridUpdate||null,e.__mlsMpmG2pReconstruction=D.getMlsMpmG2pReconstruction?.()||t?.finalStep?.g2pReconstruction||null,e.__mlsMpmResidentRequestedReadbackMode=t?.requestedReadbackMode||n,e.__mlsMpmResidentSourceMode=t?.residentSourceMode||`cpu-packed-state`,e.__mlsMpmResidentContinuedFromResidentState=!!t?.continuedFromResidentState,e.__mlsMpmResidentContinuationAvailable=!!t?.continuationAvailable,l=!!(t?.continuationAvailable&&t?.readbackMode===`no-full-readback`&&t?.backend===`webgpu`&&i>0&&a===P),t?.backend===`webgpu`&&a===P)try{e.__sphResidentRenderState=await D.refreshSphResidentRenderState?.({preferWebGpu:!0,residentSteps:t,materialProperties:T?.demo?.materialProperties||{}})}catch(t){e.__sphResidentRenderStateError=t instanceof Error?t.message:String(t)}else e.__sphResidentRenderState=D.getSphResidentRenderState?.()||null;ce()}).catch(t=>{e.__mlsMpmResidentStepsError=t instanceof Error?t.message:String(t),ce()}).finally(()=>{N===c&&(N=null),l&&e.isConnected&&a===P&&window.requestAnimationFrame(()=>{!e.isConnected||a!==P||re({stepCount:o,readbackMode:n,continueFromResidentState:!0,continuationBudget:i-1,generation:a})})})}u.addEventListener(`input`,()=>{D.setSurfaceRadiusScale(C()),oe()});function ie(){le=!1,e.querySelector(`#sph-play`).textContent=`Play`,T=E(),D.dispose(),D=Cx(g,{boxDimsM:T?.demo.box.dimensionsM??b(),surfaceRadiusScale:C()}),e.__sphScene=D,e.__sphDriver=T,e.__sphOpticalGpuLookup=D.getOpticalGpuLookup?.()||null,e.__sphThermalMaterialTable=D.getSphThermalMaterialTable?.()||null,e.__sphReactionTable=D.getSphReactionTable?.()||null,e.__sphResidentRenderState=D.getSphResidentRenderState?.()||null,e.__sphGpuParticleState=D.getSphGpuParticleState?.()||null,e.__sphGpuParticleUpload=D.getSphGpuParticleUpload?.()||null,e.__mlsMpmGpuParticleState=D.getMlsMpmGpuParticleState?.()||null,e.__mlsMpmGpuParticleUpload=D.getMlsMpmGpuParticleUpload?.()||null,e.__mlsMpmMechanicsPrediction=D.getMlsMpmMechanicsPrediction?.()||null,e.__mlsMpmP2gGridProjection=D.getMlsMpmP2gGridProjection?.()||null,e.__mlsMpmGridUpdate=D.getMlsMpmGridUpdate?.()||null,e.__mlsMpmG2pReconstruction=D.getMlsMpmG2pReconstruction?.()||null,e.__mlsMpmResidentStep=D.getMlsMpmResidentStep?.()||null,e.__mlsMpmResidentSteps=D.getMlsMpmResidentSteps?.()||null,e.__mlsMpmResidentRequestedReadbackMode=D.getMlsMpmResidentRequestedReadbackMode?.()||`no-full-readback`,k=null,A=null,j=null,M=null,N=null,oe(),ce()}function ae(){y(),O!=null&&window.clearTimeout(O),le=!1,e.querySelector(`#sph-play`).textContent=`Play`,h.textContent=`rebuilding material state and derived chemistry...`,O=window.setTimeout(()=>{O=null,ie()},0)}for(let[e,t]of Object.entries(_))e===`blob`?t.addEventListener(`change`,y):t.addEventListener(`change`,ae);function oe(){if(P+=1,!T){D.setParticles({positionsM:new Float32Array,colorsRgb:new Float32Array,materials:[],reactions:[]}),e.__sphResidentRenderState=D.getSphResidentRenderState?.()||null;return}let t=OT(T.demo),n=kT(T.demo),r=vg(T.demo.state,{materialProperties:T.demo.materialProperties}),i=xg(T.demo.state,{materialProperties:T.demo.materialProperties}),a=T.demo.state.particles.length,o=new Float32Array(a*3),s=new Float32Array(a*3),c=Array(a);T.demo.state.particles.forEach((e,r)=>{o[r*3]=e.x[0],o[r*3+1]=e.x[1],o[r*3+2]=e.x[2],s[r*3]=t[r].rgb[0],s[r*3+1]=t[r].rgb[1],s[r*3+2]=t[r].rgb[2],c[r]=n[r]}),D.setParticles({positionsM:o,colorsRgb:s,materials:c,emissiveByMaterial:AT(T.demo),materialProperties:T.demo.materialProperties,reactions:T.demo.reactions||[],reactionContactRadiusM:T.demo.reactionContactRadiusM,sphGpuParticleState:r,mlsMpmGpuParticleState:i}),e.__sphOpticalGpuLookup=D.getOpticalGpuLookup?.()||null,e.__sphThermalMaterialTable=D.getSphThermalMaterialTable?.()||null,e.__sphReactionTable=D.getSphReactionTable?.()||null,e.__sphResidentRenderState=D.getSphResidentRenderState?.()||null,e.__sphGpuParticleState=D.getSphGpuParticleState?.()||null,e.__mlsMpmGpuParticleState=D.getMlsMpmGpuParticleState?.()||null,e.__mlsMpmGridUpdate=D.getMlsMpmGridUpdate?.()||null,e.__mlsMpmG2pReconstruction=D.getMlsMpmG2pReconstruction?.()||null,e.__mlsMpmResidentStep=D.getMlsMpmResidentStep?.()||null,e.__mlsMpmResidentSteps=D.getMlsMpmResidentSteps?.()||null,e.__mlsMpmResidentSourceMode=`cpu-packed-state`,e.__mlsMpmResidentContinuedFromResidentState=!1,e.__mlsMpmResidentContinuationAvailable=!1,F(),ee(),te(),z(),re()}function se(e=1){if(!T)return{blocked:!0,reason:w?.message||`first-principles material resolution blocked`,blockers:w?.blockers||[]};let t=Math.max(1,Math.round(Number(e)||1));for(let e=0;e<t;e+=1)T.step();return oe(),ce(),{step:T.demo.state.step??0,time:T.demo.state.time??0,particlesByMaterial:T.demo.state.particles.reduce((e,t)=>(e[t.material]=(e[t.material]||0)+1,e),{})}}e.__sphStep=se;function ce(){if(!T){h.textContent=[`preflight        : blocked`,`reason           : first-principles material properties are required`,`error            : ${w?.message||`material closure missing`}`,`blockers         : ${(w?.blockers||[]).join(`, `)||`first-principles-material-closure-not-produced`}`,``,`validation       : no fixture/reduced material properties consumed`].join(`
`);return}let t=T.preflight(),n=uw(T.demo.state),r=jT(T.demo),i=r.byMaterialPhase.h2o||{},a=t.energyBudget.wallLedger.map(e=>`  ${e.faceId} ${e.role} ${JT(e.heatJ)}J`).join(`
`),o=Object.entries(i).map(([e,t])=>`${e} ${JT(t)}kg`).join(`  `),s=YT(r.byMaterialPhase),c=D.getMlsMpmResidentSteps?.()||e.__mlsMpmResidentSteps||null,l=D.getMlsMpmResidentStep?.()||e.__mlsMpmResidentStep||null,u=D.getSphResidentRenderState?.()||e.__sphResidentRenderState||null,d=c?.requestedReadbackMode||l?.requestedReadbackMode||e.__mlsMpmResidentRequestedReadbackMode||`no-full-readback`,f=c?.readbackMode||l?.readbackMode||`pending`,p=c?.backend||l?.backend||`pending`,m=c?.renderStateReadbackAvailable??l?.renderStateReadbackAvailable??null,g=c?.normalHotLoopReadbackFree??l?.normalHotLoopReadbackFree??!1,_=c?.gpuAuthoritativeState??l?.gpuAuthoritativeState??!1,v=c?.residentSourceMode||e.__mlsMpmResidentSourceMode||`cpu-packed-state`,y=c?.continuedFromResidentState??e.__mlsMpmResidentContinuedFromResidentState??!1,b=c?.continuationAvailable??e.__mlsMpmResidentContinuationAvailable??!1,x=l?.diagnostics||null,S=x?.compactGpuSummaryStatus||`pending`,C=x?.compactGpuSummaryReadbackMode||x?.readbackMode||`pending`,E=x?.compactSummaryReductionStrategy||`pending`,O=l?.stageStatus?.thermal||l?.thermalStep?.status||l?.thermalStep?.result?.status||`pending`,k=l?.stageBackends?.thermal||l?.thermalStep?.backend||l?.thermalStep?.result?.backend||`pending`,A=D.getSphReactionTable?.()||e.__sphReactionTable||null,j=l?.stageStatus?.reaction||l?.reactionStep?.status||l?.reactionStep?.result?.status||(A?.reactionCount>0?`pending`:`no-derived-reactions`),M=l?.stageBackends?.reaction||l?.reactionStep?.backend||l?.reactionStep?.result?.backend||(A?.reactionCount>0?`pending`:`not-required`),N=l?.nextParticleBufferMode||`pending`,P=u?.source||`cpu-particles`,F=u?.status||`pending`,I=u?.backend||`pending`,ee=u?.particleCount??0,L=u?.renderFieldTotalCells??0,te=u?.renderFieldReadback??!1,R=!!u?.gpuAuthoritativeState;h.textContent=[`preflight        : ${t.status} (feasible=${t.feasibility.feasible})`,`final phase      : H2O ${t.feasibility.finalH2oPhase} / Fe ${t.feasibility.finalFePhase}`,`heat to walls    : ${JT(t.energyBudget.heatExportedToWallsJ)} J`,`masses (kg)      : Fe ${JT(t.masses.ironMassKg)}  ice ${JT(t.masses.iceMassKg)}  air ${JT(t.masses.airMassKg)}`,`particles        : ${T.demo.dropMaterial} ${T.demo.counts.drop}  ${T.demo.baseMaterial} ${T.demo.counts.base}  total ${T.demo.counts.total}`,`reaction         : ${T.demo.reactionNote||`—`}`,`material phases  : ${s||`—`}`,`molecules/macro  : H2O ${JT(t.particleResolution.h2o.entitiesPerMacroParticle)}  Fe ${JT(t.particleResolution.fe.entitiesPerMacroParticle)}`,`water by phase   : ${o||`—`}`,`iron solid frac  : ${JT(r.ironSolidFraction,3)}`,`total energy     : ${JT(n.totalEnergyJ)} J`,`momentum |p|     : ${JT(n.momentumMagnitudeKgMPerS)} kg·m/s`,`resident backend : ${p}`,`resident readback: requested=${d} actual=${f}`,`resident source  : ${v} continued=${!!y} next=${!!b}`,`compact summary  : status=${S} mode=${C} reduction=${E}`,`resident thermal : status=${O} backend=${k} next=${N}`,`resident reaction: status=${j} backend=${M} reactions=${A?.reactionCount??0}`,`render readback  : available=${m==null?`pending`:String(m)} hot-loop-no-full=${!!g}`,`render source    : ${P} status=${F} backend=${I} rows=${ee} field-cells=${L} field-readback=${!!te}`,`render authoritative: ${R}`,`gpu authoritative: ${!!_}`,`per-wall ledger  :\n${a}`,``,`validation       : scientific=false sph=false phase=false (evidence-only)`].join(`
`)}let le=!1;function ue(){!le||!T||(T.step(),oe(),ce(),requestAnimationFrame(ue))}e.querySelector(`#sph-preflight`).addEventListener(`click`,ce),e.querySelector(`#sph-step`).addEventListener(`click`,()=>{if(!T){ce();return}T.step(),oe(),ce()}),e.querySelector(`#sph-play`).addEventListener(`click`,e=>{if(!T){le=!1,e.target.textContent=`Play`,ce();return}le=!le,e.target.textContent=le?`Pause`:`Play`,le&&ue()}),e.querySelector(`#sph-reset`).addEventListener(`click`,()=>{y(),ie()});let de=e.querySelector(`#sph-panel`),fe=e.querySelector(`#sph-toggle`),pe=window.innerWidth<700;function me(){de.classList.toggle(`collapsed`,pe),fe.textContent=pe?`☰ menu`:`✕ hide`,fe.setAttribute(`aria-expanded`,String(!pe))}fe.addEventListener(`click`,()=>{pe=!pe,me()}),me();function he(){le=!1,O!=null&&window.clearTimeout(O),D.dispose(),e.remove()}return e.querySelector(`#sph-close`).addEventListener(`click`,he),oe(),ce(),{close:he,overlay:e}}function tE(){let e=eE(),t=document.querySelector(`#sph-phase-overlay`)?.querySelector(`#sph-close`);return t&&t.addEventListener(`click`,()=>{setTimeout(tE,0)}),e}tE();