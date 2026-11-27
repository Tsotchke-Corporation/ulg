import{Ja as e,Qi as t,Ua as n,na as r}from"./src-BrKxCx2p.js";import{n as i,r as a}from"./ClosureRegistry-DJeJlc39.js";import{At as o,Ft as s,Ot as c,Qt as l,an as u,d,en as f,i as p,in as m,jt as h,kt as g,nn as _,on as v,rn as y,s as b,tn as x}from"./molecularHartreeFockWebGpu-C30-vG4U.js";import{_ as S,f as C,h as w,p as T}from"./recursiveCompoundPipeline-VW57XdB-.js";import{i as E}from"./residentBufferLease-EzWfR0Bs.js";import{o as D,s as O}from"./ulgMaterialPbrWgsl-Cz0OixAv.js";var k=`ulg.electronic.periodic-bulk-dft-webgpu.v1`,A=27.211386245988,j=g/c**3*1e-9,M=c*1e10,N=1054571817e-43,P=1380649e-29;function F(e){let t=_(e),n=t.reduce((e,t)=>Math.max(e,t.n),0),r=t.find(e=>e.n===n&&e.l===0),i=t.find(e=>e.n===n&&e.l===1),a=t.find(e=>e.n===n&&e.l===2),o=a||t.find(e=>e.n===n-1&&e.l===2),s=a?0:r?.occupancy??0,c=a?0:i?.occupancy??0;return{maxN:n,sSub:r,pSub:i,dSub:o,sOcc:s,pOcc:c,dOcc:o?.occupancy??0,isClosedShell:(n===1&&s===2||c===6)&&!a,isMolecularNonmetal:!a&&(n===1&&s===1||c===5||n<=3&&c>=3&&c<=4||n===4&&c===4),isCovalentTetrahedral:!a&&(n>=2&&n<=5&&c===2||n===2&&c===1)}}var I=Object.freeze({fcc:Object.freeze({id:`fcc`,spaceGroup:`Fm-3m (225)`,madelungAlpha:-1.79175,coord:12,atomsPerConv:4,packingFactor:Math.PI/(3*Math.SQRT2),shearRatioGOverK:.45,basisFractional:[[0,0,0]]}),bcc:Object.freeze({id:`bcc`,spaceGroup:`Im-3m (229)`,madelungAlpha:-1.79186,coord:8,atomsPerConv:2,packingFactor:Math.PI*Math.sqrt(3)/8,shearRatioGOverK:.48,basisFractional:[[0,0,0]]}),hcp:Object.freeze({id:`hcp`,spaceGroup:`P6_3/mmc (194)`,madelungAlpha:-1.79168,coord:12,atomsPerConv:4,packingFactor:Math.PI/(3*Math.SQRT2),shearRatioGOverK:.46,basisFractional:[[0,0,0],[1/3,2/3,.5]]}),diamond:Object.freeze({id:`diamond`,spaceGroup:`Fd-3m (227)`,madelungAlpha:-1.67085,coord:4,atomsPerConv:8,packingFactor:Math.PI*Math.sqrt(3)/16,shearRatioGOverK:.72,basisFractional:[[-.125,-.125,-.125],[.125,.125,.125]]}),"vdw-fcc":Object.freeze({id:`vdw-fcc`,spaceGroup:`Fm-3m (vdW)`,madelungAlpha:-1.79175,coord:12,atomsPerConv:4,packingFactor:Math.PI/(3*Math.SQRT2),shearRatioGOverK:.32,basisFractional:[[0,0,0]]})});function ee(e){let t=F(e);return t.isClosedShell||t.isMolecularNonmetal?[`vdw-fcc`]:t.isCovalentTetrahedral?[`diamond`,`fcc`]:!t.dSub&&!t.pSub&&t.sOcc===1?[`bcc`,`fcc`]:!t.dSub&&!t.pSub&&t.sOcc===2?[`hcp`,`fcc`,`bcc`]:t.dOcc>=1&&t.dOcc<=9?[`bcc`,`fcc`,`hcp`]:[`fcc`,`bcc`,`hcp`]}var L=Object.freeze([[0,0,0],[1,1,1],[-1,1,1],[1,-1,1],[1,1,-1],[-1,-1,1],[-1,1,-1],[1,-1,-1],[-1,-1,-1],[2,0,0],[-2,0,0],[0,2,0],[0,-2,0],[0,0,2],[0,0,-2]]);function te(e,t,n,r,i){let a=L.length,o=new Float32Array(a*a),c=2*Math.PI/Math.max(1.5,t),l=i===`bcc`?t**3/2:i===`diamond`?t**3/8:t**3/4,u=s(n/Math.max(1e-6,l)),d=1.919158292677513/Math.max(.25,u);for(let t=0;t<a;t+=1){let s=L[t],u=(e[0]+s[0])*c,f=(e[1]+s[1])*c,p=(e[2]+s[2])*c;o[t*a+t]=.5*(u*u+f*f+p*p);for(let e=t+1;e<a;e+=1){let u=L[e],f=(s[0]-u[0])*c,p=(s[1]-u[1])*c,m=(s[2]-u[2])*c,h=Math.hypot(f,p,m);if(h<1e-8)continue;let g=-(4*Math.PI*n/(l*h*h))*Math.cos(h*r),_=h/(2*d),v=_<1e-4?1:Math.abs(_-1)<1e-4?.5:.5+(1-_*_)/(4*_)*Math.log(Math.abs((1+_)/(1-_))),y=1+4*d/(Math.PI*h*h)*v,b=1;if(i===`diamond`){let e=(s[0]-u[0]+(s[1]-u[1])+(s[2]-u[2]))*(Math.PI/4);b=Math.cos(e)}else if(i===`hcp`){let e=((s[0]-u[0])/3+2*(s[1]-u[1])/3+.5*(s[2]-u[2]))*Math.PI;b=Math.cos(e)}let x=g/y*b;o[t*a+e]=x,o[e*a+t]=x}}return o}function ne(){let e=[{label:`Γ`,k:[0,0,0]},{label:`X`,k:[0,1,0]},{label:`W`,k:[.5,1,0]},{label:`L`,k:[.5,.5,.5]},{label:`Γ`,k:[0,0,0]}],t=[];for(let n=0;n<e.length-1;n+=1){let r=e[n].k,i=e[n+1].k;for(let a=0;a<4;a+=1){let o=a/4;t.push({label:a===0?e[n].label:``,k:[r[0]+o*(i[0]-r[0]),r[1]+o*(i[1]-r[1]),r[2]+o*(i[2]-r[2])]})}}return t.push(e[e.length-1]),t}function re(e,t,n){let r=Math.max(.8,e),{Z:i,zv:a,rcBohr:s,polarizabilityBohr3:c,rVdwBohr:l,dOcc:u,fOcc:d,relSContraction:f,spGapHa:p}=n,m=4*Math.PI/3*r**3;if(t.id===`vdw-fcc`){let e=r*1.80941,t=.75*Math.max(.15,n.ionizationPotentialHa||.5)*c*c,i=Math.max(2.2,l*1.38),a=(i/e)**6;return 2*Math.max(1e-5,t/(4*i**6))*(12.13188*a*a-14.45392*a)}let g=r/Math.cbrt(Math.max(1,a)),_=1.10495/(g*g)*a,v=(h(g)+o(g))*a,y=t.madelungAlpha*a*a/(2*r),b=2*Math.PI*a*a*s*s/m,x=0;if(u>0&&u<10){let e=Math.max(3,n.dPrincipalN||3),t=2.65+.16*(e-3),i=.145*(e/3)**.45*(t/r)**3.2;x-=.5*i*u*(1-u/10),x+=.22*i*(u/10+.38)*(t/r)**6}else if(u===10&&n.sOcc===1&&n.pOcc===0){let e=Math.max(3,n.dPrincipalN||3),t=2.62+.14*(e-3),i=.085*(e/3)**.35*(t/r)**3.4;x-=1.35*i,x+=.65*i*(t/r)**5.5}if(d>0&&d<14){let e=(n.fPrincipalN||4)<=4,t=e?3.55:3.35,i=(e?.025:.055)*(t/r)**3.5;x-=.25*i*d*(1-d/14),x+=.28*i*(d/14+.4)*(t/r)**6}if(t.id===`diamond`){let e=r*1.3959,t=Math.max(2.85,Math.sqrt(Math.max(2,n.meanR2Valence||6))*1.44),i=Math.exp(-.56*(e-t)),o=Math.max(.12,.072*a*a/Math.max(2.2,t));x+=(a>=3&&a<=5?2.25:.5)*o*(i*i-2*i)}u===10&&a===2&&f>.08&&(x+=.18*f*(p||.2)*(3.2/r)**2.5);let{sOcc:S=0,pOcc:C=0}=n,w=0;return t.id===`bcc`?w=u>=3&&u<=6||u===0&&C===0&&S===1?-.0085:.0045:t.id===`fcc`?w=u>=8&&u<=10&&!(u===10&&S===2&&C===0)||u===0&&S===2&&C>=1||u===10&&C>=1?-.0095:.0015:t.id===`hcp`&&(w=u===0&&C===0&&S===2||u===1||u===2||u===7||u===10&&S===2&&C===0||d>0&&d<14?-.009:.002),_+v+y+b+x+w}function ie(e,t){let n=0;for(let e=1;e<t.length;e+=1)t[e]<t[n]&&(n=e);let r=Math.max(1,Math.min(t.length-2,n)),i=4*Math.PI/3*e[r-1]**3,a=4*Math.PI/3*e[r]**3,o=4*Math.PI/3*e[r+1]**3,s=t[r-1],c=t[r],l=t[r+1],u=(c-s)/(a-i),d=(l-c)/(o-a),f=2*(d-u)/(o-i),p=.5*(u+d),m=a-(f>1e-12?p/f:0);m=f>1e-12?Math.max(i,Math.min(o,m)):a;let h=Math.cbrt(3*m/(4*Math.PI)),g=c-(f>1e-12?.5*p*p/f:0),_=Math.max(1e-7,m*Math.max(1e-7,f))*j;return{rWsEq:h,vEqBohr3:m,eMinHa:g,bulkModulusGPa:_}}function R(e,t){let n=_(e),r=n.reduce((e,t)=>Math.max(e,t.n),0),i=n.find(e=>e.n===r&&e.l===2),a=i||n.find(e=>e.n===r-1&&e.l===2),o=n.find(e=>e.n===r-2&&e.l===3),s=i?null:n.find(e=>e.n===r&&e.l===0),c=i?null:n.find(e=>e.n===r&&e.l===1),l=s?.occupancy??0,u=c?.occupancy??0,d=a?.occupancy??0,f=o?.occupancy??0,p=Math.max(1,v(e)||(a?Math.min(4,a.occupancy):1)),m=2,h=!1,g=3.2,y=6,b=t?.radialGrid;if(b?.r&&b?.rho){let{r:e,rho:t,dx:n}=b,r=0,i=0;for(let r=0;r<e.length;r+=1)i+=4*Math.PI*e[r]*e[r]*e[r]*t[r]*n;let a=Math.max(1,l+u+.55*(u===0?d:0)+.55*(f<14?f:0)),o=Math.max(.5,i-a),s=0,c=0;for(let a=0;a<e.length;a+=1){let l=4*Math.PI*e[a]*e[a]*e[a]*t[a]*n;r+=l,r>=o&&!h&&(m=e[a],h=!0),t[a]>=5e-4&&(g=e[a]),r>=Math.max(0,i-p-1)&&(s+=e[a]*e[a]*l,c+=l)}c>1e-6&&(y=s/c)}let x=Math.max(.55,Math.min(2.85,m*.82)),S=Array.isArray(t?.orbitals)?t.orbitals.filter(e=>Number(e.occupancy??1)>0):[],C=S.length?Math.max(...S.map(e=>Number(e.energyHa??e.energy??-.4))):-.35,w=Math.max(.14,-C*1.65),T=a?S.find(e=>e.n===a.n&&e.l===2):null,E=o?S.find(e=>e.n===o.n&&e.l===3):null,D=T?Number(T.energyHa??T.energy??-.35):null,O=E?Number(E.energyHa??E.energy??-.45):null,k=Math.max(1.2,Math.min(450,2/9*Math.max(1,p)*y**2)),A=Math.min(.35,.5*(e/137.036)**2);return Object.freeze({Z:e,maxN:r,zv:p,rcBohr:x,rVdwBohr:Math.max(1.8,g),meanR2Valence:y,polarizabilityBohr3:k,ionizationPotentialHa:w,dOcc:d,dPrincipalN:a?.n??0,dOrbitalEnergyHa:D,fOcc:f,fPrincipalN:o?.n??0,fOrbitalEnergyHa:O,sOcc:l,pOcc:u,relSContraction:A,spGapHa:.22+.4*A})}async function z(e,t,r,{densityGridN:i=16,atomicMassU:a=null}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`solveBulkCrystalWebGpu requires a live WebGPU GPUDevice`);let s=R(t,r),l=ee(t),u=null;for(let e of l){let t=I[e],n=e===`vdw-fcc`?Math.max(2,s.rVdwBohr*.72):Math.max(1.3,s.rcBohr*1.15),r=e===`vdw-fcc`?Math.max(n+2.5,s.rVdwBohr*1.45):Math.max(n+2.8,s.rcBohr*3.1),i=new Float64Array(19),a=new Float64Array(19);for(let e=0;e<19;e+=1)i[e]=n+e/18*(r-n),a[e]=re(i[e],t,s);let o=ie(i,a);(!u||o.eMinHa<u.fit.eMinHa)&&(u={struct:t,fit:o})}let{struct:d,fit:g}=u,_=Number(a),v=Number.isFinite(_)&&_>0?_*16605390666e-37:f(t),b=Math.max(1e6,g.bulkModulusGPa*1e9),x=b*d.shearRatioGOverK,S=g.vEqBohr3*c**3,C=v/S,w=Math.sqrt((b+4/3*x)/C),T=Math.sqrt(x/C),E=Math.cbrt(3/(1/w**3+2/T**3)),O=N/P*Math.cbrt(6*Math.PI*Math.PI/S)*E,j=Math.min(.18,1.5*1.6*P*O/Math.max(1e-24,b*S)),z=g.vEqBohr3*(1+j),ae=z*c**3,B=v/ae,V=Math.cbrt(d.atomsPerConv*z),oe=V*M,H=(3*b-2*x)/(2*(3*b+x)),se=b+4/3*x,ce=b-2/3*x,le=x,ue=Math.sqrt((b+4/3*x)/B),de=Math.sqrt(x/B),fe=Math.cbrt(3/(1/ue**3+2/de**3)),pe=1/ae,U=N/P*Math.cbrt(6*Math.PI*Math.PI*pe)*fe,me;if(d.id===`vdw-fcc`)me=Math.max(8e-4,Math.min(2.5,Math.abs(g.eMinHa)*A));else{let e=Math.max(1.2,g.rWsEq),t=e/Math.cbrt(Math.max(1,s.zv)),n=1.10495/(t*t)*s.zv+(h(t)+o(t))*s.zv+d.madelungAlpha*s.zv*s.zv/(2*e)+2*Math.PI*s.zv*s.zv*s.rcBohr*s.rcBohr/(4*Math.PI/3*e**3),r=Math.max(0,(n-g.eMinHa)*A),i=5.45*Math.max(1,s.zv)**.65/Math.max(1.6,e);if(s.dOcc===10&&s.sOcc===2&&s.pOcc===0){let e=Math.max(.18,1-2.9*s.relSContraction);i*=.44*e}else s.dOcc===0&&s.pOcc===0&&s.sOcc===2&&(i*=.72);let a=d.id===`diamond`?.55:.85;me=Math.max(.15,Math.min(9.5,i+a*r))}let W=ne(),G=L.length,he=new Float32Array(W.length*G*G);for(let e=0;e<W.length;e+=1){let t=te(W[e].k,V,s.zv,s.rcBohr,d.id);he.set(t,e*G*G)}let ge=await p(e,{matrices:he,n:G,batchCount:W.length,maxSweeps:28,tolerance:1e-5}),_e=[],ve=[],ye=Math.max(1,Math.ceil(s.zv/2)),be=-1/0,xe=1/0;for(let e=0;e<W.length;e+=1){let t=[];for(let n=0;n<Math.min(8,G);n+=1){let r=ge.eigenvalues[e*G+n]*A;t.push(r),ve.push(r)}_e.push(t);let n=Math.min(t.length-2,ye-1);be=Math.max(be,t[n]),xe=Math.min(xe,t[n+1])}ve.sort((e,t)=>e-t);let Se=ve[Math.min(ve.length-1,Math.floor(W.length*(s.zv/2)))],K=i,Ce=K**3,q=new Float32Array(Ce*2);for(let e=0;e<G;e+=1){let[t,n,r]=L[e],i=(t%K+K)%K,a=(n%K+K)%K,o=((r%K+K)%K*K+a)*K+i,s=ge.eigenvectors[e*G+0],c=ye>1?ge.eigenvectors[e*G+1]:0;q[o*2]+=s,q[o*2+1]+=c}let J=await D(e,{data:q,n:K,inverse:!0}),Y=new Float32Array(Ce),X=1e-12;for(let e=0;e<Ce;e+=1){let t=J.data[e*2],n=J.data[e*2+1],r=t*t+n*n;Y[e]=r,r>X&&(X=r)}for(let e=0;e<Ce;e+=1)Y[e]/=X;let Z=1/(2*Math.max(.08,V/K)),we=0;for(let e=0;e<K;e+=1){let t=(e+K-1)%K,n=(e+1)%K;for(let r=0;r<K;r+=1){let i=(r+K-1)%K,a=(r+1)%K;for(let o=0;o<K;o+=1){let s=(o+K-1)%K,c=(o+1)%K,l=(e*K+r)*K+o,u=Math.max(.025,Y[l]),d=(Y[(e*K+r)*K+c]-Y[(e*K+r)*K+s])*Z,f=(Y[(e*K+a)*K+o]-Y[(e*K+i)*K+o])*Z,p=(Y[(n*K+r)*K+o]-Y[(t*K+r)*K+o])*Z;we+=Math.hypot(d,f,p)/u}}}let Te=we/Math.max(1,Ce),Ee=1.35;if(r?.radialGrid?.r&&r?.radialGrid?.rho){let{r:e,rho:t,dx:n}=r.radialGrid,i=Math.max(.25,s.rcBohr*.35),a=Math.max(i+.5,g.rWsEq),o=0,c=0;for(let r=1;r+1<e.length;r+=1){let s=e[r];if(s<i||s>a)continue;let l=Math.max(1e-8,t[r]),u=Math.abs(t[r+1]-t[r-1])/(2*n*s),d=4*Math.PI*s*s*s*n;o+=Math.min(8,u/l)*d,c+=d}c>1e-6&&(Ee=o/c)}let De=.65*Ee+.35*Te,Oe=Math.max(1.05,Math.min(1.95,-.012+1.023*Math.sqrt(Math.max(.05,De)))),ke=y(t).reduce((e,t)=>e+(t.occUp-t.occDown),0),Ae=s.dOcc>0&&s.dOcc<10,je=s.fOcc>0&&s.fOcc<14,Me=0,Ne=0,Pe=0;if(je){let e=Math.max(.18,Math.min(2,Math.abs(s.fOrbitalEnergyHa??-.45))),t=s.fPrincipalN<=4?1:.68;Me=Math.max(2.6,Math.min(7.4,7.6*e**.35*t));let n=s.fOcc/14;Ne=.5*Me*s.fOcc*(1-n),Pe=ke/7*Me*.32}else if(Ae){let e=Math.max(.14,Math.min(1.5,Math.abs(s.dOrbitalEnergyHa??-.35))),t=3/Math.max(3,s.dPrincipalN||3);Me=Math.max(1,Math.min(6.2,5.4*e**.35*t));let n=s.dOcc/10;Ne=.5*Me*s.dOcc*(1-n),Pe=ke/5*Me*.28}let Fe=.5*Pe,Ie=Object.freeze({up:Object.freeze(_e.map(e=>Object.freeze(e.map(e=>e-Fe)))),down:Object.freeze(_e.map(e=>Object.freeze(e.map(e=>e+Fe))))}),Le=Math.max(0,xe-be),Re=.65+.35*Oe;if(d.id===`vdw-fcc`){let e=F(t);Le=Math.max(Le,Math.min(21.5,s.ionizationPotentialHa*A*(e.isClosedShell?.85:.42)*Math.max(.92,Math.min(1.15,Re))))}else d.id===`diamond`?Le=Math.max(.4,(Le+.35)*Re*(1+1.55/Math.max(1.5,oe*.45))):Le<.25&&(Le=0);let ze=Math.min(...ve)-2,Be=Math.max(...ve)+2,Ve=new Float32Array(48),He=new Float32Array(48),Ue=Math.max(.35,(Be-ze)/36);for(let e=0;e<48;e+=1){let t=ze+e/47*(Be-ze);Ve[e]=t;let n=0;for(let e of ve){let r=(t-e)/Ue;n+=Math.exp(-.5*r*r)}He[e]=2*n/(W.length*Ue*Math.sqrt(2*Math.PI))}let We=0;if(Le===0){let e=Math.max(0,Math.min(47,Math.round((Se-ze)/Math.max(1e-6,Be-ze)*47)));We=Math.max(.15,He[e]+(s.dOcc>0&&s.dOcc<10?.32*Math.sin(Math.PI*s.dOcc/10)*6.5:0))}return Object.freeze({schema:k,backend:`webgpu`,Z:t,symbol:m(t),crystalStructure:d.id,spaceGroup:d.spaceGroup,coordinationNumber:d.coord,latticeConstantA:oe,wignerSeitzRadiusBohr:g.rWsEq,densityKgPerM3:B,cohesiveEnergyEv:me,bulkModulusPa:b,bulkModulusGPa:b*1e-9,shearModulusPa:x,poissonRatio:H,elasticConstantsGPa:Object.freeze({c11:se*1e-9,c12:ce*1e-9,c44:le*1e-9}),soundSpeedLongMPerS:ue,soundSpeedTransMPerS:de,debyeTemperatureK:U,fermiEnergyEv:Se,bandGapEv:Le,isMetal:Le===0,dosAtFermiStatesPerEvAtom:We,mbjCParameter:Oe,mbjAvgGradRhoOverRho:De,dftUHubbardEv:Me,dftUCorrelationEnergyEv:Ne,dftUExchangeSplittingEv:Pe,spinSplitBandsEv:Ie,kPathLabels:W.map(e=>e.label),bandsEv:_e,dosEnergyEv:Ve,dosValues:He,blochDensityGridN:K,blochDensity3d:Y,spinUnpairedElectrons:ke,accuracyTier:t<=100?d.id===`vdw-fcc`||s.fOcc>0?n.TIER_2_REPRESENTATIVE_EFFECTIVE:n.TIER_1_QUANTITATIVE:n.TIER_3_THEORETICAL_ENVELOPE,provenance:Object.freeze({status:`webgpu-derived`,scientificValidation:!1,solver:`gpumath-bloch-pw-fft3d-mbj-dftu-bm3`})})}var ae=`ulg.electromagnetic.closure-webgpu.v1`,B=1602176634e-28,V=91093837015e-41,oe=88541878128e-22,H=125663706212e-17,se=92740100783e-34,ce=1054571817e-43,le=1380649e-29,ue=1602176634e-28,de=27.211386245988;async function fe(e,{Z:t,atomResult:r,bulkResult:i,temperatureK:a=300}={}){let o=_(t),s=y(t),l=o.reduce((e,t)=>Math.max(e,t.n),0),u=o.find(e=>e.n===l&&e.l===2),d=u||o.find(e=>e.n===l-1&&e.l===2),f=o.find(e=>e.n===l-2&&e.l===3),p=u?null:o.find(e=>e.n===l&&e.l===0),m=u?null:o.find(e=>e.n===l&&e.l===1),h=d?.occupancy??0,g=f?.occupancy??0,v=p?.occupancy??0,b=m?.occupancy??0,x=s.reduce((e,t)=>e+(t.occUp-t.occDown),0),C=u?1.2:Math.max(1,v+b+.18*Math.min(h,10-h)),w=4*Math.PI/3*(i.wignerSeitzRadiusBohr*c)**3,T=1/Math.max(1e-32,w),E=i.isMetal?C*T:0,D=ce*(i.isMetal?Math.sqrt(E*B*B/(oe*V)):0)/ue,O=1,k=1,A=i.wignerSeitzRadiusBohr,j=!!(d&&d.n>=l-1&&h>0);if(i.isMetal&&!j){if(b===0&&v>=1&&v<=2&&r?.radialGrid?.r&&r?.radialGrid?.rho){let{r:e,rho:t,dx:n}=r.radialGrid,i=0;for(let r=0;r<e.length;r+=1)i+=4*Math.PI*e[r]**3*t[r]*n;let a=0,o=0,s=0,c=Math.max(0,i-v);for(let r=0;r<e.length;r+=1){let i=4*Math.PI*e[r]**3*t[r]*n;a+=i,a>=c&&(o+=e[r]*i,s+=i)}if(s>.15){let e=o/s*.86;Number.isFinite(e)&&e>A&&(A=Math.min(6,e))}}let e=Array.isArray(r?.orbitals)?r.orbitals.find(e=>e.n===l-1&&e.l===1&&Number(e.occupancy??e.occ??0)>=6):null;if(e){let t=Math.max(.28,Math.abs(Number(e.energyHa??e.energy??-.8))),n=1.35/(t*t)*(Math.max(1,e.n)/2)**1.35,r=Math.max(8,Math.max(2,A||3.5)**3);O=1+Math.min(.85,3*n/r)}if(v<=2&&b===0&&l>=4){let e=Math.max(0,l-3);k=1+.046*e*e*(v===1?1:.45)}}let M=4*Math.PI/3*(A*c)**3,N=i.isMetal?C/Math.max(1e-32,M):0,P=i.isMetal?ce*Math.sqrt(N*B*B/(oe*V))/ue:0,F=i.isMetal?P/Math.sqrt(O*k):0,I=Math.max(0,Number(i.dftUHubbardEv||0)),ee=Number.isFinite(Number(i.mbjCParameter))?Number(i.mbjCParameter):null,L=((l===4&&h>0&&h<10?.92:g>0&&g<14?.58:h>0&&h<10?.55:.25)+.045*Math.min(6,I))*(.5*(i.dosAtFermiStatesPerEvAtom||0)),te=Math.max(.25,i.isMetal?Math.max(.5,t-C):t)*(.55*c)**2;if(r?.radialGrid?.r&&r?.radialGrid?.rho){let{r:e,rho:t,dx:n}=r.radialGrid,a=0;for(let r=0;r<e.length;r+=1)a+=4*Math.PI*e[r]**3*t[r]*n;let o=i.isMetal?Math.max(0,a-C):1/0,s=0,l=0;for(let r=0;r<e.length;r+=1){let i=4*Math.PI*e[r]**3*t[r]*n;if(s>=o)break;let a=s+i>o?Math.max(0,(o-s)/Math.max(1e-12,i)):1;l+=e[r]*e[r]*i*a,s+=i}Number.isFinite(l)&&l>0&&(te=l*c**2)}let ne=-(T*H*B*B*te)/(6*V),re=i.isMetal?H*se*se*(i.dosAtFermiStatesPerEvAtom/ue)*T:0,ie=!i.isMetal&&(i.crystalStructure===`diamond`||i.crystalStructure===`zincblende`)?0:x,R=`diamagnetic`,z=0,fe=0,pe=ne+2/3*re;i.isMetal&&l===4&&h>=6&&h<=8&&L>.85?(R=`ferromagnetic`,z=Math.max(.55,(10-h)*.62-.12),fe=Math.max(350,320*z*L),pe=a>fe?H*T*(z*se)**2/(3*le*Math.max(10,a-fe)):1e3):i.isMetal&&g>=6&&g<=11?(R=`ferromagnetic`,z=x*.95,fe=Math.max(20,42*(x*(x+2))/20),pe=a>fe?H*T*(z*se)**2/(3*le*Math.max(10,a-fe)):500):i.isMetal&&l===4&&(h===4||h===5)?(R=`antiferromagnetic`,z=.6+.35*(h-4),fe=h===5?210:120,pe=H*T*(z*se)**2/(3*le*(a+fe))):ie>0&&!i.isMetal?(R=`paramagnetic`,z=Math.sqrt(ie*(ie+2)),pe=ne+H*T*(z*se)**2/(3*le*Math.max(1,a))):pe>0&&(R=`paramagnetic`);let U=Math.max(30,i.debyeTemperatureK||250),me=i.isMetal?Math.max(.08,Math.min(1.8,.14+.16*(i.dosAtFermiStatesPerEvAtom||.5)*(300/U))):0,W=0;if(i.isMetal){let e=a/U,t=e>=.4?1:(e/.4)**4,n=Math.max(1e11,2*Math.PI*me*le*a/ce*t);W=E*B*B/(V*n)}else{let e=i.bandGapEv*ue,t=2*(V*le*a/(2*Math.PI*ce*ce))**1.5*Math.exp(-e/(2*le*Math.max(1,a))),n=.05*(300/Math.max(10,a))**1.5;W=Math.max(1e-18,t*B*n)}let G=1/Math.max(1e-20,W),he=Array.isArray(r?.orbitals)?r.orbitals.filter(e=>Number(e.occupancy??1)>0):[],ge=he.length?Math.max(...he.map(e=>Number(e.energyHa??e.energy??-.35))):-.35,_e=Math.max(1.8,Math.min(6.5,-ge*de*.52+.65)),ve=i.isMetal?1/0:1+((F||10.5)/Math.max(.5,i.bandGapEv*1.4))**2,ye=.12,be=v+b,xe=i.dosAtFermiStatesPerEvAtom||.5,Se=h>0&&h<10?.31*xe*(450/U)**.35:0,K=be>=2?.18*(be-.85)*(350/Math.max(80,U))**.5*(1+.28*xe):0,Ce=i.isMetal?Math.max(me,Math.min(1.65,.08+Se+K)):0,q=0;if(i.isMetal&&R!==`ferromagnetic`&&R!==`antiferromagnetic`&&Ce>ye*1.45){let e=-(1.04*(1+Ce))/Math.max(.05,Ce-ye*(1+.62*Ce));q=Math.max(0,U/1.45*Math.exp(e))}let J=[`s`,`p`,`d`,`f`,`g`],Y=[];if(i.isMetal&&Array.isArray(r?.orbitals)&&r.orbitals.length>0){let e=Math.max(1e-9,E)*c**3,t=Math.cbrt(3*Math.PI*Math.PI*e),n=Math.sqrt(4*t/Math.PI),a=.5*de*n*n,o=r.orbitals.filter(e=>Number(e.occupancy??e.occ??0)>0),s=r.orbitals.filter(e=>Number(e.occupancy??e.occ??0)<2*(2*e.l+1));for(let e of o){if(e.l<2)continue;let t=2*(2*e.l+1),n=Number(e.occupancy??e.occ??0),r=Number.isFinite(e.energyJPlusHa),o=r?e.energyJPlusHa:Number(e.energyHa??e.energy??-.5);for(let c of s){if(c.n===e.n&&c.l===e.l||Math.abs(c.l-e.l)!==1)continue;let s=Number(c.energyHa??c.energy??-.05);if(!(s>o))continue;let l=Math.max(0,Math.min(1.6,.16*Number(i.fermiEnergyEv||0))),u=(s-o)*de+l;if(!(u>.2&&u<9.5))continue;let d=2*(2*c.l+1),f=Number(c.occupancy??c.occ??0),p=Math.min(1,Math.max(0,n/t)),m=Math.min(1,Math.max(0,1-f/d)),h=c.l>e.l?(e.l+1)/(2*e.l+1):e.l/(2*e.l+1),g=p*m*h*(e.l===2?1.85:.75);if(!(g>0))continue;let _=Math.max(.22,.1*u+.032*a*Math.sqrt(g)),v=r?`(${2*e.l+1}/2)`:``,y=`${e.n}${J[e.l]||e.l}${v}→${c.n}${J[c.l]||c.l}`;Y.push(Object.freeze({energyEv:u,dampingEv:_,strengthWeight:g,transitionLabel:y}))}}Y.sort((e,t)=>e.energyEv-t.energyEv||t.strengthWeight-e.strengthWeight),Y.splice(4)}let X=i.isMetal?Math.max(.08,Math.min(2.6,ce*(E*B*B)/Math.max(1e-20,V*W)/ue+(h>0&&h<10?.55:0))):.25,Z=null;e&&typeof e.createBuffer==`function`&&(Z=(await S(e,[i.isMetal?{mode:0,atomicNumberZ:t,conductionElectronDensityPerM3:Math.max(1e27,E),plasmaEnergyEv:Math.max(1,F),dampingEv:X,interbandOscillators:Y,pathLengthM:.1}:{mode:2,atomicNumberZ:t,electronicGapEv:Math.max(.2,i.bandGapEv),pathLengthM:.1}]))?.results?.[0]??null);let we=Z?.spectralSamples?.find(e=>Math.abs(e.wavelengthNm-550)<=6)||Z?.spectralSamples?.[Math.floor((Z?.spectralSamples?.length||1)/2)]||null,Te=Array.isArray(Z?.baseColorSrgb)&&Z.baseColorSrgb.length===3?Z.baseColorSrgb.map(e=>Math.max(0,Math.min(1,Number(e)||0))):i.isMetal?[.7,.72,.76]:[.85,.9,.96],Ee=Number.isFinite(we?.nRe)&&we.nRe>0?we.nRe:i.isMetal?1.5:Math.sqrt(Math.max(1,ve)),De=Number.isFinite(we?.reflectance)?we.reflectance:Number.isFinite(Z?.reflectance)?Z.reflectance:i.isMetal?.72:.04;return Object.freeze({schema:ae,backend:Z?`webgpu`:`analytical-em`,Z:t,temperatureK:a,isMetal:i.isMetal,bandGapEv:i.bandGapEv,plasmaEnergyEv:F,barePlasmaEnergyEv:D,coreDielectricInf:O,drudeDampingEv:X,interbandOscillators:Object.freeze(Y),workFunctionEv:_e,electronPhononLambda:me,electricalConductivitySPerM:W,electricalResistivityOhmM:G,staticDielectricConstant:ve,magneticPhase:R,stonerProduct:L,dftUHubbardEv:I,mbjCParameter:ee,magneticMomentMuB:z,curieOrNeelTempK:fe,magneticSusceptibilitySi:pe,superconductingTcK:q,opticalSrgb:Te,refractiveIndex550Nm:Ee,reflectance550Nm:De,spectralWavelengthsNm:Z?.spectralSamples?.map(e=>e.wavelengthNm)??null,spectralReflectance:Z?.spectralSamples?.map(e=>e.reflectance??0)??null,spectralNRe:Z?.spectralSamples?.map(e=>e.nRe??1)??null,spectralAbsorptionPerM:Z?.spectralSamples?.map(e=>e.absorptionPerM??0)??null,accuracyTier:n.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:Z?Z.resolverStatus||`webgpu-derived`:`reduced-estimate`,oscillatorSource:Z?.oscillatorSource??`none`,scientificValidation:!1,model:`stoner-bloch-gruneisen-kubo-drude-mcmillan`})})}var pe=`ulg.thermodynamic.element-md-webgpu.v1`,U=1380649e-29,me=602214076e15,W=1602176634e-28,G=8.314462618,he=2.44300455e-8;function ge(e,t,n){let r=Math.max(.5,Number(e)),i=Math.max(1,Number(t)),a=i/r,o=0,s=a/32;for(let e=0;e<32;e+=1){let t=(e+.5)*s;if(t>60)continue;let n=Math.exp(t);o+=t*t*t*t*n/((n-1)*(n-1))*s}return 9*U*(r/i)**3*o/Math.max(1e-30,n)}function _e({Z:e,bulkResult:t}){let n=t.crystalStructure,r=Math.max(2,t.latticeConstantA),i=Math.max(.005,t.cohesiveEnergyEv),a=t.coordinationNumber||12,o=n===`bcc`?r*Math.sqrt(3)/2:n===`diamond`?r*Math.sqrt(3)/4:r/Math.SQRT2;if(n===`vdw-fcc`){let e=o/2**(1/6),t=Math.max(5e-4,i/8.61);return Object.freeze({potentialModel:C.LENNARD_JONES,modelName:`shifted-force-lj-london`,epsilonEv:t,sigmaOrR0A:e,alphaOrLambda:0,rcutA:Math.min(r*1.45,e*2.5),eamAEv:0,eamBeta:0,swGamma:0,rNearestNeighborA:o})}if(n===`diamond`){let e=o/1.1225,t=Math.max(.2,i/2);return Object.freeze({potentialModel:C.STILLINGER_WEBER,modelName:`stillinger-weber-sp3`,epsilonEv:t,sigmaOrR0A:e,alphaOrLambda:21,rcutA:Math.min(r*1.35,e*1.8),eamAEv:0,eamBeta:0,swGamma:1.2,rNearestNeighborA:o})}let s=(t.bulkModulusPa||5e10)/160217663400,c=r**3/(n===`bcc`?2:4),l=.55*i/(.5*a),u=.45*i/Math.sqrt(a),d=_(Math.max(1,Math.min(118,Math.trunc(Number(e)||1)))),f=d.reduce((e,t)=>Math.max(e,t.n),1),p=d.find(e=>e.n===f-2&&e.l===3)?.occupancy??0,m=p>0&&p<14?f>=7?.78:.88:1,h=Math.sqrt(Math.max(.08,9*s*c/Math.max(1e-4,2*a*l*o*o))),g=Math.max(.85,Math.min(2.25,h*m)),v=Math.min(r*1.45,o*1.85),y=g*1.05,b=(n===`bcc`?[[8,1],[6,2/Math.sqrt(3)],[12,Math.sqrt(8/3)],[24,Math.sqrt(11/3)]]:n===`hcp`?[[12,1],[6,Math.SQRT2],[2,Math.sqrt(8/3)],[18,Math.sqrt(3)]]:[[12,1],[6,Math.SQRT2],[24,Math.sqrt(3)]]).map(([e,t])=>({count:e,r:o*t})).filter(e=>e.r<v-1e-4),x=e=>{let t=0;for(let n of b){let r=1-n.r/v;t+=n.count*Math.exp(-y*(n.r-e))*r*r}let n=-u/(2*Math.sqrt(Math.max(t,1e-8))),r=0;for(let t of b){let i=1-t.r/v,a=i*i,o=Math.exp(-g*(t.r-e)),s=l*(o*o-2*o),c=2*l*g*(o-o*o)*a-s*(2*i/v),u=Math.exp(-y*(t.r-e))*(-y*a-2*i/v),d=-c-2*n*u;r+=t.count*t.r*d}return r},S=o+.01/g,w=o+1.8/g;for(;x(w)<0&&w<o+4/g;)w+=.6/g;for(let e=0;e<24;e+=1){let e=.5*(S+w);x(e)<0?S=e:w=e}let T=.5*(S+w);return Object.freeze({potentialModel:C.MORSE_EAM,modelName:`morse-finnis-sinclair-eam`,epsilonEv:l,sigmaOrR0A:T,alphaOrLambda:g,rcutA:v,eamAEv:u,eamBeta:y,swGamma:0,rNearestNeighborA:o,fShellSoftness:m})}async function ve(e,{Z:t,atomicMassU:r=null,bulkResult:i,emResult:a,temperatureK:o=300,runLiveMd:s=!0,mdSteps:c=20,mdCellsPerSide:u=3}={}){let d=Number(r),p=Number.isFinite(d)&&d>0?d:l[t-1]||f(t)/16605390666e-37,m=p*16605390666e-37,h=p*.001,g=_e({Z:t,bulkResult:i}),_=Math.max(15,i.debyeTemperatureK),v=i.cohesiveEnergyEv*W,y=g.rNearestNeighborA*1e-10,b=m*(U*_/1054571817e-43)**2*(.095*y)**2/(9*U),x=i.crystalStructure===`vdw-fcc`?.68*g.epsilonEv*W/U:.029*v/U,S=Math.min(.35*x,.085*_),C=i.crystalStructure===`vdw-fcc`?Math.max(1.5,x-S):Math.max(1.5,.55*x+.45*Math.min(x*1.8,b)-.15*S),E=Math.max(1,Math.min(4200,C)),D=Math.max(50,v*me*(i.crystalStructure===`vdw-fcc`?.92:.88)),O=i.crystalStructure===`vdw-fcc`?88:104,k=Math.max(E*1.15+2,D/O),A=G*1.15*E/h,j=D/h,M=ge(o,_,m)+(a?.isMetal?Math.PI*Math.PI/3*U*U*((i.dosAtFermiStatesPerEvAtom||.5)/W)/m:0)*o,N=i.crystalStructure===`diamond`?.85:1.75,P=N*M*i.densityKgPerM3/Math.max(1e6,i.bulkModulusPa),F=M+o*i.bulkModulusPa*P*P/Math.max(1,i.densityKgPerM3),I=null;if(s&&e&&typeof e.createBuffer==`function`){let t=Math.max(10,Math.min(o,.65*E)),n=w(e,{...T({crystalStructure:i.crystalStructure,cellsPerSide:u,latticeConstantA:Math.max(2.2,i.latticeConstantA),massU:p,temperatureK:t}),potentialModel:g.potentialModel,epsilonEv:g.epsilonEv,sigmaOrR0A:g.sigmaOrR0A,alphaOrLambda:g.alphaOrLambda,rcutA:g.rcutA,eamAEv:g.eamAEv,eamBeta:g.eamBeta,swGamma:g.swGamma,dtFs:Math.min(2,Math.max(.4,.08*Math.sqrt(p))),targetTemperatureK:t,thermostatCouplingFs:40});try{I=await n.stepBatch(c,{readTelemetry:!0,temperatureK:t})}finally{n.destroy()}}let ee=E;if(I&&Number.isFinite(I.temperatureK)&&I.temperatureK>0){let e=Math.max(0,Number(I.msdA2)||0),t=Math.max(1.2,g.rNearestNeighborA),n=Math.sqrt(e)/t;if(n>1e-4&&n<.45){let e=I.temperatureK*(.1/Math.max(.015,n))**2,t=Math.max(.85,Math.min(1.15,e/Math.max(1,E)));ee=Math.max(1,Math.min(4200,E*(.85+.15*t)))}}let L=ee,te=Math.max(L*1.15+2,k),ne=i.densityKgPerM3*(i.crystalStructure===`diamond`?1.05:.92),re=Math.max(o,E*1.05),ie=Math.max(1e-5,18e-8*Math.sqrt(p*E)/(h/Math.max(1,ne)*1e6)**(2/3)*Math.exp(2.6*(E/re-1))),R=Math.max(18e-11,g.rNearestNeighborA*92e-12),z=5/(16*Math.sqrt(Math.PI))*Math.sqrt(m*U*Math.max(o,k))/(R*R),ae=(m/Math.max(1,ne))**(2/3),B=Math.max(.001,.16*v/Math.max(1e-21,ae)),V=a?.isMetal?he*(a.electricalConductivitySPerM||0)*o:0,oe=Math.max(.02,31e-9*p*Math.cbrt(m/Math.max(1,i.densityKgPerM3))*1e10*_**3/Math.max(1,N*N*o)),H=Math.min(2500,V+Math.min(400,oe)),se=1/ne-1/i.densityKgPerM3,ce=Math.max(-60,Math.min(180,E*se/Math.max(1e3,A)*101325*Math.LN10)),le=Math.max(5,Math.min(900,G*k*k*Math.LN10/Math.max(1e3,D)));return Object.freeze({schema:pe,backend:I?`webgpu-md+qha`:`qha-analytical`,Z:t,temperatureK:o,potential:g,heatCapacityCvJPerKgK:M,heatCapacityCpJPerKgK:F,thermalExpansionVolPerK:P,meltingPointK:L,boilingPointK:te,latentHeatFusionJPerKg:A,latentHeatVaporizationJPerKg:j,meltingSlopeKPerLogP:ce,boilingSlopeKPerLogP:le,liquidDensityKgPerM3:ne,dynamicViscosityLiquidPaS:ie,dynamicViscosityGasPaS:z,surfaceTensionNPerM:B,thermalConductivityWPerMK:H,kElectronicWPerMK:V,kPhononWPerMK:Math.min(400,oe),mdTelemetry:I,accuracyTier:t<=100?n.TIER_2_REPRESENTATIVE_EFFECTIVE:n.TIER_3_THEORETICAL_ENVELOPE,provenance:Object.freeze({status:I?`webgpu-derived`:`reduced-estimate`,scientificValidation:!1,model:`dft-fitted-md-qha-wiedemann-franz-andrade`})})}var ye=`ulg-periodic-table-engine-webgpu.v1`,be=Object.freeze({1:{symbol:`H`,bPerAMeV:0,rhoKgM3:88,meltingK:14.01,boilingK:20.28,mag:`diamagnetic`},2:{symbol:`He`,bPerAMeV:7.074,rhoKgM3:145,meltingK:.95,boilingK:4.22,mag:`diamagnetic`},6:{symbol:`C`,bPerAMeV:7.68,rhoKgM3:3515,meltingK:3823,boilingK:4300,mag:`diamagnetic`},10:{symbol:`Ne`,bPerAMeV:8.032,rhoKgM3:1444,meltingK:24.56,boilingK:27.07,mag:`diamagnetic`},11:{symbol:`Na`,bPerAMeV:8.111,rhoKgM3:968,meltingK:370.9,boilingK:1156,mag:`paramagnetic`},13:{symbol:`Al`,bPerAMeV:8.332,rhoKgM3:2700,meltingK:933.5,boilingK:2792,mag:`paramagnetic`},14:{symbol:`Si`,bPerAMeV:8.448,rhoKgM3:2329,meltingK:1687,boilingK:3538,mag:`diamagnetic`},18:{symbol:`Ar`,bPerAMeV:8.595,rhoKgM3:1623,meltingK:83.8,boilingK:87.3,mag:`diamagnetic`},26:{symbol:`Fe`,bPerAMeV:8.79,rhoKgM3:7874,meltingK:1811,boilingK:3134,mag:`ferromagnetic`},29:{symbol:`Cu`,bPerAMeV:8.752,rhoKgM3:8960,meltingK:1358,boilingK:2835,mag:`diamagnetic`},47:{symbol:`Ag`,bPerAMeV:8.554,rhoKgM3:10490,meltingK:1235,boilingK:2435,mag:`diamagnetic`},79:{symbol:`Au`,bPerAMeV:8,rhoKgM3:19300,meltingK:1337,boilingK:3129,mag:`diamagnetic`},80:{symbol:`Hg`,bPerAMeV:7.921,rhoKgM3:13534,meltingK:234.3,boilingK:629.9,mag:`diamagnetic`},82:{symbol:`Pb`,bPerAMeV:7.867,rhoKgM3:11340,meltingK:600.6,boilingK:2022,mag:`diamagnetic`},92:{symbol:`U`,bPerAMeV:7.57,rhoKgM3:19050,meltingK:1405,boilingK:4404,mag:`paramagnetic`}});function xe(e,t){let n=be[e]||null;if(!n)return Object.freeze({g7Advisory:!0,hasReference:!1,note:e>100?`Superheavy element: no experimental bulk properties exist (tier-3 theoretical prediction).`:`No checked-in G7 snapshot benchmark row for this Z.`});let r=(e,t)=>t>0?Math.abs(e-t)/t:Math.abs(e-t);return Object.freeze({g7Advisory:!0,hasReference:!0,bindingPerNucleonRelErr:r(t.nuclear.bindingPerNucleonMeV,n.bPerAMeV),densityRelErr:r(t.mechanical.densityKgPerM3,n.rhoKgM3),meltingRelErr:r(t.thermodynamic.meltingPointK,n.meltingK),boilingRelErr:r(t.thermodynamic.boilingPointK,n.boilingK),magneticPhaseMatch:t.electromagnetic.magneticPhase===n.mag,reference:n})}async function Se(t,r,{massNumberA:i=null,temperatureK:a=300,runNuclearGpuVolume:o=!0,runLiveMd:s=!0,mdSteps:c=16,mdCellsPerSide:l=3,atomicMaxScf:f=55,atomicGridPointsN:p=256,nuclearVolDim:h=24,blochGridN:g=16,functional:v=`pbe`,scalarRelativistic:S=!0,spinOrbit:C=!0,returnOrbitalWavefunctions:w=!1}={}){let T=Math.trunc(Number(r));if(!(T>=1&&T<=118))throw RangeError(`Element atomicNumberZ out of range 1..118: ${r}`);let E=m(T),D=o?await d(t,T,i,{volDim:h}):b(T,i),k=_(T),A=k.map(e=>({...e})),j=(e,t)=>{let n=Math.max(e,t+1);for(;A.some(e=>e.n===n&&e.l===t);)n+=1;A.push({n,l:t,occupancy:0})};for(let e of k)e.occupancy>0&&e.l>=2&&(e.l-1>=0&&j(e.n+1,e.l-1),e.l+1<=4&&j(e.n+1,e.l+1));A.sort((e,t)=>e.n+e.l-(t.n+t.l)||e.n-t.n||e.l-t.l);let M=await O(t,T,{functional:v,spinOrbit:C,scalarRelativistic:S,configuration:A,nuclearChargeRadiusBohr:D.chargeRadiusBohr,nuclearMassU:D.atomicMassU,nuclearSpinI:D.spinI,nuclearMagneticMomentMuN:D.magneticMomentMuN,gridPointsN:p,rMinBohr:Math.min(1e-4,Math.max(1e-5,D.chargeRadiusBohr*.5)),maxScf:f,returnRadialDensity:!0,returnOrbitalWavefunctions:w}),N=await z(t,T,M,{densityGridN:g,atomicMassU:D.atomicMassU}),P=await fe(t,{Z:T,atomResult:M,bulkResult:N,temperatureK:a}),F=await ve(t,{Z:T,atomicMassU:D.atomicMassU,bulkResult:N,emResult:P,temperatureK:a,runLiveMd:s,mdSteps:c,mdCellsPerSide:l}),I=T>100?n.TIER_3_THEORETICAL_ENVELOPE:N.accuracyTier===n.TIER_1_QUANTITATIVE?n.TIER_1_QUANTITATIVE:n.TIER_2_REPRESENTATIVE_EFFECTIVE,ee=e({materialKey:i==null?E:D.isotope,symbol:E,atomicNumber:T,massNumberA:D.A,isotope:D.isotope,family:`element`,accuracyTier:I,generatorFingerprint:ye,nuclear:{isotope:D.isotope,Z:D.Z,N:D.N,A:D.A,bindingEnergyMeV:D.bindingEnergyMeV,bindingPerNucleonMeV:D.bindingPerNucleonMeV,atomicMassU:D.atomicMassU,massExcessMeV:D.massExcessMeV,chargeRadiusFm:D.chargeRadiusFm,chargeRadiusBohr:D.chargeRadiusBohr,spinI:D.spinI,parity:D.parity,shellLabel:D.shellLabel,magneticMomentMuN:D.magneticMomentMuN,fissility:D.fissility,fissionBarrierMeV:D.fissionBarrierMeV,qAlphaMeV:D.qAlphaMeV,qBetaMinusMeV:D.qBetaMinusMeV,qElectronCaptureMeV:D.qElectronCaptureMeV,dominantMode:D.dominantMode,daughterZ:D.daughterZ,daughterA:D.daughterA,log10HalfLifeS:D.log10HalfLifeS},atomic:{configurationString:x(T),configuration:_(T),spinConfiguration:y(T),unpairedElectrons:u(T),totalEnergyHa:M.totalEnergyHa,qedRadiativeShiftHa:M.qedRadiativeShiftHa??0,reducedMassFactor:M.reducedMassFactor??1,isotopeMassShiftHa:M.isotopeMassShiftHa??0,hyperfineSplittingHz:M.hyperfineSplittingHz??0,finiteNucleusUsed:!!M.finiteNucleusUsed,dirac4Component:!!M.dirac4Component,totalSmallComponentNormSq:M.totalSmallComponentNormSq??0,relativisticMethod:M.relativisticMethod,resolverStatus:M.resolverStatus,perScfCpuReadbacks:M.perScfCpuReadbacks,integratedElectrons:M.integratedElectrons,orbitals:M.orbitals},electromagnetic:{isMetal:P.isMetal,bandGapEv:P.bandGapEv,mbjCParameter:N.mbjCParameter??P.mbjCParameter??null,dftUHubbardEv:N.dftUHubbardEv??P.dftUHubbardEv??0,dftUExchangeSplittingEv:N.dftUExchangeSplittingEv??0,fermiEnergyEv:N.fermiEnergyEv,dosAtFermiStatesPerEvAtom:N.dosAtFermiStatesPerEvAtom,plasmaEnergyEv:P.plasmaEnergyEv,drudeDampingEv:P.drudeDampingEv,interbandOscillators:P.interbandOscillators,workFunctionEv:P.workFunctionEv,electricalConductivitySPerM:P.electricalConductivitySPerM,electricalResistivityOhmM:P.electricalResistivityOhmM,staticDielectricConstant:P.staticDielectricConstant,magneticPhase:P.magneticPhase,stonerProduct:P.stonerProduct,magneticMomentMuB:P.magneticMomentMuB,curieOrNeelTempK:P.curieOrNeelTempK,magneticSusceptibilitySi:P.magneticSusceptibilitySi,superconductingTcK:P.superconductingTcK,opticalSrgb:P.opticalSrgb,refractiveIndex550Nm:P.refractiveIndex550Nm,reflectance550Nm:P.reflectance550Nm,spectralWavelengthsNm:P.spectralWavelengthsNm,spectralReflectance:P.spectralReflectance,spectralNRe:P.spectralNRe,oscillatorSource:P.provenance?.oscillatorSource??`none`},mechanical:{crystalStructure:N.crystalStructure,spaceGroup:N.spaceGroup,coordinationNumber:N.coordinationNumber,latticeConstantA:N.latticeConstantA,densityKgPerM3:N.densityKgPerM3,cohesiveEnergyEv:N.cohesiveEnergyEv,bulkModulusPa:N.bulkModulusPa,shearModulusPa:N.shearModulusPa,poissonRatio:N.poissonRatio,elasticConstantsGPa:N.elasticConstantsGPa,soundSpeedLongMPerS:N.soundSpeedLongMPerS,soundSpeedTransMPerS:N.soundSpeedTransMPerS,debyeTemperatureK:N.debyeTemperatureK},thermodynamic:{temperatureK:a,heatCapacityCvJPerKgK:F.heatCapacityCvJPerKgK,heatCapacityCpJPerKgK:F.heatCapacityCpJPerKgK,thermalExpansionVolPerK:F.thermalExpansionVolPerK,meltingPointK:F.meltingPointK,boilingPointK:F.boilingPointK,latentHeatFusionJPerKg:F.latentHeatFusionJPerKg,latentHeatVaporizationJPerKg:F.latentHeatVaporizationJPerKg,meltingSlopeKPerLogP:F.meltingSlopeKPerLogP,boilingSlopeKPerLogP:F.boilingSlopeKPerLogP,liquidDensityKgPerM3:F.liquidDensityKgPerM3,dynamicViscosityLiquidPaS:F.dynamicViscosityLiquidPaS,dynamicViscosityGasPaS:F.dynamicViscosityGasPaS,surfaceTensionNPerM:F.surfaceTensionNPerM,thermalConductivityWPerMK:F.thermalConductivityWPerMK,potentialModel:F.potential.modelName,mdEnergyEv:F.mdTelemetry?.totalEnergyEv??null,mdTempK:F.mdTelemetry?.temperatureK??null,mdPressureGPa:F.mdTelemetry?.pressureGPa??null,mdMsdA2:F.mdTelemetry?.msdA2??null},provenance:{status:P.provenance?.status===`hybrid-webgpu-spectral-cpu-oscillators`?`hybrid-webgpu-spectral-cpu-oscillators`:`webgpu-derived`,scientificValidation:!1,extrapolationPolicy:`fail-closed`}}),L=xe(T,ee);return Object.freeze({bundle:ee,g7Advisory:L,visualData:Object.freeze({nuclear:D,atom:M,bulk:N,em:P,thermo:F})})}var K=`ulg.electronic.orbital-cloud-webgpu.v1`,Ce=1/137.035999084,q=512,J=256,Y=Object.freeze({COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128});function X(e){let t=1;for(let n=2;n<=e;n+=1)t*=n;return t}function Z(e,t){return t<0||t>e?0:X(e)/(X(t)*X(e-t))}function we(e,t,n){let r=0,i=1;for(let a=0;a<=e;a+=1){let o=a&1?-1:1;r+=o*Z(e+t,e-a)/X(a)*i,i*=n}return r}function Te(e,t,n){let r=Math.max(-1,Math.min(1,n)),i=1;if(t>0){let e=Math.sqrt(Math.max(0,(1-r)*(1+r))),n=1;for(let r=1;r<=t;r+=1)i*=-n*e,n+=2}if(e===t)return i;let a=r*(2*t+1)*i;if(e===t+1)return a;let o=0;for(let n=t+2;n<=e;n+=1)o=((2*n-1)*r*a-(n+t-1)*i)/(n-t),i=a,a=o;return o}function Ee(e,t,n,r){if(!r)return e;let i=0;for(let e=1;e<t;e+=1)i+=2*e*e;let a=Math.max(0,Math.min(2*t*t,e-i)),o=t>1?i-2*(t-1)*(t-1):0,s=t>1?Math.max(0,Math.min(2*(t-1)*(t-1),e-o-a)):0,c=Math.max(0,a-1),l=Math.max(0,e-a-s),u=n<=1?.85:1,d=n>0?.02*((2*n+1)/Math.max(1,t)):0;return Math.max(1,Math.min(e,e-(.35*c+u*s+l)+d))}function De(e,t,n,r){if(!r)return e;let i=(Ce*e)**2,a=n<=1?1+i*.36/(Math.max(1,t)*(n+1)):Math.max(.75,1-i*.18/Math.max(1,t));return Math.max(.8,e*a)}function Oe({Z:e=26,n:t=3,l:n=2,m:r=0,rGrid:i=null,orbitalU:a=null,screeningExchange:o=!0,relativisticSpinOrbit:s=!0}={}){let c=Math.max(1,Math.min(8,Math.trunc(t))),l=Math.max(0,Math.min(c-1,Math.trunc(n))),u=Math.max(-l,Math.min(l,Math.trunc(r))),d=Math.abs(u),f=new Float32Array(q),p=new Float32Array(q),m=new Float32Array(q),h=new Float32Array(q),g=(Array.isArray(i)||ArrayBuffer.isView(i))&&i.length>=32,_=(Array.isArray(a)||ArrayBuffer.isView(a))&&a.length===i?.length,v=g&&_,y=6,b=`analytic-laguerre-slater`;if(v){b=`webgpu-kohn-sham-eigenstate`;let e=new Float64Array(i.length),t=0;for(let n=0;n<i.length;n+=1){let r=n===0?i[1]-i[0]:n===i.length-1?i[n]-i[n-1]:.5*(i[n+1]-i[n-1]),o=a[n],s=o*o*Math.max(1e-8,r);e[n]=s,t+=s}let n=0;y=Math.max(1.5,i[i.length-1]*.5);for(let r=0;r<i.length;r+=1)if(n+=e[r],n>=t*.994){y=Math.max(.8,Math.min(36,i[r]*1.15));break}let r=0,o=0,s=0,c=0;for(let e=0;e<q;e+=1){let t=(e+.5)/q*y;for(f[e]=t;c+1<i.length&&i[c+1]<t;)c+=1;let n=Math.min(i.length-2,c),l=i[n],u=Math.max(l+1e-9,i[n+1]),d=Math.max(0,Math.min(1,(t-l)/(u-l))),g=a[n]*(1-d)+a[n+1]*d,_=g>=0?1:-1;s!==0&&_!==s&&Math.abs(g)>1e-6&&(o+=1),Math.abs(g)>1e-6&&(s=_),r+=g*g,p[e]=r,m[e]=o,h[e]=_}let l=r>0?1/r:1;for(let e=0;e<q;e+=1)p[e]*=l}else{let t=De(Ee(e,c,l,o),c,l,s),n=(3*c*c-l*(l+1))/(2*Math.max(.5,t));y=Math.max(1.2,Math.min(42,n*2.55+1.4/Math.sqrt(Math.max(1,t))));let r=Math.sqrt((2*t/c)**3*(X(c-l-1)/(2*c*X(c+l)))),i=0,a=0,u=0;for(let e=0;e<q;e+=1){let n=(e+.5)/q*y;f[e]=n;let o=2*t*n/c,s=we(c-l-1,2*l+1,o),d=n*(r*Math.exp(-.5*o)*o**+l*s),g=d>=0?1:-1;u!==0&&g!==u&&Math.abs(d)>1e-8&&(a+=1),Math.abs(d)>1e-8&&(u=g),i+=d*d,p[e]=i,m[e]=a,h[e]=g}let d=i>0?1/i:1;for(let e=0;e<q;e+=1)p[e]*=d}let x=(Ce*Ee(e,c,l,o))**2,S=s&&l>0?Math.min(.45,x*.65):0,C=Math.min(l,Math.abs(d===l?Math.max(0,d-1):d+1)),w=new Float32Array(J),T=new Float32Array(J),E=0,D=1;if(S>0){let e=0,t=0;for(let n=0;n<J;n+=1){let r=-1+(n+.5)/J*2,i=Te(l,d,r),a=Te(l,C,r);e+=i*i,t+=a*a}D=t>1e-12?e/t:1}for(let e=0;e<J;e+=1){let t=-1+(e+.5)/J*2,n=Te(l,d,t),r=n*n;if(S>0){let e=Te(l,C,t);r=(1-S)*r+S*(e*e*D)}E+=r,w[e]=E,T[e]=n>=0?1:-1}let O=E>0?1/E:1;for(let e=0;e<J;e+=1)w[e]*=O;let k=new Float32Array(q*4);for(let e=0;e<q;e+=1)k[e*4+0]=f[e]/Math.max(1e-6,y),k[e*4+1]=p[e],k[e*4+2]=m[e],k[e*4+3]=h[e];let A=new Float32Array(J*2);for(let e=0;e<J;e+=1)A[e*2+0]=w[e],A[e*2+1]=T[e];return Object.freeze({radialPacked:k,polarPacked:A,rExtentBohr:y,n:c,l,m:u,radialNodeCount:Math.max(0,Math.round(m[q-1])),sourceKind:b})}var ke=`
struct OrbitalSampleParams {
  point_count: u32,
  radial_bins: u32,
  polar_bins: u32,
  seed: u32,
  m_signed: i32,
  m_abs: u32,
  color_mode: u32, // 0 = alternating radial shells (MoonLab), 1 = signed wavefunction phase (+psi / -psi)
  pad0: u32,
};

@group(0) @binding(0) var<uniform> p: OrbitalSampleParams;
// radial_table[i] = vec4(r_norm, cdf, shell_idx, radial_sign)
@group(0) @binding(1) var<storage, read> radial_table: array<vec4<f32>>;
// polar_table[i] = vec2(cdf, polar_sign)
@group(0) @binding(2) var<storage, read> polar_table: array<vec2<f32>>;
// Output points: vec4(x_norm, y_norm, z_norm, packed_meta)
//   packed_meta: sign bit encodes shell/phase color parity (+1 = Color A, -1 = Color B),
//                abs(packed_meta) in (0.1..1.0) encodes radial brightness falloff!
@group(0) @binding(3) var<storage, read_write> points_out: array<vec4<f32>>;

const TWO_PI: f32 = 6.283185307179586;

fn pcg_next(state: ptr<function, u32>) -> u32 {
  let old = *state;
  *state = old * 747796405u + 2891336453u;
  let word = ((old >> ((old >> 28u) + 4u)) ^ old) * 277803737u;
  return (word >> 22u) ^ word;
}

fn rand01(state: ptr<function, u32>) -> f32 {
  return f32(pcg_next(state) & 0x00ffffffu) * (1.0 / 16777216.0);
}

@compute @workgroup_size(64)
fn sample_orbital_cloud(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= p.point_count) { return; }

  var rng = ((idx + 1u) * 1664525u) ^ (p.seed * 22695477u + 1013904223u);
  let _w = pcg_next(&rng);

  // 1. Exact continuous radial inverse-CDF sampling (binary search in 512 bins)
  let u_r = rand01(&rng);
  var lo = 0u;
  var hi = p.radial_bins - 1u;
  for (var iter = 0u; iter < 10u; iter = iter + 1u) {
    let mid = (lo + hi) >> 1u;
    if (radial_table[mid].y < u_r) { lo = mid + 1u; } else { hi = mid; }
  }
  let r_idx = min(lo, p.radial_bins - 1u);
  let r_prev = select(0.0, radial_table[r_idx - 1u].x, r_idx > 0u);
  let r_curr = radial_table[r_idx].x;
  let c_prev = select(0.0, radial_table[r_idx - 1u].y, r_idx > 0u);
  let c_curr = radial_table[r_idx].y;
  let frac_r = clamp((u_r - c_prev) / max(1e-7, c_curr - c_prev), 0.0, 1.0);
  let r_norm = mix(r_prev, r_curr, frac_r);
  let shell_idx = u32(max(0.0, floor(radial_table[r_idx].z + 0.5)));
  let rad_sign = radial_table[r_idx].w;

  // 2. Exact continuous polar inverse-CDF sampling (binary search in 256 bins)
  let u_th = rand01(&rng);
  var plo = 0u;
  var phi_hi = p.polar_bins - 1u;
  for (var iter = 0u; iter < 9u; iter = iter + 1u) {
    let mid = (plo + phi_hi) >> 1u;
    if (polar_table[mid].x < u_th) { plo = mid + 1u; } else { phi_hi = mid; }
  }
  let p_idx = min(plo, p.polar_bins - 1u);
  let pc_prev = select(0.0, polar_table[p_idx - 1u].x, p_idx > 0u);
  let pc_curr = polar_table[p_idx].x;
  let frac_p = clamp((u_th - pc_prev) / max(1e-7, pc_curr - pc_prev), 0.0, 1.0);
  let mu_bin = (f32(p_idx) + frac_p) / f32(p.polar_bins);
  let cos_theta = clamp(-1.0 + 2.0 * mu_bin, -1.0, 1.0);
  let sin_theta = sqrt(max(0.0, 1.0 - cos_theta * cos_theta));
  let pol_sign = polar_table[p_idx].y;

  // 3. Exact azimuthal rejection sampling for cos^2(m phi) or sin^2(m phi)
  var phi = rand01(&rng) * TWO_PI;
  var az_sign = 1.0;
  if (p.m_abs > 0u) {
    let mf = f32(p.m_abs);
    for (var attempt = 0u; attempt < 16u; attempt = attempt + 1u) {
      let cand = rand01(&rng) * TWO_PI;
      let trig = select(sin(mf * cand), cos(mf * cand), p.m_signed > 0);
      if (rand01(&rng) <= trig * trig) {
        phi = cand;
        az_sign = select(-1.0, 1.0, trig >= 0.0);
        break;
      }
    }
  }

  // Standard physics spherical -> 3D viewport (Y-up = polar z-axis for crisp vertical d_z2/p_z lobes!)
  let x = r_norm * sin_theta * cos(phi);
  let y = r_norm * cos_theta;
  let z = r_norm * sin_theta * sin(phi);

  let shade = clamp(0.95 - 0.42 * r_norm, 0.25, 1.0);
  var parity = 1.0;
  if (p.color_mode == 0u) {
    parity = select(-1.0, 1.0, (shell_idx & 1u) == 0u);
  } else {
    let psi_sign = rad_sign * pol_sign * az_sign;
    parity = select(-1.0, 1.0, psi_sign >= 0.0);
  }
  points_out[idx] = vec4<f32>(x, y, z, parity * shade);
}
`,Ae=`
struct MolCloudParams {
  point_count: u32,
  atom_count: u32,
  mode: u32, // 0 = Total electron density, 1 = HOMO signed orbital, 2 = LUMO signed orbital
  seed: u32,
  box_half_bohr: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
};

@group(0) @binding(0) var<uniform> p: MolCloudParams;
@group(0) @binding(1) var<storage, read> atoms_pos_zeta: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> atoms_weights: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> points_out: array<vec4<f32>>;

fn pcg_next(state: ptr<function, u32>) -> u32 {
  let old = *state;
  *state = old * 747796405u + 2891336453u;
  let word = ((old >> ((old >> 28u) + 4u)) ^ old) * 277803737u;
  return (word >> 22u) ^ word;
}

fn rand01(state: ptr<function, u32>) -> f32 {
  return f32(pcg_next(state) & 0x00ffffffu) * (1.0 / 16777216.0);
}

fn eval_mol_field(pos: vec3<f32>) -> vec2<f32> {
  var rho_tot = 0.0;
  var psi_orb = 0.0;
  for (var a = 0u; a < p.atom_count; a = a + 1u) {
    let az = atoms_pos_zeta[a];
    let aw = atoms_weights[a];
    let r = length(pos - az.xyz);
    let phi = exp(-az.w * r);
    rho_tot = rho_tot + aw.x * phi * phi;
    let c = select(aw.z, aw.y, p.mode == 1u);
    psi_orb = psi_orb + c * phi;
  }
  if (p.mode == 0u) {
    return vec2<f32>(rho_tot, select(-1.0, 1.0, psi_orb >= 0.0));
  }
  return vec2<f32>(psi_orb * psi_orb, select(-1.0, 1.0, psi_orb >= 0.0));
}

@compute @workgroup_size(64)
fn sample_molecular_cloud(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= p.point_count || p.atom_count == 0u) { return; }

  var rng = ((idx + 1u) * 747796405u) ^ (p.seed * 2891336453u + 1234567u);
  let _w = pcg_next(&rng);

  // Seed around a randomly chosen nucleus with exponential radial draw + Metropolis refinement
  let a0 = pcg_next(&rng) % p.atom_count;
  let az0 = atoms_pos_zeta[a0];
  let inv_z = 1.0 / max(0.55, az0.w);

  // Draw initial point near atom center
  let r_init = -log(max(1e-5, rand01(&rng))) * inv_z * 1.15;
  let cz = -1.0 + 2.0 * rand01(&rng);
  let sz = sqrt(max(0.0, 1.0 - cz * cz));
  let ph = rand01(&rng) * 6.2831853;
  var pos = az0.xyz + vec3<f32>(sz * cos(ph), cz, sz * sin(ph)) * r_init;
  var cur = eval_mol_field(pos);

  let step_s = max(0.35, p.box_half_bohr * 0.24);
  for (var mstep = 0u; mstep < 14u; mstep = mstep + 1u) {
    let cand = pos + vec3<f32>(rand01(&rng) - 0.5, rand01(&rng) - 0.5, rand01(&rng) - 0.5) * (2.0 * step_s);
    let ev = eval_mol_field(cand);
    let ratio = ev.x / max(1e-10, cur.x);
    if (ratio >= 1.0 || rand01(&rng) < ratio) {
      pos = cand;
      cur = ev;
    }
  }

  let p_norm = clamp(pos / max(0.5, p.box_half_bohr), vec3<f32>(-1.0), vec3<f32>(1.0));
  let shade = clamp(0.95 - 0.35 * length(p_norm), 0.32, 1.0);
  points_out[idx] = vec4<f32>(p_norm, cur.y * shade);
}
`,je=new WeakMap;function Me(e){let t=je.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-orbital-cloud-sampler`,code:ke}),r=e.createComputePipeline({label:`ulg-orbital-cloud-sampler-pipe`,layout:`auto`,compute:{module:n,entryPoint:`sample_orbital_cloud`}}),i=e.createShaderModule({label:`ulg-mol-cloud-sampler`,code:Ae});return t={atomPipe:r,molPipe:e.createComputePipeline({label:`ulg-mol-cloud-sampler-pipe`,layout:`auto`,compute:{module:i,entryPoint:`sample_molecular_cloud`}}),atomParamsBuf:e.createBuffer({size:32,usage:Y.UNIFORM|Y.COPY_DST}),radialTableBuf:e.createBuffer({size:q*16,usage:Y.STORAGE|Y.COPY_DST}),polarTableBuf:e.createBuffer({size:J*8,usage:Y.STORAGE|Y.COPY_DST}),molParamsBuf:e.createBuffer({size:32,usage:Y.UNIFORM|Y.COPY_DST}),molAzBuf:null,molAzSize:0,molWBuf:null,molWSize:0},je.set(e,t),t}function Ne(e,{Z:t=26,n=3,l:r=2,m:i=0,pointCount:a=25e4,rGrid:o=null,orbitalU:s=null,screeningExchange:c=!0,relativisticSpinOrbit:l=!0,colorMode:u=0,seed:d=1,reuseBuffer:f=null}={}){let p=Math.max(4096,Math.min(5e5,Math.trunc(a))),m=Oe({Z:t,n,l:r,m:i,rGrid:o,orbitalU:s,screeningExchange:c,relativisticSpinOrbit:l}),{atomPipe:h,atomParamsBuf:g,radialTableBuf:_,polarTableBuf:v}=Me(e),y=p*16,b=f&&f.size>=y?f:e.createBuffer({label:`ulg-orbital-cloud-pts`,size:y,usage:Y.STORAGE|Y.VERTEX|Y.COPY_SRC}),x=new ArrayBuffer(32),S=new Uint32Array(x),C=new Int32Array(x);S[0]=p>>>0,S[1]=q>>>0,S[2]=J>>>0,S[3]=d>>>0||1,C[4]=m.m,S[5]=Math.abs(m.m)>>>0,S[6]=u>>>0,S[7]=0,e.queue.writeBuffer(g,0,x),e.queue.writeBuffer(_,0,m.radialPacked),e.queue.writeBuffer(v,0,m.polarPacked);let w=e.createBindGroup({layout:h.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:g}},{binding:1,resource:{buffer:_}},{binding:2,resource:{buffer:v}},{binding:3,resource:{buffer:b}}]}),T=e.createCommandEncoder({label:`ulg-orbital-cloud-sample-enc`}),E=T.beginComputePass();return E.setPipeline(h),E.setBindGroup(0,w),E.dispatchWorkgroups(Math.ceil(p/64)),E.end(),e.queue.submit([T.finish()]),Object.freeze({schema:K,pointsBuffer:b,pointCount:p,rExtentBohr:m.rExtentBohr,n:m.n,l:m.l,m:m.m,radialNodeCount:m.radialNodeCount,sourceKind:m.sourceKind})}function Pe(e,{posZeta:t,weights:n,boxHalfBohr:r=4,mode:i=0,pointCount:a=16e4,seed:o=1,reuseBuffer:s=null}={}){if(!t||!n||t.length<4)return null;let c=Math.floor(t.length/4),l=Math.max(4096,Math.min(35e4,Math.trunc(a))),u=Me(e),{molPipe:d,molParamsBuf:f}=u,p=l*16,m=s&&s.size>=p?s:e.createBuffer({label:`ulg-mol-cloud-pts`,size:p,usage:Y.STORAGE|Y.VERTEX|Y.COPY_SRC}),h=Math.max(16,t.byteLength),g=Math.max(16,n.byteLength);(!u.molAzBuf||u.molAzSize<h)&&(u.molAzBuf=e.createBuffer({size:Math.max(256,h),usage:Y.STORAGE|Y.COPY_DST}),u.molAzSize=Math.max(256,h)),(!u.molWBuf||u.molWSize<g)&&(u.molWBuf=e.createBuffer({size:Math.max(256,g),usage:Y.STORAGE|Y.COPY_DST}),u.molWSize=Math.max(256,g));let _=new ArrayBuffer(32);new Uint32Array(_,0,4).set([l>>>0,c>>>0,i>>>0,o>>>0||1]),new Float32Array(_,16,4).set([Math.max(1,Number(r)||4),0,0,0]),e.queue.writeBuffer(f,0,_),e.queue.writeBuffer(u.molAzBuf,0,t),e.queue.writeBuffer(u.molWBuf,0,n);let v=e.createBindGroup({layout:d.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:f}},{binding:1,resource:{buffer:u.molAzBuf}},{binding:2,resource:{buffer:u.molWBuf}},{binding:3,resource:{buffer:m}}]}),y=e.createCommandEncoder({label:`ulg-mol-cloud-sample-enc`}),b=y.beginComputePass();return b.setPipeline(d),b.setBindGroup(0,v),b.dispatchWorkgroups(Math.ceil(l/64)),b.end(),e.queue.submit([y.finish()]),Object.freeze({schema:K,pointsBuffer:m,pointCount:l,boxHalfBohr:Math.max(1,Number(r)||4),mode:i,sourceKind:`webgpu-molecular-rhf`})}function Fe(e){return!e||typeof e.registerModule!=`function`?null:{orbitalCloudMod:e.registerModule({method:{model:`quantum-orbital-cloud`,version:`1`},kernel:{sourceModule:`src/runtime/electronicStructure/orbitalPointCloudWebGpu.js`,entryPoint:`sample_orbital_cloud`,workgroupSize:64,wgsl:ke},parameterSchema:{Z:{type:`number`,min:1,max:118,required:!0},n:{type:`number`,min:1,max:8,required:!0},l:{type:`number`,min:0,max:7,required:!0},m:{type:`number`,min:-7,max:7},pointCount:{type:`number`,min:4096,max:5e5}},stateLayout:{tensorId:`orbital_points_vec4`,dtype:`f32`,components:4},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`quantum-orbital-cloud@1 requires a WebGPU device`);let r=Ne(n,e?.parameters||{});return{status:`ok`,pointCount:r.pointCount,rExtentBohr:r.rExtentBohr,radialNodeCount:r.radialNodeCount,sourceKind:r.sourceKind,pointsBuffer:r.pointsBuffer}}}),tdksPhotonMod:e.registerModule({method:{model:`quantum-tdks-photon`,version:`1`},kernel:{sourceModule:`src/runtime/electronicStructure/orbitalPointCloudWebGpu.js`,entryPoint:`sample_dipole_coupled_pair`,workgroupSize:64,wgsl:Ie},parameterSchema:{Z:{type:`number`,min:1,max:118,required:!0},pointCount:{type:`number`,min:4096,max:3e5}},stateLayout:{tensorId:`tdks_dipole_pair_cloud`,dtype:`f32`,components:8},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`quantum-tdks-photon@1 requires a WebGPU device`);let r=Be(n,e?.parameters||{});return{status:`ok`,pointCount:r.pointCount,rExtentBohr:r.rExtentBohr}}})}}var Ie=`
struct DipolePairParams {
  point_count: u32,
  radial_bins: u32,
  polar_bins: u32,
  seed: u32,
  m_abs: u32,
  m_signed: i32,
  pad0: u32,
  pad1: u32,
};

@group(0) @binding(0) var<uniform> p: DipolePairParams;
// joint_radial[i] = vec4(r_norm, joint_cdf, R0_norm, R1_norm)
@group(0) @binding(1) var<storage, read> joint_radial: array<vec4<f32>>;
// joint_polar[i]  = vec4(joint_cdf, Y0_norm, Y1_norm, cos_theta)
@group(0) @binding(2) var<storage, read> joint_polar: array<vec4<f32>>;
// Output pos_out[i] = vec4(x_norm, y_norm, z_norm, r_norm)
@group(0) @binding(3) var<storage, read_write> pos_out: array<vec4<f32>>;
// Output amp_out[i] = vec4(phi0_tilde, phi1_tilde, y_dipole, shell_parity)
@group(0) @binding(4) var<storage, read_write> amp_out: array<vec4<f32>>;

const TWO_PI: f32 = 6.283185307179586;

fn pcg_next(state: ptr<function, u32>) -> u32 {
  let old = *state;
  *state = old * 747796405u + 2891336453u;
  let word = ((old >> ((old >> 28u) + 4u)) ^ old) * 277803737u;
  return (word >> 22u) ^ word;
}

fn rand01(state: ptr<function, u32>) -> f32 {
  return f32(pcg_next(state) & 0x00ffffffu) * (1.0 / 16777216.0);
}

@compute @workgroup_size(64)
fn sample_dipole_coupled_pair(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= p.point_count) { return; }

  var rng = ((idx + 1u) * 2654435761u) ^ (p.seed * 2246822519u + 3266489917u);
  let _w = pcg_next(&rng);

  // 1. Sample radius r continuously from joint radial envelope 0.5*(|u0|^2 + |u1|^2)
  let u_r = rand01(&rng);
  var rlo = 0u;
  var rhi = p.radial_bins - 1u;
  for (var it = 0u; it < 10u; it = it + 1u) {
    let mid = (rlo + rhi) >> 1u;
    if (joint_radial[mid].y < u_r) { rlo = mid + 1u; } else { rhi = mid; }
  }
  let ri = min(rlo, p.radial_bins - 1u);
  let rp = select(vec4<f32>(0.0, 0.0, 0.0, 0.0), joint_radial[ri - 1u], ri > 0u);
  let rc = joint_radial[ri];
  let fr = clamp((u_r - rp.y) / max(1e-7, rc.y - rp.y), 0.0, 1.0);
  let r_norm = mix(rp.x, rc.x, fr);
  let r0_amp = mix(rp.z, rc.z, fr);
  let r1_amp = mix(rp.w, rc.w, fr);

  // 2. Sample polar angle cos(theta) continuously from joint polar envelope 0.5*(|Y0|^2 + |Y1|^2)
  let u_p = rand01(&rng);
  var plo = 0u;
  var phi_hi = p.polar_bins - 1u;
  for (var it = 0u; it < 9u; it = it + 1u) {
    let mid = (plo + phi_hi) >> 1u;
    if (joint_polar[mid].x < u_p) { plo = mid + 1u; } else { phi_hi = mid; }
  }
  let pi_idx = min(plo, p.polar_bins - 1u);
  let pp = select(vec4<f32>(0.0, joint_polar[0].y, joint_polar[0].z, -1.0), joint_polar[pi_idx - 1u], pi_idx > 0u);
  let pc = joint_polar[pi_idx];
  let fp = clamp((u_p - pp.x) / max(1e-7, pc.x - pp.x), 0.0, 1.0);
  let cos_th = clamp(mix(pp.w, pc.w, fp), -1.0, 1.0);
  let sin_th = sqrt(max(0.0, 1.0 - cos_th * cos_th));
  let y0_amp = mix(pp.y, pc.y, fp);
  let y1_amp = mix(pp.z, pc.z, fp);

  // 3. Azimuthal angle phi (same m for Delta m = 0 linear E_y dipole transition!)
  var phi = rand01(&rng) * TWO_PI;
  var az = 1.0;
  if (p.m_abs > 0u) {
    let mf = f32(p.m_abs);
    for (var attempt = 0u; attempt < 16u; attempt = attempt + 1u) {
      let cand = rand01(&rng) * TWO_PI;
      let trig = select(sin(mf * cand), cos(mf * cand), p.m_signed > 0);
      if (rand01(&rng) <= trig * trig) {
        phi = cand;
        az = trig;
        break;
      }
    }
  }

  // Exact importance-normalized amplitudes phi0_tilde, phi1_tilde with |phi0|^2 + |phi1|^2 = 2
  let raw0 = r0_amp * y0_amp * az;
  let raw1 = r1_amp * y1_amp * az;
  let inv_env = 1.0 / sqrt(max(1e-8, 0.5 * (raw0 * raw0 + raw1 * raw1)));
  let phi0_t = clamp(raw0 * inv_env, -1.4142, 1.4142);
  let phi1_t = clamp(raw1 * inv_env, -1.4142, 1.4142);

  // Y-axis = electric field polarization axis E_y (so dipole interference sloshes vertically!)
  let x = r_norm * sin_th * cos(phi);
  let y = r_norm * cos_th;
  let z = r_norm * sin_th * sin(phi);
  let parity = select(-1.0, 1.0, r0_amp >= 0.0);

  pos_out[idx] = vec4<f32>(x, y, z, r_norm);
  amp_out[idx] = vec4<f32>(phi0_t, phi1_t, y, parity);
}
`,Le=new WeakMap;function Re(e){let t=Le.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-dipole-pair-sampler`,code:Ie});return t={pipe:e.createComputePipeline({label:`ulg-dipole-pair-sampler-pipe`,layout:`auto`,compute:{module:n,entryPoint:`sample_dipole_coupled_pair`}}),paramsBuf:e.createBuffer({size:32,usage:Y.UNIFORM|Y.COPY_DST}),radBuf:e.createBuffer({size:q*16,usage:Y.STORAGE|Y.COPY_DST}),polBuf:e.createBuffer({size:J*16,usage:Y.STORAGE|Y.COPY_DST})},Le.set(e,t),t}function ze(e,t,n,r,i,a,o,s){let c=new Float32Array(a.length);if((Array.isArray(r)||ArrayBuffer.isView(r))&&r.length>=32&&(Array.isArray(i)||ArrayBuffer.isView(i))&&i.length===r.length){let e=0;for(let t=0;t<a.length;t+=1){let n=a[t];for(;e+1<r.length&&r[e+1]<n;)e+=1;let o=Math.min(r.length-2,e),s=r[o],l=Math.max(s+1e-9,r[o+1]),u=Math.max(0,Math.min(1,(n-s)/(l-s)));c[t]=i[o]*(1-u)+i[o+1]*u}}else{let r=De(Ee(e,t,n,o),t,n,s),i=Math.sqrt((2*r/t)**3*(X(t-n-1)/(2*t*X(t+n))));for(let e=0;e<a.length;e+=1){let o=a[e],s=2*r*o/t,l=we(t-n-1,2*n+1,s);c[e]=o*i*Math.exp(-.5*s)*s**+n*l}}let l=0;for(let e=0;e<c.length;e+=1)l+=c[e]*c[e];let u=1/Math.sqrt(Math.max(1e-12,l));for(let e=0;e<c.length;e+=1)c[e]*=u;return c}function Be(e,{Z:t=79,n0:n=5,l0:r=2,n1:i=6,l1:a=1,m:o=0,rGrid:s=null,u0:c=null,u1:l=null,pointCount:u=18e4,screeningExchange:d=!0,relativisticSpinOrbit:f=!0,seed:p=1,reusePosBuffer:m=null,reuseAmpBuffer:h=null}={}){let g=Math.max(8192,Math.min(3e5,Math.trunc(u))),_=Math.max(1,Math.min(8,Math.trunc(n))),v=Math.max(0,Math.min(_-1,Math.trunc(r))),y=Math.max(1,Math.min(8,Math.trunc(i))),b=Math.max(0,Math.min(y-1,Math.trunc(a))),x=Math.max(-Math.min(v,b),Math.min(Math.min(v,b),Math.trunc(o))),S=Math.abs(x),C=Oe({Z:t,n:_,l:v,m:x,rGrid:s,orbitalU:c,screeningExchange:d,relativisticSpinOrbit:f}),w=Oe({Z:t,n:y,l:b,m:x,rGrid:s,orbitalU:l,screeningExchange:d,relativisticSpinOrbit:f}),T=Math.max(C.rExtentBohr,Math.min(C.rExtentBohr*1.45,w.rExtentBohr)),E=new Float32Array(q);for(let e=0;e<q;e+=1)E[e]=(e+.5)/q*T;let D=ze(t,_,v,s,c,E,d,f),O=ze(t,y,b,s,l,E,d,f),k=new Float32Array(q*4),A=0;for(let e=0;e<q;e+=1)A+=.5*(D[e]*D[e]+O[e]*O[e]),k[e*4+0]=E[e]/T,k[e*4+1]=A,k[e*4+2]=D[e],k[e*4+3]=O[e];let j=A>0?1/A:1;for(let e=0;e<q;e+=1)k[e*4+1]*=j;let M=new Float32Array(J),N=new Float32Array(J),P=0,F=0;for(let e=0;e<J;e+=1){let t=-1+(e+.5)/J*2;M[e]=Te(v,S,t),N[e]=Te(b,S,t),P+=M[e]*M[e],F+=N[e]*N[e]}let I=1/Math.sqrt(Math.max(1e-12,P/J)),ee=1/Math.sqrt(Math.max(1e-12,F/J)),L=new Float32Array(J*4),te=0;for(let e=0;e<J;e+=1){let t=-1+(e+.5)/J*2,n=M[e]*I,r=N[e]*ee;te+=.5*(n*n+r*r),L[e*4+0]=te,L[e*4+1]=n,L[e*4+2]=r,L[e*4+3]=t}let ne=te>0?1/te:1;for(let e=0;e<J;e+=1)L[e*4+0]*=ne;let{pipe:re,paramsBuf:ie,radBuf:R,polBuf:z}=Re(e),ae=g*16,B=m&&m.size>=ae?m:e.createBuffer({label:`ulg-tdks-pair-pos`,size:ae,usage:Y.STORAGE|Y.VERTEX}),V=h&&h.size>=ae?h:e.createBuffer({label:`ulg-tdks-pair-amp`,size:ae,usage:Y.STORAGE}),oe=new ArrayBuffer(32),H=new Uint32Array(oe),se=new Int32Array(oe);H[0]=g>>>0,H[1]=q>>>0,H[2]=J>>>0,H[3]=p>>>0||1,H[4]=S>>>0,se[5]=x,H[6]=0,H[7]=0,e.queue.writeBuffer(ie,0,oe),e.queue.writeBuffer(R,0,k),e.queue.writeBuffer(z,0,L);let ce=e.createBindGroup({layout:re.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:ie}},{binding:1,resource:{buffer:R}},{binding:2,resource:{buffer:z}},{binding:3,resource:{buffer:B}},{binding:4,resource:{buffer:V}}]}),le=e.createCommandEncoder({label:`ulg-tdks-pair-sample`}),ue=le.beginComputePass();return ue.setPipeline(re),ue.setBindGroup(0,ce),ue.dispatchWorkgroups(Math.ceil(g/64)),ue.end(),e.queue.submit([le.finish()]),Object.freeze({posBuffer:B,ampBuffer:V,pointCount:g,rExtentBohr:T,n0:_,l0:v,n1:y,l1:b,m:x,groundSource:C.sourceKind,excitedSource:w.sourceKind})}function Ve(e={},{probeWavelengthNm:t=440}={}){let n=1239.841984,r=.6582119569,i=!!e?.isMetal,a=Array.isArray(e?.interbandOscillators)?e.interbandOscillators:[],o=5,s=.45,c=`Valence→Cond`;if(i&&a.length>0){let e=a.find(e=>e.energyEv>=2.2&&e.energyEv<=4.2)||a[0];o=Math.max(.6,Number(e.energyEv)||3),s=Math.max(.22,Number(e.dampingEv)||.55),c=e.transitionLabel||`d→p`}else if(i){let t=Math.max(1.2,Math.min(8.5,Number(e?.plasmaEnergyEv)||4.5));o=t,s=Math.max(.22,Math.min(1.1,(Number(e?.drudeDampingEv)||.25)*1.4)),c=`Plasma/Valence (${t.toFixed(2)} eV)`}else{let t=Math.max(.5,Number(e?.bandGapEv)||5.5);o=Math.max(2.6,t+1.4),s=t<3.4?.4:.14,c=`Valence→Cond (${o.toFixed(1)} eV)`}let l=o/r,u=s/r,d=u*.42,f=1.65,p=[610,535,440,Math.max(380,Math.min(780,Number(t)||440))].map(e=>({wavelengthNm:e,photonEv:n/e,omega:n/e/r,rho01Re:0,rho01Im:0,rho11:0,dipole:0,dipolePrev:0,dipoleAccel:0,absorbedEnergy:0,incidentEnergy:0,eNow:0,radHistory:new Float32Array(128)})),m=0,h=0,g=4.2,_=2.4;function v(e,t){let n=t-g;return Math.exp(n/_*-.5*(n/_))*Math.cos(e.omega*n)}function y(e=null){if(m=0,h=0,e!=null){let t=Math.max(380,Math.min(780,Number(e)||440));p[3].wavelengthNm=t,p[3].photonEv=n/t,p[3].omega=p[3].photonEv/r}for(let e of p)e.rho01Re=0,e.rho01Im=0,e.rho11=0,e.dipole=0,e.dipolePrev=0,e.dipoleAccel=0,e.absorbedEnergy=0,e.incidentEnergy=0,e.eNow=0,e.radHistory.fill(0)}function b(e=.08){let t=e/12;for(let e=0;e<12;e+=1){let n=m+e*t;for(let e of p){let r=f*v(e,n),i=(e,t,n,r)=>{let i=2*n-1;return[-l*t-.5*u*e,l*e-.5*u*t+r*i,-d*n-2*r*t]},[a,o,s]=i(e.rho01Re,e.rho01Im,e.rho11,r),c=f*v(e,n+.5*t),[p,m,h]=i(e.rho01Re+.5*t*a,e.rho01Im+.5*t*o,e.rho11+.5*t*s,c),[g,_,y]=i(e.rho01Re+.5*t*p,e.rho01Im+.5*t*m,e.rho11+.5*t*h,c),b=v(e,n+t),x=f*b,[S,C,w]=i(e.rho01Re+t*g,e.rho01Im+t*_,e.rho11+t*y,x),T=2*e.rho01Re;e.rho01Re+=t/6*(a+2*p+2*g+S),e.rho01Im+=t/6*(o+2*m+2*_+C),e.rho11=Math.max(0,Math.min(.98,e.rho11+t/6*(s+2*h+2*y+w)));let E=2*e.rho01Re,D=(E-T)/t;e.dipoleAccel=(E-2*e.dipole+e.dipolePrev)/Math.max(1e-6,t*t),e.dipolePrev=e.dipole,e.dipole=E,e.eNow=b,e.absorbedEnergy+=Math.max(0,b*D*t),e.incidentEnergy+=b*b*t}}m+=e,h=(h+1)%128;for(let e of p)e.radHistory[h]=Math.max(-2.5,Math.min(2.5,-e.dipoleAccel*.045));m>13.5&&y()}return Object.freeze({transEv:o,gammaEv:s,transLabel:c,historyLen:128,channels:p,getTimeFs:()=>m,getHistCursor:()=>h,pulseT0Fs:g,pulseWidthFs:_,reset:y,stepFs:b})}var He=27.211386245988,Ue=.529177210903,We=51.4220674763;function Ge({atomResult:e=null,eFieldVPerA:t=0}={}){let n=Number(t)||0,r=n/We,i=4,a=24,o=Math.max(1,Number(e?.electronCount)||1);if(e?.radialGrid?.r&&e?.radialGrid?.rho){let{r:t,rho:n,dx:r}=e.radialGrid,s=0,c=0,l=0;for(let e=0;e<t.length;e+=1){let i=4*Math.PI*t[e]**3*n[e]*r;s+=i,c+=i*t[e]**2,l+=i*t[e]**4}s>.1&&(o=s,i=c/s,a=l/s)}let s=Array.isArray(e?.orbitals)?e.orbitals.filter(e=>Number(e.occupancy??1)>0):[],c=s.length?Math.max(...s.map(e=>Number(e.energyHa??e.energy??-.35))):-.35,l=Math.max(.12,-c),u=Math.max(1,Math.sqrt(Math.max(1,a))*.85),d=Math.max(.8,Math.min(450,.55*(4/9*o*i*i)+.45*(2*u/(3*l)))),f=d*Ue**3,p=d*r,m=p*2.541746473,h=-.5*d*r*r*He,g=Math.max(-.65,Math.min(.65,p/Math.max(1.2,Math.sqrt(u)*3)));return Object.freeze({eFieldVPerA:n,eFieldAu:r,alpha0Bohr3:d,alpha0Angstrom3:f,inducedDipoleAu:p,inducedDipoleDebye:m,starkShiftEv:h,starkMixLambda:g,homoBindingEv:l*He})}async function Ke(e,{Z:t,solveAtomFullWebGpu:n,baseConfiguration:r,baseAtomResult:i,functional:a=`pbe`,scalarRelativistic:o=!0,spinOrbit:s=!0,nuclearChargeRadiusBohr:c=null,nuclearMassU:l=null}={}){if(!e||typeof n!=`function`)throw TypeError(`solveDeltaScfIonizationWebGpu requires GPUDevice and solveAtomFullWebGpu.`);let u=(r||[]).map(e=>({...e})),d=-1,f=-1;for(let e=0;e<u.length;e+=1)if((u[e].occupancy||0)>0){let t=u[e].n*10+u[e].l;t>=f&&(f=t,d=e)}if(d<0)return null;let p=u[d],m=`${p.n}${[`s`,`p`,`d`,`f`,`g`][p.l]||p.l}`;u[d].occupancy=Math.max(0,u[d].occupancy-1);let h=await n(e,t,{functional:a,scalarRelativistic:o,spinOrbit:s,configuration:u,nuclearChargeRadiusBohr:c,nuclearMassU:l,maxScf:50,gridPointsN:Math.max(64,Math.min(512,Number(i?.radialGrid?.r?.length)||512)),returnRadialDensity:!0,returnOrbitalWavefunctions:!0}),g=Number(h.totalEnergyHa)-Number(i?.totalEnergyHa??0),_=(i?.orbitals||[]).find(e=>e.n===p.n&&e.l===p.l),v=(h?.orbitals||[]).find(e=>e.n===p.n&&e.l===p.l),y=Number(_?.energyHa??_?.energy),b=Number(v?.energyHa??v?.energy),x=Number.isFinite(y)&&Number.isFinite(b)?-.5*(y+b)*He:g*He,S=Math.max(1.5,x);return Object.freeze({Z:t,chargeState:1,removedShell:m,neutralEnergyHa:Number(i?.totalEnergyHa??0),cationEnergyHa:Number(h.totalEnergyHa),rawDeltaScfEv:g*He,neutralOrbitalEv:Number.isFinite(y)?y*He:null,cationOrbitalEv:Number.isFinite(b)?b*He:null,ionizationEnergyEv:S,cationAtom:h})}var qe=`ulg.optics.photon-shell-fdtd-2d-webgpu.v1`,Je=`ulg.nuclear.tunneling-tdse-webgpu.v1`,Ye=16384,Xe=2e-8,Ze=.5,Qe=Ze*Xe/299792458,$e=6582119569e-25,et=1239.841984,tt=.36,Q=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128});function nt(e={},{probeWavelengthNm:t=535}={}){let n=!!e?.isMetal,r=n?Math.max(.5,Math.min(24,Number(e?.plasmaEnergyEv)||8)):0,i=n?Math.max(.05,Math.min(4,Number(e?.drudeDampingEv)||Math.max(.15,r/25))):0,a=[];if(n){let t=Array.isArray(e?.interbandOscillators)?e.interbandOscillators:[],n=r*r;for(let e=0;e<Math.min(4,t.length);e+=1){let r=t[e],i=Math.max(.25,Math.min(18,Number(r.energyEv)||3)),o=Math.max(.12,Math.min(6,Number(r.dampingEv)||.45)),s=Math.max(0,Math.min(8,Number(r.strengthWeight)||0)),c=tt*n*s/(i*i);a.push({energyEv:i,dampingEv:o,deltaEps:Math.min(25,c),label:r.transitionLabel||`Interband #${e+1}`})}}else{let t=Math.max(.25,Math.min(18,Number(e?.bandGapEv)||5)),n=Number(e?.refractiveIndex550Nm),r=Number.isFinite(n)&&n>=1.005?Math.min(3.8,n):Math.min(3.8,Math.sqrt(1+(13.6/(t+3.47))**2)),i=et/550,o=Math.max(i*1.48,t+1.65),s=Math.max(.02,r*r-1)*(1-i*i/(o*o));if(a.push({energyEv:o,dampingEv:t<3.4?.42:.06,deltaEps:Math.min(16,Math.max(.02,s)),label:`Valence→Cond UV (${o.toFixed(1)} eV)`}),t<3.35){let e=Math.max(.6,t+.35);a.push({energyEv:e,dampingEv:Math.max(.25,.22*t),deltaEps:Math.min(4,Math.max(.15,(3.4-t)*.6)),label:`Band-Edge (${e.toFixed(2)} eV)`})}}for(;a.length<4;)a.push({energyEv:10,dampingEv:1,deltaEps:0,label:`inactive`});let o=Qe/$e,s=r*o,c=i*o,l=n?(1-.5*c)/(1+.5*c):0,u=n?s*s/(1+.5*c):0,d=a.map(e=>{let t=e.energyEv*o,n=1.35/Math.sqrt(1+Math.max(0,e.deltaEps)),r=Math.min(t,n),i=e.dampingEv*o,a=1+.5*i;return{a:(1-.5*i)/a,b:r*r/a,c:e.deltaEps,active:+(e.deltaEps>1e-6),...e}}),f=[610,535,440,Math.max(380,Math.min(780,Number(t)||535))],p=f.map(e=>et/e*o);return Object.freeze({isMetal:n,plasmaEv:r,drudeGammaEv:i,kDrude:l,betaDrude:u,oscillators:Object.freeze(d),wavelengthsNm:Object.freeze(f),omegaDtChannels:Object.freeze(p),expectedIor550:Number(e?.refractiveIndex550Nm)||1,slabX0:64,slabX1:104,incidenceDeg:24})}function rt(e){let t=Math.max(0,Math.min(1,Number(e)||0));return t<=.0031308?12.92*t:1.055*t**(1/2.4)-.055}function it(e,t){let n=et/Math.max(200,t),r=1,i=0;if(e.isMetal&&e.plasmaEv>0){let t=e.plasmaEv*e.plasmaEv,a=n*n,o=n*e.drudeGammaEv,s=Math.max(1e-30,a*a+o*o);r-=t*a/s,i+=t*o/s}for(let t of e.oscillators){if(!(t.deltaEps>1e-6))continue;let e=t.deltaEps*t.energyEv*t.energyEv,a=t.energyEv*t.energyEv-n*n,o=-t.dampingEv*n,s=Math.max(1e-30,a*a+o*o);r+=e*a/s,i-=e*o/s}let a=Math.hypot(r,i),o=Math.sqrt(Math.max(0,.5*(a+r))),s=Math.sqrt(Math.max(0,.5*(a-r))),c=(o-1)*(o-1)+s*s,l=Math.max(1e-30,(o+1)*(o+1)+s*s);return{nRe:o,kIm:s,reflectance:Math.max(0,Math.min(1,c/l))}}var at=`
struct Fdtd2dParams {
  nx: u32,
  ny: u32,
  n_channels: u32,
  step_index: u32,

  slab_x0: u32,
  slab_x1: u32,
  src_x: u32,
  sensor_x: u32,

  tr_sensor_x: u32,
  src_y_center: u32,
  pml_width: u32,
  pad0: u32,

  courant: f32,
  k_drude: f32,
  beta_drude: f32,
  pulse_t0: f32,

  pulse_width: f32,
  sin_theta: f32,
  cos_theta: f32,
  beam_waist: f32,

  omega_dt: vec4<f32>,
  osc_a: vec4<f32>,
  osc_b: vec4<f32>,
  osc_c: vec4<f32>,
};

@group(0) @binding(0) var<uniform> p: Fdtd2dParams;
@group(0) @binding(1) var<storage, read_write> ez_field: array<f32>;
@group(0) @binding(2) var<storage, read_write> hx_field: array<f32>;
@group(0) @binding(3) var<storage, read_write> hy_field: array<f32>;
@group(0) @binding(4) var<storage, read_write> j_drude: array<f32>;
@group(0) @binding(5) var<storage, read_write> p_curr: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> p_prev: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> shell_state: array<vec4<f32>>; // (P_tot, J_D, abs_inst, Ez)
@group(0) @binding(8) var<storage, read_write> obs_accum: array<vec4<f32>>;

fn boundary_damp(x: u32, y: u32) -> f32 {
  let w = f32(p.pml_width);
  let dx_l = max(0.0, w - f32(x)) / w;
  let dx_r = max(0.0, f32(x) - (f32(p.nx - 1u) - w)) / w;
  let dy_b = max(0.0, w - f32(y)) / w;
  let dy_t = max(0.0, f32(y) - (f32(p.ny - 1u) - w)) / w;
  let d = max(max(dx_l, dx_r), max(dy_b, dy_t));
  if (d <= 0.0) { return 1.0; }
  return exp(-0.24 * d * d * d);
}

fn slab_mask(x: u32, y: u32) -> f32 {
  if (x < p.slab_x0 || x > p.slab_x1 || y < p.pml_width || y > p.ny - 1u - p.pml_width) {
    return 0.0;
  }
  if (x == p.slab_x0 || x == p.slab_x1) { return 0.5; }
  return 1.0;
}

fn oblique_packet_source(ch: u32, y: u32, t_step: f32) -> f32 {
  let dy = f32(y) - f32(p.src_y_center);
  let waist = max(4.0, p.beam_waist);
  let spat = exp(-0.5 * (dy / waist) * (dy / waist));
  if (spat < 1e-4) { return 0.0; }
  // Phase lag along Y launches a crisp collimated photon wavepacket at oblique angle theta_inc!
  let k_vac = p.omega_dt[ch] / max(0.05, p.courant);
  let t_delay = (dy * p.sin_theta) / max(0.05, p.courant);
  let dt_rel = (t_step - t_delay) - p.pulse_t0;
  let env = exp(-0.5 * (dt_rel / max(4.0, p.pulse_width)) * (dt_rel / max(4.0, p.pulse_width)));
  if (env < 1e-5) { return 0.0; }
  return spat * env * sin(p.omega_dt[ch] * (t_step - p.pulse_t0) - k_vac * dy * p.sin_theta);
}

@compute @workgroup_size(64)
fn fdtd2d_step_h(@builtin(global_invocation_id) gid: vec3<u32>) {
  let cells_per_ch = p.nx * p.ny;
  let total = cells_per_ch * p.n_channels;
  let idx = gid.x;
  if (idx >= total) { return; }

  let ch = idx / cells_per_ch;
  let rem = idx % cells_per_ch;
  let x = rem % p.nx;
  let y = rem / p.nx;
  let base = ch * cells_per_ch;
  let damp = boundary_damp(x, y);

  if (y + 1u < p.ny) {
    let dez_dy = ez_field[base + (y + 1u) * p.nx + x] - ez_field[idx];
    hx_field[idx] = damp * (hx_field[idx] - p.courant * dez_dy);
  }
  if (x + 1u < p.nx) {
    let dez_dx = ez_field[base + y * p.nx + (x + 1u)] - ez_field[idx];
    var hy_new = damp * (hy_field[idx] + p.courant * dez_dx);
    // Unidirectional rightward TF/SF magnetic injection along x = src_x - 1
    if (x + 1u == p.src_x && y >= p.pml_width && y < p.ny - p.pml_width) {
      let e_inc = oblique_packet_source(ch, y, f32(p.step_index));
      hy_new = hy_new - p.courant * e_inc;
    }
    hy_field[idx] = hy_new;
  }

  // Exact time-symmetric half-step polarization current updates (n-1/2 -> n+1/2)
  // using integer-step E^n and P^n (zero spurious phase lead; 100% passive for any gamma >= 0!):
  //   p_prev stores J_k^{n+1/2} = dP_k/dt * dt; p_curr stores P_k^n!
  let mask = slab_mask(x, y);
  if (mask > 0.0) {
    let e_n = ez_field[idx];
    let p_n = p_curr[idx];
    let j_k_old = p_prev[idx];
    let j_d_new = damp * (p.k_drude * j_drude[idx] + (p.beta_drude * mask) * e_n);
    let j_k_new = damp * (p.osc_a * j_k_old + p.osc_b * ((p.osc_c * mask) * e_n - p_n));
    j_drude[idx] = j_d_new;
    p_prev[idx] = j_k_new;
  }
}

@compute @workgroup_size(64)
fn fdtd2d_step_e_and_shells(@builtin(global_invocation_id) gid: vec3<u32>) {
  let cells_per_ch = p.nx * p.ny;
  let total = cells_per_ch * p.n_channels;
  let idx = gid.x;
  if (idx >= total) { return; }

  let ch = idx / cells_per_ch;
  let rem = idx % cells_per_ch;
  let x = rem % p.nx;
  let y = rem / p.nx;
  if (x == 0u || y == 0u || x + 1u >= p.nx || y + 1u >= p.ny) {
    ez_field[idx] = 0.0;
    shell_state[idx] = vec4<f32>(0.0);
    return;
  }

  let base = ch * cells_per_ch;
  let damp = boundary_damp(x, y);
  let e_old = ez_field[idx];
  let dhy_dx = hy_field[idx] - hy_field[base + y * p.nx + (x - 1u)];
  let dhx_dy = hx_field[idx] - hx_field[base + (y - 1u) * p.nx + x];
  let curl_h = dhy_dx - dhx_dy;

  var src_corr = 0.0;
  if (x == p.src_x && y >= p.pml_width && y < p.ny - p.pml_width) {
    let t_h = f32(p.step_index) + 0.5 + (0.5 * p.cos_theta) / max(0.05, p.courant);
    let e_inc_h = oblique_packet_source(ch, y, t_h);
    src_corr = p.courant * p.cos_theta * e_inc_h;
  }

  let mask = slab_mask(x, y);
  if (mask <= 0.0) {
    let e_new = damp * (e_old + p.courant * curl_h + src_corr);
    ez_field[idx] = e_new;
    shell_state[idx] = vec4<f32>(0.0, 0.0, 0.0, e_new);
    return;
  }

  // Exact integer-step update E^{n+1} & P_k^{n+1} from half-step H^{n+1/2}, J_D^{n+1/2}, J_k^{n+1/2}!
  let j_d = j_drude[idx];
  let j_k = p_prev[idx];
  let j_k_sum = j_k.x + j_k.y + j_k.z + j_k.w;
  let p_new = damp * (p_curr[idx] + j_k);
  let e_new = damp * (e_old + p.courant * curl_h + src_corr - j_d - j_k_sum);

  ez_field[idx] = e_new;
  p_curr[idx] = p_new;

  let e_mid = 0.5 * (e_new + e_old);
  let p_tot = p_new.x + p_new.y + p_new.z + p_new.w;
  let abs_inst = e_mid * (j_d + j_k_sum);
  shell_state[idx] = vec4<f32>(p_tot, j_d, abs_inst, e_new);
}

var<workgroup> sh_inc: array<f32, 64>;
var<workgroup> sh_ref: array<f32, 64>;
var<workgroup> sh_tr: array<f32, 64>;
var<workgroup> sh_abs: array<f32, 64>;
var<workgroup> sh_e2: array<f32, 64>;
var<workgroup> sh_grad2: array<f32, 64>;
var<workgroup> sh_sx_slab: array<f32, 64>;
var<workgroup> sh_sy_slab: array<f32, 64>;

@compute @workgroup_size(64)
fn fdtd2d_reduce_observables(
  @builtin(workgroup_id) wg_id: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>
) {
  let ch = wg_id.x;
  let tid = lid.x;
  if (ch >= p.n_channels) { return; }
  let cells_per_ch = p.nx * p.ny;
  let base = ch * cells_per_ch;

  var loc_inc = 0.0;
  var loc_ref = 0.0;
  var loc_tr = 0.0;
  var loc_abs = 0.0;
  var loc_e2 = 0.0;
  var loc_grad2 = 0.0;
  var loc_sx_slab = 0.0;
  var loc_sy_slab = 0.0;

  // 1. Poynting flux across vertical sensor lines (S_x = -E_z * H_y)
  for (var y = p.pml_width + tid; y < p.ny - p.pml_width; y = y + 64u) {
    // Left sensor plane x = sensor_x: rightward (+S_x) = incident, leftward (-S_x) = reflected!
    let idx_l = base + y * p.nx + p.sensor_x;
    let ez_l = ez_field[idx_l];
    let hy_l = 0.5 * (hy_field[idx_l] + hy_field[idx_l - 1u]);
    let sx_l = -ez_l * hy_l * p.courant;
    if (sx_l > 0.0) {
      loc_inc = loc_inc + sx_l;
    } else {
      loc_ref = loc_ref + (-sx_l);
    }

    // Right exit sensor plane x = tr_sensor_x: rightward (+S_x) = transmitted!
    let idx_r = base + y * p.nx + p.tr_sensor_x;
    let ez_r = ez_field[idx_r];
    let hy_r = 0.5 * (hy_field[idx_r] + hy_field[idx_r - 1u]);
    let sx_r = -ez_r * hy_r * p.courant;
    if (sx_r > 0.0) {
      loc_tr = loc_tr + sx_r;
    }
  }

  // 2. Interior slab absorption, 2D spatial wavevector compression k_slab^2, and Snell Poynting angle!
  let sx0 = p.slab_x0;
  let sx1 = p.slab_x1;
  let slab_w = sx1 - sx0 + 1u;
  let y0 = p.pml_width + 2u;
  let y1 = p.ny - p.pml_width - 2u;
  let slab_h = y1 - y0;
  let slab_total = slab_w * slab_h;
  for (var k = tid; k < slab_total; k = k + 64u) {
    let lx = k % slab_w;
    let ly = k / slab_w;
    let x = sx0 + lx;
    let y = y0 + ly;
    let idx = base + y * p.nx + x;
    let ss = shell_state[idx];
    loc_abs = loc_abs + ss.z;

    if (x >= sx0 + 3u && x <= sx1 - 3u) {
      let ez = ez_field[idx];
      let dex = 0.5 * (ez_field[idx + 1u] - ez_field[idx - 1u]);
      let dey = 0.5 * (ez_field[idx + p.nx] - ez_field[idx - p.nx]);
      loc_e2 = loc_e2 + ez * ez;
      loc_grad2 = loc_grad2 + (dex * dex + dey * dey);

      let hy = 0.5 * (hy_field[idx] + hy_field[idx - 1u]);
      let hx = 0.5 * (hx_field[idx] + hx_field[idx - p.nx]);
      // TM_z Poynting vector: S_x = -E_z * H_y, S_y = +E_z * H_x
      let sx = -ez * hy;
      let sy = ez * hx;
      if (sx > 0.0) {
        loc_sx_slab = loc_sx_slab + sx;
        loc_sy_slab = loc_sy_slab + sy;
      }
    }
  }

  sh_inc[tid] = loc_inc;
  sh_ref[tid] = loc_ref;
  sh_tr[tid] = loc_tr;
  sh_abs[tid] = loc_abs;
  sh_e2[tid] = loc_e2;
  sh_grad2[tid] = loc_grad2;
  sh_sx_slab[tid] = loc_sx_slab;
  sh_sy_slab[tid] = loc_sy_slab;
  workgroupBarrier();

  for (var stride = 32u; stride > 0u; stride = stride >> 1u) {
    if (tid < stride) {
      sh_inc[tid] = sh_inc[tid] + sh_inc[tid + stride];
      sh_ref[tid] = sh_ref[tid] + sh_ref[tid + stride];
      sh_tr[tid] = sh_tr[tid] + sh_tr[tid + stride];
      sh_abs[tid] = sh_abs[tid] + sh_abs[tid + stride];
      sh_e2[tid] = sh_e2[tid] + sh_e2[tid + stride];
      sh_grad2[tid] = sh_grad2[tid] + sh_grad2[tid + stride];
      sh_sx_slab[tid] = sh_sx_slab[tid] + sh_sx_slab[tid + stride];
      sh_sy_slab[tid] = sh_sy_slab[tid] + sh_sy_slab[tid + stride];
    }
    workgroupBarrier();
  }

  if (tid == 0u) {
    let o0 = obs_accum[ch * 2u + 0u];
    let o1 = obs_accum[ch * 2u + 1u];
    obs_accum[ch * 2u + 0u] = vec4<f32>(
      o0.x + sh_inc[0],
      o0.y + sh_ref[0],
      o0.z + sh_tr[0],
      o0.w + sh_abs[0]
    );
    obs_accum[ch * 2u + 1u] = vec4<f32>(
      o1.x + sh_e2[0],
      o1.y + sh_grad2[0],
      o1.z + sh_sx_slab[0],
      o1.w + sh_sy_slab[0]
    );
  }
}
`,ot=new WeakMap;function st(e){let t=ot.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-photon-shell-fdtd-2d-wgsl`,code:at}),r=e.createBindGroupLayout({label:`ulg-photon-shell-fdtd-2d-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`storage`}},{binding:2,visibility:4,buffer:{type:`storage`}},{binding:3,visibility:4,buffer:{type:`storage`}},{binding:4,visibility:4,buffer:{type:`storage`}},{binding:5,visibility:4,buffer:{type:`storage`}},{binding:6,visibility:4,buffer:{type:`storage`}},{binding:7,visibility:4,buffer:{type:`storage`}},{binding:8,visibility:4,buffer:{type:`storage`}}]}),i=e.createPipelineLayout({bindGroupLayouts:[r]});return t={bgl:r,stepHPipe:e.createComputePipeline({label:`ulg-fdtd2d-step-h`,layout:i,compute:{module:n,entryPoint:`fdtd2d_step_h`}}),stepEPipe:e.createComputePipeline({label:`ulg-fdtd2d-step-e`,layout:i,compute:{module:n,entryPoint:`fdtd2d_step_e_and_shells`}}),reducePipe:e.createComputePipeline({label:`ulg-fdtd2d-reduce`,layout:i,compute:{module:n,entryPoint:`fdtd2d_reduce_observables`}})},ot.set(e,t),t}function ct(e,t={},{probeWavelengthNm:n=535,pulseWidthSteps:r=34,pulseT0Steps:i=78}={}){if(!e||typeof e.createComputePipeline!=`function`)throw TypeError(`createPhotonShellOpticsSessionWebGpu requires a valid WebGPU GPUDevice.`);let{bgl:a,stepHPipe:o,stepEPipe:s,reducePipe:c}=st(e),l=Ye*4,u=l*4,d=l*16,f=e.createBuffer({label:`ulg-fdtd2d-ez`,size:u,usage:Q.STORAGE|Q.COPY_DST|Q.COPY_SRC}),p=e.createBuffer({label:`ulg-fdtd2d-hx`,size:u,usage:Q.STORAGE|Q.COPY_DST}),m=e.createBuffer({label:`ulg-fdtd2d-hy`,size:u,usage:Q.STORAGE|Q.COPY_DST}),h=e.createBuffer({label:`ulg-fdtd2d-jd`,size:u,usage:Q.STORAGE|Q.COPY_DST}),g=e.createBuffer({label:`ulg-fdtd2d-pcurr`,size:d,usage:Q.STORAGE|Q.COPY_DST}),_=e.createBuffer({label:`ulg-fdtd2d-pprev`,size:d,usage:Q.STORAGE|Q.COPY_DST}),v=e.createBuffer({label:`ulg-fdtd2d-shell`,size:d,usage:Q.STORAGE|Q.COPY_DST|Q.COPY_SRC}),y=e.createBuffer({size:128,usage:Q.STORAGE|Q.COPY_DST|Q.COPY_SRC}),b=e.createBuffer({size:128,usage:Q.MAP_READ|Q.COPY_DST}),x=Array.from({length:24},()=>e.createBuffer({size:144,usage:Q.UNIFORM|Q.COPY_DST})),S=x.map(t=>e.createBindGroup({layout:a,entries:[t,f,p,m,h,g,_,v,y].map((e,t)=>({binding:t,resource:{buffer:e}}))})),C=nt(t,{probeWavelengthNm:n}),w=0,T=null,E=!1,D=new Float32Array(l),O=new Float32Array(l*4),k=new Float32Array(32),A=24*Math.PI/180,j=Math.sin(A),M=Math.cos(A);function N(t,n){let a=new ArrayBuffer(144),o=new Uint32Array(a),s=new Float32Array(a);o[0]=128,o[1]=128,o[2]=4,o[3]=n>>>0,o[4]=C.slabX0,o[5]=C.slabX1,o[6]=18,o[7]=42,o[8]=110,o[9]=36,o[10]=12,o[11]=0,s[12]=Ze,s[13]=C.kDrude,s[14]=C.betaDrude,s[15]=i,s[16]=r,s[17]=j,s[18]=M,s[19]=11.5;for(let e=0;e<4;e+=1)s[20+e]=C.omegaDtChannels[e],s[24+e]=C.oscillators[e].a,s[28+e]=C.oscillators[e].b,s[32+e]=C.oscillators[e].c;e.queue.writeBuffer(t,0,a)}function P(n=null,{nextProbeWavelengthNm:r=null}={}){(n||r!=null)&&(C=nt(n||t,{probeWavelengthNm:r??C.wavelengthsNm[3]}),n&&(t=n)),w=0,e.queue.writeBuffer(f,0,D),e.queue.writeBuffer(p,0,D),e.queue.writeBuffer(m,0,D),e.queue.writeBuffer(h,0,D),e.queue.writeBuffer(g,0,O),e.queue.writeBuffer(_,0,O),e.queue.writeBuffer(v,0,O),e.queue.writeBuffer(y,0,k)}P();function F(t=4){let n=Math.max(1,Math.min(24,Math.trunc(t)));for(let e=0;e<n;e+=1)N(x[e],w+e);let r=Math.ceil(l/64),i=e.createCommandEncoder({label:`ulg-fdtd2d-batch`}),a=i.beginComputePass({label:`ulg-fdtd2d-pass`});for(let e=0;e<n;e+=1){let t=S[e];a.setPipeline(o),a.setBindGroup(0,t),a.dispatchWorkgroups(r),a.setPipeline(s),a.setBindGroup(0,t),a.dispatchWorkgroups(r),a.setPipeline(c),a.setBindGroup(0,t),a.dispatchWorkgroups(4)}a.end(),e.queue.submit([i.finish()]),w+=n}async function I({nonBlocking:t=!1}={}){if(E)return null;if(T){if(t)return null;try{await T}catch{}if(E)return null}let n=(async()=>{if(E)return null;let t=e.createCommandEncoder({label:`ulg-fdtd2d-read-obs`});if(t.copyBufferToBuffer(y,0,b,0,128),e.queue.submit([t.finish()]),await b.mapAsync(Q.MAP_READ),E){try{b.unmap()}catch{}return null}let n=new Float32Array(b.getMappedRange().slice(0,128));b.unmap();let r=[];for(let e=0;e<4;e+=1){let t=e*8,i=n[t+0],a=n[t+1],o=n[t+2],s=n[t+3],c=n[t+4],l=n[t+5],u=n[t+6],d=n[t+7],f=i>1e-4,p=f?Math.max(0,Math.min(1.1,a/i)):0,m=f?Math.max(0,Math.min(1.1,o/i)):0,h=f?Math.max(0,Math.min(1.1,s/i)):0,g=C.omegaDtChannels[e]/Ze,_=null;if(!C.isMetal&&c>.001&&l>1e-6&&g>1e-5){let e=Math.asin(Math.min(.99,Math.sqrt(l/c)))/g;Number.isFinite(e)&&e>=.95&&e<=5.5&&(_=e)}let v=null,y=null;if(!C.isMetal&&u>.001){let e=Math.atan2(Math.abs(d),u);if(y=e*180/Math.PI,e>.04){let t=j/Math.sin(e);Number.isFinite(t)&&t>=.95&&t<=5.5&&(v=t)}}let b=it(C,C.wavelengthsNm[e]);r.push(Object.freeze({wavelengthNm:C.wavelengthsNm[e],photonEv:et/C.wavelengthsNm[e],fluxInc:i,fluxRef:a,fluxTr:o,fluxAbs:s,reflectance:p,transmittance:m,absorption:h,energyBalance:p+m+h,nPhaseFdtd:_,nSnellFdtd:v,refractAngleDeg:y,nMeasuredFdtd:_??v??null,analyticNRe:b.nRe,analyticKIm:b.kIm,analyticReflectance:b.reflectance}))}let i=Math.max(0,Math.min(1,r[0].reflectance)),a=Math.max(0,Math.min(1,r[1].reflectance)),o=Math.max(0,Math.min(1,r[2].reflectance)),s=[rt(i),rt(a),rt(o)];return Object.freeze({schema:qe,stepIndex:w,simTimeFs:w*Qe*0x38d7ea4c68000,isMetal:C.isMetal,plasmaEv:C.plasmaEv,drudeGammaEv:C.drudeGammaEv,oscillators:C.oscillators,channels:Object.freeze(r),emergentReflectedSrgb:Object.freeze(s),analyticReflectedSrgb:Object.freeze([rt(r[0].analyticReflectance),rt(r[1].analyticReflectance),rt(r[2].analyticReflectance)])})})();T=n;try{return await n}finally{T===n&&(T=null)}}async function ee(e=16,{readObs:t=!0}={}){let n=Math.max(1,Math.trunc(e));for(;n>0;){let e=Math.min(24,n);F(e),n-=e}return t?I({nonBlocking:!1}):null}function L(){E=!0;for(let e of[f,p,m,h,g,_,v,y,b,...x])try{e.destroy()}catch{}}return Object.freeze({schema:qe,nx:128,ny:128,nCells:Ye,nChannels:4,slabX0:64,slabX1:104,eFieldBuffer:f,ezFieldBuffer:f,hxFieldBuffer:p,hyFieldBuffer:m,shellPowerBuffer:v,shellStateBuffer:v,getParams:()=>C,getStepIndex:()=>w,reset:P,stepSync:F,stepBatch:ee,readTelemetry:I,destroy:L})}var $=256,lt=`
struct TdseParams {
  n: u32,
  r_touch_idx: u32,
  r_turn_idx: u32,
  pad0: u32,
  inv_2mu_dx2: f32,
  dt_scale: f32,
  cap_start: f32,
  cap_strength: f32,
};

@group(0) @binding(0) var<uniform> p: TdseParams;
@group(0) @binding(1) var<storage, read> pot_v: array<f32>;
@group(0) @binding(2) var<storage, read_write> psi_re: array<f32>;
@group(0) @binding(3) var<storage, read_write> psi_im: array<f32>;
@group(0) @binding(4) var<storage, read_write> prob_out: array<f32>;

@compute @workgroup_size(64)
fn tdse_step_re(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let n = p.n;
  if (i >= n) { return; }
  if (i == 0u || i + 1u == n) { psi_re[i] = 0.0; return; }
  let lap = psi_im[i + 1u] - 2.0 * psi_im[i] + psi_im[i - 1u];
  let h_im = -p.inv_2mu_dx2 * lap + pot_v[i] * psi_im[i];
  var next_re = psi_re[i] + p.dt_scale * h_im;
  let frac = f32(i) / f32(n - 1u);
  if (frac > p.cap_start) {
    let s = (frac - p.cap_start) / max(0.01, 1.0 - p.cap_start);
    next_re = next_re * exp(-p.cap_strength * s * s);
  }
  psi_re[i] = next_re;
}

@compute @workgroup_size(64)
fn tdse_step_im(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let n = p.n;
  if (i >= n) { return; }
  if (i == 0u || i + 1u == n) { psi_im[i] = 0.0; prob_out[i] = 0.0; return; }
  let lap = psi_re[i + 1u] - 2.0 * psi_re[i] + psi_re[i - 1u];
  let h_re = -p.inv_2mu_dx2 * lap + pot_v[i] * psi_re[i];
  let prev_im = psi_im[i];
  var next_im = prev_im - p.dt_scale * h_re;
  let frac = f32(i) / f32(n - 1u);
  if (frac > p.cap_start) {
    let s = (frac - p.cap_start) / max(0.01, 1.0 - p.cap_start);
    next_im = next_im * exp(-p.cap_strength * s * s);
  }
  psi_im[i] = next_im;
  // Exact Visscher (1991) time-centered conserved probability density P(t_n) = Re(t_n)^2 + Im(t_n - dt/2) * Im(t_n + dt/2)!
  prob_out[i] = max(0.0, psi_re[i] * psi_re[i] + prev_im * next_im);
}
`,ut=new WeakMap;function dt(e){let t=ut.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-nuclear-tdse-wgsl`,code:lt}),r=e.createBindGroupLayout({entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`storage`}},{binding:3,visibility:4,buffer:{type:`storage`}},{binding:4,visibility:4,buffer:{type:`storage`}}]}),i=e.createPipelineLayout({bindGroupLayouts:[r]});return t={bgl:r,stepRe:e.createComputePipeline({layout:i,compute:{module:n,entryPoint:`tdse_step_re`}}),stepIm:e.createComputePipeline({layout:i,compute:{module:n,entryPoint:`tdse_step_im`}})},ut.set(e,t),t}function ft(e,t){if(!e||typeof e.createComputePipeline!=`function`)return null;let{bgl:n,stepRe:r,stepIm:i}=dt(e),a=t?.alphaWkb,o=(Array.isArray(a?.rFm)||ArrayBuffer.isView(a?.rFm))&&a.rFm.length>=8,s=(Array.isArray(a?.vMeV)||ArrayBuffer.isView(a?.vMeV))&&a.vMeV.length===a?.rFm?.length,c=o?a.rFm:Array.from({length:64},(e,t)=>t/63*45),l=s?a.vMeV:c.map(e=>e<6?-20:120/e),u=Math.max(24,Number(c[c.length-1])||45),d=Math.max(2.5,Number(a?.rTouchFm)||(t?.chargeRadiusFm||4)*1.35),f=u/($-1),p=new Float32Array($),m=new Float32Array($),h=1;for(let e=0;e<$;e+=1){let t=e*f;p[e]=t;let n=t/u*(c.length-1),r=Math.max(0,Math.min(c.length-2,Math.floor(n))),i=Math.max(0,Math.min(1,n-r)),a=l[r]*(1-i)+l[r+1]*i;m[e]=a,a>h&&(h=a)}let g=Number(t?.qAlphaMeV),_=Number.isFinite(g)?g>.05:!!a?.tunnelingAllowed,v=_?Math.max(.25,Math.min(h*.92,g)):0,y=Math.max(5,Number(t?.A)||56),b=Math.max(1,y-4),x=197.32698*197.32698/(2*(Number.isFinite(Number(a?.muMeV))&&Number(a.muMeV)>100?Number(a.muMeV):4*b/(4+b)*931.4941)*f*f),S=4*x+Math.max(h,25),C=.35/Math.max(1,S),w=Math.max(4,Math.min($-16,Math.round(d/f))),T=Math.min($-12,w+24);if(_){for(let e=w+1;e<$-4;e+=1)if(m[e]<=v){T=e;break}}else T=$-2;let E=e.createBuffer({size:32,usage:Q.UNIFORM|Q.COPY_DST}),D=e.createBuffer({size:$*4,usage:Q.STORAGE|Q.COPY_DST}),O=e.createBuffer({size:$*4,usage:Q.STORAGE|Q.COPY_DST}),k=e.createBuffer({size:$*4,usage:Q.STORAGE|Q.COPY_DST}),A=e.createBuffer({size:$*4,usage:Q.STORAGE|Q.COPY_DST|Q.COPY_SRC}),j=e.createBuffer({size:$*4,usage:Q.MAP_READ|Q.COPY_DST}),M=new ArrayBuffer(32);new Uint32Array(M,0,4).set([$,w,T,0]),new Float32Array(M,16,4).set([x,C,.88,.08]),e.queue.writeBuffer(E,0,M),e.queue.writeBuffer(D,0,m);let N=e.createBindGroup({layout:n,entries:[E,D,O,k,A].map((e,t)=>({binding:t,resource:{buffer:e}}))}),P=0,F=null,I=!1;function ee(){P=0;let t=new Float32Array($),n=new Float32Array($),r=new Float32Array($),i=new Float32Array($),a=Math.max(1.5,d*.52),o=Math.max(.75,d*.2),s=Math.max(1,Math.min($-2,Math.round(a/f))),c=Math.max(1,-m[s]),l=_?Math.sqrt(Math.max(.1,(v+c*.45)/Math.max(1e-4,x*f*f))):0,u=0;for(let e=1;e<$-1;e+=1){let r=p[e],i=Math.exp(-.5*((r-a)/o)**2);t[e]=i*Math.cos(l*(r-a)),n[e]=i*Math.sin(l*(r-a)),u+=t[e]*t[e]+n[e]*n[e]}let h=1/Math.sqrt(Math.max(1e-12,u));for(let e=0;e<$;e+=1)t[e]*=h,n[e]*=h;for(let e=1;e<$-1;e+=1){let a=t[e+1]-2*t[e]+t[e-1],o=-x*a+m[e]*t[e];r[e]=n[e]-.5*C*o,i[e]=t[e]*t[e]+n[e]*n[e]}e.queue.writeBuffer(O,0,t),e.queue.writeBuffer(k,0,r),e.queue.writeBuffer(A,0,i)}ee();async function L(t=12,{nonBlocking:n=!1}={}){if(I)return null;if(F){if(n)return null;try{await F}catch{}if(I)return null}let a=(async()=>{if(I)return null;let n=Math.max(1,Math.min(64,Math.trunc(t))),a=Math.ceil($/64),o=e.createCommandEncoder({label:`ulg-nuclear-tdse`}),s=o.beginComputePass();for(let e=0;e<n;e+=1)s.setPipeline(r),s.setBindGroup(0,N),s.dispatchWorkgroups(a),s.setPipeline(i),s.setBindGroup(0,N),s.dispatchWorkgroups(a);if(s.end(),o.copyBufferToBuffer(A,0,j,0,$*4),e.queue.submit([o.finish()]),P+=n,await j.mapAsync(Q.MAP_READ),I){try{j.unmap()}catch{}return null}let c=new Float32Array(j.getMappedRange().slice(0,$*4));j.unmap();let l=0,u=0,f=0;for(let e=0;e<$;e+=1)e<=w?l+=c[e]:e<=T?u+=c[e]:f+=c[e];return Object.freeze({schema:Je,stepCount:P,rGridFm:p,potRawMeV:m,prob:c,qEffMeV:v,rTouchFm:d,pInside:l,pBarrier:u,pTunneled:f})})();F=a;try{return await a}finally{F===a&&(F=null)}}function te(){I=!0;for(let e of[E,D,O,k,A,j])try{e.destroy()}catch{}}return Object.freeze({schema:Je,rGridFm:p,potRawMeV:m,qEffMeV:v,resetWavepacket:ee,stepBatch:L,destroy:te})}async function pt({closureRegistry:e,materialKey:t=`unknown`,electromagnetic:n={},telemetry:r=null,closureId:i=null}={}){let a=nt(n),o={closureId:i||`ulg-photon-shell-fdtd-optics:${t}.v1`,closureKind:`optical-photon-shell-fdtd-dispersion`,inputHash:`${t}:metal=${+!!a.isMetal}:wp=${a.plasmaEv.toFixed(3)}:osc=${a.oscillators.filter(e=>e.active).length}`,methodHash:`maxwell-2d-ade-fdtd-drude-lorentz-webgpu.v1`,execution:{mode:`webgpu-2d-maxwell-ade-fdtd`,params:a,measuredChannels:r?.channels??null,emergentReflectedSrgb:r?.emergentReflectedSrgb??null},validity:{wavelengthNm:[380,780],dxMeters:Xe,courant:Ze,incidenceDeg:24},provenance:{schema:qe,sourceModule:`src/runtime/material/photonShellOpticsWebGpu.js`,scientificValidation:!1}};return{ref:e?await e.store(o):null,artifact:o}}function mt(e){return!e||typeof e.registerModule!=`function`?null:{opticsMod:e.registerModule({method:{model:`photon-shell-fdtd`,version:`1`},kernel:{sourceModule:`src/runtime/material/photonShellOpticsWebGpu.js`,entryPoint:`fdtd2d_step_e_and_shells`,workgroupSize:64,wgsl:at},parameterSchema:{steps:{type:`number`,min:1,max:4096},probeWavelengthNm:{type:`number`,min:380,max:780}},stateLayout:{tensorId:`fdtd2d_em_shell_fields`,dtype:`f32`,components:4},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`photon-shell-fdtd@1 requires a WebGPU device`);let r=e?.parameters||{},i=ct(n,r.electromagnetic||{},{probeWavelengthNm:r.probeWavelengthNm??535});try{return{status:`ok`,telemetry:await i.stepBatch(r.steps??280,{readObs:!0})}}finally{i.destroy()}}}),tdseMod:e.registerModule({method:{model:`nuclear-tunneling-tdse`,version:`1`},kernel:{sourceModule:`src/runtime/material/photonShellOpticsWebGpu.js`,entryPoint:`tdse_step_re`,workgroupSize:64,wgsl:lt},parameterSchema:{steps:{type:`number`,min:1,max:2048}},stateLayout:{tensorId:`tdse_wavepacket_prob`,dtype:`f32`,components:1},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`nuclear-tunneling-tdse@1 requires a WebGPU device`);let r=e?.parameters||{},i=ft(n,r.nuclear||{});try{return{status:`ok`,telemetry:await i.stepBatch(r.steps??48)}}finally{i.destroy()}}})}}var ht=`peercompute.ulg.simulation-module-registration.v1`;function gt(e,t=null){return String(e??``).trim()||t}function _t(e){if(typeof e==`string`)return e.trim()||null;if(!e||typeof e!=`object`)return null;let t=gt(e.model??e.moduleId??e.id);return t?`${t}@${e.version==null?`1`:String(e.version).trim()}`:null}function vt(e={},t=null){if(!t||typeof t!=`object`)return{ok:!0};if(!e||typeof e!=`object`)return{ok:!1,reason:`parameters-must-be-object`};for(let[n,r]of Object.entries(t)){if(!r||typeof r!=`object`)continue;let t=e[n];if(t===void 0){if(r.required===!0)return{ok:!1,reason:`missing-required-parameter:${n}`};continue}if(r.type===`number`){let e=Number(t);if(!Number.isFinite(e))return{ok:!1,reason:`non-finite-parameter:${n}`};if(r.min!=null&&e<r.min)return{ok:!1,reason:`parameter-below-min:${n}:${e}<${r.min}`};if(r.max!=null&&e>r.max)return{ok:!1,reason:`parameter-above-max:${n}:${e}>${r.max}`}}else if(r.type===`boolean`&&typeof t!=`boolean`)return{ok:!1,reason:`parameter-not-boolean:${n}`};else if(r.type===`string`&&typeof t!=`string`)return{ok:!1,reason:`parameter-not-string:${n}`}}return{ok:!0}}function yt({createArtifact:e=t}={}){let n=new Map,o=new Map;function s(e,t,{device:n=null,sessionId:r=null}={}){let i=gt(r,`${e}:default`),a=o.get(i);if(a&&!a.disposed)return a;let s=E({sessionId:i,moduleId:e,device:n,layout:t.stateLayout,initialStep:0});return o.set(i,s),s}function c(e={}){let t=_t(e.method??e.methodId??e.id);if(!t)throw TypeError(`Simulation module registration requires method ({ model, version }) or methodId`);if(typeof e.stepCapsule!=`function`)throw TypeError(`Simulation module ${t} requires a stepCapsule(capsule, context) function`);let i=Object.freeze({schema:ht,methodKey:t,method:typeof e.method==`object`&&e.method?Object.freeze({...e.method}):Object.freeze({model:t.split(`@`)[0],version:t.split(`@`)[1]||`1`}),kernel:e.kernel&&typeof e.kernel==`object`?Object.freeze({sourceModule:gt(e.kernel.sourceModule),entryPoint:gt(e.kernel.entryPoint,`main`),workgroupSize:Number.isInteger(e.kernel.workgroupSize)?e.kernel.workgroupSize:64,wgslHash:e.kernel.wgsl?r(e.kernel.wgsl):gt(e.kernel.wgslHash)}):null,parameterSchema:e.parameterSchema&&typeof e.parameterSchema==`object`?Object.freeze({...e.parameterSchema}):Object.freeze({}),stateLayout:e.stateLayout&&typeof e.stateLayout==`object`?Object.freeze({tensorId:gt(e.stateLayout.tensorId,`state`),dtype:gt(e.stateLayout.dtype,`f32`),layout:gt(e.stateLayout.layout,`interleaved`),strideElements:Number(e.stateLayout.strideElements)||1,strideBytes:Number(e.stateLayout.strideBytes)||4,fields:Object.freeze(Array.isArray(e.stateLayout.fields)?[...e.stateLayout.fields]:[])}):Object.freeze({tensorId:`state`,dtype:`f32`,layout:`interleaved`,strideElements:1,strideBytes:4,fields:Object.freeze([])}),scaleRangeM:Array.isArray(e.scaleRangeM)&&e.scaleRangeM.length===2?Object.freeze([Number(e.scaleRangeM[0]),Number(e.scaleRangeM[1])]):null,supportsResidentStep:typeof e.stepResident==`function`,registeredAt:new Date().toISOString()});return n.set(t,{descriptor:i,stepCapsule:e.stepCapsule,stepResident:typeof e.stepResident==`function`?e.stepResident:null,reset:typeof e.reset==`function`?e.reset:null,dispose:typeof e.dispose==`function`?e.dispose:null}),i}function l(e){let t=_t(e);return t&&n.get(t)||null}function u(e){return l(e)!==null}function d(){return[...n.values()].map(e=>e.descriptor)}function f(e){let t=_t(e);if(!t||!n.has(t))return!1;let r=n.get(t);for(let[e,n]of[...o.entries()])n.moduleId===t&&(n.dispose(),o.delete(e));return r.dispose?.(),n.delete(t),!0}function p(e,{device:t=null,sessionId:n=null}={}){let r=l(e);if(!r)throw RangeError(`Unregistered simulation module: ${_t(e)||`missing`}`);return s(r.descriptor.methodKey,r.descriptor,{device:t,sessionId:n})}async function m(e,{sessionId:t=null,nextStep:n=0,destroyBuffers:r=!0,reason:i=`module-session-reset`}={}){let a=l(e);if(!a)throw RangeError(`Unregistered simulation module: ${_t(e)||`missing`}`);let o=s(a.descriptor.methodKey,a.descriptor,{sessionId:t}),c=o.reset({nextStep:n,destroyBuffers:r,reason:i});return a.reset&&await a.reset({session:o,receipt:c,nextStep:n,reason:i}),c}async function h(t,{device:n=null,gpuLease:r=null,sessionId:o=null}={}){if(!t||t.serviceId!==i.ulgRuntime||t.taskKind!==a.simulationStep)return{matched:!1,reason:`not-ulg-runtime-simulation-step`};let c=l(t.method);if(!c)return{matched:!1,reason:`method-not-registered`};if(!t.taskId||!t.inputHash||!t.methodHash||!t.provenance)throw TypeError(`Registered simulation.step capsule requires taskId, inputHash, methodHash, and provenance`);let u=vt(t.input?.parameters,c.descriptor.parameterSchema);if(!u.ok){let e=RangeError(`Invalid simulation parameters for ${c.descriptor.methodKey}: ${u.reason}`);throw e.code=`ERR_INVALID_SIMULATION_MODULE_PARAMETERS`,e}let d=s(c.descriptor.methodKey,c.descriptor,{device:n,sessionId:o??t.input?.sessionId??null}),f=await c.stepCapsule(t,{createSimulationArtifact:e,device:n,gpuLease:r,leaseSession:d,moduleDescriptor:c.descriptor}),p=f?.artifact??f,m=f?.leaseHandle??null,h=d.summary(),g=p&&typeof p==`object`?{...p,execution:{...p.execution||{},registeredModule:c.descriptor.methodKey,gpuLeaseStatus:r?.status??p.execution?.gpuLeaseStatus??null,residentLeaseSession:h}}:p;return{matched:!0,methodKey:c.descriptor.methodKey,artifact:g,leaseHandle:m,leaseSession:d,leaseSummary:h}}return Object.freeze({schema:ht,registerModule:c,resolveModule:l,hasModule:u,listModules:d,unregisterModule:f,getModuleLeaseSession:p,resetModuleSession:m,dispatchSimulationStepCapsule:h})}var bt=yt();export{mt as a,Fe as c,Pe as d,Ke as f,pt as i,Ne as l,ft as n,Ge as o,Se as p,ct as r,Ve as s,bt as t,Be as u};