import{F as e,H as t,I as n,L as r,R as i,at as a,ct as o,et as s,it as c,nt as l,ot as u,rt as d,st as f,tt as p}from"./eshkolTriadClosures-CAdZ5Pha.js";import{d as m,f as h,o as g}from"./materialFoundationAbi-FyZ8ey5s.js";import{t as _}from"./ClosureRegistry-DFBzDEUV.js";import{r as v,t as y}from"./polytopeAtlasBuilder-QwnCNpa5.js";import{computeBufferBinding as b,createCachedExplicitComputePipeline as x}from"../runtime/webgpuComputeLayout.js";import{r as S}from"./formula-CxRFRmhW.js";import{i as C,n as w,t as T}from"./nuclearStructureGpu-C34Rg1Np.js";import{i as E}from"./nuclearCherenkovClosure-BY7Gw8c1.js";import{i as D}from"./reactionCandidates-CtFyvwwG.js";import{a as ee,c as O,i as k,o as A,r as j}from"./simulationModuleRegistry-B9GELnPw.js";import{n as M}from"./fft3dWebGpu-U-dm_fNS.js";import{r as N}from"./opticalResolverWebGpu-lrCWoCIq.js";var P=`ulg.electronic.periodic-bulk-dft-webgpu.v1`,F=27.211386245988,I=n/e**3*1e-9,te=e*1e10,ne=1054571817e-43,L=1380649e-29;function re(e){let t=c(e),n=t.reduce((e,t)=>Math.max(e,t.n),0),r=t.find(e=>e.n===n&&e.l===0),i=t.find(e=>e.n===n&&e.l===1),a=t.find(e=>e.n===n&&e.l===2),o=a||t.find(e=>e.n===n-1&&e.l===2),s=a?0:r?.occupancy??0,l=a?0:i?.occupancy??0;return{maxN:n,sSub:r,pSub:i,dSub:o,sOcc:s,pOcc:l,dOcc:o?.occupancy??0,isClosedShell:(n===1&&s===2||l===6)&&!a,isMolecularNonmetal:!a&&(n===1&&s===1||l===5||n===2&&l>=3&&l<=4),isCovalentTetrahedral:!a&&(n>=2&&n<=5&&l===2||n===2&&l===1)}}var ie=Object.freeze({fcc:Object.freeze({id:`fcc`,spaceGroup:`Fm-3m (225)`,madelungAlpha:-1.79175,coord:12,atomsPerConv:4,packingFactor:Math.PI/(3*Math.SQRT2),shearRatioGOverK:.45,basisFractional:[[0,0,0]]}),bcc:Object.freeze({id:`bcc`,spaceGroup:`Im-3m (229)`,madelungAlpha:-1.79186,coord:8,atomsPerConv:2,packingFactor:Math.PI*Math.sqrt(3)/8,shearRatioGOverK:.48,basisFractional:[[0,0,0]]}),hcp:Object.freeze({id:`hcp`,spaceGroup:`P6_3/mmc (194)`,madelungAlpha:-1.79168,coord:12,atomsPerConv:4,packingFactor:Math.PI/(3*Math.SQRT2),shearRatioGOverK:.46,basisFractional:[[0,0,0],[1/3,2/3,.5]]}),diamond:Object.freeze({id:`diamond`,spaceGroup:`Fd-3m (227)`,madelungAlpha:-1.67085,coord:4,atomsPerConv:8,packingFactor:Math.PI*Math.sqrt(3)/16,shearRatioGOverK:.72,basisFractional:[[-.125,-.125,-.125],[.125,.125,.125]]}),"vdw-fcc":Object.freeze({id:`vdw-fcc`,spaceGroup:`Fm-3m (vdW)`,madelungAlpha:-1.79175,coord:12,atomsPerConv:4,packingFactor:Math.PI/(3*Math.SQRT2),shearRatioGOverK:.32,basisFractional:[[0,0,0]]})});function ae(e){let t=re(e);return t.isClosedShell||t.isMolecularNonmetal?[`vdw-fcc`]:t.isCovalentTetrahedral?[`diamond`,`fcc`]:!t.dSub&&!t.pSub&&t.sOcc===1?[`bcc`,`fcc`]:!t.dSub&&!t.pSub&&t.sOcc===2?[`hcp`,`fcc`,`bcc`]:t.dOcc>=1&&t.dOcc<=9?[`bcc`,`fcc`,`hcp`]:[`fcc`,`bcc`,`hcp`]}var R=Object.freeze([[0,0,0],[1,1,1],[-1,1,1],[1,-1,1],[1,1,-1],[-1,-1,1],[-1,1,-1],[1,-1,-1],[-1,-1,-1],[2,0,0],[-2,0,0],[0,2,0],[0,-2,0],[0,0,2],[0,0,-2]]);function z(e,n,r,i,a){let o=R.length,s=new Float32Array(o*o),c=2*Math.PI/Math.max(1.5,n),l=a===`bcc`?n**3/2:a===`diamond`?n**3/8:n**3/4,u=t(r/Math.max(1e-6,l)),d=1.919158292677513/Math.max(.25,u);for(let t=0;t<o;t+=1){let n=R[t],u=(e[0]+n[0])*c,f=(e[1]+n[1])*c,p=(e[2]+n[2])*c;s[t*o+t]=.5*(u*u+f*f+p*p);for(let e=t+1;e<o;e+=1){let u=R[e],f=(n[0]-u[0])*c,p=(n[1]-u[1])*c,m=(n[2]-u[2])*c,h=Math.hypot(f,p,m);if(h<1e-8)continue;let g=-(4*Math.PI*r/(l*h*h))*Math.cos(h*i),_=h/(2*d),v=_<1e-4?1:Math.abs(_-1)<1e-4?.5:.5+(1-_*_)/(4*_)*Math.log(Math.abs((1+_)/(1-_))),y=1+4*d/(Math.PI*h*h)*v,b=1;if(a===`diamond`){let e=(n[0]-u[0]+(n[1]-u[1])+(n[2]-u[2]))*(Math.PI/4);b=Math.cos(e)}else if(a===`hcp`){let e=((n[0]-u[0])/3+2*(n[1]-u[1])/3+.5*(n[2]-u[2]))*Math.PI;b=Math.cos(e)}let x=g/y*b;s[t*o+e]=x,s[e*o+t]=x}}return s}function oe(){let e=[{label:`Γ`,k:[0,0,0]},{label:`X`,k:[0,1,0]},{label:`W`,k:[.5,1,0]},{label:`L`,k:[.5,.5,.5]},{label:`Γ`,k:[0,0,0]}],t=[];for(let n=0;n<e.length-1;n+=1){let r=e[n].k,i=e[n+1].k;for(let a=0;a<4;a+=1){let o=a/4;t.push({label:a===0?e[n].label:``,k:[r[0]+o*(i[0]-r[0]),r[1]+o*(i[1]-r[1]),r[2]+o*(i[2]-r[2])]})}}return t.push(e[e.length-1]),t}function se(e,t,n){let a=Math.max(.8,e),{Z:o,zv:s,rcBohr:c,polarizabilityBohr3:l,rVdwBohr:u,dOcc:d,fOcc:f,relSContraction:p,spGapHa:m}=n,h=4*Math.PI/3*a**3;if(t.id===`vdw-fcc`){let e=a*2.2097,t=.75*Math.max(.15,n.ionizationPotentialHa||.5)*l*l,r=Math.max(2.2,u*1.52),i=(r/e)**6;return 2*Math.max(1e-5,t/(4*r**6))*(12.13188*i*i-14.45392*i)}let g=a/Math.cbrt(Math.max(1,s)),_=1.10495/(g*g)*s,v=(i(g)+r(g))*s,y=t.madelungAlpha*s*s/(2*a),b=2*Math.PI*s*s*c*c/h,x=0;if(d>0&&d<10){let e=.38*Math.min(1.6,1+.008*o)*(3/a)**3.2;x-=.5*e*d*(1-d/10),x+=.16*e*(d/10+.35)*(2.85/a)**6}if(f>0&&f<14){let e=.08*(3.4/a)**4;x-=.25*e*f*(1-f/14)}if(t.id===`diamond`){let e=a*1.3959,t=Math.max(2.6,c*2.35),n=Math.exp(-.9*(e-t)),r=Math.max(.25,.11*s*s/Math.max(2,t));x+=(s>=3&&s<=5?2.4:.5)*r*(n*n-2*n)}d===10&&s===2&&p>.08&&(x+=.18*p*(m||.2)*(3.2/a)**2.5);let{sOcc:S=0,pOcc:C=0}=n,w=0;return t.id===`bcc`?w=d>=3&&d<=6||d===0&&C===0&&S===1?-.0085:.0045:t.id===`fcc`?w=d>=8&&d<=10&&!(d===10&&S===2&&C===0)||d===0&&S===2&&C>=1||d===10&&C>=1?-.0095:.0015:t.id===`hcp`&&(w=d===0&&C===0&&S===2||d===1||d===2||d===7||d===10&&S===2&&C===0||f>0&&f<14?-.009:.002),_+v+y+b+x+w}function ce(e,t){let n=0;for(let e=1;e<t.length;e+=1)t[e]<t[n]&&(n=e);let r=Math.max(1,Math.min(t.length-2,n)),i=4*Math.PI/3*e[r-1]**3,a=4*Math.PI/3*e[r]**3,o=4*Math.PI/3*e[r+1]**3,s=t[r-1],c=t[r],l=t[r+1],u=(c-s)/(a-i),d=(l-c)/(o-a),f=2*(d-u)/(o-i),p=.5*(u+d),m=a-(f>1e-12?p/f:0);m=Math.max(i*.9,Math.min(o*1.1,m));let h=Math.cbrt(3*m/(4*Math.PI)),g=c-(f>1e-12?.5*p*p/f:0),_=Math.max(1e-7,m*Math.max(1e-9,f))*I;return{rWsEq:h,vEqBohr3:m,eMinHa:g,bulkModulusGPa:_}}function B(e,t){let n=c(e),r=n.reduce((e,t)=>Math.max(e,t.n),0),i=n.find(e=>e.n===r&&e.l===2),a=i||n.find(e=>e.n===r-1&&e.l===2),s=n.find(e=>e.n===r-2&&e.l===3),l=i?null:n.find(e=>e.n===r&&e.l===0),u=i?null:n.find(e=>e.n===r&&e.l===1),d=Math.max(1,o(e)||(a?Math.min(4,a.occupancy):1)),f=2,p=3.2,m=6,h=t?.radialGrid;if(h?.r&&h?.rho){let{r:e,rho:t,dx:n}=h,r=0,i=0;for(let r=0;r<e.length;r+=1)i+=4*Math.PI*e[r]*e[r]*e[r]*t[r]*n;let a=0,o=0;for(let s=0;s<e.length;s+=1){let c=4*Math.PI*e[s]*e[s]*e[s]*t[s]*n;r+=c,r>=.88*i&&f===2&&(f=e[s]),t[s]>=.001&&(p=e[s]),r>=Math.max(0,i-d-1)&&(a+=e[s]*e[s]*c,o+=c)}o>1e-6&&(m=a/o)}let g=Math.max(.55,Math.min(3.2,f*.78)),_=Array.isArray(t?.orbitals)?t.orbitals.filter(e=>Number(e.occupancy??1)>0):[],v=_.length?Math.max(..._.map(e=>Number(e.energyHa??e.energy??-.4))):-.35,y=Math.max(.12,-v),b=Math.max(1.2,Math.min(450,4/(9*Math.max(1,d))*m**2*d)),x=Math.min(.35,.5*(e/137.036)**2);return Object.freeze({Z:e,zv:d,rcBohr:g,rVdwBohr:Math.max(1.8,p),meanR2Valence:m,polarizabilityBohr3:b,ionizationPotentialHa:y,dOcc:a?.occupancy??0,fOcc:s?.occupancy??0,sOcc:l?.occupancy??0,pOcc:u?.occupancy??0,relSContraction:x,spGapHa:.22+.4*x})}async function le(t,n,r,{densityGridN:i=16,atomicMassU:o=null}={}){if(!t||typeof t.createBuffer!=`function`)throw TypeError(`solveBulkCrystalWebGpu requires a live WebGPU GPUDevice`);let s=B(n,r),c=ae(n),d=null;for(let e of c){let t=ie[e],n=e===`vdw-fcc`?Math.max(2,s.rVdwBohr*.72):Math.max(1.3,s.rcBohr*1.15),r=e===`vdw-fcc`?Math.max(n+2.5,s.rVdwBohr*1.45):Math.max(n+2.8,s.rcBohr*3.1),i=new Float64Array(19),a=new Float64Array(19);for(let e=0;e<19;e+=1)i[e]=n+e/18*(r-n),a[e]=se(i[e],t,s);let o=ce(i,a);(!d||o.eMinHa<d.fit.eMinHa)&&(d={struct:t,fit:o})}let{struct:f,fit:p}=d,m=Number(o),h=Number.isFinite(m)&&m>0?m*16605390666e-37:l(n),_=Math.max(1e6,p.bulkModulusGPa*1e9),v=_*f.shearRatioGOverK,y=p.vEqBohr3*e**3,b=h/y,x=Math.sqrt((_+4/3*v)/b),S=Math.sqrt(v/b),C=Math.cbrt(3/(1/x**3+2/S**3)),w=ne/L*Math.cbrt(6*Math.PI*Math.PI/y)*C,T=Math.min(.18,1.5*1.6*L*w/Math.max(1e-24,_*y)),E=p.vEqBohr3*(1+T),D=E*e**3,ee=h/D,O=Math.cbrt(f.atomsPerConv*E),k=O*te,j=(3*_-2*v)/(2*(3*_+v)),N=_+4/3*v,I=_-2/3*v,le=v,ue=Math.sqrt((_+4/3*v)/ee),de=Math.sqrt(v/ee),fe=Math.cbrt(3/(1/ue**3+2/de**3)),pe=1/D,me=ne/L*Math.cbrt(6*Math.PI*Math.PI*pe)*fe,he=Math.max(.01,Math.min(11,Math.abs(p.eMinHa)*F*.45+(f.id===`vdw-fcc`?0:.6))),ge=oe(),_e=R.length,ve=new Float32Array(ge.length*_e*_e);for(let e=0;e<ge.length;e+=1){let t=z(ge[e].k,O,s.zv,s.rcBohr,f.id);ve.set(t,e*_e*_e)}let ye=await A(t,{matrices:ve,n:_e,batchCount:ge.length,maxSweeps:28,tolerance:1e-5}),be=[],xe=[],Se=Math.max(1,Math.ceil(s.zv/2)),V=-1/0,Ce=1/0;for(let e=0;e<ge.length;e+=1){let t=[];for(let n=0;n<Math.min(8,_e);n+=1){let r=ye.eigenvalues[e*_e+n]*F;t.push(r),xe.push(r)}be.push(t);let n=Math.min(t.length-2,Se-1);V=Math.max(V,t[n]),Ce=Math.min(Ce,t[n+1])}xe.sort((e,t)=>e-t);let we=xe[Math.min(xe.length-1,Math.floor(ge.length*(s.zv/2)))],Te=Math.max(0,Ce-V);if(f.id===`vdw-fcc`){let e=re(n);Te=Math.max(Te,Math.min(21.5,s.ionizationPotentialHa*F*(e.isClosedShell?.85:.42)))}else f.id===`diamond`?Te=Math.max(.4,(Te+.35)*(1+1.8/Math.max(1.5,k*.45))):Te<.25&&(Te=0);let Ee=Math.min(...xe)-2,De=Math.max(...xe)+2,Oe=new Float32Array(48),ke=new Float32Array(48),Ae=Math.max(.35,(De-Ee)/36);for(let e=0;e<48;e+=1){let t=Ee+e/47*(De-Ee);Oe[e]=t;let n=0;for(let e of xe){let r=(t-e)/Ae;n+=Math.exp(-.5*r*r)}ke[e]=2*n/(ge.length*Ae*Math.sqrt(2*Math.PI))}let je=0;if(Te===0){let e=Math.max(0,Math.min(47,Math.round((we-Ee)/Math.max(1e-6,De-Ee)*47)));je=Math.max(.15,ke[e]+(s.dOcc>0&&s.dOcc<10?.32*Math.sin(Math.PI*s.dOcc/10)*6.5:0))}let Me=i,Ne=Me**3,Pe=new Float32Array(Ne*2);for(let e=0;e<_e;e+=1){let[t,n,r]=R[e],i=(t%Me+Me)%Me,a=(n%Me+Me)%Me,o=((r%Me+Me)%Me*Me+a)*Me+i,s=ye.eigenvectors[e*_e+0],c=Se>1?ye.eigenvectors[e*_e+1]:0;Pe[o*2]+=s,Pe[o*2+1]+=c}let Fe=await M(t,{data:Pe,n:Me,inverse:!0}),Ie=new Float32Array(Ne),Le=1e-12;for(let e=0;e<Ne;e+=1){let t=Fe.data[e*2],n=Fe.data[e*2+1],r=t*t+n*n;Ie[e]=r,r>Le&&(Le=r)}for(let e=0;e<Ne;e+=1)Ie[e]/=Le;return Object.freeze({schema:P,backend:`webgpu`,Z:n,symbol:u(n),crystalStructure:f.id,spaceGroup:f.spaceGroup,coordinationNumber:f.coord,latticeConstantA:k,wignerSeitzRadiusBohr:p.rWsEq,densityKgPerM3:ee,cohesiveEnergyEv:he,bulkModulusPa:_,bulkModulusGPa:_*1e-9,shearModulusPa:v,poissonRatio:j,elasticConstantsGPa:Object.freeze({c11:N*1e-9,c12:I*1e-9,c44:le*1e-9}),soundSpeedLongMPerS:ue,soundSpeedTransMPerS:de,debyeTemperatureK:me,fermiEnergyEv:we,bandGapEv:Te,isMetal:Te===0,dosAtFermiStatesPerEvAtom:je,kPathLabels:ge.map(e=>e.label),bandsEv:be,dosEnergyEv:Oe,dosValues:ke,blochDensityGridN:Me,blochDensity3d:Ie,spinUnpairedElectrons:a(n).reduce((e,t)=>e+(t.occUp-t.occDown),0),accuracyTier:n<=100?f.id===`vdw-fcc`||s.fOcc>0?g.TIER_2_REPRESENTATIVE_EFFECTIVE:g.TIER_1_QUANTITATIVE:g.TIER_3_THEORETICAL_ENVELOPE,provenance:Object.freeze({status:`webgpu-derived`,scientificValidation:!1,solver:`gpumath-bloch-pw-fft3d-bm3`})})}var ue=`ulg.electromagnetic.closure-webgpu.v1`,de=1602176634e-28,fe=91093837015e-41,pe=88541878128e-22,me=125663706212e-17,he=92740100783e-34,ge=1054571817e-43,_e=1380649e-29,ve=1602176634e-28,ye=27.211386245988;async function be(t,{Z:n,atomResult:r,bulkResult:i,temperatureK:o=300}={}){let s=c(n),l=a(n),u=s.reduce((e,t)=>Math.max(e,t.n),0),d=s.find(e=>e.n===u&&e.l===2),f=d||s.find(e=>e.n===u-1&&e.l===2),p=s.find(e=>e.n===u-2&&e.l===3),m=d?null:s.find(e=>e.n===u&&e.l===0),h=d?null:s.find(e=>e.n===u&&e.l===1),_=f?.occupancy??0,v=p?.occupancy??0,y=m?.occupancy??0,b=h?.occupancy??0,x=l.reduce((e,t)=>e+(t.occUp-t.occDown),0),S=d?1.2:Math.max(1,y+b+.18*Math.min(_,10-_)),C=4*Math.PI/3*(i.wignerSeitzRadiusBohr*e)**3,w=1/Math.max(1e-32,C),T=i.isMetal?S*w:0,E=ge*(i.isMetal?Math.sqrt(T*de*de/(pe*fe)):0)/ve,D=(u===4&&_>0&&_<10?.92:v>0&&v<14?.58:_>0&&_<10?.55:.25)*(.5*(i.dosAtFermiStatesPerEvAtom||0)),ee=n*(.65*e)**2;if(r?.radialGrid?.r&&r?.radialGrid?.rho){let{r:t,rho:n,dx:i}=r.radialGrid,a=0;for(let e=0;e<t.length;e+=1)a+=4*Math.PI*t[e]**5*n[e]*i;Number.isFinite(a)&&a>0&&(ee=a*e**2)}let O=-(w*me*de*de*ee)/(6*fe),k=i.isMetal?me*he*he*(i.dosAtFermiStatesPerEvAtom/ve)*w:0,A=`diamagnetic`,j=0,M=0,P=O+2/3*k;i.isMetal&&u===4&&_>=6&&_<=8&&D>.85?(A=`ferromagnetic`,j=Math.max(.55,(10-_)*.62-.12),M=Math.max(350,320*j*D),P=o>M?me*w*(j*he)**2/(3*_e*Math.max(10,o-M)):1e3):i.isMetal&&v>=6&&v<=11?(A=`ferromagnetic`,j=x*.95,M=Math.max(20,42*(x*(x+2))/20),P=o>M?me*w*(j*he)**2/(3*_e*Math.max(10,o-M)):500):i.isMetal&&u===4&&(_===4||_===5)?(A=`antiferromagnetic`,j=.6+.35*(_-4),M=_===5?210:120,P=me*w*(j*he)**2/(3*_e*(o+M))):x>0&&!i.isMetal?(A=`paramagnetic`,j=Math.sqrt(x*(x+2)),P=O+me*w*(j*he)**2/(3*_e*Math.max(1,o))):P>0&&(A=`paramagnetic`);let F=Math.max(30,i.debyeTemperatureK||250),I=i.isMetal?Math.max(.08,Math.min(1.8,.14+.16*(i.dosAtFermiStatesPerEvAtom||.5)*(300/F))):0,te=0;if(i.isMetal){let e=o/F,t=e>=.4?1:(e/.4)**4,n=Math.max(1e11,2*Math.PI*I*_e*o/ge*t);te=T*de*de/(fe*n)}else{let e=i.bandGapEv*ve,t=2*(fe*_e*o/(2*Math.PI*ge*ge))**1.5*Math.exp(-e/(2*_e*Math.max(1,o))),n=.05*(300/Math.max(10,o))**1.5;te=Math.max(1e-18,t*de*n)}let ne=1/Math.max(1e-20,te),L=Array.isArray(r?.orbitals)?r.orbitals.filter(e=>Number(e.occupancy??1)>0):[],re=L.length?Math.max(...L.map(e=>Number(e.energyHa??e.energy??-.35))):-.35,ie=Math.max(1.8,Math.min(6.5,-re*ye*.52+.65)),ae=i.isMetal?1/0:1+((E||10.5)/Math.max(.5,i.bandGapEv*1.4))**2,R=.12,z=0;if(i.isMetal&&A!==`ferromagnetic`&&A!==`antiferromagnetic`&&I>R*1.35){let e=-(1.04*(1+I))/Math.max(.05,I-R*(1+.62*I));z=Math.max(0,F/1.45*Math.exp(e))}let oe=[`s`,`p`,`d`,`f`,`g`],se=[];if(i.isMetal&&Array.isArray(r?.orbitals)&&r.orbitals.length>0){let t=Math.max(1e-9,T)*e**3,n=Math.cbrt(3*Math.PI*Math.PI*t),a=Math.sqrt(4*n/Math.PI),o=.5*ye*a*a,s=r.orbitals.filter(e=>Number(e.occupancy??e.occ??0)>0),c=r.orbitals.filter(e=>Number(e.occupancy??e.occ??0)<2*(2*e.l+1));for(let e of s){if(e.l<2)continue;let t=2*(2*e.l+1),n=Number(e.occupancy??e.occ??0),r=Number.isFinite(e.energyJPlusHa),a=r?e.energyJPlusHa:Number(e.energyHa??e.energy??-.5);for(let s of c){if(s.n===e.n&&s.l===e.l||Math.abs(s.l-e.l)!==1)continue;let c=Number(s.energyHa??s.energy??-.05);if(!(c>a))continue;let l=Math.max(0,Math.min(1.6,.16*Number(i.fermiEnergyEv||0))),u=(c-a)*ye+l;if(!(u>.2&&u<9.5))continue;let d=2*(2*s.l+1),f=Number(s.occupancy??s.occ??0),p=Math.min(1,Math.max(0,n/t)),m=Math.min(1,Math.max(0,1-f/d)),h=s.l>e.l?(e.l+1)/(2*e.l+1):e.l/(2*e.l+1),g=p*m*h*(e.l===2?1.85:.75);if(!(g>0))continue;let _=Math.max(.22,.1*u+.032*o*Math.sqrt(g)),v=r?`(${2*e.l+1}/2)`:``,y=`${e.n}${oe[e.l]||e.l}${v}→${s.n}${oe[s.l]||s.l}`;se.push(Object.freeze({energyEv:u,dampingEv:_,strengthWeight:g,transitionLabel:y}))}}se.sort((e,t)=>e.energyEv-t.energyEv||t.strengthWeight-e.strengthWeight),se.splice(4)}let ce=i.isMetal?Math.max(.08,Math.min(2.6,ge*(T*de*de)/Math.max(1e-20,fe*te)/ve+(_>0&&_<10?.55:0))):.25,B=null;t&&typeof t.createBuffer==`function`&&(B=(await N(t,[i.isMetal?{mode:0,atomicNumberZ:n,conductionElectronDensityPerM3:Math.max(1e27,T),plasmaEnergyEv:Math.max(1,E),dampingEv:ce,interbandOscillators:se,pathLengthM:.1}:{mode:2,atomicNumberZ:n,electronicGapEv:Math.max(.2,i.bandGapEv),pathLengthM:.1}]))?.results?.[0]??null);let le=B?.spectralSamples?.find(e=>Math.abs(e.wavelengthNm-550)<=6)||B?.spectralSamples?.[Math.floor((B?.spectralSamples?.length||1)/2)]||null,be=Array.isArray(B?.baseColorSrgb)&&B.baseColorSrgb.length===3?B.baseColorSrgb.map(e=>Math.max(0,Math.min(1,Number(e)||0))):i.isMetal?[.7,.72,.76]:[.85,.9,.96],xe=Number.isFinite(le?.nRe)&&le.nRe>0?le.nRe:i.isMetal?1.5:Math.sqrt(Math.max(1,ae)),Se=Number.isFinite(le?.reflectance)?le.reflectance:Number.isFinite(B?.reflectance)?B.reflectance:i.isMetal?.72:.04;return Object.freeze({schema:ue,backend:B?`webgpu`:`analytical-em`,Z:n,temperatureK:o,isMetal:i.isMetal,bandGapEv:i.bandGapEv,plasmaEnergyEv:E,drudeDampingEv:ce,interbandOscillators:Object.freeze(se),workFunctionEv:ie,electronPhononLambda:I,electricalConductivitySPerM:te,electricalResistivityOhmM:ne,staticDielectricConstant:ae,magneticPhase:A,stonerProduct:D,magneticMomentMuB:j,curieOrNeelTempK:M,magneticSusceptibilitySi:P,superconductingTcK:z,opticalSrgb:be,refractiveIndex550Nm:xe,reflectance550Nm:Se,spectralWavelengthsNm:B?.spectralSamples?.map(e=>e.wavelengthNm)??null,spectralReflectance:B?.spectralSamples?.map(e=>e.reflectance??0)??null,spectralNRe:B?.spectralSamples?.map(e=>e.nRe??1)??null,spectralAbsorptionPerM:B?.spectralSamples?.map(e=>e.absorptionPerM??0)??null,accuracyTier:g.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:B?B.resolverStatus||`webgpu-derived`:`reduced-estimate`,oscillatorSource:B?.oscillatorSource??`none`,scientificValidation:!1,model:`stoner-bloch-gruneisen-kubo-drude-mcmillan`})})}var xe=`ulg.gpumath.molecular-dynamics-webgpu.v1`,Se=Object.freeze({LENNARD_JONES:0,MORSE_EAM:1,STILLINGER_WEBER:2}),V=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128}),Ce=10.1805057,we=8617333262e-14,Te=80,Ee=`
struct MdParams {
  // x=atomCount, y=potentialModel (0=LJ, 1=Morse+EAM, 2=SW), z=rdfBins(64), w=thermostatActive
  counts: vec4<u32>,
  // x=boxLx, y=boxLy, z=boxLz, w=dt_internal
  box_dt: vec4<f32>,
  // x=epsilon_ev, y=sigma_or_r0_A, z=alpha_or_lambda, w=rcut_A
  pot0: vec4<f32>,
  // x=eam_A_ev, y=eam_beta, z=sw_gamma_or_p, w=target_temp_k
  pot1: vec4<f32>,
  // x=thermostat_alpha (dt / tau), y=scale_factor, z=0, w=0
  ctrl: vec4<f32>,
};

@group(0) @binding(0) var<uniform> params: MdParams;
// pos: xyz in [0, box), w = species / phase marker
@group(0) @binding(1) var<storage, read_write> pos: array<vec4<f32>>;
// vel: vxyz (A/t0), w = mass (u)
@group(0) @binding(2) var<storage, read_write> vel: array<vec4<f32>>;
// force: fxyz (eV/A), w = per-atom potential energy (eV)
@group(0) @binding(3) var<storage, read_write> force: array<vec4<f32>>;
// unwrapped: xyz unwrapped coords for exact MSD, w = EAM embedding derivative F'(rho)
@group(0) @binding(4) var<storage, read_write> unwrapped: array<vec4<f32>>;
// pos_init: initial unwrapped xyz for MSD reference
@group(0) @binding(5) var<storage, read> pos_init: array<vec4<f32>>;
// telemetry: fixed-point scaled atomic accumulators
//   [0]=E_kin*1e5, [1]=E_pot*1e5, [2]=virial*1e5, [3]=msd*1e4,
//   [4]=px*1e5, [5]=py*1e5, [6]=pz*1e5, [7]=sxy*1e5, [8]=sxz*1e5, [9]=syz*1e5,
//   [16..79]=RDF histogram bins
@group(0) @binding(6) var<storage, read_write> telemetry: array<atomic<i32>>;

fn min_image(d: vec3<f32>, box_l: vec3<f32>) -> vec3<f32> {
  return d - box_l * round(d / box_l);
}

fn wrap_box(p: vec3<f32>, box_l: vec3<f32>) -> vec3<f32> {
  return p - box_l * floor(p / box_l);
}

@compute @workgroup_size(64)
fn reset_telemetry(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x < 80u) {
    atomicStore(&telemetry[id.x], 0);
  }
}

@compute @workgroup_size(64)
fn vv_half_kick_drift(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.x) { return; }
  let dt = params.box_dt.w;
  let box_l = params.box_dt.xyz;
  let v4 = vel[i];
  let m = max(v4.w, 1.0e-6);
  let f3 = force[i].xyz;
  let v_half = v4.xyz + (0.5 * dt / m) * f3;
  let dr = v_half * dt;
  let p_new = wrap_box(pos[i].xyz + dr, box_l);
  pos[i] = vec4<f32>(p_new, pos[i].w);
  unwrapped[i] = vec4<f32>(unwrapped[i].xyz + dr, unwrapped[i].w);
  vel[i] = vec4<f32>(v_half, m);
}

// Pre-pass for Finnis-Sinclair EAM metallic electron density rho_i = sum_j phi(r_ij)
@compute @workgroup_size(64)
fn compute_eam_density(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  let n = params.counts.x;
  if (i >= n || params.counts.y != 1u) { return; }
  let box_l = params.box_dt.xyz;
  let r0 = params.pot0.y;
  let rcut = params.pot0.w;
  let rcut2 = rcut * rcut;
  let beta = max(params.pot1.y, 0.25);
  let pi = pos[i].xyz;
  var rho = 0.0;
  for (var j = 0u; j < n; j = j + 1u) {
    if (j == i) { continue; }
    let d = min_image(pi - pos[j].xyz, box_l);
    let r2 = dot(d, d);
    if (r2 < rcut2 && r2 > 1.0e-8) {
      let r = sqrt(r2);
      let s = 1.0 - r / rcut;
      rho = rho + exp(-beta * (r - r0)) * s * s;
    }
  }
  // Store F'(rho) = -0.5 * A / sqrt(rho + eps) in unwrapped[i].w and embed energy later
  let a_eam = params.pot1.x;
  let dF = -0.5 * a_eam / sqrt(max(rho, 1.0e-6));
  unwrapped[i].w = dF;
  // Temporarily stash sqrt(rho) in force[i].w
  force[i].w = -a_eam * sqrt(max(rho, 0.0));
}

@compute @workgroup_size(64)
fn compute_forces(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  let n = params.counts.x;
  if (i >= n) { return; }
  let model = params.counts.y;
  let box_l = params.box_dt.xyz;
  let eps = params.pot0.x;
  let sig = params.pot0.y;
  let alpha = params.pot0.z;
  let rcut = params.pot0.w;
  let rcut2 = rcut * rcut;
  let pi = pos[i].xyz;

  var fi = vec3<f32>(0.0);
  var epot_i = select(0.0, force[i].w, model == 1u);
  var vir_i = 0.0;
  var sxy = 0.0;
  var sxz = 0.0;
  var syz = 0.0;

  let inv_rc = sig / rcut;
  let sr2_c = inv_rc * inv_rc;
  let sr6_c = sr2_c * sr2_c * sr2_c;
  let lj_ecut = 4.0 * eps * (sr6_c * sr6_c - sr6_c);
  let lj_fcut = 24.0 * eps * (2.0 * sr6_c * sr6_c - sr6_c) / rcut;

  let dFi = unwrapped[i].w;
  let beta = max(params.pot1.y, 0.25);

  for (var j = 0u; j < n; j = j + 1u) {
    if (j == i) { continue; }
    let d = min_image(pi - pos[j].xyz, box_l);
    let r2 = dot(d, d);
    if (r2 >= rcut2 || r2 <= 1.0e-8) { continue; }
    let r = sqrt(r2);

    // RDF bin accumulation (only when telemetry is active on final step)
    if (params.ctrl.z > 0.5) {
      let bin = u32(clamp((r / rcut) * 64.0, 0.0, 63.0));
      atomicAdd(&telemetry[16u + bin], 1);
    }

    var f_scalar = 0.0; // force magnitude / r along d = pi - pj
    var u_pair = 0.0;

    if (model == 0u) {
      // Shifted-force Lennard-Jones
      let sr = sig / r;
      let sr2 = sr * sr;
      let sr6 = sr2 * sr2 * sr2;
      let sr12 = sr6 * sr6;
      u_pair = 4.0 * eps * (sr12 - sr6) - lj_ecut + (r - rcut) * lj_fcut;
      let f_mag = 24.0 * eps * (2.0 * sr12 - sr6) / r - lj_fcut;
      f_scalar = f_mag / r;
    } else if (model == 1u) {
      // Smoothly truncated Morse pair + Finnis-Sinclair EAM many-body force
      let ex = exp(-alpha * (r - sig));
      let s = 1.0 - r / rcut;
      let s2 = s * s;
      let u_morse = eps * (ex * ex - 2.0 * ex);
      let du_morse = 2.0 * eps * alpha * (ex - ex * ex);
      u_pair = u_morse * s2;
      let du_dr = du_morse * s2 - u_morse * (2.0 * s / rcut);
      // EAM density derivative d(rho)/dr
      let ex_rho = exp(-beta * (r - sig));
      let drho_dr = ex_rho * (-beta * s2 - 2.0 * s / rcut);
      let dFj = unwrapped[j].w;
      let f_mag = -du_dr - (dFi + dFj) * drho_dr;
      f_scalar = f_mag / r;
    } else {
      // Stillinger-Weber 2-body term (A=7.049556, B=0.602224, p=4, a=rcut/sig)
      let rs = r / sig;
      let a_sw = rcut / sig;
      let denom = rs - a_sw;
      if (denom < -1.0e-4) {
        let ex_sw = exp(1.0 / denom);
        let inv_r4 = 1.0 / (rs * rs * rs * rs);
        let term = 0.6022245584 * inv_r4 - 1.0;
        u_pair = 7.049556277 * eps * term * ex_sw;
        let dterm = -4.0 * 0.6022245584 * inv_r4 / rs;
        let du_drs = 7.049556277 * eps * ex_sw * (dterm - term / (denom * denom));
        f_scalar = -(du_drs / sig) / r;
      }
    }

    let fij = d * f_scalar;
    fi = fi + fij;
    epot_i = epot_i + 0.5 * u_pair;
    vir_i = vir_i + 0.5 * dot(d, fij);
    sxy = sxy + 0.5 * d.x * fij.y;
    sxz = sxz + 0.5 * d.x * fij.z;
    syz = syz + 0.5 * d.y * fij.z;
  }

  // Stillinger-Weber 3-body tetrahedral term when model == 2 (covalent sp3 bonding)
  if (model == 2u && params.pot0.z > 0.0) {
    let lambda_sw = params.pot0.z;
    let gamma_sw = max(params.pot1.z, 1.2);
    let a_sw = rcut / sig;
    // Collect up to 12 nearest neighbors of i inside rcut
    var nb_idx: array<u32, 12>;
    var nb_vec: array<vec3<f32>, 12>;
    var nb_r: array<f32, 12>;
    var nb_count = 0u;
    for (var j = 0u; j < n; j = j + 1u) {
      if (j == i || nb_count >= 12u) { continue; }
      let d = min_image(pos[j].xyz - pi, box_l);
      let r2 = dot(d, d);
      if (r2 < rcut2 && r2 > 1.0e-8) {
        nb_idx[nb_count] = j;
        nb_vec[nb_count] = d;
        nb_r[nb_count] = sqrt(r2);
        nb_count = nb_count + 1u;
      }
    }
    // Central-atom angular restoring force (cos theta_jik + 1/3)^2
    for (var a = 0u; a + 1u < nb_count; a = a + 1u) {
      let ra = nb_r[a] / sig;
      let da = ra - a_sw;
      if (da >= -1.0e-3) { continue; }
      let ea = exp(gamma_sw / da);
      let ua = nb_vec[a] / nb_r[a];
      for (var b = a + 1u; b < nb_count; b = b + 1u) {
        let rb = nb_r[b] / sig;
        let db = rb - a_sw;
        if (db >= -1.0e-3) { continue; }
        let eb = exp(gamma_sw / db);
        let ub = nb_vec[b] / nb_r[b];
        let cos_t = clamp(dot(ua, ub), -1.0, 1.0);
        let diff = cos_t + 0.33333333;
        let pre = lambda_sw * eps * ea * eb;
        let u3 = pre * diff * diff;
        epot_i = epot_i + u3;
        // Gradient w.r.t. central atom i: -(grad_j + grad_k)
        let d_cos_dj = (ub - ua * cos_t) / nb_r[a];
        let d_cos_dk = (ua - ub * cos_t) / nb_r[b];
        let d_ea_dr = -(gamma_sw / (da * da * sig));
        let d_eb_dr = -(gamma_sw / (db * db * sig));
        let grad_j = pre * (2.0 * diff * d_cos_dj + diff * diff * d_ea_dr * ua);
        let grad_k = pre * (2.0 * diff * d_cos_dk + diff * diff * d_eb_dr * ub);
        fi = fi + grad_j + grad_k;
      }
    }
  }

  force[i] = vec4<f32>(fi, epot_i);

  if (params.ctrl.z > 0.5) {
    atomicAdd(&telemetry[1], i32(clamp(epot_i * 1.0e4, -2.0e9, 2.0e9)));
    atomicAdd(&telemetry[2], i32(clamp(vir_i * 1.0e4, -2.0e9, 2.0e9)));
    atomicAdd(&telemetry[7], i32(clamp(sxy * 1.0e4, -2.0e9, 2.0e9)));
    atomicAdd(&telemetry[8], i32(clamp(sxz * 1.0e4, -2.0e9, 2.0e9)));
    atomicAdd(&telemetry[9], i32(clamp(syz * 1.0e4, -2.0e9, 2.0e9)));
  }
}

@compute @workgroup_size(64)
fn vv_second_kick_reduce(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.x) { return; }
  let dt = params.box_dt.w;
  let v4 = vel[i];
  let m = max(v4.w, 1.0e-6);
  var v_new = v4.xyz + (0.5 * dt / m) * force[i].xyz;
  if (params.counts.w != 0u) {
    v_new = v_new * params.ctrl.y;
  }
  vel[i] = vec4<f32>(v_new, m);

  if (params.ctrl.z > 0.5) {
    let ekin = 0.5 * m * dot(v_new, v_new);
    let disp = unwrapped[i].xyz - pos_init[i].xyz;
    let msd_i = dot(disp, disp);
    atomicAdd(&telemetry[0], i32(clamp(ekin * 1.0e4, -2.0e9, 2.0e9)));
    atomicAdd(&telemetry[3], i32(clamp(msd_i * 1.0e6, 0.0, 1.5e7)));
    atomicAdd(&telemetry[4], i32(clamp(m * v_new.x * 1.0e4, -2.0e9, 2.0e9)));
    atomicAdd(&telemetry[5], i32(clamp(m * v_new.y * 1.0e4, -2.0e9, 2.0e9)));
    atomicAdd(&telemetry[6], i32(clamp(m * v_new.z * 1.0e4, -2.0e9, 2.0e9)));
  }
}
`;function De(e,{positions:t,velocities:n,boxLengthsA:r,potentialModel:i=Se.LENNARD_JONES,epsilonEv:a=.0103,sigmaOrR0A:o=3.405,alphaOrLambda:s=1.5,rcutA:c=8.5,eamAEv:l=0,eamBeta:u=1.2,swGamma:d=1.2,dtFs:f=2,targetTemperatureK:p=0,thermostatCouplingFs:m=0}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createMolecularDynamicsSessionWebGpu requires a live WebGPU GPUDevice`);let h=t instanceof Float32Array?t:Float32Array.from(t),g=n instanceof Float32Array?n:Float32Array.from(n),_=Math.floor(h.length/4);if(!(_>=2&&g.length===_*4))throw RangeError(`Invalid MD buffers: atomCount=${_}, velFloats=${g.length}`);let v=Array.isArray(r)?[Number(r[0]),Number(r[1]),Number(r[2])]:[Number(r),Number(r),Number(r)],y=[b(0,`uniform`),b(1,`storage`),b(2,`storage`),b(3,`storage`),b(4,`storage`),b(5,`read-only-storage`),b(6,`storage`)],S=t=>x(e,{cacheKey:`ulg-gpumath-md-${t}.v1`,label:`ulg-gpumath-md-${t}`,code:Ee,entryPoint:t,bindings:y}),C=S(`reset_telemetry`),w=S(`vv_half_kick_drift`),T=S(`compute_eam_density`),E=S(`compute_forces`),D=S(`vv_second_kick_reduce`),ee=_*16,O=(t,n,r)=>{let i=e.createBuffer({label:t,size:Math.max(16,n?n.byteLength:ee),usage:r});return n&&e.queue.writeBuffer(i,0,n),i},k=e.createBuffer({label:`ulg-md-params`,size:80,usage:V.UNIFORM|V.COPY_DST}),A=O(`ulg-md-pos`,h,V.STORAGE|V.COPY_DST|V.COPY_SRC),j=O(`ulg-md-vel`,g,V.STORAGE|V.COPY_DST|V.COPY_SRC),M=O(`ulg-md-force`,new Float32Array(_*4),V.STORAGE|V.COPY_DST|V.COPY_SRC),N=O(`ulg-md-unwrapped`,h,V.STORAGE|V.COPY_DST|V.COPY_SRC),P=O(`ulg-md-pos-init`,h,V.STORAGE|V.COPY_DST),F=e.createBuffer({label:`ulg-md-telemetry`,size:Te*4,usage:V.STORAGE|V.COPY_SRC}),I=e.createBuffer({label:`ulg-md-telemetry-read`,size:Te*4,usage:V.MAP_READ|V.COPY_DST}),te=e.createBindGroup({layout:E.bindGroupLayout,entries:[k,A,j,M,N,P,F].map((e,t)=>({binding:t,resource:{buffer:e}}))}),ne=Number(f)/Ce,L=Math.max(1,Number(p)||300),re=0,ie=!1,ae=({collectTelemetry:t=!1,scaleVel:n=1,useThermostat:r=!1}={})=>{let h=new ArrayBuffer(80);new Uint32Array(h,0,4).set([_,i,64,+!!r]),new Float32Array(h,16,4).set([v[0],v[1],v[2],ne]),new Float32Array(h,32,4).set([a,o,s,c]),new Float32Array(h,48,4).set([l,u,d,p]),new Float32Array(h,64,4).set([m>0?f/m:0,n,+!!t,0]),e.queue.writeBuffer(k,0,h)},R=Math.ceil(_/64);async function z(t=10,{readTelemetry:n=!0,temperatureK:r=p}={}){let a=Math.max(1,Math.trunc(Number(t))),o=Number(r)>0&&Number(m)>0,s=1;if(o&&L>0){let e=Math.min(.5,f/m);s=Math.sqrt(Math.max(.25,Math.min(4,1+e*(Number(r)/L-1))))}let l=e.createCommandEncoder({label:`ulg-md-batch-${a}`});if(!ie){ae({collectTelemetry:!1,scaleVel:1,useThermostat:!1});let e=l.beginComputePass({label:`ulg-md-init-forces`});e.setBindGroup(0,te),i===Se.MORSE_EAM&&(e.setPipeline(T.pipeline),e.dispatchWorkgroups(R)),e.setPipeline(E.pipeline),e.dispatchWorkgroups(R),e.end(),ie=!0}if(a>1){ae({collectTelemetry:!1,scaleVel:s,useThermostat:o});let e=l.beginComputePass({label:`ulg-md-steps-loop`});e.setBindGroup(0,te);for(let t=0;t<a-1;t+=1)e.setPipeline(w.pipeline),e.dispatchWorkgroups(R),i===Se.MORSE_EAM&&(e.setPipeline(T.pipeline),e.dispatchWorkgroups(R)),e.setPipeline(E.pipeline),e.dispatchWorkgroups(R),e.setPipeline(D.pipeline),e.dispatchWorkgroups(R);e.end()}e.queue.submit([l.finish()]);let u=e.createCommandEncoder({label:`ulg-md-final-step`});ae({collectTelemetry:n,scaleVel:s,useThermostat:o});let d=u.beginComputePass({label:`ulg-md-final-pass`});if(d.setBindGroup(0,te),n&&(d.setPipeline(C.pipeline),d.dispatchWorkgroups(2)),d.setPipeline(w.pipeline),d.dispatchWorkgroups(R),i===Se.MORSE_EAM&&(d.setPipeline(T.pipeline),d.dispatchWorkgroups(R)),d.setPipeline(E.pipeline),d.dispatchWorkgroups(R),d.setPipeline(D.pipeline),d.dispatchWorkgroups(R),d.end(),n&&u.copyBufferToBuffer(F,0,I,0,Te*4),e.queue.submit([u.finish()]),re+=a,!n)return null;await I.mapAsync(V.MAP_READ);let h=new Int32Array(I.getMappedRange().slice(0,Te*4));I.unmap();let g=h[0]/1e4,y=h[1]/1e4,b=g+y,x=h[2]/1e4,S=h[3]/(1e6*_),ee=[h[4]/1e4,h[5]/1e4,h[6]/1e4],O=v[0]*v[1]*v[2],k=Math.max(1,3*_-3),A=2*g/(k*we);L=Number.isFinite(A)&&A>0?A:L;let j=(2*g+x)/(3*O)*160.2176634,M=[h[7]/1e4/O*160.2176634,h[8]/1e4/O*160.2176634,h[9]/1e4/O*160.2176634],N=new Float32Array(64),P=c/64,ne=_/O;for(let e=0;e<64;e+=1){let t=(e+.5)*P,n=4*Math.PI*t*t*P,r=Math.max(1e-9,_*ne*n);N[e]=h[16+e]/r}return Object.freeze({schema:xe,backend:`webgpu`,totalSteps:re,timeFs:re*f,atomCount:_,kineticEnergyEv:g,potentialEnergyEv:y,totalEnergyEv:b,temperatureK:A,pressureGPa:j,msdA2:S,momentum:ee,stressOffDiagGPa:M,rdf:N})}async function oe(){let t=_*16,n=e.createBuffer({size:t,usage:V.MAP_READ|V.COPY_DST}),r=e.createBuffer({size:t,usage:V.MAP_READ|V.COPY_DST}),i=e.createCommandEncoder({label:`ulg-md-read-pos-vel`});i.copyBufferToBuffer(A,0,n,0,t),i.copyBufferToBuffer(j,0,r,0,t),e.queue.submit([i.finish()]);try{await Promise.all([n.mapAsync(V.MAP_READ),r.mapAsync(V.MAP_READ)]);let e=new Float32Array(n.getMappedRange().slice(0,t)),i=new Float32Array(r.getMappedRange().slice(0,t));return n.unmap(),r.unmap(),{positions:e,velocities:i}}finally{n.destroy(),r.destroy()}}return Object.freeze({schema:xe,atomCount:_,boxLengthsA:Object.freeze([...v]),positionsBuffer:A,velocitiesBuffer:j,forcesBuffer:M,stepBatch:z,readPositionsAndVelocities:oe,destroy(){for(let e of[k,A,j,M,N,P,F,I])e.destroy()}})}function Oe({crystalStructure:e=`fcc`,cellsPerSide:t=3,latticeConstantA:n=4.05,massU:r=26.982,temperatureK:i=300,seed:a=1337}={}){let o=Math.max(2,Math.trunc(t)),s=Number(n),c=String(e||`fcc`).toLowerCase(),l,u=[1,1,1];if(c===`bcc`||c.startsWith(`cscl`))l=[[0,0,0],[.5,.5,.5]];else if(c===`diamond`||c.startsWith(`zincblende`))l=[[0,0,0],[.5,.5,0],[.5,0,.5],[0,.5,.5],[.25,.25,.25],[.75,.75,.25],[.75,.25,.75],[.25,.75,.75]];else if(c===`hcp`){let e=s/Math.SQRT2;u=[e/s,Math.sqrt(3)*e/s,1.632993*e/s],l=[[0,0,0],[.5,.5,0],[0,1/3,.5],[.5,5/6,.5]]}else l=[[0,0,0],[.5,.5,0],[.5,0,.5],[0,.5,.5]];let d=l.length*o*o*o,f=new Float32Array(d*4),p=new Float32Array(d*4),m=a>>>0,h=()=>(m=Math.imul(1664525,m)+1013904223>>>0,(m+.5)/4294967296),g=()=>Math.sqrt(-2*Math.log(h()))*Math.cos(2*Math.PI*h()),_=Math.sqrt(Math.max(1e-9,we*i/Math.max(r,1e-6))),v=s*u[0],y=s*u[1],b=s*u[2],x=0,S=0,C=0,w=0;for(let e=0;e<o;e+=1)for(let t=0;t<o;t+=1)for(let n=0;n<o;n+=1)for(let[i,a,o]of l){f[x*4+0]=(e+i)*v,f[x*4+1]=(t+a)*y,f[x*4+2]=(n+o)*b,f[x*4+3]=0;let s=g()*_,c=g()*_,l=g()*_;p[x*4+0]=s,p[x*4+1]=c,p[x*4+2]=l,p[x*4+3]=r,S+=s,C+=c,w+=l,x+=1}S/=d,C/=d,w/=d;let T=0;for(let e=0;e<d;e+=1){p[e*4+0]-=S,p[e*4+1]-=C,p[e*4+2]-=w;let t=p[e*4+0],n=p[e*4+1],i=p[e*4+2];T+=.5*r*(t*t+n*n+i*i)}let E=.5*(3*d-3)*we*i,D=T>0?Math.sqrt(E/T):0;for(let e=0;e<d;e+=1)p[e*4+0]*=D,p[e*4+1]*=D,p[e*4+2]*=D;return{crystalStructure:c,atomCount:d,positions:f,velocities:p,boxLengthsA:[o*v,o*y,o*b]}}var ke=`ulg.thermodynamic.element-md-webgpu.v1`,Ae=1380649e-29,je=602214076e15,Me=1602176634e-28,Ne=8.314462618,Pe=2.44300455e-8;function Fe(e,t,n){let r=Math.max(.5,Number(e)),i=Math.max(1,Number(t)),a=i/r,o=0,s=a/32;for(let e=0;e<32;e+=1){let t=(e+.5)*s;if(t>60)continue;let n=Math.exp(t);o+=t*t*t*t*n/((n-1)*(n-1))*s}return 9*Ae*(r/i)**3*o/Math.max(1e-30,n)}function Ie({Z:e,bulkResult:t}){let n=t.crystalStructure,r=Math.max(2,t.latticeConstantA),i=Math.max(.005,t.cohesiveEnergyEv),a=t.coordinationNumber||12,o=n===`bcc`?r*Math.sqrt(3)/2:n===`diamond`?r*Math.sqrt(3)/4:r/Math.SQRT2;if(n===`vdw-fcc`){let e=o/2**(1/6),t=Math.max(5e-4,i/8.61);return Object.freeze({potentialModel:Se.LENNARD_JONES,modelName:`shifted-force-lj-london`,epsilonEv:t,sigmaOrR0A:e,alphaOrLambda:0,rcutA:Math.min(r*1.45,e*2.5),eamAEv:0,eamBeta:0,swGamma:0,rNearestNeighborA:o})}if(n===`diamond`){let e=o/1.1225,t=Math.max(.2,i/2);return Object.freeze({potentialModel:Se.STILLINGER_WEBER,modelName:`stillinger-weber-sp3`,epsilonEv:t,sigmaOrR0A:e,alphaOrLambda:21,rcutA:Math.min(r*1.35,e*1.8),eamAEv:0,eamBeta:0,swGamma:1.2,rNearestNeighborA:o})}let s=(t.bulkModulusPa||5e10)/160217663400,c=r**3/(n===`bcc`?2:4),l=.55*i/(.5*a),u=.45*i/Math.sqrt(a),d=Math.max(.9,Math.min(2.6,Math.sqrt(Math.max(.1,9*s*c/Math.max(1e-4,a*l*o*o))))),f=o*(1+.24/d);return Object.freeze({potentialModel:Se.MORSE_EAM,modelName:`morse-finnis-sinclair-eam`,epsilonEv:l,sigmaOrR0A:f,alphaOrLambda:d,rcutA:Math.min(r*1.45,o*1.85),eamAEv:u,eamBeta:d*1.05,swGamma:0,rNearestNeighborA:o})}async function Le(e,{Z:t,atomicMassU:n=null,bulkResult:r,emResult:i,temperatureK:a=300,runLiveMd:o=!0,mdSteps:c=20,mdCellsPerSide:u=3}={}){let d=Number(n),f=Number.isFinite(d)&&d>0?d:s[t-1]||l(t)/16605390666e-37,p=f*16605390666e-37,m=f*.001,h=Ie({Z:t,bulkResult:r}),_=Math.max(15,r.debyeTemperatureK),v=r.cohesiveEnergyEv*Me,y=h.rNearestNeighborA*1e-10,b=p*(Ae*_/1054571817e-43)**2*(.095*y)**2/(9*Ae),x=r.crystalStructure===`vdw-fcc`?.68*h.epsilonEv*Me/Ae:.029*v/Ae,S=Math.min(.35*x,.085*_),C=r.crystalStructure===`vdw-fcc`?Math.max(1.5,x-S):Math.max(1.5,.55*x+.45*Math.min(x*1.8,b)-.15*S),w=Math.max(1,Math.min(4200,C)),T=Math.max(1500,v*je*(r.crystalStructure===`vdw-fcc`?.92:.88)),E=Math.max(w*1.15+2,T/88),D=Ne*1.15*w/m,ee=T/m,O=Fe(a,_,p)+(i?.isMetal?Math.PI*Math.PI/3*Ae*Ae*((r.dosAtFermiStatesPerEvAtom||.5)/Me)/p:0)*a,k=r.crystalStructure===`diamond`?.85:1.75,A=k*O*r.densityKgPerM3/Math.max(1e6,r.bulkModulusPa),j=O+a*r.bulkModulusPa*A*A/Math.max(1,r.densityKgPerM3),M=null;if(o&&e&&typeof e.createBuffer==`function`){let t=Math.max(10,Math.min(a,.65*w)),n=De(e,{...Oe({crystalStructure:r.crystalStructure,cellsPerSide:u,latticeConstantA:Math.max(2.2,r.latticeConstantA),massU:f,temperatureK:t}),potentialModel:h.potentialModel,epsilonEv:h.epsilonEv,sigmaOrR0A:h.sigmaOrR0A,alphaOrLambda:h.alphaOrLambda,rcutA:h.rcutA,eamAEv:h.eamAEv,eamBeta:h.eamBeta,swGamma:h.swGamma,dtFs:Math.min(2,Math.max(.4,.08*Math.sqrt(f))),targetTemperatureK:t,thermostatCouplingFs:40});try{M=await n.stepBatch(c,{readTelemetry:!0,temperatureK:t})}finally{n.destroy()}}let N=w;if(M&&Number.isFinite(M.temperatureK)&&M.temperatureK>0){let e=Math.max(0,Number(M.msdA2)||0),t=Math.max(1.2,h.rNearestNeighborA),n=Math.sqrt(e)/t;if(n>1e-4&&n<.45){let e=M.temperatureK*(.1/Math.max(.015,n))**2,t=Math.max(.85,Math.min(1.15,e/Math.max(1,w)));N=Math.max(1,Math.min(4200,w*(.85+.15*t)))}}let P=N,F=Math.max(P*1.15+2,E),I=r.densityKgPerM3*(r.crystalStructure===`diamond`?1.05:.92),te=Math.max(a,w*1.05),ne=Math.max(1e-5,18e-8*Math.sqrt(f*w)/(m/Math.max(1,I)*1e6)**(2/3)*Math.exp(2.6*(w/te-1))),L=Math.max(18e-11,h.rNearestNeighborA*92e-12),re=5/(16*Math.sqrt(Math.PI))*Math.sqrt(p*Ae*Math.max(a,E))/(L*L),ie=(p/Math.max(1,I))**(2/3),ae=Math.max(.001,.16*v/Math.max(1e-21,ie)),R=i?.isMetal?Pe*(i.electricalConductivitySPerM||0)*a:0,z=Math.max(.02,31e-9*f*Math.cbrt(p/Math.max(1,r.densityKgPerM3))*1e10*_**3/Math.max(1,k*k*a)),oe=Math.min(2500,R+Math.min(400,z)),se=1/I-1/r.densityKgPerM3,ce=Math.max(-60,Math.min(180,w*se/Math.max(1e3,D)*101325*Math.LN10)),B=Math.max(5,Math.min(900,Ne*E*E*Math.LN10/Math.max(1e3,T)));return Object.freeze({schema:ke,backend:M?`webgpu-md+qha`:`qha-analytical`,Z:t,temperatureK:a,potential:h,heatCapacityCvJPerKgK:O,heatCapacityCpJPerKgK:j,thermalExpansionVolPerK:A,meltingPointK:P,boilingPointK:F,latentHeatFusionJPerKg:D,latentHeatVaporizationJPerKg:ee,meltingSlopeKPerLogP:ce,boilingSlopeKPerLogP:B,liquidDensityKgPerM3:I,dynamicViscosityLiquidPaS:ne,dynamicViscosityGasPaS:re,surfaceTensionNPerM:ae,thermalConductivityWPerMK:oe,kElectronicWPerMK:R,kPhononWPerMK:Math.min(400,z),mdTelemetry:M,accuracyTier:t<=100?g.TIER_2_REPRESENTATIVE_EFFECTIVE:g.TIER_3_THEORETICAL_ENVELOPE,provenance:Object.freeze({status:M?`webgpu-derived`:`reduced-estimate`,scientificValidation:!1,model:`dft-fitted-md-qha-wiedemann-franz-andrade`})})}var Re=`ulg-periodic-table-engine-webgpu.v1`,ze=Object.freeze({1:{symbol:`H`,bPerAMeV:0,rhoKgM3:88,meltingK:14.01,boilingK:20.28,mag:`diamagnetic`},2:{symbol:`He`,bPerAMeV:7.074,rhoKgM3:145,meltingK:.95,boilingK:4.22,mag:`diamagnetic`},6:{symbol:`C`,bPerAMeV:7.68,rhoKgM3:3515,meltingK:3823,boilingK:4300,mag:`diamagnetic`},10:{symbol:`Ne`,bPerAMeV:8.032,rhoKgM3:1444,meltingK:24.56,boilingK:27.07,mag:`diamagnetic`},11:{symbol:`Na`,bPerAMeV:8.111,rhoKgM3:968,meltingK:370.9,boilingK:1156,mag:`paramagnetic`},13:{symbol:`Al`,bPerAMeV:8.332,rhoKgM3:2700,meltingK:933.5,boilingK:2792,mag:`paramagnetic`},14:{symbol:`Si`,bPerAMeV:8.448,rhoKgM3:2329,meltingK:1687,boilingK:3538,mag:`diamagnetic`},18:{symbol:`Ar`,bPerAMeV:8.595,rhoKgM3:1623,meltingK:83.8,boilingK:87.3,mag:`diamagnetic`},26:{symbol:`Fe`,bPerAMeV:8.79,rhoKgM3:7874,meltingK:1811,boilingK:3134,mag:`ferromagnetic`},29:{symbol:`Cu`,bPerAMeV:8.752,rhoKgM3:8960,meltingK:1358,boilingK:2835,mag:`diamagnetic`},47:{symbol:`Ag`,bPerAMeV:8.554,rhoKgM3:10490,meltingK:1235,boilingK:2435,mag:`diamagnetic`},79:{symbol:`Au`,bPerAMeV:8,rhoKgM3:19300,meltingK:1337,boilingK:3129,mag:`diamagnetic`},80:{symbol:`Hg`,bPerAMeV:7.921,rhoKgM3:13534,meltingK:234.3,boilingK:629.9,mag:`diamagnetic`},82:{symbol:`Pb`,bPerAMeV:7.867,rhoKgM3:11340,meltingK:600.6,boilingK:2022,mag:`diamagnetic`},92:{symbol:`U`,bPerAMeV:7.57,rhoKgM3:19050,meltingK:1405,boilingK:4404,mag:`paramagnetic`}});function Be(e,t){let n=ze[e]||null;if(!n)return Object.freeze({g7Advisory:!0,hasReference:!1,note:e>100?`Superheavy element: no experimental bulk properties exist (tier-3 theoretical prediction).`:`No checked-in G7 snapshot benchmark row for this Z.`});let r=(e,t)=>t>0?Math.abs(e-t)/t:Math.abs(e-t);return Object.freeze({g7Advisory:!0,hasReference:!0,bindingPerNucleonRelErr:r(t.nuclear.bindingPerNucleonMeV,n.bPerAMeV),densityRelErr:r(t.mechanical.densityKgPerM3,n.rhoKgM3),meltingRelErr:r(t.thermodynamic.meltingPointK,n.meltingK),boilingRelErr:r(t.thermodynamic.boilingPointK,n.boilingK),magneticPhaseMatch:t.electromagnetic.magneticPhase===n.mag,reference:n})}async function Ve(e,t,{massNumberA:n=null,temperatureK:r=300,runNuclearGpuVolume:i=!0,runLiveMd:o=!0,mdSteps:s=16,mdCellsPerSide:l=3,atomicMaxScf:p=55,atomicGridPointsN:h=256,nuclearVolDim:_=24,blochGridN:v=16,functional:y=`pbe`,scalarRelativistic:b=!0,spinOrbit:x=!0,returnOrbitalWavefunctions:S=!1}={}){let w=Math.trunc(Number(t));if(!(w>=1&&w<=118))throw RangeError(`Element atomicNumberZ out of range 1..118: ${t}`);let E=u(w),D=i?await C(e,w,n,{volDim:_}):T(w,n),ee=c(w),k=ee.map(e=>({...e})),A=(e,t)=>{let n=Math.max(e,t+1);for(;k.some(e=>e.n===n&&e.l===t);)n+=1;k.push({n,l:t,occupancy:0})};for(let e of ee)e.occupancy>0&&e.l>=2&&(e.l-1>=0&&A(e.n+1,e.l-1),e.l+1<=4&&A(e.n+1,e.l+1));k.sort((e,t)=>e.n+e.l-(t.n+t.l)||e.n-t.n||e.l-t.l);let j=await O(e,w,{functional:y,spinOrbit:x,scalarRelativistic:b,configuration:k,nuclearChargeRadiusBohr:D.chargeRadiusBohr,nuclearMassU:D.atomicMassU,nuclearSpinI:D.spinI,nuclearMagneticMomentMuN:D.magneticMomentMuN,gridPointsN:h,rMinBohr:Math.min(1e-4,Math.max(1e-5,D.chargeRadiusBohr*.5)),maxScf:p,returnRadialDensity:!0,returnOrbitalWavefunctions:S}),M=await le(e,w,j,{densityGridN:v,atomicMassU:D.atomicMassU}),N=await be(e,{Z:w,atomResult:j,bulkResult:M,temperatureK:r}),P=await Le(e,{Z:w,atomicMassU:D.atomicMassU,bulkResult:M,emResult:N,temperatureK:r,runLiveMd:o,mdSteps:s,mdCellsPerSide:l}),F=w>100?g.TIER_3_THEORETICAL_ENVELOPE:M.accuracyTier===g.TIER_1_QUANTITATIVE?g.TIER_1_QUANTITATIVE:g.TIER_2_REPRESENTATIVE_EFFECTIVE,I=m({materialKey:n==null?E:D.isotope,symbol:E,atomicNumber:w,massNumberA:D.A,isotope:D.isotope,family:`element`,accuracyTier:F,generatorFingerprint:Re,nuclear:{isotope:D.isotope,Z:D.Z,N:D.N,A:D.A,bindingEnergyMeV:D.bindingEnergyMeV,bindingPerNucleonMeV:D.bindingPerNucleonMeV,atomicMassU:D.atomicMassU,massExcessMeV:D.massExcessMeV,chargeRadiusFm:D.chargeRadiusFm,chargeRadiusBohr:D.chargeRadiusBohr,spinI:D.spinI,parity:D.parity,shellLabel:D.shellLabel,magneticMomentMuN:D.magneticMomentMuN,fissility:D.fissility,fissionBarrierMeV:D.fissionBarrierMeV,qAlphaMeV:D.qAlphaMeV,qBetaMinusMeV:D.qBetaMinusMeV,qElectronCaptureMeV:D.qElectronCaptureMeV,dominantMode:D.dominantMode,daughterZ:D.daughterZ,daughterA:D.daughterA,log10HalfLifeS:D.log10HalfLifeS},atomic:{configurationString:d(w),configuration:c(w),spinConfiguration:a(w),unpairedElectrons:f(w),totalEnergyHa:j.totalEnergyHa,qedRadiativeShiftHa:j.qedRadiativeShiftHa??0,reducedMassFactor:j.reducedMassFactor??1,isotopeMassShiftHa:j.isotopeMassShiftHa??0,hyperfineSplittingHz:j.hyperfineSplittingHz??0,finiteNucleusUsed:!!j.finiteNucleusUsed,relativisticMethod:j.relativisticMethod,resolverStatus:j.resolverStatus,perScfCpuReadbacks:j.perScfCpuReadbacks,integratedElectrons:j.integratedElectrons,orbitals:j.orbitals},electromagnetic:{isMetal:N.isMetal,bandGapEv:N.bandGapEv,fermiEnergyEv:M.fermiEnergyEv,dosAtFermiStatesPerEvAtom:M.dosAtFermiStatesPerEvAtom,plasmaEnergyEv:N.plasmaEnergyEv,drudeDampingEv:N.drudeDampingEv,interbandOscillators:N.interbandOscillators,workFunctionEv:N.workFunctionEv,electricalConductivitySPerM:N.electricalConductivitySPerM,electricalResistivityOhmM:N.electricalResistivityOhmM,staticDielectricConstant:N.staticDielectricConstant,magneticPhase:N.magneticPhase,stonerProduct:N.stonerProduct,magneticMomentMuB:N.magneticMomentMuB,curieOrNeelTempK:N.curieOrNeelTempK,magneticSusceptibilitySi:N.magneticSusceptibilitySi,superconductingTcK:N.superconductingTcK,opticalSrgb:N.opticalSrgb,refractiveIndex550Nm:N.refractiveIndex550Nm,reflectance550Nm:N.reflectance550Nm,spectralWavelengthsNm:N.spectralWavelengthsNm,spectralReflectance:N.spectralReflectance,spectralNRe:N.spectralNRe,oscillatorSource:N.provenance?.oscillatorSource??`none`},mechanical:{crystalStructure:M.crystalStructure,spaceGroup:M.spaceGroup,coordinationNumber:M.coordinationNumber,latticeConstantA:M.latticeConstantA,densityKgPerM3:M.densityKgPerM3,cohesiveEnergyEv:M.cohesiveEnergyEv,bulkModulusPa:M.bulkModulusPa,shearModulusPa:M.shearModulusPa,poissonRatio:M.poissonRatio,elasticConstantsGPa:M.elasticConstantsGPa,soundSpeedLongMPerS:M.soundSpeedLongMPerS,soundSpeedTransMPerS:M.soundSpeedTransMPerS,debyeTemperatureK:M.debyeTemperatureK},thermodynamic:{temperatureK:r,heatCapacityCvJPerKgK:P.heatCapacityCvJPerKgK,heatCapacityCpJPerKgK:P.heatCapacityCpJPerKgK,thermalExpansionVolPerK:P.thermalExpansionVolPerK,meltingPointK:P.meltingPointK,boilingPointK:P.boilingPointK,latentHeatFusionJPerKg:P.latentHeatFusionJPerKg,latentHeatVaporizationJPerKg:P.latentHeatVaporizationJPerKg,meltingSlopeKPerLogP:P.meltingSlopeKPerLogP,boilingSlopeKPerLogP:P.boilingSlopeKPerLogP,liquidDensityKgPerM3:P.liquidDensityKgPerM3,dynamicViscosityLiquidPaS:P.dynamicViscosityLiquidPaS,dynamicViscosityGasPaS:P.dynamicViscosityGasPaS,surfaceTensionNPerM:P.surfaceTensionNPerM,thermalConductivityWPerMK:P.thermalConductivityWPerMK,potentialModel:P.potential.modelName,mdEnergyEv:P.mdTelemetry?.totalEnergyEv??null,mdTempK:P.mdTelemetry?.temperatureK??null,mdPressureGPa:P.mdTelemetry?.pressureGPa??null,mdMsdA2:P.mdTelemetry?.msdA2??null},provenance:{status:N.provenance?.status===`hybrid-webgpu-spectral-cpu-oscillators`?`hybrid-webgpu-spectral-cpu-oscillators`:`webgpu-derived`,scientificValidation:!1,extrapolationPolicy:`fail-closed`}}),te=Be(w,I);return Object.freeze({bundle:I,g7Advisory:te,visualData:Object.freeze({nuclear:D,atom:j,bulk:M,em:N,thermo:P})})}var He=`ulg.compound.recursive-pipeline-webgpu.v1`,Ue=`ulg-recursive-compound-feedback-webgpu.v1`,We=602214076e15,Ge=8.314462618,Ke=1602176634e-28,qe=1602176634e-28,Je=88541878128e-22,Ye=529177210903e-22;function Xe(e){let t=c(e),n=t.reduce((e,t)=>Math.max(e,t.n),0);if(n===1)return!0;let r=t.find(e=>e.n===n&&e.l===1)?.occupancy??0;return r>0&&(r>=n||n===2&&r>=1||n===3&&r>=2||n>=6&&r>=5)}var Ze=Object.freeze([{id:`rocksalt-B1`,spaceGroup:`Fm-3m (225)`,madelung:1.74756,coord:6,packing:.68,stoich:`AB`},{id:`cscl-B2`,spaceGroup:`Pm-3m (221)`,madelung:1.76267,coord:8,packing:.72,stoich:`AB`},{id:`zincblende-B3`,spaceGroup:`F-43m (216)`,madelung:1.63806,coord:4,packing:.56,stoich:`AB`},{id:`fluorite-C1`,spaceGroup:`Fm-3m (225)`,madelung:2.51939,coord:8,packing:.66,stoich:`AB2`},{id:`rutile-C4`,spaceGroup:`P4_2/mnm (136)`,madelung:2.408,coord:6,packing:.62,stoich:`AB2`},{id:`corundum-D51`,spaceGroup:`R-3c (167)`,madelung:4.1719,coord:6,packing:.65,stoich:`A2B3`}]);function Qe(e){let t=c(e).reduce((e,t)=>Math.max(e,t.n),1),n=1+.55*(Math.max(1,o(e))-1)+(t>3?.8:0);return Math.max(.65,Math.min(4.8,t*t/n*.72))}function $e(e){let t=c(e),n=t.reduce((e,t)=>Math.max(e,t.n),1);if(n===1)return e===1?2.2:3.2;let r=0,i=0,a=0;for(let e of t)e.n===n&&(e.l===0||e.l===1)?r+=e.occupancy:e.n===n-1?i+=e.occupancy:a+=e.occupancy;let o=.35*Math.max(0,r-1)+.85*i+1*a,s=Math.max(1,e-o),l=n<=3?n:3.4+.3*(n-3),u=Math.max(.55,Math.min(2.6,.385*l*l/s**.68));return Math.max(.7,Math.min(4,.359*(s/(u*u))+.744))}function et(e){let t=S(e).elements.map(e=>({sym:e.symbol,Z:e.Z,count:e.count}));if(t.length===0)throw RangeError(`Cannot parse formula: ${e}`);let n=[];for(let e of t)for(let t=0;t<e.count&&n.length<12;t+=1)n.push({sym:e.sym,Z:e.Z,r:Qe(e.Z)});if(n.length===1)return[{Z:n[0].Z,x:0,y:0,z:0}];if(n.length===2){let e=Math.max(1.4,(n[0].r+n[1].r)*.88);return[{Z:n[0].Z,x:-.5*e,y:0,z:0},{Z:n[1].Z,x:.5*e,y:0,z:0}]}n.sort((e,t)=>t.Z-e.Z);let r=n[0],i=n.slice(1),a=[[.8165,.5774,0],[-.8165,.5774,0],[0,-.5774,.8165],[0,-.5774,-.8165],[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],[.577,.577,.577]],s=o(r.Z),c=i.length===2&&(s===4||s===2),l=[{Z:r.Z,x:0,y:0,z:0}];for(let e=0;e<i.length;e+=1){let t=i[e],n=Math.max(1.6,(r.r+t.r)*.86),o=a[e%a.length];c&&(o=e===0?[1,0,0]:[-1,0,0]),l.push({Z:t.Z,x:o[0]*n,y:o[1]*n,z:o[2]*n})}return l}async function tt(e,t,{temperatureK:n=300,runLiveMd:r=!0,mdSteps:i=12,mdCellsPerSide:a=3,reactionContext:c=null}={}){let l=String(t||``).trim(),u=S(l),d=u.elements.map(e=>({sym:e.symbol,Z:e.Z,count:e.count})),f=u.sites,p=Object.fromEntries(d.map(e=>[e.sym,e.count]));if(d.length===0)throw RangeError(`Invalid compound formula: ${t}`);let h=0,_=0,v=0,y=0,b=0,x=0,C=!0,w=1/0,E=-1/0,D=0;for(let e of f){let t=T(e.Z,e.A);h+=e.Z*e.count,_+=t.A*e.count,v+=t.bindingEnergyMeV*e.count,y+=e.atomicMassU*e.count,b+=(s[e.Z-1]||t.atomicMassU)*e.count,x=Math.max(x,t.chargeRadiusFm),D+=e.count,Xe(e.Z)||(C=!1);let n=$e(e.Z);n<w&&(w=n),n>E&&(E=n)}let O=y/Math.max(1e-6,b),k=0,A=0;for(let e of f)e.Z===1&&(k+=e.atomicMassU*e.count,A+=e.count);let j=A>0?k/A:s[0],M=Math.max(0,E-w),P=1-Math.exp(-.25*M*M),F=!C&&P>=.3,I=!C&&!F,te=y*.001,ne=te/We,L=null,re=D<=10&&d.every(e=>e.Z<=36)&&h%2==0;if(e&&typeof e.createBuffer==`function`&&re){let t=et(l);try{L=await ee(e,t,{maxScf:25,volDim:20})}catch{L=null}}let ie=`molecular-fcc`,ae=`P1 (molecular)`,R=4.5,z=1e3,oe=22e8,se=0,ce=.45,B=L?Math.max(1.2,L.homoLumoGapEv*.65):5.5,le=I,ue=273,de=373,fe=260;if(F){let e=d.map(e=>e.count).sort((e,t)=>e-t),t=e.length>=2&&e[0]===1&&e[1]===2?`AB2`:e.length>=2&&e[0]===2&&e[1]===3?`A2B3`:`AB`,n=Ze.filter(e=>e.stoich===t),r=d.reduce((e,t)=>e+Qe(t.Z)*Ye*t.count,0)/D*2.15,i=Math.max(1,Math.min(6,d.length>=2?1+Math.floor(P*2.2):1)),a=n[0]||Ze[0],o=1/0;for(let e of n.length?n:Ze){let t=-(e.madelung*i*qe*qe/(4*Math.PI*Je*r))*(1-1/9);t<o&&(o=t,a=e)}ie=a.id,ae=a.spaceGroup,ce=Math.max(1.8,Math.min(14,Math.abs(o)/Ke));let s=Math.max(15e-30,d.reduce((e,t)=>e+4*Math.PI/3*(Qe(t.Z)*Ye*1.12)**3*t.count,0)/a.packing);z=Math.max(600,Math.min(24e3,ne/s)),R=Math.cbrt(s*4)*1e10,oe=Math.max(8e9,8*Math.abs(o)/(9*s)),se=.44*oe,B=Math.max(2.5,Math.min(11.5,3.2+5.5*P)),le=!1,fe=Math.max(150,Math.min(950,120*Math.sqrt(oe*1e-9/(z*.001)))),ue=Math.max(450,Math.min(3100,185*ce+120)),de=Math.max(ue*1.45,ue+550)}else if(I){ie=`fcc-alloy`,ae=`Fm-3m (225)`;let e=d.reduce((e,t)=>e+4*Math.PI/3*(Qe(t.Z)*Ye*1.22)**3*t.count,0),t=d.reduce((e,t)=>e+Math.max(1,o(t.Z))*t.count,0)/Math.max(1,D),n=Math.cbrt(e/Math.max(1,D)*3/(4*Math.PI))/Ye;z=Math.max(600,Math.min(24e3,ne/Math.max(1e-29,e))),R=Math.cbrt(e/Math.max(1,D)*4)*1e10,ce=Math.max(.6,Math.min(9.5,1.45*t/Math.max(1.4,n)*D*.65)),oe=Math.max(5e9,1.9*ce*Ke/Math.max(1e-29,e)),se=.44*oe,B=0,le=!0,fe=Math.max(60,Math.min(1200,118*Math.sqrt(oe*1e-9/(z*.001)))),ue=Math.max(250,Math.min(3600,360*ce/Math.max(1,D)+120)),de=Math.max(ue*1.5,ue+600)}else{let e=L?.dipoleDebye??(M>.3?1.4*M:0),t=!!p.H,r=!!(p.N||p.O||p.F),i=t&&r?.21*Math.min(p.H,2*((p.N||0)+(p.O||0)+(p.F||0))):0,a=i>0?i*.095*(1-Math.sqrt(s[0]/Math.max(.5,j))):0,o=.012*b**.72+.045*e*e;ce=Math.max(.01,o+i+a);let c=Math.max(13e-11,d.reduce((e,t)=>e+(Qe(t.Z)*Ye)**3*t.count,0)**(1/3)*1.65),l=4*Math.PI/3*c**3/.56;z=Math.max(40,Math.min(4500,ne/Math.max(1e-29,l))),R=Math.cbrt(l*4)*1e10,oe=Math.max(2e8,ce*Ke/Math.max(1e-29,l)*1.8),ue=Math.max(12,Math.min(600,460*ce+12)),se=n<ue?.35*oe:0,de=Math.max(ue*1.2+5,ce*Ke*We/96),fe=Math.max(60,Math.min(450,ue*.9/Math.sqrt(Math.max(.2,O))))}let pe=null;e&&typeof e.createBuffer==`function`&&(pe=(await N(e,[le?{mode:0,conductionElectronDensityPerM3:Math.max(1e27,z/Math.max(1e-27,ne)*D),interbandOscillators:[],pathLengthM:.2}:{mode:2,electronicGapEv:Math.max(.25,B),pathLengthM:.2}]))?.results?.[0]??null);let me=Math.max(15,Math.min(n,.65*ue)),he=ne/Math.max(1,z)*1e30,ge=ie.startsWith(`cscl`)||ie===`bcc`?2:ie.startsWith(`zincblende`)||ie===`diamond`?8:4,_e=Math.max(2.6,Math.min(9.5,Math.cbrt(he*ge))),ve=_e*(ge===2?Math.sqrt(3)/2:ge===8?Math.sqrt(3)/4:1/Math.SQRT2),ye=Object.freeze({crystalStructure:ie,latticeConstantA:_e,massU:Math.max(2,y),potentialModel:F?Se.MORSE_EAM:Se.LENNARD_JONES,modelName:F?`Morse+EAM (Ionic Lattice)`:`Lennard-Jones (Molecular/Dispersion)`,epsilonEv:Math.max(.005,Math.min(1.5,ce/8)),sigmaOrR0A:F?Math.max(1.8,ve*1.08):Math.max(1.8,ve/2**(1/6)),alphaOrLambda:1.4,eamAEv:F?ce*.2:0,eamBeta:1.4,rcutA:Math.max(4.5,_e*1.25),dtFs:Math.min(2,Math.max(.5,.14*Math.sqrt(Math.max(2,y)))),defaultTemperatureK:me}),be=null;if(r&&e&&typeof e.createBuffer==`function`){let t=De(e,{...Oe({crystalStructure:ye.crystalStructure,cellsPerSide:a,latticeConstantA:ye.latticeConstantA,massU:ye.massU,temperatureK:me}),potentialModel:ye.potentialModel,epsilonEv:ye.epsilonEv,sigmaOrR0A:ye.sigmaOrR0A,alphaOrLambda:ye.alphaOrLambda,eamAEv:ye.eamAEv,eamBeta:ye.eamBeta,rcutA:ye.rcutA,dtFs:ye.dtFs,targetTemperatureK:me,thermostatCouplingFs:40});try{be=await t.stepBatch(i,{readTelemetry:!0,temperatureK:me})}finally{t.destroy()}}let xe=Math.max(2e3,ce*Ke*We*.92),V=Ge*1.4*ue/te,Ce=xe/te,we=3*D*Ge/te,Te=z*.92,Ee=1/Math.max(1,Te)-1/Math.max(1,z),ke=Math.max(-40,Math.min(180,ue*Ee/Math.max(1e3,V)*101325*Math.LN10)),Ae=Math.max(8,Math.min(600,Ge*de*de*Math.LN10/xe)),je=pe?.spectralSamples?.find(e=>Math.abs(e.wavelengthNm-550)<=6)||pe?.spectralSamples?.[Math.floor((pe?.spectralSamples?.length||1)/2)]||null,Me=Array.isArray(pe?.baseColorSrgb)&&pe.baseColorSrgb.length===3?pe.baseColorSrgb.map(e=>Math.max(0,Math.min(1,Number(e)||0))):le?[.74,.76,.79]:[.85,.9,.96],Ne=Number.isFinite(je?.nRe)&&je.nRe>0?je.nRe:Math.sqrt(1+(9.5/Math.max(.5,B))**2),Pe=Number.isFinite(je?.reflectance)?je.reflectance:Number.isFinite(pe?.reflectance)?pe.reflectance:le?.72:.04,Fe=le?Math.max(5e5,300/Math.max(50,n)*25e6*(fe/300)):Math.max(1e-16,1e-4*Math.exp(-B/(2*8617e-8*Math.max(100,n)))),Ie=le?2.44300455e-8*Fe*n:0,Le=F?1.5:2,Re=Math.cbrt(ne/Math.max(1,z)/Math.max(1,D))*1e10,ze=Math.max(.04,Math.min(120,y/Math.max(1,D)*31e-9*Re*fe**3/Math.max(1,Le*Le*n*D**(2/3)))),Be=Math.min(1200,Ie+ze),Ve=m({materialKey:u.canonicalIsotopologue,formula:l,canonicalFormula:u.canonicalFormula,canonicalIsotopologue:u.canonicalIsotopologue,hasExplicitIsotopes:u.hasExplicitIsotopes,family:`compound`,accuracyTier:g.TIER_2_REPRESENTATIVE_EFFECTIVE,generatorFingerprint:Ue,nuclear:{totalProtonsZ:h,totalNucleonsA:_,molarMassU:y,isotopeMassRatio:O,totalBindingEnergyMeV:v,maxNuclearRadiusFm:x,stoichiometry:p,isotopologueSites:f},atomic:{molecularRhfSolvedOnGpu:!!L,totalEnergyHa:L?.totalEnergyHa??null,homoLumoGapEv:L?.homoLumoGapEv??B,dipoleDebye:L?.dipoleDebye??0,paulingIonicity:P,mullikenCharges:L?.mullikenCharges??null},electromagnetic:{isMetal:le,bandGapEv:B,plasmaEnergyEv:le?Math.max(1.5,Number(pe?.plasmaEnergyEv)||8):0,drudeDampingEv:le?.45:.08,interbandOscillators:[],electricalConductivitySPerM:Fe,staticDielectricConstant:le?1/0:1+(9.5/Math.max(.5,B))**2+(L?.dipoleDebye??0)**2*18,magneticPhase:h%2==1?`paramagnetic`:`diamagnetic`,opticalSrgb:Me,refractiveIndex550Nm:Ne,reflectance550Nm:Pe,spectralWavelengthsNm:pe?.spectralSamples?.map(e=>e.wavelengthNm)??null,spectralReflectance:pe?.spectralSamples?.map(e=>e.reflectance??0)??null,spectralNRe:pe?.spectralSamples?.map(e=>e.nRe??Ne)??null,spectralAbsorptionPerM:pe?.spectralSamples?.map(e=>e.absorptionPerM??0)??null},mechanical:{crystalStructure:ie,spaceGroup:ae,latticeConstantA:R,densityKgPerM3:z,cohesiveEnergyEv:ce,bulkModulusPa:oe,shearModulusPa:se,debyeTemperatureK:fe},thermodynamic:{temperatureK:n,heatCapacityCvJPerKgK:we*.92,heatCapacityCpJPerKgK:we,meltingPointK:ue,boilingPointK:de,latentHeatFusionJPerKg:V,latentHeatVaporizationJPerKg:Ce,meltingSlopeKPerLogP:ke,boilingSlopeKPerLogP:Ae,liquidDensityKgPerM3:Te,dynamicViscosityLiquidPaS:Math.max(1e-4,4e-4*Math.exp(ue/Math.max(n,ue)*1.8)),surfaceTensionNPerM:Math.max(.005,.14*ce*Ke/(ne/Te)**(2/3)),thermalConductivityWPerMK:Be,mdTempK:be?.temperatureK??null,mdEnergyEv:be?.totalEnergyEv??null,mdPressureGPa:be?.pressureGPa??null},provenance:{status:L||be||pe?`webgpu-derived`:`reduced-estimate`,gpuStagesExecuted:{molecularRhf:!!L,opticalSpectrum:!!pe,molecularDynamics:!!be},scientificValidation:!1,extrapolationPolicy:`fail-closed`,reactionContext:c}});return Object.freeze({schema:He,bundle:Ve,visualData:Object.freeze({molQm:L,optics:pe,mdTelemetry:be,mdConfig:ye})})}function nt(e,t){let n,r;try{n=S(e),r=S(t)}catch{return null}if(n.elements.length!==1||r.elements.length!==1)return null;let i=n.elements[0].Z===1?{f:e,d:n}:r.elements[0].Z===1?{f:t,d:r}:null,a=n.elements[0].Z===8?{f:e,d:n}:r.elements[0].Z===8?{f:t,d:r}:null;if(!i||!a)return null;let o=i.d.sites[0],s=o.A===2?`D`:o.A===3?`T`:`H`,c=i.d.elements[0].count,l=a.d.elements[0].count,u=`${s}2O`,d=c===1&&l===1?1:2,f=2*d/c,p=d/l,m=(e,t)=>e===1?t:`${e} ${t}`;return Object.freeze({familyId:`hydrogen-oxygen-synthesis`,familyLabel:`hydrogen + oxygen -> water synthesis`,equation:`${m(f,i.f)} + ${m(p,a.f)} -> ${m(d,u)}`,reactants:[{coefficient:f,formula:i.f,atomCounts:{1:c}},{coefficient:p,formula:a.f,atomCounts:{8:l}}],products:[{coefficient:d,formula:u,atomCounts:{1:2,8:1}}],productFormula:u,atomBalance:{balanced:!0,reactants:{1:2*d,8:d},products:{1:2*d,8:d}},energetics:{model:`provisional-hydrogen-oxygen-combustion-v0`,provisional:!0,reactionEnthalpyJPerBalancedEquation:-241800*d},sedenionScope:{reactiveClass:`reactive`},scientificValidation:!1})}async function rt(e,t,n={}){let r=Array.isArray(t)?t:[t],i=[];for(let e=0;e<r.length;e+=1)for(let t=e+1;t<r.length;t+=1){let a=D(r[e],r[t],n.discoveryOptions||{});if(Array.isArray(a?.candidates)&&a.candidates.length>0)i.push(...a.candidates);else{let n=nt(r[e],r[t]);n&&i.push(n)}}let a=[],o=new Set;for(let e of i)for(let t of e.products||[]){let e=String(t.formula||t.material||``).trim();e&&!o.has(e)&&(o.add(e),a.push(e))}let s=[];for(let t of a){let i=await tt(e,t,{runLiveMd:n.runLiveMd!==!1,mdSteps:n.mdSteps??10,mdCellsPerSide:n.mdCellsPerSide??2,reactionContext:{source:`discoverAndDeriveReactionProductsWebGpu`,reactants:r}});s.push(i)}return Object.freeze({schema:`ulg.reaction-feedback-pipeline-webgpu.v1`,reactants:Object.freeze([...r]),candidateCount:i.length,candidates:Object.freeze(i),productFormulas:Object.freeze(a),derivedProducts:Object.freeze(s)})}var it=`ulg.electronic.orbital-cloud-webgpu.v1`,at=1/137.035999084,ot=512,st=256,H=Object.freeze({COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128});function ct(e){let t=1;for(let n=2;n<=e;n+=1)t*=n;return t}function lt(e,t){return t<0||t>e?0:ct(e)/(ct(t)*ct(e-t))}function ut(e,t,n){let r=0,i=1;for(let a=0;a<=e;a+=1){let o=a&1?-1:1;r+=o*lt(e+t,e-a)/ct(a)*i,i*=n}return r}function dt(e,t,n){let r=Math.max(-1,Math.min(1,n)),i=1;if(t>0){let e=Math.sqrt(Math.max(0,(1-r)*(1+r))),n=1;for(let r=1;r<=t;r+=1)i*=-n*e,n+=2}if(e===t)return i;let a=r*(2*t+1)*i;if(e===t+1)return a;let o=0;for(let n=t+2;n<=e;n+=1)o=((2*n-1)*r*a-(n+t-1)*i)/(n-t),i=a,a=o;return o}function ft(e,t,n,r){if(!r)return e;let i=0;for(let e=1;e<t;e+=1)i+=2*e*e;let a=Math.max(0,Math.min(2*t*t,e-i)),o=t>1?i-2*(t-1)*(t-1):0,s=t>1?Math.max(0,Math.min(2*(t-1)*(t-1),e-o-a)):0,c=Math.max(0,a-1),l=Math.max(0,e-a-s),u=n<=1?.85:1,d=n>0?.02*((2*n+1)/Math.max(1,t)):0;return Math.max(1,Math.min(e,e-(.35*c+u*s+l)+d))}function pt(e,t,n,r){if(!r)return e;let i=(at*e)**2,a=n<=1?1+i*.36/(Math.max(1,t)*(n+1)):Math.max(.75,1-i*.18/Math.max(1,t));return Math.max(.8,e*a)}function mt({Z:e=26,n:t=3,l:n=2,m:r=0,rGrid:i=null,orbitalU:a=null,screeningExchange:o=!0,relativisticSpinOrbit:s=!0}={}){let c=Math.max(1,Math.min(8,Math.trunc(t))),l=Math.max(0,Math.min(c-1,Math.trunc(n))),u=Math.max(-l,Math.min(l,Math.trunc(r))),d=Math.abs(u),f=new Float32Array(ot),p=new Float32Array(ot),m=new Float32Array(ot),h=new Float32Array(ot),g=Array.isArray(i)&&i.length>=32&&a&&a.length===i.length,_=6,v=`analytic-laguerre-slater`;if(g){v=`webgpu-kohn-sham-eigenstate`;let e=new Float64Array(i.length),t=0;for(let n=0;n<i.length;n+=1){let r=n===0?i[1]-i[0]:n===i.length-1?i[n]-i[n-1]:.5*(i[n+1]-i[n-1]),o=a[n],s=o*o*Math.max(1e-8,r);e[n]=s,t+=s}let n=0;_=Math.max(1.5,i[i.length-1]*.5);for(let r=0;r<i.length;r+=1)if(n+=e[r],n>=t*.994){_=Math.max(.8,Math.min(36,i[r]*1.15));break}let r=0,o=0,s=0,c=0;for(let e=0;e<ot;e+=1){let t=(e+.5)/ot*_;for(f[e]=t;c+1<i.length&&i[c+1]<t;)c+=1;let n=Math.min(i.length-2,c),l=i[n],u=Math.max(l+1e-9,i[n+1]),d=Math.max(0,Math.min(1,(t-l)/(u-l))),g=a[n]*(1-d)+a[n+1]*d,v=g>=0?1:-1;s!==0&&v!==s&&Math.abs(g)>1e-6&&(o+=1),Math.abs(g)>1e-6&&(s=v),r+=g*g,p[e]=r,m[e]=o,h[e]=v}let l=r>0?1/r:1;for(let e=0;e<ot;e+=1)p[e]*=l}else{let t=pt(ft(e,c,l,o),c,l,s),n=(3*c*c-l*(l+1))/(2*Math.max(.5,t));_=Math.max(1.2,Math.min(42,n*2.55+1.4/Math.sqrt(Math.max(1,t))));let r=Math.sqrt((2*t/c)**3*(ct(c-l-1)/(2*c*ct(c+l)))),i=0,a=0,u=0;for(let e=0;e<ot;e+=1){let n=(e+.5)/ot*_;f[e]=n;let o=2*t*n/c,s=ut(c-l-1,2*l+1,o),d=n*(r*Math.exp(-.5*o)*o**+l*s),g=d>=0?1:-1;u!==0&&g!==u&&Math.abs(d)>1e-8&&(a+=1),Math.abs(d)>1e-8&&(u=g),i+=d*d,p[e]=i,m[e]=a,h[e]=g}let d=i>0?1/i:1;for(let e=0;e<ot;e+=1)p[e]*=d}let y=(at*ft(e,c,l,o))**2,b=s&&l>0&&u!==0?y*.28*l/Math.max(1,c*c):0,x=new Float32Array(st),S=new Float32Array(st),C=0;for(let e=0;e<st;e+=1){let t=-1+(e+.5)/st*2,n=dt(l,d,t),r=b>0?Math.max(.35,Math.min(1.65,1+b*t*(u/Math.max(1,l)))):1;C+=n*n*r,x[e]=C,S[e]=n>=0?1:-1}let w=C>0?1/C:1;for(let e=0;e<st;e+=1)x[e]*=w;let T=new Float32Array(ot*4);for(let e=0;e<ot;e+=1)T[e*4+0]=f[e]/Math.max(1e-6,_),T[e*4+1]=p[e],T[e*4+2]=m[e],T[e*4+3]=h[e];let E=new Float32Array(st*2);for(let e=0;e<st;e+=1)E[e*2+0]=x[e],E[e*2+1]=S[e];return Object.freeze({radialPacked:T,polarPacked:E,rExtentBohr:_,n:c,l,m:u,radialNodeCount:Math.max(0,Math.round(m[ot-1])),sourceKind:v})}var ht=`
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
`,gt=`
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
`,_t=new WeakMap;function vt(e){let t=_t.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-orbital-cloud-sampler`,code:ht}),r=e.createComputePipeline({label:`ulg-orbital-cloud-sampler-pipe`,layout:`auto`,compute:{module:n,entryPoint:`sample_orbital_cloud`}}),i=e.createShaderModule({label:`ulg-mol-cloud-sampler`,code:gt});return t={atomPipe:r,molPipe:e.createComputePipeline({label:`ulg-mol-cloud-sampler-pipe`,layout:`auto`,compute:{module:i,entryPoint:`sample_molecular_cloud`}}),atomParamsBuf:e.createBuffer({size:32,usage:H.UNIFORM|H.COPY_DST}),radialTableBuf:e.createBuffer({size:ot*16,usage:H.STORAGE|H.COPY_DST}),polarTableBuf:e.createBuffer({size:st*8,usage:H.STORAGE|H.COPY_DST}),molParamsBuf:e.createBuffer({size:32,usage:H.UNIFORM|H.COPY_DST}),molAzBuf:null,molAzSize:0,molWBuf:null,molWSize:0},_t.set(e,t),t}function yt(e,{Z:t=26,n=3,l:r=2,m:i=0,pointCount:a=25e4,rGrid:o=null,orbitalU:s=null,screeningExchange:c=!0,relativisticSpinOrbit:l=!0,colorMode:u=0,seed:d=1,reuseBuffer:f=null}={}){let p=Math.max(4096,Math.min(5e5,Math.trunc(a))),m=mt({Z:t,n,l:r,m:i,rGrid:o,orbitalU:s,screeningExchange:c,relativisticSpinOrbit:l}),{atomPipe:h,atomParamsBuf:g,radialTableBuf:_,polarTableBuf:v}=vt(e),y=p*16,b=f&&f.size>=y?f:e.createBuffer({label:`ulg-orbital-cloud-pts`,size:y,usage:H.STORAGE|H.VERTEX|H.COPY_SRC}),x=new ArrayBuffer(32),S=new Uint32Array(x),C=new Int32Array(x);S[0]=p>>>0,S[1]=ot>>>0,S[2]=st>>>0,S[3]=d>>>0||1,C[4]=m.m,S[5]=Math.abs(m.m)>>>0,S[6]=u>>>0,S[7]=0,e.queue.writeBuffer(g,0,x),e.queue.writeBuffer(_,0,m.radialPacked),e.queue.writeBuffer(v,0,m.polarPacked);let w=e.createBindGroup({layout:h.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:g}},{binding:1,resource:{buffer:_}},{binding:2,resource:{buffer:v}},{binding:3,resource:{buffer:b}}]}),T=e.createCommandEncoder({label:`ulg-orbital-cloud-sample-enc`}),E=T.beginComputePass();return E.setPipeline(h),E.setBindGroup(0,w),E.dispatchWorkgroups(Math.ceil(p/64)),E.end(),e.queue.submit([T.finish()]),Object.freeze({schema:it,pointsBuffer:b,pointCount:p,rExtentBohr:m.rExtentBohr,n:m.n,l:m.l,m:m.m,radialNodeCount:m.radialNodeCount,sourceKind:m.sourceKind})}function bt(e,{posZeta:t,weights:n,boxHalfBohr:r=4,mode:i=0,pointCount:a=16e4,seed:o=1,reuseBuffer:s=null}={}){if(!t||!n||t.length<4)return null;let c=Math.floor(t.length/4),l=Math.max(4096,Math.min(35e4,Math.trunc(a))),u=vt(e),{molPipe:d,molParamsBuf:f}=u,p=l*16,m=s&&s.size>=p?s:e.createBuffer({label:`ulg-mol-cloud-pts`,size:p,usage:H.STORAGE|H.VERTEX|H.COPY_SRC}),h=Math.max(16,t.byteLength),g=Math.max(16,n.byteLength);(!u.molAzBuf||u.molAzSize<h)&&(u.molAzBuf=e.createBuffer({size:Math.max(256,h),usage:H.STORAGE|H.COPY_DST}),u.molAzSize=Math.max(256,h)),(!u.molWBuf||u.molWSize<g)&&(u.molWBuf=e.createBuffer({size:Math.max(256,g),usage:H.STORAGE|H.COPY_DST}),u.molWSize=Math.max(256,g));let _=new ArrayBuffer(32);new Uint32Array(_,0,4).set([l>>>0,c>>>0,i>>>0,o>>>0||1]),new Float32Array(_,16,4).set([Math.max(1,Number(r)||4),0,0,0]),e.queue.writeBuffer(f,0,_),e.queue.writeBuffer(u.molAzBuf,0,t),e.queue.writeBuffer(u.molWBuf,0,n);let v=e.createBindGroup({layout:d.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:f}},{binding:1,resource:{buffer:u.molAzBuf}},{binding:2,resource:{buffer:u.molWBuf}},{binding:3,resource:{buffer:m}}]}),y=e.createCommandEncoder({label:`ulg-mol-cloud-sample-enc`}),b=y.beginComputePass();return b.setPipeline(d),b.setBindGroup(0,v),b.dispatchWorkgroups(Math.ceil(l/64)),b.end(),e.queue.submit([y.finish()]),Object.freeze({schema:it,pointsBuffer:m,pointCount:l,boxHalfBohr:Math.max(1,Number(r)||4),mode:i,sourceKind:`webgpu-molecular-rhf`})}function xt(e){return!e||typeof e.registerModule!=`function`?null:{orbitalCloudMod:e.registerModule({method:{model:`quantum-orbital-cloud`,version:`1`},kernel:{sourceModule:`src/runtime/electronicStructure/orbitalPointCloudWebGpu.js`,entryPoint:`sample_orbital_cloud`,workgroupSize:64,wgsl:ht},parameterSchema:{Z:{type:`number`,min:1,max:118,required:!0},n:{type:`number`,min:1,max:8,required:!0},l:{type:`number`,min:0,max:7,required:!0},m:{type:`number`,min:-7,max:7},pointCount:{type:`number`,min:4096,max:5e5}},stateLayout:{tensorId:`orbital_points_vec4`,dtype:`f32`,components:4},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`quantum-orbital-cloud@1 requires a WebGPU device`);let r=yt(n,e?.parameters||{});return{status:`ok`,pointCount:r.pointCount,rExtentBohr:r.rExtentBohr,radialNodeCount:r.radialNodeCount,sourceKind:r.sourceKind,pointsBuffer:r.pointsBuffer}}}),tdksPhotonMod:e.registerModule({method:{model:`quantum-tdks-photon`,version:`1`},kernel:{sourceModule:`src/runtime/electronicStructure/orbitalPointCloudWebGpu.js`,entryPoint:`sample_dipole_coupled_pair`,workgroupSize:64,wgsl:St},parameterSchema:{Z:{type:`number`,min:1,max:118,required:!0},pointCount:{type:`number`,min:4096,max:3e5}},stateLayout:{tensorId:`tdks_dipole_pair_cloud`,dtype:`f32`,components:8},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`quantum-tdks-photon@1 requires a WebGPU device`);let r=Et(n,e?.parameters||{});return{status:`ok`,pointCount:r.pointCount,rExtentBohr:r.rExtentBohr}}})}}var St=`
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
`,Ct=new WeakMap;function wt(e){let t=Ct.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-dipole-pair-sampler`,code:St});return t={pipe:e.createComputePipeline({label:`ulg-dipole-pair-sampler-pipe`,layout:`auto`,compute:{module:n,entryPoint:`sample_dipole_coupled_pair`}}),paramsBuf:e.createBuffer({size:32,usage:H.UNIFORM|H.COPY_DST}),radBuf:e.createBuffer({size:ot*16,usage:H.STORAGE|H.COPY_DST}),polBuf:e.createBuffer({size:st*16,usage:H.STORAGE|H.COPY_DST})},Ct.set(e,t),t}function Tt(e,t,n,r,i,a,o,s){let c=new Float32Array(a.length);if(Array.isArray(r)&&r.length>=32&&i&&i.length===r.length){let e=0;for(let t=0;t<a.length;t+=1){let n=a[t];for(;e+1<r.length&&r[e+1]<n;)e+=1;let o=Math.min(r.length-2,e),s=r[o],l=Math.max(s+1e-9,r[o+1]),u=Math.max(0,Math.min(1,(n-s)/(l-s)));c[t]=i[o]*(1-u)+i[o+1]*u}}else{let r=pt(ft(e,t,n,o),t,n,s),i=Math.sqrt((2*r/t)**3*(ct(t-n-1)/(2*t*ct(t+n))));for(let e=0;e<a.length;e+=1){let o=a[e],s=2*r*o/t,l=ut(t-n-1,2*n+1,s);c[e]=o*i*Math.exp(-.5*s)*s**+n*l}}let l=0;for(let e=0;e<c.length;e+=1)l+=c[e]*c[e];let u=1/Math.sqrt(Math.max(1e-12,l));for(let e=0;e<c.length;e+=1)c[e]*=u;return c}function Et(e,{Z:t=79,n0:n=5,l0:r=2,n1:i=6,l1:a=1,m:o=0,rGrid:s=null,u0:c=null,u1:l=null,pointCount:u=18e4,screeningExchange:d=!0,relativisticSpinOrbit:f=!0,seed:p=1,reusePosBuffer:m=null,reuseAmpBuffer:h=null}={}){let g=Math.max(8192,Math.min(3e5,Math.trunc(u))),_=Math.max(1,Math.min(8,Math.trunc(n))),v=Math.max(0,Math.min(_-1,Math.trunc(r))),y=Math.max(1,Math.min(8,Math.trunc(i))),b=Math.max(0,Math.min(y-1,Math.trunc(a))),x=Math.max(-Math.min(v,b),Math.min(Math.min(v,b),Math.trunc(o))),S=Math.abs(x),C=mt({Z:t,n:_,l:v,m:x,rGrid:s,orbitalU:c,screeningExchange:d,relativisticSpinOrbit:f}),w=mt({Z:t,n:y,l:b,m:x,rGrid:s,orbitalU:l,screeningExchange:d,relativisticSpinOrbit:f}),T=Math.max(C.rExtentBohr,Math.min(C.rExtentBohr*1.45,w.rExtentBohr)),E=new Float32Array(ot);for(let e=0;e<ot;e+=1)E[e]=(e+.5)/ot*T;let D=Tt(t,_,v,s,c,E,d,f),ee=Tt(t,y,b,s,l,E,d,f),O=new Float32Array(ot*4),k=0;for(let e=0;e<ot;e+=1)k+=.5*(D[e]*D[e]+ee[e]*ee[e]),O[e*4+0]=E[e]/T,O[e*4+1]=k,O[e*4+2]=D[e],O[e*4+3]=ee[e];let A=k>0?1/k:1;for(let e=0;e<ot;e+=1)O[e*4+1]*=A;let j=new Float32Array(st),M=new Float32Array(st),N=0,P=0;for(let e=0;e<st;e+=1){let t=-1+(e+.5)/st*2;j[e]=dt(v,S,t),M[e]=dt(b,S,t),N+=j[e]*j[e],P+=M[e]*M[e]}let F=1/Math.sqrt(Math.max(1e-12,N/st)),I=1/Math.sqrt(Math.max(1e-12,P/st)),te=new Float32Array(st*4),ne=0;for(let e=0;e<st;e+=1){let t=-1+(e+.5)/st*2,n=j[e]*F,r=M[e]*I;ne+=.5*(n*n+r*r),te[e*4+0]=ne,te[e*4+1]=n,te[e*4+2]=r,te[e*4+3]=t}let L=ne>0?1/ne:1;for(let e=0;e<st;e+=1)te[e*4+0]*=L;let{pipe:re,paramsBuf:ie,radBuf:ae,polBuf:R}=wt(e),z=g*16,oe=m&&m.size>=z?m:e.createBuffer({label:`ulg-tdks-pair-pos`,size:z,usage:H.STORAGE|H.VERTEX}),se=h&&h.size>=z?h:e.createBuffer({label:`ulg-tdks-pair-amp`,size:z,usage:H.STORAGE}),ce=new ArrayBuffer(32),B=new Uint32Array(ce),le=new Int32Array(ce);B[0]=g>>>0,B[1]=ot>>>0,B[2]=st>>>0,B[3]=p>>>0||1,B[4]=S>>>0,le[5]=x,B[6]=0,B[7]=0,e.queue.writeBuffer(ie,0,ce),e.queue.writeBuffer(ae,0,O),e.queue.writeBuffer(R,0,te);let ue=e.createBindGroup({layout:re.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:ie}},{binding:1,resource:{buffer:ae}},{binding:2,resource:{buffer:R}},{binding:3,resource:{buffer:oe}},{binding:4,resource:{buffer:se}}]}),de=e.createCommandEncoder({label:`ulg-tdks-pair-sample`}),fe=de.beginComputePass();return fe.setPipeline(re),fe.setBindGroup(0,ue),fe.dispatchWorkgroups(Math.ceil(g/64)),fe.end(),e.queue.submit([de.finish()]),Object.freeze({posBuffer:oe,ampBuffer:se,pointCount:g,rExtentBohr:T,n0:_,l0:v,n1:y,l1:b,m:x,groundSource:C.sourceKind,excitedSource:w.sourceKind})}function Dt(e={},{probeWavelengthNm:t=440}={}){let n=1239.841984,r=.6582119569,i=!!e?.isMetal,a=Array.isArray(e?.interbandOscillators)?e.interbandOscillators:[],o=5,s=.45,c=`Valence→Cond`;if(i&&a.length>0){let e=a.find(e=>e.energyEv>=2.2&&e.energyEv<=4.2)||a[0];o=Math.max(.6,Number(e.energyEv)||3),s=Math.max(.22,Number(e.dampingEv)||.55),c=e.transitionLabel||`d→p`}else{let t=Math.max(.5,Number(e?.bandGapEv)||5.5);o=Math.max(2.6,t+1.4),s=t<3.4?.4:.14,c=`Valence→Cond (${o.toFixed(1)} eV)`}let l=o/r,u=s/r,d=u*.42,f=1.65,p=[610,535,440,Math.max(380,Math.min(780,Number(t)||440))].map(e=>({wavelengthNm:e,photonEv:n/e,omega:n/e/r,rho01Re:0,rho01Im:0,rho11:0,dipole:0,dipolePrev:0,dipoleAccel:0,absorbedEnergy:0,incidentEnergy:0,eNow:0,radHistory:new Float32Array(128)})),m=0,h=0,g=4.2,_=2.4;function v(e,t){let n=t-g;return Math.exp(n/_*-.5*(n/_))*Math.cos(e.omega*n)}function y(e=null){if(m=0,h=0,e!=null){let t=Math.max(380,Math.min(780,Number(e)||440));p[3].wavelengthNm=t,p[3].photonEv=n/t,p[3].omega=p[3].photonEv/r}for(let e of p)e.rho01Re=0,e.rho01Im=0,e.rho11=0,e.dipole=0,e.dipolePrev=0,e.dipoleAccel=0,e.absorbedEnergy=0,e.incidentEnergy=0,e.eNow=0,e.radHistory.fill(0)}function b(e=.08){let t=e/12;for(let e=0;e<12;e+=1){let n=m+e*t;for(let e of p){let r=f*v(e,n),i=(e,t,n,r)=>{let i=2*n-1;return[-l*t-.5*u*e,l*e-.5*u*t+r*i,-d*n-2*r*t]},[a,o,s]=i(e.rho01Re,e.rho01Im,e.rho11,r),c=f*v(e,n+.5*t),[p,m,h]=i(e.rho01Re+.5*t*a,e.rho01Im+.5*t*o,e.rho11+.5*t*s,c),[g,_,y]=i(e.rho01Re+.5*t*p,e.rho01Im+.5*t*m,e.rho11+.5*t*h,c),b=v(e,n+t),x=f*b,[S,C,w]=i(e.rho01Re+t*g,e.rho01Im+t*_,e.rho11+t*y,x),T=2*e.rho01Re;e.rho01Re+=t/6*(a+2*p+2*g+S),e.rho01Im+=t/6*(o+2*m+2*_+C),e.rho11=Math.max(0,Math.min(.98,e.rho11+t/6*(s+2*h+2*y+w)));let E=2*e.rho01Re,D=(E-T)/t;e.dipoleAccel=(E-2*e.dipole+e.dipolePrev)/Math.max(1e-6,t*t),e.dipolePrev=e.dipole,e.dipole=E,e.eNow=b,e.absorbedEnergy+=Math.max(0,b*D*t),e.incidentEnergy+=b*b*t}}m+=e,h=(h+1)%128;for(let e of p)e.radHistory[h]=Math.max(-2.5,Math.min(2.5,-e.dipoleAccel*.045));m>13.5&&y()}return Object.freeze({transEv:o,gammaEv:s,transLabel:c,historyLen:128,channels:p,getTimeFs:()=>m,getHistCursor:()=>h,pulseT0Fs:g,pulseWidthFs:_,reset:y,stepFs:b})}var Ot=`ulg.optics.photon-shell-fdtd-2d-webgpu.v1`,kt=`ulg.nuclear.tunneling-tdse-webgpu.v1`,At=16384,jt=2e-8,Mt=.5,Nt=Mt*jt/299792458,Pt=6582119569e-25,Ft=1239.841984,It=.36,U=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128});function Lt(e={},{probeWavelengthNm:t=535}={}){let n=!!e?.isMetal,r=n?Math.max(.5,Math.min(24,Number(e?.plasmaEnergyEv)||8)):0,i=n?Math.max(.05,Math.min(4,Number(e?.drudeDampingEv)||Math.max(.15,r/25))):0,a=[];if(n){let t=Array.isArray(e?.interbandOscillators)?e.interbandOscillators:[],n=r*r;for(let e=0;e<Math.min(4,t.length);e+=1){let r=t[e],i=Math.max(.25,Math.min(18,Number(r.energyEv)||3)),o=Math.max(.12,Math.min(6,Number(r.dampingEv)||.45)),s=Math.max(0,Math.min(8,Number(r.strengthWeight)||0)),c=It*n*s/(i*i);a.push({energyEv:i,dampingEv:o,deltaEps:Math.min(25,c),label:r.transitionLabel||`Interband #${e+1}`})}}else{let t=Math.max(.25,Math.min(18,Number(e?.bandGapEv)||5)),n=Number(e?.refractiveIndex550Nm),r=Number.isFinite(n)&&n>=1.005?Math.min(3.8,n):Math.min(3.8,Math.sqrt(1+(13.6/(t+3.47))**2)),i=Ft/550,o=Math.max(i*1.48,t+1.65),s=Math.max(.02,r*r-1)*(1-i*i/(o*o));if(a.push({energyEv:o,dampingEv:t<3.4?.42:.06,deltaEps:Math.min(16,Math.max(.02,s)),label:`Valence→Cond UV (${o.toFixed(1)} eV)`}),t<3.35){let e=Math.max(.6,t+.35);a.push({energyEv:e,dampingEv:Math.max(.25,.22*t),deltaEps:Math.min(4,Math.max(.15,(3.4-t)*.6)),label:`Band-Edge (${e.toFixed(2)} eV)`})}}for(;a.length<4;)a.push({energyEv:10,dampingEv:1,deltaEps:0,label:`inactive`});let o=Nt/Pt,s=r*o,c=i*o,l=n?(1-.5*c)/(1+.5*c):0,u=n?s*s/(1+.5*c):0,d=a.map(e=>{let t=e.energyEv*o,n=1.35/Math.sqrt(1+Math.max(0,e.deltaEps)),r=Math.min(t,n),i=e.dampingEv*o,a=1+.5*i;return{a:(1-.5*i)/a,b:r*r/a,c:e.deltaEps,active:+(e.deltaEps>1e-6),...e}}),f=[610,535,440,Math.max(380,Math.min(780,Number(t)||535))],p=f.map(e=>Ft/e*o);return Object.freeze({isMetal:n,plasmaEv:r,drudeGammaEv:i,kDrude:l,betaDrude:u,oscillators:Object.freeze(d),wavelengthsNm:Object.freeze(f),omegaDtChannels:Object.freeze(p),expectedIor550:Number(e?.refractiveIndex550Nm)||1,slabX0:64,slabX1:104,incidenceDeg:24})}function Rt(e){let t=Math.max(0,Math.min(1,Number(e)||0));return t<=.0031308?12.92*t:1.055*t**(1/2.4)-.055}function zt(e,t){let n=Ft/Math.max(200,t),r=1,i=0;if(e.isMetal&&e.plasmaEv>0){let t=e.plasmaEv*e.plasmaEv,a=n*n,o=n*e.drudeGammaEv,s=Math.max(1e-30,a*a+o*o);r-=t*a/s,i+=t*o/s}for(let t of e.oscillators){if(!(t.deltaEps>1e-6))continue;let e=t.deltaEps*t.energyEv*t.energyEv,a=t.energyEv*t.energyEv-n*n,o=-t.dampingEv*n,s=Math.max(1e-30,a*a+o*o);r+=e*a/s,i-=e*o/s}let a=Math.hypot(r,i),o=Math.sqrt(Math.max(0,.5*(a+r))),s=Math.sqrt(Math.max(0,.5*(a-r))),c=(o-1)*(o-1)+s*s,l=Math.max(1e-30,(o+1)*(o+1)+s*s);return{nRe:o,kIm:s,reflectance:Math.max(0,Math.min(1,c/l))}}var Bt=`
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
`,Vt=new WeakMap;function Ht(e){let t=Vt.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-photon-shell-fdtd-2d-wgsl`,code:Bt}),r=e.createBindGroupLayout({label:`ulg-photon-shell-fdtd-2d-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`storage`}},{binding:2,visibility:4,buffer:{type:`storage`}},{binding:3,visibility:4,buffer:{type:`storage`}},{binding:4,visibility:4,buffer:{type:`storage`}},{binding:5,visibility:4,buffer:{type:`storage`}},{binding:6,visibility:4,buffer:{type:`storage`}},{binding:7,visibility:4,buffer:{type:`storage`}},{binding:8,visibility:4,buffer:{type:`storage`}}]}),i=e.createPipelineLayout({bindGroupLayouts:[r]});return t={bgl:r,stepHPipe:e.createComputePipeline({label:`ulg-fdtd2d-step-h`,layout:i,compute:{module:n,entryPoint:`fdtd2d_step_h`}}),stepEPipe:e.createComputePipeline({label:`ulg-fdtd2d-step-e`,layout:i,compute:{module:n,entryPoint:`fdtd2d_step_e_and_shells`}}),reducePipe:e.createComputePipeline({label:`ulg-fdtd2d-reduce`,layout:i,compute:{module:n,entryPoint:`fdtd2d_reduce_observables`}})},Vt.set(e,t),t}function Ut(e,t={},{probeWavelengthNm:n=535,pulseWidthSteps:r=34,pulseT0Steps:i=78}={}){if(!e||typeof e.createComputePipeline!=`function`)throw TypeError(`createPhotonShellOpticsSessionWebGpu requires a valid WebGPU GPUDevice.`);let{bgl:a,stepHPipe:o,stepEPipe:s,reducePipe:c}=Ht(e),l=At*4,u=l*4,d=l*16,f=e.createBuffer({label:`ulg-fdtd2d-ez`,size:u,usage:U.STORAGE|U.COPY_DST|U.COPY_SRC}),p=e.createBuffer({label:`ulg-fdtd2d-hx`,size:u,usage:U.STORAGE|U.COPY_DST}),m=e.createBuffer({label:`ulg-fdtd2d-hy`,size:u,usage:U.STORAGE|U.COPY_DST}),h=e.createBuffer({label:`ulg-fdtd2d-jd`,size:u,usage:U.STORAGE|U.COPY_DST}),g=e.createBuffer({label:`ulg-fdtd2d-pcurr`,size:d,usage:U.STORAGE|U.COPY_DST}),_=e.createBuffer({label:`ulg-fdtd2d-pprev`,size:d,usage:U.STORAGE|U.COPY_DST}),v=e.createBuffer({label:`ulg-fdtd2d-shell`,size:d,usage:U.STORAGE|U.COPY_DST|U.COPY_SRC}),y=e.createBuffer({size:128,usage:U.STORAGE|U.COPY_DST|U.COPY_SRC}),b=e.createBuffer({size:128,usage:U.MAP_READ|U.COPY_DST}),x=Array.from({length:24},()=>e.createBuffer({size:144,usage:U.UNIFORM|U.COPY_DST})),S=x.map(t=>e.createBindGroup({layout:a,entries:[t,f,p,m,h,g,_,v,y].map((e,t)=>({binding:t,resource:{buffer:e}}))})),C=Lt(t,{probeWavelengthNm:n}),w=0,T=null,E=!1,D=new Float32Array(l),ee=new Float32Array(l*4),O=new Float32Array(32),k=24*Math.PI/180,A=Math.sin(k),j=Math.cos(k);function M(t,n){let a=new ArrayBuffer(144),o=new Uint32Array(a),s=new Float32Array(a);o[0]=128,o[1]=128,o[2]=4,o[3]=n>>>0,o[4]=C.slabX0,o[5]=C.slabX1,o[6]=18,o[7]=42,o[8]=110,o[9]=36,o[10]=12,o[11]=0,s[12]=Mt,s[13]=C.kDrude,s[14]=C.betaDrude,s[15]=i,s[16]=r,s[17]=A,s[18]=j,s[19]=11.5;for(let e=0;e<4;e+=1)s[20+e]=C.omegaDtChannels[e],s[24+e]=C.oscillators[e].a,s[28+e]=C.oscillators[e].b,s[32+e]=C.oscillators[e].c;e.queue.writeBuffer(t,0,a)}function N(n=null,{nextProbeWavelengthNm:r=null}={}){(n||r!=null)&&(C=Lt(n||t,{probeWavelengthNm:r??C.wavelengthsNm[3]}),n&&(t=n)),w=0,e.queue.writeBuffer(f,0,D),e.queue.writeBuffer(p,0,D),e.queue.writeBuffer(m,0,D),e.queue.writeBuffer(h,0,D),e.queue.writeBuffer(g,0,ee),e.queue.writeBuffer(_,0,ee),e.queue.writeBuffer(v,0,ee),e.queue.writeBuffer(y,0,O)}N();function P(t=4){let n=Math.max(1,Math.min(24,Math.trunc(t)));for(let e=0;e<n;e+=1)M(x[e],w+e);let r=Math.ceil(l/64),i=e.createCommandEncoder({label:`ulg-fdtd2d-batch`}),a=i.beginComputePass({label:`ulg-fdtd2d-pass`});for(let e=0;e<n;e+=1){let t=S[e];a.setPipeline(o),a.setBindGroup(0,t),a.dispatchWorkgroups(r),a.setPipeline(s),a.setBindGroup(0,t),a.dispatchWorkgroups(r),a.setPipeline(c),a.setBindGroup(0,t),a.dispatchWorkgroups(4)}a.end(),e.queue.submit([i.finish()]),w+=n}async function F({nonBlocking:t=!1}={}){if(E)return null;if(T){if(t)return null;try{await T}catch{}if(E)return null}let n=(async()=>{if(E)return null;let t=e.createCommandEncoder({label:`ulg-fdtd2d-read-obs`});if(t.copyBufferToBuffer(y,0,b,0,128),e.queue.submit([t.finish()]),await b.mapAsync(U.MAP_READ),E){try{b.unmap()}catch{}return null}let n=new Float32Array(b.getMappedRange().slice(0,128));b.unmap();let r=[];for(let e=0;e<4;e+=1){let t=e*8,i=n[t+0],a=n[t+1],o=n[t+2],s=n[t+3],c=n[t+4],l=n[t+5],u=n[t+6],d=n[t+7],f=i>1e-4,p=f?Math.max(0,Math.min(1.1,a/i)):0,m=f?Math.max(0,Math.min(1.1,o/i)):0,h=f?Math.max(0,Math.min(1.1,s/i)):0,g=C.omegaDtChannels[e]/Mt,_=null;if(!C.isMetal&&c>.001&&l>1e-6&&g>1e-5){let e=Math.asin(Math.min(.99,Math.sqrt(l/c)))/g;Number.isFinite(e)&&e>=.95&&e<=5.5&&(_=e)}let v=null,y=null;if(!C.isMetal&&u>.001){let e=Math.atan2(Math.abs(d),u);if(y=e*180/Math.PI,e>.04){let t=A/Math.sin(e);Number.isFinite(t)&&t>=.95&&t<=5.5&&(v=t)}}let b=zt(C,C.wavelengthsNm[e]);r.push(Object.freeze({wavelengthNm:C.wavelengthsNm[e],photonEv:Ft/C.wavelengthsNm[e],fluxInc:i,fluxRef:a,fluxTr:o,fluxAbs:s,reflectance:p,transmittance:m,absorption:h,energyBalance:p+m+h,nPhaseFdtd:_,nSnellFdtd:v,refractAngleDeg:y,nMeasuredFdtd:_??v??null,analyticNRe:b.nRe,analyticKIm:b.kIm,analyticReflectance:b.reflectance}))}let i=Math.max(0,Math.min(1,r[0].reflectance)),a=Math.max(0,Math.min(1,r[1].reflectance)),o=Math.max(0,Math.min(1,r[2].reflectance)),s=[Rt(i),Rt(a),Rt(o)];return Object.freeze({schema:Ot,stepIndex:w,simTimeFs:w*Nt*0x38d7ea4c68000,isMetal:C.isMetal,plasmaEv:C.plasmaEv,drudeGammaEv:C.drudeGammaEv,oscillators:C.oscillators,channels:Object.freeze(r),emergentReflectedSrgb:Object.freeze(s),analyticReflectedSrgb:Object.freeze([Rt(r[0].analyticReflectance),Rt(r[1].analyticReflectance),Rt(r[2].analyticReflectance)])})})();T=n;try{return await n}finally{T===n&&(T=null)}}async function I(e=16,{readObs:t=!0}={}){let n=Math.max(1,Math.trunc(e));for(;n>0;){let e=Math.min(24,n);P(e),n-=e}return t?F({nonBlocking:!1}):null}function te(){E=!0;for(let e of[f,p,m,h,g,_,v,y,b,...x])try{e.destroy()}catch{}}return Object.freeze({schema:Ot,nx:128,ny:128,nCells:At,nChannels:4,slabX0:64,slabX1:104,eFieldBuffer:f,ezFieldBuffer:f,hxFieldBuffer:p,hyFieldBuffer:m,shellPowerBuffer:v,shellStateBuffer:v,getParams:()=>C,getStepIndex:()=>w,reset:N,stepSync:P,stepBatch:I,readTelemetry:F,destroy:te})}var Wt=256,Gt=`
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
  var next_im = psi_im[i] - p.dt_scale * h_re;
  let frac = f32(i) / f32(n - 1u);
  if (frac > p.cap_start) {
    let s = (frac - p.cap_start) / max(0.01, 1.0 - p.cap_start);
    next_im = next_im * exp(-p.cap_strength * s * s);
  }
  psi_im[i] = next_im;
  prob_out[i] = psi_re[i] * psi_re[i] + next_im * next_im;
}
`,Kt=new WeakMap;function qt(e){let t=Kt.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-nuclear-tdse-wgsl`,code:Gt}),r=e.createBindGroupLayout({entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`storage`}},{binding:3,visibility:4,buffer:{type:`storage`}},{binding:4,visibility:4,buffer:{type:`storage`}}]}),i=e.createPipelineLayout({bindGroupLayouts:[r]});return t={bgl:r,stepRe:e.createComputePipeline({layout:i,compute:{module:n,entryPoint:`tdse_step_re`}}),stepIm:e.createComputePipeline({layout:i,compute:{module:n,entryPoint:`tdse_step_im`}})},Kt.set(e,t),t}function Jt(e,t){if(!e||typeof e.createComputePipeline!=`function`)return null;let{bgl:n,stepRe:r,stepIm:i}=qt(e),a=t?.alphaWkb,o=Array.isArray(a?.rFm)?a.rFm:Array.from({length:64},(e,t)=>t/63*45),s=Array.isArray(a?.vMeV)?a.vMeV:o.map(e=>e<6?-20:120/e),c=Math.max(24,Number(o[o.length-1])||45),l=Math.max(2.5,Number(a?.rTouchFm)||(t?.chargeRadiusFm||4)*1.35),u=c/(Wt-1),d=new Float32Array(Wt),f=new Float32Array(Wt),p=1;for(let e=0;e<Wt;e+=1){let t=e*u;d[e]=t;let n=t/c*(o.length-1),r=Math.max(0,Math.min(o.length-2,Math.floor(n))),i=Math.max(0,Math.min(1,n-r)),a=s[r]*(1-i)+s[r+1]*i;f[e]=a,a>p&&(p=a)}let m=Math.max(3.5,Math.min(p*.82,Number(t?.qAlphaMeV)>.5?Number(t.qAlphaMeV):p*.55)),h=197.32698*197.32698/(2*3727.38*u*u),g=4*h+Math.max(p,25),_=.35/Math.max(1,g),v=Math.max(4,Math.min(Wt-16,Math.round(l/u))),y=Math.min(Wt-12,v+24);for(let e=v+1;e<Wt-4;e+=1)if(f[e]<=m){y=e;break}let b=e.createBuffer({size:32,usage:U.UNIFORM|U.COPY_DST}),x=e.createBuffer({size:Wt*4,usage:U.STORAGE|U.COPY_DST}),S=e.createBuffer({size:Wt*4,usage:U.STORAGE|U.COPY_DST}),C=e.createBuffer({size:Wt*4,usage:U.STORAGE|U.COPY_DST}),w=e.createBuffer({size:Wt*4,usage:U.STORAGE|U.COPY_DST|U.COPY_SRC}),T=e.createBuffer({size:Wt*4,usage:U.MAP_READ|U.COPY_DST}),E=new ArrayBuffer(32);new Uint32Array(E,0,4).set([Wt,v,y,0]),new Float32Array(E,16,4).set([h,_,.88,.08]),e.queue.writeBuffer(b,0,E),e.queue.writeBuffer(x,0,f);let D=e.createBindGroup({layout:n,entries:[b,x,S,C,w].map((e,t)=>({binding:t,resource:{buffer:e}}))}),ee=0,O=null,k=!1;function A(){ee=0;let t=new Float32Array(Wt),n=new Float32Array(Wt),r=new Float32Array(Wt),i=Math.max(1.5,l*.52),a=Math.max(.85,l*.22),o=Math.sqrt(Math.max(.2,(m+18)/Math.max(1e-4,h*u*u))),s=0;for(let e=1;e<Wt-1;e+=1){let r=d[e],c=Math.exp(-.5*((r-i)/a)**2);t[e]=c*Math.cos(o*(r-i)),n[e]=c*Math.sin(o*(r-i)),s+=t[e]*t[e]+n[e]*n[e]}let c=1/Math.sqrt(Math.max(1e-12,s));for(let e=0;e<Wt;e+=1)t[e]*=c,n[e]*=c,r[e]=t[e]*t[e]+n[e]*n[e];e.queue.writeBuffer(S,0,t),e.queue.writeBuffer(C,0,n),e.queue.writeBuffer(w,0,r)}A();async function j(t=12,{nonBlocking:n=!1}={}){if(k)return null;if(O){if(n)return null;try{await O}catch{}if(k)return null}let a=(async()=>{if(k)return null;let n=Math.max(1,Math.min(64,Math.trunc(t))),a=Math.ceil(Wt/64),o=e.createCommandEncoder({label:`ulg-nuclear-tdse`}),s=o.beginComputePass();for(let e=0;e<n;e+=1)s.setPipeline(r),s.setBindGroup(0,D),s.dispatchWorkgroups(a),s.setPipeline(i),s.setBindGroup(0,D),s.dispatchWorkgroups(a);if(s.end(),o.copyBufferToBuffer(w,0,T,0,Wt*4),e.queue.submit([o.finish()]),ee+=n,await T.mapAsync(U.MAP_READ),k){try{T.unmap()}catch{}return null}let c=new Float32Array(T.getMappedRange().slice(0,Wt*4));T.unmap();let u=0,p=0,h=0;for(let e=0;e<Wt;e+=1)e<=v?u+=c[e]:e<=y?p+=c[e]:h+=c[e];return Object.freeze({schema:kt,stepCount:ee,rGridFm:d,potRawMeV:f,prob:c,qEffMeV:m,rTouchFm:l,pInside:u,pBarrier:p,pTunneled:h})})();O=a;try{return await a}finally{O===a&&(O=null)}}function M(){k=!0;for(let e of[b,x,S,C,w,T])try{e.destroy()}catch{}}return Object.freeze({schema:kt,rGridFm:d,potRawMeV:f,qEffMeV:m,resetWavepacket:A,stepBatch:j,destroy:M})}async function Yt({closureRegistry:e,materialKey:t=`unknown`,electromagnetic:n={},telemetry:r=null,closureId:i=null}={}){let a=Lt(n),o={closureId:i||`ulg-photon-shell-fdtd-optics:${t}.v1`,closureKind:`optical-photon-shell-fdtd-dispersion`,inputHash:`${t}:metal=${+!!a.isMetal}:wp=${a.plasmaEv.toFixed(3)}:osc=${a.oscillators.filter(e=>e.active).length}`,methodHash:`maxwell-2d-ade-fdtd-drude-lorentz-webgpu.v1`,execution:{mode:`webgpu-2d-maxwell-ade-fdtd`,params:a,measuredChannels:r?.channels??null,emergentReflectedSrgb:r?.emergentReflectedSrgb??null},validity:{wavelengthNm:[380,780],dxMeters:jt,courant:Mt,incidenceDeg:24},provenance:{schema:Ot,sourceModule:`src/runtime/material/photonShellOpticsWebGpu.js`,scientificValidation:!1}};return{ref:e?await e.store(o):null,artifact:o}}function Xt(e){return!e||typeof e.registerModule!=`function`?null:{opticsMod:e.registerModule({method:{model:`photon-shell-fdtd`,version:`1`},kernel:{sourceModule:`src/runtime/material/photonShellOpticsWebGpu.js`,entryPoint:`fdtd2d_step_e_and_shells`,workgroupSize:64,wgsl:Bt},parameterSchema:{steps:{type:`number`,min:1,max:4096},probeWavelengthNm:{type:`number`,min:380,max:780}},stateLayout:{tensorId:`fdtd2d_em_shell_fields`,dtype:`f32`,components:4},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`photon-shell-fdtd@1 requires a WebGPU device`);let r=e?.parameters||{},i=Ut(n,r.electromagnetic||{},{probeWavelengthNm:r.probeWavelengthNm??535});try{return{status:`ok`,telemetry:await i.stepBatch(r.steps??280,{readObs:!0})}}finally{i.destroy()}}}),tdseMod:e.registerModule({method:{model:`nuclear-tunneling-tdse`,version:`1`},kernel:{sourceModule:`src/runtime/material/photonShellOpticsWebGpu.js`,entryPoint:`tdse_step_re`,workgroupSize:64,wgsl:Gt},parameterSchema:{steps:{type:`number`,min:1,max:2048}},stateLayout:{tensorId:`tdse_wavepacket_prob`,dtype:`f32`,components:1},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`nuclear-tunneling-tdse@1 requires a WebGPU device`);let r=e?.parameters||{},i=Jt(n,r.nuclear||{});try{return{status:`ok`,telemetry:await i.stepBatch(r.steps??48)}}finally{i.destroy()}}})}}var W=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),Zt=`
struct CompNucParams {
  dim: u32,
  site_count: u32,
  pad0: u32,
  pad1: u32,
};

@group(0) @binding(0) var<uniform> params: CompNucParams;
// site_pos_r: vec4(x_unit, y_unit, z_unit, radius_unit)
@group(0) @binding(1) var<storage, read> site_pos_r: array<vec4<f32>>;
// site_meta: vec4(Z, N, skin_ratio, weight)
@group(0) @binding(2) var<storage, read> site_meta: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> vol_out: array<vec4<f32>>;

@compute @workgroup_size(64)
fn build_composite_nuclear_volume(@builtin(global_invocation_id) gid: vec3<u32>) {
  let dim = params.dim;
  let total = dim * dim * dim;
  let idx = gid.x;
  if (idx >= total) { return; }
  let ix = idx % dim;
  let iy = (idx / dim) % dim;
  let iz = idx / (dim * dim);
  let p = (vec3<f32>(f32(ix) + 0.5, f32(iy) + 0.5, f32(iz) + 0.5) / f32(dim)) * 2.0 - 1.0;

  var accum_col = vec3<f32>(0.0);
  var accum_d = 0.0;
  let n_sites = params.site_count;
  for (var s = 0u; s < n_sites; s = s + 1u) {
    let pr = site_pos_r[s];
    let smeta = site_meta[s];
    let d = length(p - pr.xyz);
    let r0 = max(0.08, pr.w);
    let diff_a = max(0.025, r0 * 0.24);
    let rho_p = 1.0 / (1.0 + exp((d - r0) / diff_a));
    let rho_n = 1.0 / (1.0 + exp((d - r0 * smeta.z) / diff_a));
    let n_frac = smeta.y / max(1.0, smeta.x + smeta.y);
    let core_c = mix(vec3<f32>(1.0, 0.54, 0.24), vec3<f32>(0.32, 0.78, 1.0), clamp((rho_n - rho_p) * 3.0 + n_frac * 0.35, 0.0, 1.0));
    let w = max(rho_p, rho_n) * smeta.w;
    accum_col = accum_col + core_c * w;
    accum_d = accum_d + w;
  }
  let dens = clamp(accum_d, 0.0, 1.0);
  let col = select(vec3<f32>(0.0), accum_col / max(1.0e-5, accum_d), accum_d > 1.0e-5);
  vol_out[idx] = vec4<f32>(col, dens);
}
`,Qt=`
${h}

struct ProbeParams {
  temperature_k: f32,
  pressure_pa: f32,
  pad0: f32,
  pad1: f32,
};

@group(0) @binding(0) var<uniform> params: ProbeParams;
@group(0) @binding(1) var<storage, read> polytope_atlas: array<f32>;
@group(0) @binding(2) var<storage, read_write> probe_out: array<vec4<f32>>;

@compute @workgroup_size(64)
fn probe_polytope_point(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x != 0u) { return; }
  probe_out[0u] = eval_polytope_atlas_2d(&polytope_atlas, params.temperature_k, params.pressure_pa);
}
`,$t=`
struct AtomVolParams {
  dim: u32,
  n_grid: u32,
  valence_l: u32,
  unpaired_count: u32,
  r_max_bohr: f32,
  spin_fraction: f32,
  pad0: f32,
  pad1: f32,
};

@group(0) @binding(0) var<uniform> params: AtomVolParams;
@group(0) @binding(1) var<storage, read> r_grid: array<f32>;
@group(0) @binding(2) var<storage, read> rho_grid: array<f32>;
@group(0) @binding(3) var<storage, read_write> vol_out: array<vec4<f32>>;

fn sample_radial_rho(rr: f32) -> f32 {
  let n = params.n_grid;
  if (n < 2u || rr >= r_grid[n - 1u]) { return 0.0; }
  if (rr <= r_grid[0u]) { return rho_grid[0u]; }
  var lo = 0u;
  var hi = n - 1u;
  for (var iter = 0u; iter < 10u; iter = iter + 1u) {
    let mid = (lo + hi) >> 1u;
    if (r_grid[mid] < rr) { lo = mid; } else { hi = mid; }
  }
  let r0 = r_grid[lo];
  let r1 = max(r0 + 1e-6, r_grid[hi]);
  let t = clamp((rr - r0) / (r1 - r0), 0.0, 1.0);
  return mix(rho_grid[lo], rho_grid[hi], t);
}

fn angular_ylm_sq(dir: vec3<f32>, l: u32) -> f32 {
  let ct = dir.y;
  let st2 = max(0.0, 1.0 - ct * ct);
  let c2p = select(1.0, (dir.x * dir.x - dir.z * dir.z) / max(1e-5, st2), st2 > 1e-5);
  if (l == 0u) {
    return 1.0;
  } else if (l == 1u) {
    // p_z orbital lobe |Y_10|^2 ~ 3 cos^2(theta)
    return 0.25 + 2.25 * ct * ct;
  } else if (l == 2u) {
    // d_{z^2} / d_{x^2-y^2} hybrid valence lobe |Y_20|^2 + |Y_22|^2
    let d0 = (3.0 * ct * ct - 1.0);
    let d2 = st2 * c2p;
    return 0.22 + 0.55 * (d0 * d0) + 0.95 * (d2 * d2);
  }
  // f-shell octupolar |Y_30|^2
  let f0 = ct * (5.0 * ct * ct - 3.0);
  return 0.2 + 0.45 * f0 * f0;
}

@compute @workgroup_size(64)
fn build_atomic_volume(@builtin(global_invocation_id) gid: vec3<u32>) {
  let dim = params.dim;
  let total = dim * dim * dim;
  let idx = gid.x;
  if (idx >= total) { return; }
  let ix = idx % dim;
  let iy = (idx / dim) % dim;
  let iz = idx / (dim * dim);
  let p = (vec3<f32>(f32(ix) + 0.5, f32(iy) + 0.5, f32(iz) + 0.5) / f32(dim) * 2.0 - 1.0) * params.r_max_bohr;
  let rr = length(p);
  let dir = p / max(1e-5, rr);
  let rho = max(0.0, sample_radial_rho(rr));
  let shell_prob = pow(clamp(4.0 * 3.14159265 * rr * rr * rho * 0.28, 0.0, 4.0), 0.55);
  let ang = angular_ylm_sq(dir, params.valence_l);
  let core_w = exp(-rr * 0.85);
  let valence_w = 1.0 - core_w;
  let total_d = clamp(shell_prob * (core_w + valence_w * ang * 0.72), 0.0, 1.0);

  // Spin density (rho_up - rho_down): positive lobes (amber/gold) vs negative spin-nodal phase (cyan)
  let spin_mag = clamp(params.spin_fraction * valence_w * shell_prob * ang * 1.15, 0.0, 1.0);
  let sign_lobe = select(1.0, sign(3.0 * dir.y * dir.y - 1.0), params.valence_l >= 2u);
  let r_col = clamp(0.18 * total_d + max(0.0, sign_lobe) * spin_mag * 0.95, 0.0, 1.0);
  let g_col = clamp(0.68 * total_d + spin_mag * 0.35, 0.0, 1.0);
  let b_col = clamp(0.98 * total_d + max(0.0, -sign_lobe) * spin_mag * 0.85, 0.0, 1.0);
  vol_out[idx] = vec4<f32>(r_col, g_col, b_col, total_d);
}
`,en=`
struct VolRenderUniforms {
  resolution: vec2<f32>,
  yaw: f32,
  pitch: f32,
  dim: u32,
  channels: u32,
  mode_flags: u32, // bit 0: show Fermi isosurface contour
  pad0: u32,
  tint: vec4<f32>,
};

@group(0) @binding(0) var<uniform> u: VolRenderUniforms;
@group(0) @binding(1) var<storage, read> vol_data: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> scalar_data: array<f32>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_fullscreen(@builtin(vertex_index) vid: u32) -> VsOut {
  var pts = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  var out: VsOut;
  out.pos = vec4<f32>(pts[vid], 0.0, 1.0);
  out.uv = pts[vid];
  return out;
}

fn rotate_cam(v: vec3<f32>, yaw: f32, pitch: f32) -> vec3<f32> {
  let cp = cos(pitch); let sp = sin(pitch);
  let cy = cos(yaw); let sy = sin(yaw);
  let v1 = vec3<f32>(v.x, v.y * cp - v.z * sp, v.y * sp + v.z * cp);
  return vec3<f32>(v1.x * cy + v1.z * sy, v1.y, -v1.x * sy + v1.z * cy);
}

fn fetch_voxel(i: vec3<u32>) -> vec4<f32> {
  let dim = u.dim;
  let idx = (i.z * dim + i.y) * dim + i.x;
  if (u.channels == 4u) {
    return vol_data[idx];
  }
  let s = scalar_data[idx];
  // Contrast-stretched periodic Bloch charge peaks + sharp Fermi isosurface shell (never over-exposed!)
  let mod_s = pow(clamp((s - 0.12) / 0.88, 0.0, 1.0), 2.4);
  let iso = select(0.0, exp(-pow((s - 0.52) * 18.0, 2.0)), (u.mode_flags & 1u) != 0u);
  let col = mix(u.tint.rgb * (0.25 + 0.90 * mod_s), vec3<f32>(1.0, 0.84, 0.35), iso * 0.85);
  return vec4<f32>(col, clamp(mod_s * 0.24 + iso * 0.38, 0.0, 0.65));
}

fn sample_voxel(p_unit: vec3<f32>) -> vec4<f32> {
  let d = f32(u.dim);
  let g = clamp((p_unit * 0.5 + 0.5) * d - 0.5, vec3<f32>(0.0), vec3<f32>(d - 1.001));
  let i0 = vec3<u32>(floor(g));
  let i1 = min(i0 + vec3<u32>(1u), vec3<u32>(u.dim - 1u));
  let f = fract(g);
  let c000 = fetch_voxel(vec3<u32>(i0.x, i0.y, i0.z));
  let c100 = fetch_voxel(vec3<u32>(i1.x, i0.y, i0.z));
  let c010 = fetch_voxel(vec3<u32>(i0.x, i1.y, i0.z));
  let c110 = fetch_voxel(vec3<u32>(i1.x, i1.y, i0.z));
  let c001 = fetch_voxel(vec3<u32>(i0.x, i0.y, i1.z));
  let c101 = fetch_voxel(vec3<u32>(i1.x, i0.y, i1.z));
  let c011 = fetch_voxel(vec3<u32>(i0.x, i1.y, i1.z));
  let c111 = fetch_voxel(vec3<u32>(i1.x, i1.y, i1.z));
  let c00 = mix(c000, c100, f.x);
  let c10 = mix(c010, c110, f.x);
  let c01 = mix(c001, c101, f.x);
  let c11 = mix(c011, c111, f.x);
  return mix(mix(c00, c10, f.y), mix(c01, c11, f.y), f.z);
}

@fragment
fn fs_raymarch(in: VsOut) -> @location(0) vec4<f32> {
  let aspect = u.resolution.x / max(1.0, u.resolution.y);
  let ndc = vec2<f32>(in.uv.x * aspect, in.uv.y);
  let ro = rotate_cam(vec3<f32>(0.0, 0.0, 2.85), u.yaw, u.pitch);
  let rd = normalize(rotate_cam(normalize(vec3<f32>(ndc * 0.62, -1.0)), u.yaw, u.pitch));

  // Ray-box intersection against [-1, 1]^3
  let inv_rd = 1.0 / select(rd, vec3<f32>(1e-5), abs(rd) < vec3<f32>(1e-5));
  let t0 = (-1.0 - ro) * inv_rd;
  let t1 = (1.0 - ro) * inv_rd;
  let tmin_v = min(t0, t1);
  let tmax_v = max(t0, t1);
  let t_enter = max(max(tmin_v.x, tmin_v.y), max(tmin_v.z, 0.0));
  let t_exit = min(min(tmax_v.x, tmax_v.y), tmax_v.z);

  // Clean deep-space scientific lab backdrop
  let bg = vec3<f32>(0.020, 0.035, 0.067) + 0.022 * exp(-dot(ndc, ndc) * 1.4) * u.tint.rgb;
  if (t_exit <= t_enter) {
    return vec4<f32>(bg, 1.0);
  }

  let steps = 56u;
  let dt = (t_exit - t_enter) / f32(steps);
  var accum_rgb = vec3<f32>(0.0);
  var accum_a = 0.0;
  for (var s = 0u; s < steps; s = s + 1u) {
    let t = t_enter + (f32(s) + 0.5) * dt;
    let p = ro + rd * t;
    let v = sample_voxel(p);
    let alpha = clamp(v.w * dt * 2.1, 0.0, 0.92);
    let rem = 1.0 - accum_a;
    accum_rgb = accum_rgb + rem * v.rgb * alpha * 1.55;
    accum_a = accum_a + rem * alpha;
    if (accum_a > 0.985) { break; }
  }

  // Subtle bounding-box edge highlight at enter/exit planes
  let p_in = abs(ro + rd * t_enter);
  let edge_d = max(min(abs(1.0 - p_in.x), abs(1.0 - p_in.y)), min(abs(1.0 - p_in.y), abs(1.0 - p_in.z)));
  let box_wire = smoothstep(0.022, 0.0, edge_d) * 0.16;

  let final_rgb = accum_rgb + (1.0 - accum_a) * bg + vec3<f32>(0.34, 0.76, 1.0) * box_wire;
  return vec4<f32>(clamp(final_rgb, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}
`,tn=`
struct AtomRenderUniforms {
  resolution: vec2<f32>,
  yaw: f32,
  pitch: f32,
  box_l: vec4<f32>,      // (Lx, Ly, Lz, atomRadiusFrac)
  base_tint: vec4<f32>,  // (r, g, b, velocityColorScale)
};

@group(0) @binding(0) var<uniform> u: AtomRenderUniforms;
@group(0) @binding(1) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> velocities: array<vec4<f32>>;

struct VsOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) local_uv: vec2<f32>,
  @location(1) color: vec3<f32>,
};

fn world_to_view(p_norm: vec3<f32>) -> vec3<f32> {
  let cy = cos(u.yaw); let sy = sin(u.yaw);
  let cp = cos(u.pitch); let sp = sin(u.pitch);
  let x1 = p_norm.x * cy - p_norm.z * sy;
  let z1 = p_norm.x * sy + p_norm.z * cy;
  let y2 = p_norm.y * cp - z1 * sp;
  let z2 = p_norm.y * sp + z1 * cp + 3.35;
  return vec3<f32>(x1, y2, z2);
}

@vertex
fn vs_atom(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> VsOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let corner = quad[vid];
  let pos4 = positions[iid];
  let vel4 = velocities[iid];
  let half_box = max(vec3<f32>(0.5), u.box_l.xyz * 0.5);
  let p_norm = (pos4.xyz - half_box) / half_box;
  let view = world_to_view(p_norm);

  let aspect = u.resolution.x / max(1.0, u.resolution.y);
  let fov_scale = 1.65;
  let rad = u.box_l.w;
  let cx = (view.x * fov_scale) / max(0.35, view.z * aspect);
  let cy = (view.y * fov_scale) / max(0.35, view.z);
  let rx = (rad * fov_scale) / max(0.35, view.z * aspect);
  let ry = (rad * fov_scale) / max(0.35, view.z);
  let depth_z = clamp((view.z - 0.35) / 8.0, 0.001, 0.999);

  // Velocity-magnitude thermal kinetic energy coloring (live GPU velocitiesBuffer!)
  let speed = length(vel4.xyz);
  let heat = clamp(speed * u.base_tint.w, 0.0, 1.0);
  let cold_col = mix(vec3<f32>(0.28, 0.68, 1.0), u.base_tint.rgb, 0.45);
  let warm_col = vec3<f32>(1.0, 0.56, 0.22);
  let hot_col = vec3<f32>(1.0, 0.92, 0.55);
  let col = select(
    mix(cold_col, warm_col, heat * 2.0),
    mix(warm_col, hot_col, (heat - 0.5) * 2.0),
    heat > 0.5
  );

  var out: VsOut;
  out.clip_pos = vec4<f32>(cx + corner.x * rx, cy + corner.y * ry, depth_z, 1.0);
  out.local_uv = corner;
  out.color = col;
  return out;
}

@fragment
fn fs_atom(in: VsOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.local_uv, in.local_uv);
  if (r2 > 1.0) { discard; }
  let nz = sqrt(max(0.0, 1.0 - r2));
  let n = normalize(vec3<f32>(in.local_uv.x, in.local_uv.y, nz));
  let light = normalize(vec3<f32>(-0.42, 0.62, 0.66));
  let diff = max(0.14, dot(n, light));
  let half_v = normalize(light + vec3<f32>(0.0, 0.0, 1.0));
  let spec = pow(max(0.0, dot(n, half_v)), 28.0) * 0.72;
  let rim = pow(1.0 - nz, 2.5) * 0.28;
  let rgb = in.color * diff + vec3<f32>(1.0) * spec + vec3<f32>(0.38, 0.76, 1.0) * rim;
  return vec4<f32>(clamp(rgb, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}

// Periodic Simulation-Box Wireframe Lines (24 vertices = 12 edges)
@vertex
fn vs_wire(@builtin(vertex_index) vid: u32) -> @builtin(position) vec4<f32> {
  var edges = array<vec3<f32>, 24>(
    vec3<f32>(-1,-1,-1), vec3<f32>( 1,-1,-1),
    vec3<f32>(-1, 1,-1), vec3<f32>( 1, 1,-1),
    vec3<f32>(-1,-1, 1), vec3<f32>( 1,-1, 1),
    vec3<f32>(-1, 1, 1), vec3<f32>( 1, 1, 1),
    vec3<f32>(-1,-1,-1), vec3<f32>(-1, 1,-1),
    vec3<f32>( 1,-1,-1), vec3<f32>( 1, 1,-1),
    vec3<f32>(-1,-1, 1), vec3<f32>(-1, 1, 1),
    vec3<f32>( 1,-1, 1), vec3<f32>( 1, 1, 1),
    vec3<f32>(-1,-1,-1), vec3<f32>(-1,-1, 1),
    vec3<f32>( 1,-1,-1), vec3<f32>( 1,-1, 1),
    vec3<f32>(-1, 1,-1), vec3<f32>(-1, 1, 1),
    vec3<f32>( 1, 1,-1), vec3<f32>( 1, 1, 1)
  );
  let view = world_to_view(edges[vid]);
  let aspect = u.resolution.x / max(1.0, u.resolution.y);
  let fov_scale = 1.65;
  let cx = (view.x * fov_scale) / max(0.35, view.z * aspect);
  let cy = (view.y * fov_scale) / max(0.35, view.z);
  let depth_z = clamp((view.z - 0.35) / 8.0, 0.001, 0.999);
  return vec4<f32>(cx, cy, depth_z, 1.0);
}

@fragment
fn fs_wire() -> @location(0) vec4<f32> {
  return vec4<f32>(0.34, 0.76, 1.0, 0.32);
}
`,nn=`
${h}

struct PolyRenderUniforms {
  log_t_min: f32,
  log_t_max: f32,
  log_p_min: f32,
  log_p_max: f32,
  probe_fx: f32,
  probe_fy: f32,
  probe_active: f32,
  pad0: f32,
};

@group(0) @binding(0) var<uniform> u: PolyRenderUniforms;
@group(0) @binding(1) var<storage, read> polytope_atlas: array<f32>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_poly(@builtin(vertex_index) vid: u32) -> VsOut {
  var pts = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  var out: VsOut;
  out.pos = vec4<f32>(pts[vid], 0.0, 1.0);
  out.uv = pts[vid] * 0.5 + 0.5;
  return out;
}

@fragment
fn fs_poly(in: VsOut) -> @location(0) vec4<f32> {
  // Subtle frame margin
  if (in.uv.x < 0.06 || in.uv.x > 0.96 || in.uv.y < 0.08 || in.uv.y > 0.90) {
    return vec4<f32>(0.024, 0.042, 0.078, 1.0);
  }
  let fx = (in.uv.x - 0.06) / 0.90;
  let fy = (in.uv.y - 0.08) / 0.82;
  let log_t = mix(u.log_t_min, u.log_t_max, fx);
  let log_p = mix(u.log_p_min, u.log_p_max, fy);
  let T = pow(10.0, log_t);
  let P = pow(10.0, log_p);

  let eval_res = eval_polytope_atlas_2d(&polytope_atlas, T, P);
  var col = vec3<f32>(0.04, 0.05, 0.08);
  if (eval_res.w < 0.5) {
    // Fail-closed outside-domain hatching
    let hatch = step(0.88, fract((in.uv.x + in.uv.y) * 28.0)) * 0.075;
    col = vec3<f32>(0.06, 0.045, 0.075) + vec3<f32>(hatch, hatch * 0.45, hatch * 0.55);
  } else {
    let rho = max(1e-6, eval_res.x);
    let margin = eval_res.y;
    let pcode = u32(max(0.0, floor(eval_res.z + 0.5)));
    var base_col = vec3<f32>(0.34, 0.76, 1.0); // solid
    if (pcode == 1u) { base_col = vec3<f32>(0.20, 0.83, 0.60); } // liquid
    else if (pcode == 2u) { base_col = vec3<f32>(0.98, 0.57, 0.24); } // gas
    else if (pcode >= 3u) { base_col = vec3<f32>(0.75, 0.52, 0.99); } // plasma

    // Density contour lines in log10(rho) + crisp slanted coexistence facet edge highlight
    let log_rho = log2(rho) * 0.3010299956639812;
    let iso_shade = 0.58 + 0.32 * clamp((log_rho + 2.0) / 6.5, 0.0, 1.0);
    let contour = smoothstep(0.06, 0.0, abs(fract(log_rho * 1.5) - 0.5)) * 0.22;
    let facet_edge = smoothstep(0.018, 0.0, margin) * 0.65;
    col = base_col * iso_shade + vec3<f32>(contour) + vec3<f32>(0.95, 0.98, 1.0) * facet_edge;
  }

  // Interactive GPU (T, log10 P) probe crosshair & glowing reticle
  if (u.probe_active > 0.5) {
    let dx = abs(fx - u.probe_fx);
    let dy = abs(fy - u.probe_fy);
    let d_pt = sqrt(dx * dx + dy * dy);
    let line_x = smoothstep(0.0038, 0.0, dx) * 0.34;
    let line_y = smoothstep(0.0042, 0.0, dy) * 0.34;
    let ring = smoothstep(0.006, 0.0, abs(d_pt - 0.022)) * 0.95;
    let dot_c = smoothstep(0.007, 0.0, d_pt) * 0.95;
    col = mix(col, vec3<f32>(1.0, 0.95, 0.62), clamp(line_x + line_y + ring + dot_c, 0.0, 1.0));
  }
  return vec4<f32>(clamp(col, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}
`,rn=`
struct OrbitalCloudUniforms {
  res_yaw_pitch: vec4<f32>, // (w, h, yaw, pitch)
  cam_style: vec4<f32>,     // (cam_dist, point_size, opacity, alt_shell_colors)
  color_a: vec4<f32>,       // (r, g, b, show_guides)
  color_b: vec4<f32>,       // (r, g, b, nuc_radius)
};

@group(0) @binding(0) var<uniform> u: OrbitalCloudUniforms;
@group(0) @binding(1) var<storage, read> points: array<vec4<f32>>;

struct VsOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) local_uv: vec2<f32>,
  @location(1) color: vec4<f32>,
};

fn project_pt(p: vec3<f32>) -> vec3<f32> {
  let cy = cos(u.res_yaw_pitch.z); let sy = sin(u.res_yaw_pitch.z);
  let cp = cos(u.res_yaw_pitch.w); let sp = sin(u.res_yaw_pitch.w);
  let x1 = p.x * cy - p.z * sy;
  let z1 = p.x * sy + p.z * cy;
  let y2 = p.y * cp - z1 * sp;
  let z2 = p.y * sp + z1 * cp + u.cam_style.x;
  return vec3<f32>(x1, y2, z2);
}

@vertex
fn vs_cloud(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> VsOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let corner = quad[vid];
  let pt = points[iid];
  let view = project_pt(pt.xyz);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.95;
  let inv_z = 1.0 / max(0.25, view.z);
  let cx = view.x * fov * inv_z / aspect;
  let cy = view.y * fov * inv_z;

  // Ultra-crisp MoonLab dusty sprite radius & delicate per-point alpha (zero solid-white core blowout!)
  let min_px = 0.95 / max(1.0, u.res_yaw_pitch.y);
  let world_r = max(min_px * 1.15, u.cam_style.y * 0.65 * fov * inv_z);
  let rx = world_r / aspect;
  let ry = world_r;

  let shade = abs(pt.w);
  let is_a = pt.w >= 0.0;
  let base_rgb = select(
    u.color_a.rgb,
    select(u.color_b.rgb, u.color_a.rgb, is_a),
    u.cam_style.w > 0.5
  );

  var out: VsOut;
  out.clip_pos = vec4<f32>(cx + corner.x * rx, cy + corner.y * ry, 0.5, 1.0);
  out.local_uv = corner;
  out.color = vec4<f32>(base_rgb * shade, u.cam_style.z * 0.22);
  return out;
}

@fragment
fn fs_cloud(in: VsOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.local_uv, in.local_uv);
  if (r2 > 1.0) { discard; }
  let soft = exp(-r2 * 3.2) * (1.0 - r2);
  let a = in.color.a * soft;
  return vec4<f32>(in.color.rgb * a, a);
}

// Nucleus core billboard at (0, 0, 0)
@vertex
fn vs_nucleus(@builtin(vertex_index) vid: u32) -> VsOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let corner = quad[vid];
  let view = project_pt(vec3<f32>(0.0));
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.95;
  let inv_z = 1.0 / max(0.25, view.z);
  let rad = max(0.012, u.color_b.w * fov * inv_z);
  var out: VsOut;
  out.clip_pos = vec4<f32>(
    view.x * fov * inv_z / aspect + corner.x * rad / aspect,
    view.y * fov * inv_z + corner.y * rad,
    0.4, 1.0
  );
  out.local_uv = corner;
  out.color = vec4<f32>(0.95, 0.96, 1.0, 0.9);
  return out;
}

@fragment
fn fs_nucleus(in: VsOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.local_uv, in.local_uv);
  if (r2 > 1.0) { discard; }
  let core = exp(-r2 * 4.5);
  return vec4<f32>(in.color.rgb * core, core * 0.92);
}

// Cartesian floor grid + XYZ axes (matches MoonLab "Show cartesian grid + axes"!)
struct GuideOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) col: vec4<f32>,
};

@vertex
fn vs_guides(@builtin(vertex_index) vid: u32) -> GuideOut {
  // 22 grid lines (11 along X, 11 along Z -> 44 verts) + 3 RGB axes (6 verts) = 50 verts
  var p = vec3<f32>(0.0);
  var col = vec4<f32>(0.24, 0.28, 0.36, 0.45);
  if (vid < 22u) {
    let line_i = vid / 2u;
    let end_i = vid % 2u;
    let z_pos = -1.0 + (f32(line_i) / 10.0) * 2.0;
    let x_pos = select(-1.0, 1.0, end_i == 1u);
    p = vec3<f32>(x_pos, -1.0, z_pos);
  } else if (vid < 44u) {
    let k = vid - 22u;
    let line_i = k / 2u;
    let end_i = k % 2u;
    let x_pos = -1.0 + (f32(line_i) / 10.0) * 2.0;
    let z_pos = select(-1.0, 1.0, end_i == 1u);
    p = vec3<f32>(x_pos, -1.0, z_pos);
  } else {
    let a = vid - 44u;
    if (a == 0u) { p = vec3<f32>(0.0, -1.0, 0.0); col = vec4<f32>(0.95, 0.35, 0.35, 0.85); }
    else if (a == 1u) { p = vec3<f32>(1.15, -1.0, 0.0); col = vec4<f32>(0.95, 0.35, 0.35, 0.85); }
    else if (a == 2u) { p = vec3<f32>(0.0, -1.0, 0.0); col = vec4<f32>(0.35, 0.92, 0.48, 0.85); }
    else if (a == 3u) { p = vec3<f32>(0.0, 0.15, 0.0); col = vec4<f32>(0.35, 0.92, 0.48, 0.85); }
    else if (a == 4u) { p = vec3<f32>(0.0, -1.0, 0.0); col = vec4<f32>(0.38, 0.65, 1.0, 0.85); }
    else { p = vec3<f32>(0.0, -1.0, 1.15); col = vec4<f32>(0.38, 0.65, 1.0, 0.85); }
  }
  let view = project_pt(p);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.95;
  let inv_z = 1.0 / max(0.25, view.z);
  var out: GuideOut;
  out.clip_pos = vec4<f32>(view.x * fov * inv_z / aspect, view.y * fov * inv_z, 0.5, 1.0);
  out.col = col;
  return out;
}

@fragment
fn fs_guides(in: GuideOut) -> @location(0) vec4<f32> {
  return in.col;
}
`,an=`
struct PhotonSceneUniforms {
  res_yaw_pitch: vec4<f32>, // (w, h, yaw, pitch)
  grid_meta: vec4<f32>,     // (nx, ny, slab_x0, slab_x1)
  wave_meta: vec4<f32>,     // (mode_mono, is_metal, shell_pts_per_atom, cam_dist)
  slab_tint: vec4<f32>,     // (srgb.r, srgb.g, srgb.b, shell_opacity)
  probe_rgb: vec4<f32>,     // (probe.r, probe.g, probe.b, wave_gain)
};

@group(0) @binding(0) var<uniform> u: PhotonSceneUniforms;
@group(0) @binding(1) var<storage, read> ez_field: array<f32>;
@group(0) @binding(2) var<storage, read> shell_state: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> shell_pts: array<vec4<f32>>;

struct WavePlaneOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

fn project_ps(p: vec3<f32>) -> vec3<f32> {
  let cy = cos(u.res_yaw_pitch.z); let sy = sin(u.res_yaw_pitch.z);
  let cp = cos(u.res_yaw_pitch.w); let sp = sin(u.res_yaw_pitch.w);
  let x1 = p.x * cy - p.z * sy;
  let z1 = p.x * sy + p.z * cy;
  let y2 = p.y * cp - z1 * sp;
  let z2 = p.y * sp + z1 * cp + u.wave_meta.w;
  return vec3<f32>(x1, y2, z2);
}

fn world_to_clip(p: vec3<f32>) -> vec4<f32> {
  let view = project_ps(p);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.85;
  let z_safe = max(0.3, view.z);
  // True perspective-correct clip coordinates (w = z_safe) so quad UV interpolation has ZERO diagonal kink!
  return vec4<f32>(view.x * fov / aspect, view.y * fov, 0.5 * z_safe, z_safe);
}

// 1. High-resolution 2D Maxwell Wave-Field Plane (bilinearly sampled 128x128x4 GPU EM field!)
//    Renders real incident white photon packet, real reflected Gold/Silver packet, real Snell
//    refraction & wavelength compression inside dielectrics, and real local shell absorption glow!
@vertex
fn vs_wave_plane(@builtin(vertex_index) vid: u32) -> WavePlaneOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 0.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 1.0), vec2<f32>(0.0, 1.0)
  );
  let uv = quad[vid];
  // Map 2D optical cavity [0,1]^2 onto tilted 3D world plane [-1.45, +1.45] x [-1.45, +1.45]
  let wx = (uv.x * 2.0 - 1.0) * 1.45;
  let wz = (uv.y * 2.0 - 1.0) * 1.45;
  var out: WavePlaneOut;
  out.clip_pos = world_to_clip(vec3<f32>(wx, 0.0, wz));
  out.uv = uv;
  return out;
}

fn bilerp_ez(ch: u32, gx: f32, gy: f32) -> f32 {
  let nx = u32(u.grid_meta.x);
  let ny = u32(u.grid_meta.y);
  let base = ch * nx * ny;
  let x0 = u32(clamp(floor(gx), 0.0, f32(nx - 2u)));
  let y0 = u32(clamp(floor(gy), 0.0, f32(ny - 2u)));
  let fx = fract(clamp(gx, 0.0, f32(nx - 2u)));
  let fy = fract(clamp(gy, 0.0, f32(ny - 2u)));
  let v00 = ez_field[base + y0 * nx + x0];
  let v10 = ez_field[base + y0 * nx + (x0 + 1u)];
  let v01 = ez_field[base + (y0 + 1u) * nx + x0];
  let v11 = ez_field[base + (y0 + 1u) * nx + (x0 + 1u)];
  return mix(mix(v00, v10, fx), mix(v01, v11, fx), fy);
}

fn bilerp_shell(ch: u32, gx: f32, gy: f32) -> vec4<f32> {
  let nx = u32(u.grid_meta.x);
  let ny = u32(u.grid_meta.y);
  let base = ch * nx * ny;
  let x0 = u32(clamp(floor(gx), 0.0, f32(nx - 2u)));
  let y0 = u32(clamp(floor(gy), 0.0, f32(ny - 2u)));
  let fx = fract(clamp(gx, 0.0, f32(nx - 2u)));
  let fy = fract(clamp(gy, 0.0, f32(ny - 2u)));
  let v00 = shell_state[base + y0 * nx + x0];
  let v10 = shell_state[base + y0 * nx + (x0 + 1u)];
  let v01 = shell_state[base + (y0 + 1u) * nx + x0];
  let v11 = shell_state[base + (y0 + 1u) * nx + (x0 + 1u)];
  return mix(mix(v00, v10, fx), mix(v01, v11, fx), fy);
}

@fragment
fn fs_wave_plane(in: WavePlaneOut) -> @location(0) vec4<f32> {
  let nx = u.grid_meta.x;
  let ny = u.grid_meta.y;
  let gx = in.uv.x * (nx - 1.0);
  let gy = in.uv.y * (ny - 1.0);

  let in_slab = gx >= u.grid_meta.z && gx <= u.grid_meta.w && gy >= 12.0 && gy <= ny - 13.0;
  // Crisp micro-cavity spatial ruler grid (every 8 cells = 160 nm) so wavelength compression is obvious!
  let grid_x = smoothstep(0.06, 0.0, abs(fract(gx / 8.0) - 0.5));
  let grid_y = smoothstep(0.06, 0.0, abs(fract(gy / 8.0) - 0.5));
  let grid_line = max(grid_x, grid_y) * 0.055;

  var bg = vec3<f32>(0.012, 0.019, 0.036) + vec3<f32>(0.24, 0.38, 0.58) * grid_line;
  if (in_slab) {
    bg = bg + u.slab_tint.rgb * select(0.08, 0.13, u.wave_meta.y > 0.5);
  }
  // Sharp Fresnel optical interface highlight at x = slab_x0 and x = slab_x1
  let face0 = exp(-pow((gx - u.grid_meta.z) * 1.1, 2.0)) * select(0.0, 0.55, gy >= 12.0 && gy <= ny - 13.0);
  let face1 = exp(-pow((gx - u.grid_meta.w) * 1.1, 2.0)) * select(0.0, 0.32, gy >= 12.0 && gy <= ny - 13.0);
  bg = bg + (u.slab_tint.rgb * 0.65 + vec3<f32>(0.35)) * (face0 + face1);

  let gain = u.probe_rgb.w;
  var wave_rgb = vec3<f32>(0.0);
  var shell_glow = vec3<f32>(0.0);

  if (u.wave_meta.x > 0.5) {
    // Single-lambda coherent wave visualization: positive crests bright spectral color, troughs deep complementary!
    let ez = bilerp_ez(3u, gx, gy) * gain;
    let ss = bilerp_shell(3u, gx, gy);
    let pos_w = max(0.0, ez);
    let neg_w = max(0.0, -ez);
    let crest_col = u.probe_rgb.rgb;
    let trough_col = mix(u.probe_rgb.rgb * 0.45, vec3<f32>(0.18, 0.42, 0.85), 0.45);
    wave_rgb = crest_col * pow(min(1.8, pos_w * 2.4), 0.85) + trough_col * pow(min(1.6, neg_w * 2.1), 0.9);
    let abs_e = clamp(abs(ss.z) * 28.0 + abs(ss.x) * 0.6, 0.0, 1.0);
    shell_glow = vec3<f32>(0.85, 0.55, 1.0) * abs_e * 0.55;
  } else {
    // Real RGB 3-Channel White Light Maxwell Wavepacket:
    //   Incident beam: E_R ≈ E_G ≈ E_B -> PURE LUMINOUS WHITE WAVEFRONTS!
    //   Reflected off Relativistic Gold: Blue absorbed by 5d shells -> RADIANT GOLDEN REFLECTED WAVEFRONTS!
    //   Reflected off Non-Relativistic Gold / Silver: E_R ≈ E_G ≈ E_B -> MIRROR SILVER-WHITE WAVEFRONTS!
    //   Refracted inside Dielectric (H2O, Diamond, NaCl): Snell-bent compressed wavefronts!
    let er = bilerp_ez(0u, gx, gy) * gain;
    let eg = bilerp_ez(1u, gx, gy) * gain;
    let eb = bilerp_ez(2u, gx, gy) * gain;

    // Show crisp wave crests (phase-preserving brightness so individual wavefronts are razor sharp!)
    let ar = abs(er);
    let ag = abs(eg);
    let ab = abs(eb);
    let amp_rgb = vec3<f32>(ar, ag, ab);
    let peak = max(ar, max(ag, ab));
    // Soft tone-mapped luminous optical intensity keeping true RGB ratios intact!
    let tone = pow(clamp(peak * 2.5, 0.0, 3.0), 0.82) / max(1e-4, peak);
    let phase_boost = 0.72 + 0.38 * smoothstep(-0.15, 0.25, (er + eg + eb) * 0.33);
    wave_rgb = amp_rgb * tone * 0.52 * phase_boost;

    // Real local shell dipole excitation / blue-absorption glow inside slab
    if (in_slab) {
      let s0 = bilerp_shell(0u, gx, gy);
      let s1 = bilerp_shell(1u, gx, gy);
      let s2 = bilerp_shell(2u, gx, gy);
      let b_abs = clamp(abs(s2.z) * 34.0, 0.0, 1.0);
      let tot_p = clamp((abs(s0.x) + abs(s1.x) + abs(s2.x)) * 0.45, 0.0, 1.0);
      shell_glow = vec3<f32>(0.65, 0.32, 1.0) * b_abs * 0.65 + u.slab_tint.rgb * tot_p * 0.32;
    }
  }

  let col = bg + wave_rgb + shell_glow;
  return vec4<f32>(clamp(col, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}

// 2. MoonLab-Grade 3D Atomic Electron-Shell Point Clouds Embedded Inside the Optical Slab!
//    Every electron sample reads the live 2D Maxwell field shell_state(x, y) directly on GPU,
//    physically oscillating vertically along E_z proportional to bound polarization P(x,y,t) & J_D(x,y,t)
//    and glowing brightly where photons resonantly excite the electron shells!
struct ShellDotOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) local_uv: vec2<f32>,
  @location(1) color: vec4<f32>,
};

@vertex
fn vs_driven_shells(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> ShellDotOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let corner = quad[vid];
  let pts_per_atom = max(1u, u32(u.wave_meta.z));
  let site_idx = iid / pts_per_atom;
  let pt_idx = iid % pts_per_atom;
  let raw_pt = shell_pts[pt_idx];

  // Tile 4 (X) x 5 (Z) = 20 real 3D Dirac-KS atomic electron-shell clouds cleanly across the slab!
  let sx = site_idx % 4u;
  let sz = (site_idx / 4u) % 5u;
  let nx = u.grid_meta.x;
  let ny = u.grid_meta.y;
  let gx_site = mix(u.grid_meta.z + 5.0, u.grid_meta.w - 5.0, (f32(sx) + 0.5) / 4.0);
  let gy_site = mix(22.0, ny - 23.0, (f32(sz) + 0.5) / 5.0);

  let cx_w = ((gx_site / (nx - 1.0)) * 2.0 - 1.0) * 1.45;
  let cz_w = ((gy_site / (ny - 1.0)) * 2.0 - 1.0) * 1.45;
  let atom_rad = 0.145;
  var wpos = vec3<f32>(cx_w, 0.08, cz_w) + raw_pt.xyz * atom_rad;

  // Read live 2D Maxwell polarization & shell absorption at this atom's exact (gx, gy) cell!
  let cell_x = u32(clamp(gx_site, 1.0, nx - 2.0));
  let cell_y = u32(clamp(gy_site, 1.0, ny - 2.0));
  let nx_u = u32(nx);
  let ny_u = u32(ny);
  let cell_off = cell_y * nx_u + cell_x;

  var pol_disp = 0.0;
  var abs_excite = 0.0;
  var blue_abs = 0.0;
  if (u.wave_meta.x > 0.5) {
    let sp = shell_state[3u * nx_u * ny_u + cell_off];
    pol_disp = sp.x * 0.45 + sp.y * 2.4;
    abs_excite = clamp(abs(sp.z) * 28.0 + abs(sp.x) * 0.85, 0.0, 1.0);
  } else {
    let s0 = shell_state[0u * nx_u * ny_u + cell_off];
    let s1 = shell_state[1u * nx_u * ny_u + cell_off];
    let s2 = shell_state[2u * nx_u * ny_u + cell_off];
    pol_disp = 0.22 * (s0.x + s1.x + s2.x) + 1.4 * (s0.y + s1.y + s2.y);
    abs_excite = clamp((abs(s0.z) + abs(s1.z) + abs(s2.z)) * 22.0 + abs(pol_disp) * 0.55, 0.0, 1.0);
    blue_abs = clamp(abs(s2.z) * 38.0, 0.0, 1.0);
  }

  // Real physical electron-cloud dipole oscillation driven by live GPU Maxwell field E_z!
  wpos.y = wpos.y + clamp(pol_disp * 0.16, -0.24, 0.24);

  let view = project_ps(wpos);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.85;
  let inv_z = 1.0 / max(0.3, view.z);
  let rad = max(1.5 / max(1.0, u.res_yaw_pitch.y), 0.0095 * fov * inv_z);

  let is_a = raw_pt.w >= 0.0;
  let shade = abs(raw_pt.w);
  let base_shell = select(
    mix(vec3<f32>(0.42, 0.22, 0.92), u.slab_tint.rgb, 0.35),
    mix(vec3<f32>(0.92, 0.95, 1.0), u.slab_tint.rgb, 0.50),
    is_a
  );
  let excite_col = mix(vec3<f32>(1.0, 0.85, 0.36), vec3<f32>(0.72, 0.40, 1.0), blue_abs);
  let final_rgb = mix(base_shell, excite_col, abs_excite * 0.82) * shade * (0.85 + 1.15 * abs_excite);

  var out: ShellDotOut;
  out.clip_pos = vec4<f32>(
    view.x * fov * inv_z / aspect + corner.x * rad / aspect,
    view.y * fov * inv_z + corner.y * rad,
    0.45, 1.0
  );
  out.local_uv = corner;
  out.color = vec4<f32>(final_rgb, clamp(u.slab_tint.w * 0.32 + abs_excite * 0.20, 0.04, 0.36));
  return out;
}

@fragment
fn fs_shell_dot(in: ShellDotOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.local_uv, in.local_uv);
  if (r2 > 1.0) { discard; }
  let soft = exp(-r2 * 3.0) * (1.0 - r2);
  let a = in.color.a * soft;
  return vec4<f32>(in.color.rgb * a, a);
}
`,on=`
struct TdksUniforms {
  res_yaw_pitch: vec4<f32>, // (w, h, yaw, pitch)
  cam_time: vec4<f32>,      // (cam_dist, time_fs, pulse_t0, pulse_width)
  bloch_state: vec4<f32>,   // (rho00, rho11, 2*Re[rho01], e_now)
  wave_rgb: vec4<f32>,      // (omega_rad_fs, mode_mono, hist_cursor, hist_len)
  refl_srgb: vec4<f32>,     // (emergent_r, emergent_g, emergent_b, blue_rho11)
  probe_rgb: vec4<f32>,     // (probe_r, probe_g, probe_b, point_size)
};

@group(0) @binding(0) var<uniform> u: TdksUniforms;
@group(0) @binding(1) var<storage, read> pair_pos: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> pair_amp: array<vec4<f32>>;
// rad_hist: 4 channels * 128 retarded dipole acceleration samples (channel 0=R, 1=G, 2=B, 3=Probe)
@group(0) @binding(3) var<storage, read> rad_hist: array<f32>;

struct TdksFieldOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) world_xy: vec2<f32>,
};

fn project_tdks(p: vec3<f32>) -> vec3<f32> {
  let cy = cos(u.res_yaw_pitch.z); let sy = sin(u.res_yaw_pitch.z);
  let cp = cos(u.res_yaw_pitch.w); let sp = sin(u.res_yaw_pitch.w);
  let x1 = p.x * cy - p.z * sy;
  let z1 = p.x * sy + p.z * cy;
  let y2 = p.y * cp - z1 * sp;
  let z2 = p.y * sp + z1 * cp + u.cam_time.x;
  return vec3<f32>(x1, y2, z2);
}

fn sample_retarded_dipole(ch: u32, r_world: f32) -> f32 {
  let hlen = u32(max(8.0, u.wave_rgb.w));
  let cur = u32(u.wave_rgb.z);
  // Propagation delay in ring-buffer steps (~24 steps per unit world radius -> clear visible spherical wave rings!)
  let lag = r_world * 24.0;
  let lag0 = u32(floor(lag));
  if (lag0 + 1u >= hlen) { return 0.0; }
  let f = fract(lag);
  let idx0 = (cur + hlen - (lag0 % hlen)) % hlen;
  let idx1 = (cur + hlen - ((lag0 + 1u) % hlen)) % hlen;
  let base = ch * hlen;
  return mix(rad_hist[base + idx0], rad_hist[base + idx1], f);
}

// 1. Volumetric 3D Electromagnetic Wavepacket + Retarded Concentric Dipole Radiation Plane (z = 0 cutting through atom!)
@vertex
fn vs_tdks_field(@builtin(vertex_index) vid: u32) -> TdksFieldOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let q = quad[vid];
  let wxy = vec2<f32>(q.x * 2.15, q.y * 1.45);
  let view = project_tdks(vec3<f32>(wxy.x, wxy.y, 0.0));
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.92;
  let z_safe = max(0.3, view.z);
  var out: TdksFieldOut;
  out.clip_pos = vec4<f32>(view.x * fov / aspect, view.y * fov, 0.55 * z_safe, z_safe);
  out.world_xy = wxy;
  return out;
}

@fragment
fn fs_tdks_field(in: TdksFieldOut) -> @location(0) vec4<f32> {
  let x = in.world_xy.x;
  let y = in.world_xy.y;
  let r = length(in.world_xy);
  let beam_env_y = exp(-0.5 * (y / 0.72) * (y / 0.72));
  let c_vis = 0.56; // visual speed of light (world units / fs)
  let t_ret_inc = u.cam_time.y - x / c_vis;
  let dt_inc = t_ret_inc - u.cam_time.z;
  let env_inc = exp(-0.5 * (dt_inc / u.cam_time.w) * (dt_inc / u.cam_time.w)) * beam_env_y;

  // Angular radiation pattern of a Y-polarized oscillating quantum dipole d_y(t): sin(theta_y) = |x| / r
  let sin_dip = clamp(abs(x) / max(0.08, r), 0.12, 1.0);
  let r_falloff = smoothstep(0.14, 0.34, r) / (0.55 + r * 1.05);

  var col = vec3<f32>(0.006, 0.009, 0.018);

  // Subtle polar optical reference rings around the atom
  let ring_d = smoothstep(0.012, 0.0, abs(fract(r * 1.5) - 0.5)) * 0.045 * smoothstep(2.1, 0.2, r);
  col = col + vec3<f32>(0.25, 0.40, 0.65) * ring_d;

  if (u.wave_rgb.y > 0.5) {
    // Single-lambda coherent wavepacket + exact retarded Hertzian dipole re-radiation rings!
    let e_inc = env_inc * cos(u.wave_rgb.x * dt_inc);
    let e_rad = sample_retarded_dipole(3u, r) * sin_dip * r_falloff * 1.65;
    // Left of atom (x < 0): incident + backscattered; Right of atom (x > 0): phase-shifted transmitted superposition!
    let e_tot = e_inc + e_rad;
    let inc_glow = abs(e_inc) * 0.42;
    let rad_glow = abs(e_rad) * 0.85;
    let crest = max(0.0, e_tot);
    let trough = max(0.0, -e_tot);
    let c_pos = u.probe_rgb.rgb;
    let c_neg = mix(u.probe_rgb.rgb * 0.35, vec3<f32>(0.18, 0.38, 0.85), 0.5);
    col = col + c_pos * crest * 0.52 + c_neg * trough * 0.36 + u.probe_rgb.rgb * (rad_glow * 0.55 + inc_glow * 0.15);
  } else {
    // RGB White-Light Photon Wavepacket colliding with the Quantum Electron Cloud!
    //   Incident packet (x < 0): pure luminous WHITE wavefronts (R = G = B)!
    //   Retarded spherical dipole re-radiation rings: colored in the EXACT live emergent
    //   scattered spectrum (GOLD on Relativistic Gold because Blue is absorbed into 6p; SILVER when Relativistic OFF!)
    let om_r = 3.09; // 610nm rad/fs
    let om_g = 3.52; // 535nm rad/fs
    let om_b = 4.28; // 440nm rad/fs
    let inc_r = env_inc * cos(om_r * dt_inc);
    let inc_g = env_inc * cos(om_g * dt_inc);
    let inc_b = env_inc * cos(om_b * dt_inc);

    let rad_r = sample_retarded_dipole(0u, r) * sin_dip * r_falloff * 1.55;
    let rad_g = sample_retarded_dipole(1u, r) * sin_dip * r_falloff * 1.55;
    let rad_b = sample_retarded_dipole(2u, r) * sin_dip * r_falloff * 1.55;

    // Weight re-radiated RGB rings by the real emergent FDTD reflectance spectrum so Gold radiates GOLD rings & Silver radiates SILVER!
    let refl = max(u.refl_srgb.rgb, vec3<f32>(0.18));
    let sc_rgb = vec3<f32>(abs(rad_r) * refl.r, abs(rad_g) * refl.g, abs(rad_b) * refl.b);
    // Incident wavefront attenuates smoothly past the atom according to real absorption while dipole wave radiates outward!
    let trans_att = select(1.0, 0.45 + 0.55 * (1.0 - u.refl_srgb.w), x > 0.0);
    let inc_rgb = vec3<f32>(abs(inc_r), abs(inc_g), abs(inc_b) * trans_att) * 0.34;

    col = col + inc_rgb + sc_rgb * 0.78;
    // Highlight concentric dipole re-radiation crests subtly
    let dip_wave = abs(rad_r + rad_g + rad_b) * 0.33;
    col = col + refl * smoothstep(0.18, 0.75, dip_wave) * 0.35;
  }

  // Smooth edge vignette so field blends cleanly into deep MoonLab void
  let vig = smoothstep(2.2, 1.35, abs(x)) * smoothstep(1.48, 0.95, abs(y));
  return vec4<f32>(clamp(col * vig, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}

// 2. Live 180K-Point MoonLab-Grade Evolving Quantum Electron Cloud |psi(r,t)|^2!
//    Evaluates exact quantum superposition probability weight:
//      w_i(t) = rho_00 |phi_0|^2 + rho_11 |phi_1|^2 + 2 Re(rho_01) phi_0 phi_1
//    NO fake rigid shift — the actual 3D quantum cloud sloshes through opposite-parity
//    interference AND blooms into the excited orbital |phi_1|^2 as photons are absorbed!
struct TdksPtOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) local_uv: vec2<f32>,
  @location(1) color: vec4<f32>,
};

@vertex
fn vs_tdks_cloud(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> TdksPtOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let corner = quad[vid];
  let pos4 = pair_pos[iid];
  let amp4 = pair_amp[iid];

  let rho00 = u.bloch_state.x;
  let rho11 = u.bloch_state.y;
  let two_re01 = u.bloch_state.z;

  let p0_sq = amp4.x * amp4.x;
  let p1_sq = amp4.y * amp4.y;
  let cross = two_re01 * amp4.x * amp4.y;
  let prob_w = max(0.0, rho00 * p0_sq + rho11 * p1_sq + cross);

  // Subtle physical Stark polarizability breathing (secondary to quantum interference!)
  let p_world = pos4.xyz * 0.92 + vec3<f32>(0.0, u.bloch_state.w * 0.045 * (0.4 + pos4.w), 0.0);
  let view = project_tdks(p_world);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.92;
  let inv_z = 1.0 / max(0.3, view.z);

  let min_px = 0.95 / max(1.0, u.res_yaw_pitch.y);
  let world_r = max(min_px * 1.15, u.probe_rgb.w * 0.62 * fov * inv_z);

  // Color decomposition strictly by quantum-mechanical contribution at this 3D point:
  //   Ground shell (phi_0^2): MoonLab crisp white / royal violet (#FFFFFF / #612BDE)
  //   Dipole interference (+cross / -cross): electric cyan / warm amber polarization shift
  //   Excited shell population (rho_11 * phi_1^2): radiant resonant gold-magenta bloom!
  let base_gnd = select(vec3<f32>(0.42, 0.22, 0.94), vec3<f32>(0.96, 0.97, 1.0), amp4.w >= 0.0);
  let exc_col = vec3<f32>(1.0, 0.78, 0.24); // Radiant resonant excitation gold
  let dip_col = select(vec3<f32>(0.32, 0.82, 1.0), vec3<f32>(1.0, 0.52, 0.85), cross >= 0.0);

  let gnd_frac = (rho00 * p0_sq) / max(1e-4, prob_w);
  let exc_frac = (rho11 * p1_sq) / max(1e-4, prob_w);
  let dip_frac = clamp(abs(cross) / max(1e-4, prob_w), 0.0, 0.85);

  var rgb = base_gnd * clamp(gnd_frac, 0.0, 1.0) + exc_col * clamp(exc_frac * 1.4, 0.0, 1.2);
  rgb = mix(rgb, dip_col, dip_frac * 0.65);
  let shade = clamp(0.96 - 0.35 * pos4.w, 0.3, 1.0);
  let alpha = clamp(0.052 * sqrt(prob_w), 0.0, 0.22);

  var out: TdksPtOut;
  out.clip_pos = vec4<f32>(
    view.x * fov * inv_z / aspect + corner.x * world_r / aspect,
    view.y * fov * inv_z + corner.y * world_r,
    0.45, 1.0
  );
  out.local_uv = corner;
  out.color = vec4<f32>(rgb * shade, alpha);
  return out;
}

@fragment
fn fs_tdks_cloud(in: TdksPtOut) -> @location(0) vec4<f32> {
  if (in.color.a <= 0.004) { discard; }
  let r2 = dot(in.local_uv, in.local_uv);
  if (r2 > 1.0) { discard; }
  let soft = exp(-r2 * 3.1) * (1.0 - r2);
  let a = in.color.a * soft;
  return vec4<f32>(in.color.rgb * a, a);
}
`;function sn(e,t){let n=t.getContext(`webgpu`);if(!n)throw Error(`Failed to acquire WebGPU canvas context on #gpu-canvas`);let r=navigator.gpu.getPreferredCanvasFormat(),i=0,a=0;function o(o,s){t.width=o,t.height=s,n.configure({device:e,format:r,alphaMode:`opaque`,usage:17}),i=o,a=s}o(Math.max(320,t.clientWidth||640),Math.max(240,t.clientHeight||480));let s=e.createShaderModule({code:$t,label:`ulg-lab-atomic-vol-cs`}),c=e.createComputePipeline({label:`ulg-lab-atomic-vol-pipe`,layout:`auto`,compute:{module:s,entryPoint:`build_atomic_volume`}}),l=e.createShaderModule({code:en,label:`ulg-lab-vol-raymarch`}),u=e.createRenderPipeline({label:`ulg-lab-vol-raymarch-pipe`,layout:`auto`,vertex:{module:l,entryPoint:`vs_fullscreen`},fragment:{module:l,entryPoint:`fs_raymarch`,targets:[{format:r}]},primitive:{topology:`triangle-list`}}),d=e.createShaderModule({code:tn,label:`ulg-lab-instanced-atoms`}),f=e.createRenderPipeline({label:`ulg-lab-instanced-atoms-pipe`,layout:`auto`,vertex:{module:d,entryPoint:`vs_atom`},fragment:{module:d,entryPoint:`fs_atom`,targets:[{format:r}]},primitive:{topology:`triangle-list`},depthStencil:{format:`depth24plus`,depthWriteEnabled:!0,depthCompare:`less`}}),p=e.createRenderPipeline({label:`ulg-lab-md-wireframe-pipe`,layout:`auto`,vertex:{module:d,entryPoint:`vs_wire`},fragment:{module:d,entryPoint:`fs_wire`,targets:[{format:r,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`line-list`},depthStencil:{format:`depth24plus`,depthWriteEnabled:!1,depthCompare:`less`}}),m=e.createShaderModule({code:nn,label:`ulg-lab-polytope-shader`}),h=e.createRenderPipeline({label:`ulg-lab-polytope-pipe`,layout:`auto`,vertex:{module:m,entryPoint:`vs_poly`},fragment:{module:m,entryPoint:`fs_poly`,targets:[{format:r}]},primitive:{topology:`triangle-list`}}),g=e.createShaderModule({code:Zt,label:`ulg-lab-comp-nuc-cs`}),_=e.createComputePipeline({label:`ulg-lab-comp-nuc-pipe`,layout:`auto`,compute:{module:g,entryPoint:`build_composite_nuclear_volume`}}),v=e.createShaderModule({code:Qt,label:`ulg-lab-poly-probe-cs`}),y=e.createComputePipeline({label:`ulg-lab-poly-probe-pipe`,layout:`auto`,compute:{module:v,entryPoint:`probe_polytope_point`}}),b={color:{srcFactor:`one`,dstFactor:`one`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one`,operation:`add`}},x={color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}},S=e.createShaderModule({code:rn,label:`ulg-lab-orbital-cloud`}),C=e.createRenderPipeline({label:`ulg-lab-orbital-cloud-pipe`,layout:`auto`,vertex:{module:S,entryPoint:`vs_cloud`},fragment:{module:S,entryPoint:`fs_cloud`,targets:[{format:r,blend:b}]},primitive:{topology:`triangle-list`}}),w=e.createRenderPipeline({label:`ulg-lab-orbital-nuc-pipe`,layout:`auto`,vertex:{module:S,entryPoint:`vs_nucleus`},fragment:{module:S,entryPoint:`fs_nucleus`,targets:[{format:r,blend:b}]},primitive:{topology:`triangle-list`}}),T=e.createRenderPipeline({label:`ulg-lab-orbital-guides-pipe`,layout:`auto`,vertex:{module:S,entryPoint:`vs_guides`},fragment:{module:S,entryPoint:`fs_guides`,targets:[{format:r,blend:x}]},primitive:{topology:`line-list`}}),E=e.createShaderModule({code:an,label:`ulg-lab-photon-shell-scene`}),D=e.createRenderPipeline({label:`ulg-lab-ps-wave-plane-pipe`,layout:`auto`,vertex:{module:E,entryPoint:`vs_wave_plane`},fragment:{module:E,entryPoint:`fs_wave_plane`,targets:[{format:r}]},primitive:{topology:`triangle-list`}}),ee=e.createRenderPipeline({label:`ulg-lab-ps-shells-pipe`,layout:`auto`,vertex:{module:E,entryPoint:`vs_driven_shells`},fragment:{module:E,entryPoint:`fs_shell_dot`,targets:[{format:r,blend:b}]},primitive:{topology:`triangle-list`}}),O=e.createBuffer({size:64,usage:W.UNIFORM|W.COPY_DST}),k=e.createBuffer({size:80,usage:W.UNIFORM|W.COPY_DST}),A=e.createBuffer({size:256,usage:W.STORAGE|W.COPY_DST}),j=e.createBuffer({size:256,usage:W.STORAGE|W.COPY_DST}),M=e.createShaderModule({code:on,label:`ulg-lab-tdks-photon-cloud`}),N=e.createRenderPipeline({label:`ulg-lab-tdks-field-pipe`,layout:`auto`,vertex:{module:M,entryPoint:`vs_tdks_field`},fragment:{module:M,entryPoint:`fs_tdks_field`,targets:[{format:r}]},primitive:{topology:`triangle-list`}}),P=e.createRenderPipeline({label:`ulg-lab-tdks-cloud-pipe`,layout:`auto`,vertex:{module:M,entryPoint:`vs_tdks_cloud`},fragment:{module:M,entryPoint:`fs_tdks_cloud`,targets:[{format:r,blend:b}]},primitive:{topology:`triangle-list`}}),F=e.createBuffer({size:96,usage:W.UNIFORM|W.COPY_DST}),I=e.createBuffer({size:512*4,usage:W.STORAGE|W.COPY_DST}),te=e.createBuffer({size:48,usage:W.UNIFORM|W.COPY_DST}),ne=e.createBuffer({size:48,usage:W.UNIFORM|W.COPY_DST}),L=e.createBuffer({size:32,usage:W.UNIFORM|W.COPY_DST}),re=e.createBuffer({size:16,usage:W.UNIFORM|W.COPY_DST}),ie=e.createBuffer({size:16,usage:W.STORAGE|W.COPY_SRC}),ae=e.createBuffer({size:16,usage:W.MAP_READ|W.COPY_DST}),R=e.createBuffer({size:16,usage:W.UNIFORM|W.COPY_DST}),z=null,oe=0,se=!1,ce=e.createBuffer({size:16,usage:W.STORAGE|W.COPY_DST}),B=e.createBuffer({size:16,usage:W.STORAGE|W.COPY_DST}),le=null,ue=0,de=0,fe=null,pe=0,me=null,he=0,ge=null,_e=0,ve=null,ye=0,be=null,xe=0,Se=null,V=0,Ce=e.createBuffer({size:32,usage:W.UNIFORM|W.COPY_DST}),we=null,Te=0,Ee=null,De=0,Oe=null,ke=null,Ae=null,je=null;function Me(){let n=t.getBoundingClientRect(),r=Math.max(320,Math.floor(n.width)),s=Math.max(240,Math.floor(n.height));return(t.width!==r||t.height!==s||i!==r||a!==s)&&o(r,s),(!le||ue!==r||de!==s)&&(le&&le.destroy(),le=e.createTexture({size:[r,s],format:`depth24plus`,usage:16}),ue=r,de=s),{w:r,h:s}}function Ne({rGrid:t,rhoGrid:n,valenceL:r=0,unpairedCount:i=0,totalElectrons:a=1,dim:o=32}){let s=t.length,l=o*o*o,u=l*16;(!ve||ye!==o)&&(ve&&ve.destroy(),ve=e.createBuffer({label:`ulg-lab-atomic-vol-3d`,size:u,usage:W.STORAGE}),ye=o);let d=Math.max(16,s*4);(!be||xe<d)&&(be=e.createBuffer({size:d,usage:W.STORAGE|W.COPY_DST}),xe=d),(!Se||V<d)&&(Se=e.createBuffer({size:d,usage:W.STORAGE|W.COPY_DST}),V=d);let f=Float32Array.from(t),p=Float32Array.from(n),m=Math.min(8.5,f[s-1]||8),h=i>0?Math.min(1,i/Math.max(1,Math.min(10,a))*1.4):0,g=new ArrayBuffer(32);new Uint32Array(g,0,4).set([o,s,r>>>0,i>>>0]),new Float32Array(g,16,4).set([m,h,0,0]),e.queue.writeBuffer(be,0,f),e.queue.writeBuffer(Se,0,p),e.queue.writeBuffer(Ce,0,g);let _=e.createBindGroup({layout:c.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Ce}},{binding:1,resource:{buffer:be}},{binding:2,resource:{buffer:Se}},{binding:3,resource:{buffer:ve}}]}),v=e.createCommandEncoder({label:`ulg-lab-atomic-vol-enc`}),y=v.beginComputePass();return y.setPipeline(c),y.setBindGroup(0,_),y.dispatchWorkgroups(Math.ceil(l/64)),y.end(),e.queue.submit([v.finish()]),{buffer:ve,dim:o}}function Pe({gpuVec4Buffer:t=null,vec4Data:r=null,scalarData:i=null,dim:a=24,channels:o=4,yaw:s=.48,pitch:c=.28,tint:l=[.34,.76,1],showFermiIso:d=!1}){let{w:f,h:p}=Me(),m=ce,h=B;if(o===4){if(t)m=t;else if(r){let t=Math.max(16,r.byteLength);(!fe||pe<t)&&(fe&&fe.destroy(),fe=e.createBuffer({size:t,usage:W.STORAGE|W.COPY_DST}),pe=t,Oe=null),Oe!==r&&(e.queue.writeBuffer(fe,0,r),Oe=r),m=fe}}else if(i){let t=Math.max(16,i.byteLength);(!me||he<t)&&(me&&me.destroy(),me=e.createBuffer({size:t,usage:W.STORAGE|W.COPY_DST}),he=t,ke=null),ke!==i&&(e.queue.writeBuffer(me,0,i),ke=i),h=me}let g=new ArrayBuffer(48);new Float32Array(g,0,4).set([f,p,s,c]),new Uint32Array(g,16,4).set([a>>>0,o>>>0,+!!d,0]),new Float32Array(g,32,4).set([l[0]??.34,l[1]??.76,l[2]??1,1]),e.queue.writeBuffer(te,0,g);let _=e.createBindGroup({layout:u.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:te}},{binding:1,resource:{buffer:m}},{binding:2,resource:{buffer:h}}]}),v=e.createCommandEncoder({label:`ulg-lab-render-vol`}),y=v.beginRenderPass({colorAttachments:[{view:n.getCurrentTexture().createView(),loadOp:`clear`,storeOp:`store`,clearValue:{r:.02,g:.035,b:.067,a:1}}]});y.setPipeline(u),y.setBindGroup(0,_),y.draw(3),y.end(),e.queue.submit([v.finish()])}function Fe({positionsBuffer:t,velocitiesBuffer:r,atomCount:i,boxLengthsA:a,yaw:o=.45,pitch:s=.32,tint:c=[.65,.8,.96],velocityColorScale:l=28}){if(!t||!r||!(i>0))return;let{w:u,h:d}=Me(),m=Number(a?.[0]||10),h=Number(a?.[1]||m),g=Number(a?.[2]||m),_=Math.max(.055,Math.min(.14,.56/Math.cbrt(Math.max(8,i)))),v=new Float32Array([u,d,o,s,m,h,g,_,c[0]??.65,c[1]??.8,c[2]??.96,l]);e.queue.writeBuffer(ne,0,v);let y=e.createBindGroup({layout:f.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:ne}},{binding:1,resource:{buffer:t}},{binding:2,resource:{buffer:r}}]}),b=e.createBindGroup({layout:p.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:ne}}]}),x=e.createCommandEncoder({label:`ulg-lab-render-md`}),S=x.beginRenderPass({colorAttachments:[{view:n.getCurrentTexture().createView(),loadOp:`clear`,storeOp:`store`,clearValue:{r:.02,g:.035,b:.067,a:1}}],depthStencilAttachment:{view:le.createView(),depthLoadOp:`clear`,depthStoreOp:`store`,depthClearValue:1}});S.setPipeline(f),S.setBindGroup(0,y),S.draw(6,i),S.setPipeline(p),S.setBindGroup(0,b),S.draw(24,1),S.end(),e.queue.submit([x.finish()])}function Ie({positions:t,velocities:n,atomCount:r,boxLengthsA:i,yaw:a,pitch:o,tint:s}){if(!t||!n||!(r>0))return;let c=Math.max(16,t.byteLength),l=Math.max(16,n.byteLength);(!we||Te<c)&&(we=e.createBuffer({size:c,usage:W.STORAGE|W.COPY_DST}),Te=c,je=null),(!Ee||De<l)&&(Ee=e.createBuffer({size:l,usage:W.STORAGE|W.COPY_DST}),De=l,je=null),je!==t&&(e.queue.writeBuffer(we,0,t),e.queue.writeBuffer(Ee,0,n),je=t),Fe({positionsBuffer:we,velocitiesBuffer:Ee,atomCount:r,boxLengthsA:i,yaw:a,pitch:o,tint:s,velocityColorScale:1})}function Le(e){if(!e?.polytopes?.length)return{minLt:1,maxLt:4.2,minLp:2,maxLp:10};let t=Math.log10(Math.max(1,Math.min(...e.polytopes.map(e=>e.axes[0].min)))),n=Math.log10(Math.max(10,Math.max(...e.polytopes.map(e=>e.axes[0].max)))),r=Math.min(...e.polytopes.map(e=>Math.log10(e.axes[1].min))),i=Math.max(...e.polytopes.map(e=>Math.log10(e.axes[1].max))),a=Math.max(.12,(n-t)*.08),o=Math.max(.35,(i-r)*.08);return{minLt:t-a,maxLt:n+a,minLp:r-o,maxLp:i+o}}function Re(t){let n=t.packedGpuAtlas.data,r=Math.max(64,n.byteLength);return(!ge||_e<r)&&(ge&&ge.destroy(),ge=e.createBuffer({size:r,usage:W.STORAGE|W.COPY_DST}),_e=r,Ae=null),Ae!==n&&(e.queue.writeBuffer(ge,0,n),Ae=n),ge}function ze(t=[],n=24){if(!Array.isArray(t)||t.length===0)return null;let r=n*n*n,i=r*16;(!z||oe!==n)&&(z&&z.destroy(),z=e.createBuffer({label:`ulg-lab-comp-nuc-vol-3d`,size:i,usage:W.STORAGE}),oe=n);let a=Math.min(16,t.length),o=new Float32Array(a*4),s=new Float32Array(a*4),c=.01;for(let e=0;e<a;e+=1)c=Math.max(c,Math.abs(t[e].x||0),Math.abs(t[e].y||0),Math.abs(t[e].z||0));let l=a===1?0:.58/c;for(let e=0;e<a;e+=1){let n=t[e],r=Math.max(1.2,Number(n.chargeRadiusFm||3)),i=Math.max(.14,Math.min(.36,.12+.032*r));o.set([(n.x||0)*l,(n.y||0)*l,(n.z||0)*l,i],e*4),s.set([Math.max(1,Number(n.Z||1)),Math.max(0,Number(n.N||0)),1.05,.95],e*4)}e.queue.writeBuffer(R,0,new Uint32Array([n>>>0,a>>>0,0,0])),e.queue.writeBuffer(A,0,o),e.queue.writeBuffer(j,0,s);let u=e.createBindGroup({layout:_.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:R}},{binding:1,resource:{buffer:A}},{binding:2,resource:{buffer:j}},{binding:3,resource:{buffer:z}}]}),d=e.createCommandEncoder({label:`ulg-lab-comp-nuc-enc`}),f=d.beginComputePass();return f.setPipeline(_),f.setBindGroup(0,u),f.dispatchWorkgroups(Math.ceil(r/64)),f.end(),e.queue.submit([d.finish()]),{buffer:z,dim:n}}async function Be(t,n,r){if(!t?.packedGpuAtlas?.data||se)return null;se=!0;try{let i=Re(t);e.queue.writeBuffer(re,0,new Float32Array([Number(n),Number(r),0,0]));let a=e.createBindGroup({layout:y.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:re}},{binding:1,resource:{buffer:i}},{binding:2,resource:{buffer:ie}}]}),o=e.createCommandEncoder({label:`ulg-lab-poly-probe`}),s=o.beginComputePass();s.setPipeline(y),s.setBindGroup(0,a),s.dispatchWorkgroups(1),s.end(),o.copyBufferToBuffer(ie,0,ae,0,16),e.queue.submit([o.finish()]),await ae.mapAsync(W.MAP_READ);let c=new Float32Array(ae.getMappedRange().slice(0,16));ae.unmap();let l=c[3]>.5,u=Math.round(c[2]);return Object.freeze({temperatureK:Number(n),pressurePa:Number(r),hit:l,failClosed:!l,densityKgPerM3:l?c[0]:null,margin:c[1],phaseCode:l?u:-1,phase:l?[`solid`,`liquid`,`gas`,`plasma`][Math.max(0,Math.min(3,u))]||`solid`:`OUT OF DOMAIN (FAIL-CLOSED)`})}finally{se=!1}}function Ve(t,r=null){if(!t?.packedGpuAtlas?.data||!t?.polytopes?.length)return;Me();let i=Re(t),{minLt:a,maxLt:o,minLp:s,maxLp:c}=Le(t),l=r&&Number.isFinite(r.fx)&&Number.isFinite(r.fy)?1:0;e.queue.writeBuffer(L,0,new Float32Array([a,o,s,c,l>.5?r.fx:-1,l>.5?r.fy:-1,l,0]));let u=e.createBindGroup({layout:h.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:L}},{binding:1,resource:{buffer:i}}]}),d=e.createCommandEncoder({label:`ulg-lab-render-polytope`}),f=d.beginRenderPass({colorAttachments:[{view:n.getCurrentTexture().createView(),loadOp:`clear`,storeOp:`store`,clearValue:{r:.02,g:.035,b:.067,a:1}}]});f.setPipeline(h),f.setBindGroup(0,u),f.draw(3),f.end(),e.queue.submit([d.finish()])}function He({pointsBuffer:t,pointCount:r,yaw:i=.48,pitch:a=.3,camDist:o=2.65,pointSize:s=.011,opacity:c=.22,alternateShellColors:l=!0,colorA:u=[1,1,1],colorB:d=[.38,.17,.87],showGuides:f=!1,showNucleus:p=!0}){if(!t||!(r>0))return;let{w:m,h}=Me();e.queue.writeBuffer(O,0,new Float32Array([m,h,i,a,o,s,c,+!!l,u[0]??1,u[1]??1,u[2]??1,+!!f,d[0]??.38,d[1]??.17,d[2]??.87,.018]));let g=e.createBindGroup({layout:C.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:O}},{binding:1,resource:{buffer:t}}]}),_=e.createBindGroup({layout:w.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:O}}]}),v=f?e.createBindGroup({layout:T.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:O}}]}):null,y=e.createCommandEncoder({label:`ulg-lab-render-orbital-cloud`}),b=y.beginRenderPass({colorAttachments:[{view:n.getCurrentTexture().createView(),loadOp:`clear`,storeOp:`store`,clearValue:{r:.008,g:.011,b:.02,a:1}}]});f&&v&&(b.setPipeline(T),b.setBindGroup(0,v),b.draw(50)),b.setPipeline(C),b.setBindGroup(0,g),b.draw(6,r),p&&(b.setPipeline(w),b.setBindGroup(0,_),b.draw(6)),b.end(),e.queue.submit([y.finish()])}function Ue({photonSession:t,shellPointsBuffer:r,shellPointCount:i=1800,yaw:a=.08,pitch:o=1.05,camDist:s=3.25,modeMono:c=!1,probeRgb:l=[.22,.96,.44],slabTint:u=[.94,.85,.52],waveGain:d=1}){if(!t?.ezFieldBuffer||!t?.shellStateBuffer)return;let{w:f,h:p}=Me(),m=r?Math.floor(r.size/16):0,h=Math.max(256,Math.min(2e3,m,Math.trunc(i))),g=t.getParams();e.queue.writeBuffer(k,0,new Float32Array([f,p,a,o,t.nx,t.ny,t.slabX0,t.slabX1,+!!c,+!!g.isMetal,h,s,u[0]??.85,u[1]??.85,u[2]??.9,.24,l[0]??.25,l[1]??.92,l[2]??.45,d]));let _=e.createBindGroup({layout:D.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:k}},{binding:1,resource:{buffer:t.ezFieldBuffer}},{binding:2,resource:{buffer:t.shellStateBuffer}}]}),v=r&&h>0?e.createBindGroup({layout:ee.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:k}},{binding:2,resource:{buffer:t.shellStateBuffer}},{binding:3,resource:{buffer:r}}]}):null,y=e.createCommandEncoder({label:`ulg-lab-render-photon-shell`}),b=y.beginRenderPass({colorAttachments:[{view:n.getCurrentTexture().createView(),loadOp:`clear`,storeOp:`store`,clearValue:{r:.008,g:.012,b:.024,a:1}}]});b.setPipeline(D),b.setBindGroup(0,_),b.draw(6),v&&(b.setPipeline(ee),b.setBindGroup(0,v),b.draw(6,h*20)),b.end(),e.queue.submit([y.finish()])}function We({pairCloud:t,blochSession:r,yaw:i=.24,pitch:a=.2,camDist:o=2.85,modeMono:s=!1,probeRgb:c=[.35,.55,1],emergentReflSrgb:l=[.94,.86,.65],pointSize:u=.012}){if(!t?.posBuffer||!t?.ampBuffer||!r)return;let{w:d,h:f}=Me(),p=r.historyLen,m=new Float32Array(4*p);for(let e=0;e<4;e+=1)m.set(r.channels[e].radHistory,e*p);e.queue.writeBuffer(I,0,m);let h=s?r.channels[3]:r.channels[2],g=r.channels[0],_=r.channels[1],v=r.channels[2],y=s?h.rho11:Math.max(v.rho11,.5*(g.rho11+_.rho11)),b=Math.max(.02,1-y),x=s?2*h.rho01Re:.75*g.rho01Re+.75*_.rho01Re+1.1*v.rho01Re,S=s?h.eNow:(g.eNow+_.eNow+v.eNow)*.45;e.queue.writeBuffer(F,0,new Float32Array([d,f,i,a,o,r.getTimeFs(),r.pulseT0Fs,r.pulseWidthFs,b,y,x,S,h.omega,+!!s,r.getHistCursor(),p,l[0]??.9,l[1]??.85,l[2]??.7,v.rho11,c[0]??.35,c[1]??.55,c[2]??1,u]));let C=e.createBindGroup({layout:N.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:F}},{binding:3,resource:{buffer:I}}]}),w=e.createBindGroup({layout:P.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:F}},{binding:1,resource:{buffer:t.posBuffer}},{binding:2,resource:{buffer:t.ampBuffer}}]}),T=e.createCommandEncoder({label:`ulg-lab-render-tdks`}),E=T.beginRenderPass({colorAttachments:[{view:n.getCurrentTexture().createView(),loadOp:`clear`,storeOp:`store`,clearValue:{r:.005,g:.008,b:.016,a:1}}]});E.setPipeline(N),E.setBindGroup(0,C),E.draw(6),E.setPipeline(P),E.setBindGroup(0,w),E.draw(6,t.pointCount),E.end(),e.queue.submit([T.finish()])}return Object.freeze({backend:`webgpu`,format:r,buildAtomicVolumeOnGpu:Ne,buildCompositeNuclearVolumeOnGpu:ze,renderVolume3D:Pe,renderOrbitalPointCloud:He,renderPhotonShellScene:Ue,renderTdksPhotonCloudScene:We,renderLiveMd:Fe,renderStaticCrystalLattice:Ie,renderPolytopeAtlas:Ve,probePolytopeAtlasOnGpu:Be,getPolytopeAxisBounds:Le})}try{xt(j),Xt(j)}catch{}var cn=new Map,ln=0,un=new _({artifactCache:{async put(e){ln+=1;let t=`ulg-lab://closure/${e.closureId||`item`}#${ln}`;return cn.set(t,e),{uri:t,hash:e.inputHash||String(ln)}},async get(e){return cn.get(e?.uri)||null}}}),dn=document.getElementById(`gpu-canvas`),fn=document.getElementById(`gpu-hud-title`),pn=document.getElementById(`gpu-hud-sub`),mn=document.getElementById(`gpu-overlay-bottom`),hn=document.getElementById(`sim-controls`),gn=document.getElementById(`active-specimen-pill`),_n=document.getElementById(`specimen-history`),vn=document.getElementById(`plot1`),yn=document.getElementById(`plot2`),bn=document.getElementById(`plot3`),xn=document.getElementById(`pt-grid`),Sn=document.getElementById(`z-input`),Cn=document.getElementById(`a-input`),wn=document.getElementById(`reset-a-btn`),Tn=document.getElementById(`solve-z-btn`),En=document.getElementById(`reactant-a`),Dn=document.getElementById(`reactant-b`),On=document.getElementById(`run-reaction-btn`),kn=document.getElementById(`reaction-results`),An=document.getElementById(`compound-input`),jn=document.getElementById(`solve-compound-btn`),Mn=document.getElementById(`status-badge`),Nn=document.getElementById(`bundle-readout`),Pn=document.getElementById(`g7-card`),Fn=document.getElementById(`plot1-title`),In=document.getElementById(`plot2-title`),Ln=document.getElementById(`plot3-title`),G=null,K=null,q=`nuclear`,J=`element`,Y=null,Rn=null,X=null,zn=null,Bn=null,Vn=null,Hn=null,Un=null,Wn=[],Gn=26,Kn=null,qn=[],Jn=null,Yn=null,Xn=null,Zn=null,Qn=null,$n=null,er=!1,tr=null,nr=null,rr=!1,ir=null,ar=null,or=[],sr=!1,cr=null,Z={tdsePlaying:!0,atomicViewMode:`cloud`,n:3,l:2,m:0,functional:`pbe`,relativisticSpinOrbit:!0,pointCount:24e4,pointSize:.012,opacity:.24,alternateShellColors:!0,colorMode:0,shellColorA:`#ffffff`,shellColorB:`#612bde`,showGuides:!1,autoRotate:!1,cloudSeed:1,molOrbitalMode:0,crystalViewMode:`tdks-atom`,photonPlaying:!0,photonModeMono:!1,probeWavelengthNm:440,mdPlaying:!0,mdTargetTempK:300,nebImageIdx:0,nebPlaying:!1,nebLastTickMs:0,polytopeRegime:`lab`,polytopeProbe:null},lr=.42,ur=.28,dr=2.85,fr=!1,pr=0,mr=0,hr=[`s`,`p`,`d`,`f`,`g`,`h`],gr=new Set([2,10,18,36,54,86,118]),_r=new Set([9,17,35,53,85,117]),vr=new Set([3,11,19,37,55,87]);function yr(e){let t=String(e||`#ffffff`).replace(`#`,``).trim();if(t.length!==6)return[1,1,1];let n=Number.parseInt(t,16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]}function br(e){let t=Math.max(380,Math.min(780,Number(e)||550)),n=0,r=0,i=0;return t<440?(n=-(t-440)/60,i=1):t<490?(r=(t-440)/50,i=1):t<510?(r=1,i=-(t-510)/20):t<580?(n=(t-510)/70,r=1):t<645?(n=1,r=-(t-645)/65):n=1,[Math.max(.05,n),Math.max(.05,r),Math.max(.05,i)]}function xr(e){let t=Array.isArray(e)&&e.length===3?e:[.7,.75,.85];return`rgb(${Math.round(Math.max(0,Math.min(1,t[0]))*255)}, ${Math.round(Math.max(0,Math.min(1,t[1]))*255)}, ${Math.round(Math.max(0,Math.min(1,t[2]))*255)})`}function Q(e,t=3){return e==null||!Number.isFinite(e)?String(e??`—`):Math.abs(e)>=1e4||Math.abs(e)>0&&Math.abs(e)<.01?e.toExponential(2):e.toFixed(t)}function Sr(){return J===`compound`&&X?.bundle?X.bundle:Y?.bundle||null}function Cr(){return J===`compound`&&X?.bundle?X.bundle.electromagnetic:Y?.visualData?.em||Y?.bundle?.electromagnetic||null}function wr(e){let t=c(e),n=[...t].reverse().find(e=>e.l===2&&e.occupancy>0);if(n&&n.n>=3)return{n:n.n,l:n.l,m:2};let r=t.find(e=>e.occupancy<2*(2*e.l+1));if(r)return{n:r.n,l:r.l,m:r.l>=2?2:0};let i=t[t.length-1]||{n:1,l:0};return{n:i.n,l:i.l,m:0}}function Tr(e,t){let n=c(e),r=[...n].reverse().find(e=>e.l===2&&e.occupancy>0);if(r)return{n0:r.n,l0:2,n1:r.n+1,l1:1,m:0};let i=[...n].reverse().find(e=>e.l===1&&e.occupancy>0);if(i)return{n0:i.n,l0:1,n1:i.n+1,l1:0,m:0};let a=n[n.length-1]||{n:1,l:0};return{n0:a.n,l0:0,n1:Math.max(2,a.n),l1:1,m:0}}function Er(e,t){fn&&(fn.textContent=e),pn&&(pn.textContent=t)}function Dr(e){mn&&(mn.innerHTML=e||``)}function Or(e){let t=`${e.kind}:${e.label}`,n=qn.findIndex(e=>`${e.kind}:${e.label}`===t);n>=0&&qn.splice(n,1),qn.unshift(e),qn.length>6&&qn.pop(),kr()}function kr(){let e=Sr();if(!e)return;let t=xr(e.electromagnetic?.opticalSrgb||[.7,.78,.9]),n=J===`compound`;gn.className=`specimen-pill${n?` backfed`:``}`,gn.innerHTML=`<i class="swatch" style="background:${t};"></i>`+(n?`<span>BACKFED COMPOUND: ${e.materialKey}</span> <span style="opacity:0.75;font-weight:400;">(${e.mechanical.crystalStructure} · ${e.electromagnetic.isMetal?`Metal`:`Gap ${Q(e.electromagnetic.bandGapEv,2)} eV`})</span>`:`<span>ELEMENT: ${e.nuclear.isotope} (Z=${e.atomicNumber})</span> <span style="opacity:0.75;font-weight:400;">(${e.mechanical.crystalStructure} · ${e.electromagnetic.isMetal?`Metal`:`Gap ${Q(e.electromagnetic.bandGapEv,2)} eV`})</span>`),_n.innerHTML=qn.map((e,t)=>`<button class="chip${e.kind===`compound`?` react`:``}" data-hist-idx="${t}">${e.label}</button>`).join(``);for(let e of _n.querySelectorAll(`[data-hist-idx]`))e.addEventListener(`click`,()=>{let t=qn[Number(e.dataset.histIdx)];t&&(t.kind===`element`?(Gn=t.Z,Kn=t.A??null,Sn.value=String(Gn),Cn&&(Cn.value=String(Kn??w(Gn))),ti(Gn,Kn)):(An.value=t.formula,oi(t.formula,{backfeedAllTabs:!0})))})}async function Ar(e,t=!1){if(q!==`polytope`||!Vn||!K)return;let n=dn.getBoundingClientRect(),r=(e.clientX-n.left)/Math.max(1,n.width),i=1-(e.clientY-n.top)/Math.max(1,n.height);if(r<.06||r>.96||i<.08||i>.9)return;let a=(r-.06)/.9,o=(i-.08)/.82,s=K.getPolytopeAxisBounds(Vn),c=s.minLt+a*(s.maxLt-s.minLt),l=s.minLp+o*(s.maxLp-s.minLp),u=10**c,d=10**l,f=await K.probePolytopeAtlasOnGpu(Vn,u,d);if(!f)return;let p=Sr(),m=f.hit&&p?v(p,f.phase,u,d):null,h=f.hit&&m>0?Math.abs(f.densityKgPerM3-m)/m*100:null;Z.polytopeProbe={...f,fx:a,fy:o,logT:c,logP:l,eosRho:m,relErrPct:h,locked:t},window.__ulgElementsLabState&&(window.__ulgElementsLabState.polytopeProbe=Z.polytopeProbe),$()}function jr(){let e=!1;dn.addEventListener(`pointerdown`,e=>{if(q===`polytope`){Ar(e,!0);return}fr=!0,pr=e.clientX,mr=e.clientY,dn.setPointerCapture?.(e.pointerId)}),dn.addEventListener(`pointermove`,t=>{if(q===`polytope`){e||(e=!0,Ar(t,!1).finally(()=>{e=!1}));return}if(!fr)return;let n=t.clientX-pr,r=t.clientY-mr;pr=t.clientX,mr=t.clientY,lr+=n*.008,ur=Math.max(-1.25,Math.min(1.25,ur+r*.008)),Zr()});let t=()=>{fr=!1};dn.addEventListener(`pointerup`,t),dn.addEventListener(`pointercancel`,t),dn.addEventListener(`wheel`,e=>{q!==`polytope`&&(e.preventDefault(),dr=Math.max(1.4,Math.min(5.2,dr+Math.sign(e.deltaY)*.18)),Zr())},{passive:!1})}function Mr(){xn.innerHTML=``;for(let e=1;e<=118;e+=1){let t=document.createElement(`button`),n=`el-btn`;gr.has(e)?n+=` noble`:_r.has(e)?n+=` halogen`:vr.has(e)?n+=` alkali`:(e>=21&&e<=30||e>=39&&e<=48||e>=72&&e<=80)&&(n+=` metal-d`),e===Gn&&J===`element`&&(n+=` active`),t.className=n,t.dataset.z=String(e),t.innerHTML=`<small>${e}</small>${p[e-1]}`,t.addEventListener(`click`,()=>{Gn=e,Kn=null,Sn.value=String(e),Cn.value=String(w(e)),ti(e,null)}),xn.appendChild(t)}}function Nr(){for(let e of xn.querySelectorAll(`.el-btn`))e.classList.toggle(`active`,J===`element`&&Number(e.dataset.z)===Gn)}function Pr(e,t=null){let n=e.nuclear.dominantMode?`${e.nuclear.spinI}${e.nuclear.parity} (μ=${Q(e.nuclear.magneticMomentMuN,2)} μ_N) · ${e.nuclear.dominantMode}`:`M=${Q(e.nuclear.molarMassU,3)} u`,r=t&&t.steps?.length>0?`${t.steps.slice(0,3).map(e=>`${e.isotope}→${e.daughterIsotope}(${e.mode})`).join(` → `)}${t.steps.length>3?` …→${t.endIsotope}`:``}`:e.nuclear.dominantMode===`stable`?`Stable (no decay chain)`:`—`,i=e.atomic?.hyperfineSplittingHz,a=e.electromagnetic?.interbandOscillators||[],o=a.length?a.slice(0,2).map(e=>`${e.transitionLabel||`d→p`} ${Q(e.energyEv,2)}eV`).join(`, `):e.electromagnetic.isMetal?`Drude free-e`:`UV gap ${Q(e.electromagnetic.bandGapEv,2)}eV`,s=[[`Specimen / Family`,`${e.materialKey} (${e.family})`],[`Accuracy Tier`,e.accuracyTier],[`Nuclear`,e.nuclear.isotope?`${e.nuclear.isotope} (M=${Q(e.nuclear.atomicMassU,3)} u) · B/A=${Q(e.nuclear.bindingPerNucleonMeV,2)} MeV · R=${Q(e.nuclear.chargeRadiusFm,2)} fm`:`Z=${e.nuclear.totalProtonsZ}, A=${e.nuclear.totalNucleonsA}`],[`Spin / Mode`,n],...t?[[`Decay Chain`,r]]:[],[`Quantum Solver`,e.atomic.totalEnergyHa==null?`Ionic/Covalent DFT`:`${Q(e.atomic.totalEnergyHa,2)} Ha (${e.atomic.relativisticMethod||`GPU RHF`})`],...Number.isFinite(i)?[[`Isotope HFS / NMS`,`${Q(i*1e-6,2)} MHz · ΔE=${Q(e.atomic.isotopeMassShiftHa,2)} Ha`]]:[],[`Crystal / Density`,`${e.mechanical.crystalStructure} · ${Q(e.mechanical.densityKgPerM3,0)} kg/m³`],[`Moduli / Debye`,`K=${Q(e.mechanical.bulkModulusPa*1e-9,1)} GPa · Θ_D=${Q(e.mechanical.debyeTemperatureK,0)} K`],[`EM / Band Gap`,`${e.electromagnetic.isMetal?`Metal (ω_p=${Q(e.electromagnetic.plasmaEnergyEv,1)} eV)`:`Gap ${Q(e.electromagnetic.bandGapEv,2)} eV`} · σ=${Q(e.electromagnetic.electricalConductivitySPerM)} S/m`],[`Shell Transitions`,o],[`Optics (550 nm)`,`n=${Q(e.electromagnetic.refractiveIndex550Nm,2)} · R=${Q((e.electromagnetic.reflectance550Nm??0)*100,1)}%`],[`Magnetism`,`${e.electromagnetic.magneticPhase}${e.electromagnetic.magneticMomentMuB?` (${Q(e.electromagnetic.magneticMomentMuB,2)} μ_B)`:``}`],[`Melting / Boiling`,`${Q(e.thermodynamic.meltingPointK,1)} K / ${Q(e.thermodynamic.boilingPointK,1)} K`],[`Thermal k / C_p`,`${Q(e.thermodynamic.thermalConductivityWPerMK,2)} W/mK · ${Q(e.thermodynamic.heatCapacityCpJPerKgK,0)} J/kgK`]];Nn.innerHTML=`<h3>5-Domain Bundle (${e.materialKey})</h3>`+s.map(([e,t])=>`<div class="kv"><span>${e}</span><span>${t}</span></div>`).join(``)}function Fr(e,t){let n=xr(e.electromagnetic.opticalSrgb||[.7,.75,.8]),r=$n?.emergentReflectedSrgb?xr($n.emergentReflectedSrgb):null,i=`<h3>Accuracy Tier &amp; G7 Advisory</h3>
    <div class="kv"><span>Status</span><span>${e.provenance.status} (scientificValidation: false)</span></div>
    <div class="kv"><span>Tier</span><span>${e.accuracyTier}</span></div>
    <div class="kv"><span>GPU Optical Color</span><span><i class="swatch" style="background:${n};"></i> ${n}</span></div>`;r&&(i+=`<div class="kv"><span>FDTD Reflected Color</span><span><i class="swatch" style="background:${r};"></i> ${r}</span></div>`),t?.hasReference?i+=`
      <div class="kv"><span>G7 B/A Error</span><span>${Q(t.bindingPerNucleonRelErr*100,2)}%</span></div>
      <div class="kv"><span>G7 Density Error</span><span>${Q(t.densityRelErr*100,1)}%</span></div>
      <div class="kv"><span>G7 Magnetic Match</span><span>${t.magneticPhaseMatch?`YES`:`DIFF`} (ref: ${t.reference.mag})</span></div>`:t?.note&&(i+=`<div style="font-size:10.5px;color:var(--muted);margin-top:4px;">${t.note}</div>`),Pn.innerHTML=i}function Ir(e){return e.getContext(`2d`,{willReadFrequently:!0})}function Lr(e,t,{label:n=``,yMin:r=null,yMax:i=null,hLine:a=null,vLine:o=null,xTicks:s=null}={}){let c=Ir(e),l=e.width,u=e.height;c.fillStyle=`#060b14`,c.fillRect(0,0,l,u);let d=t.filter(e=>e.xs?.length>=2&&e.ys?.length>=2);if(!d.length)return;let f=1/0,p=-1/0,m=1/0,h=-1/0;for(let e of d){for(let t of e.xs)t<f&&(f=t),t>p&&(p=t);for(let t of e.ys)t<m&&(m=t),t>h&&(h=t)}r!=null&&(m=r),i!=null&&(h=i),a!=null&&(m=Math.min(m,a.y),h=Math.max(h,a.y));let g=Math.max(1e-9,p-f),_=Math.max(1e-9,h-m),v=e=>26+(e-f)/g*(l-26-10),y=e=>u-18-(e-m)/_*(u-19-18);if(c.strokeStyle=`rgba(148,163,184,0.14)`,c.lineWidth=1,c.beginPath(),c.moveTo(26,u-18),c.lineTo(l-10,u-18),c.stroke(),a!=null){let e=y(a.y);c.save(),c.strokeStyle=a.color||`#facc15`,c.setLineDash([4,3]),c.lineWidth=1.2,c.beginPath(),c.moveTo(26,e),c.lineTo(l-10,e),c.stroke(),c.fillStyle=a.color||`#facc15`,c.font=`9.5px Inter, sans-serif`,c.fillText(a.label||``,l-10-46,Math.max(27,e-3)),c.restore()}if(o!=null){let e=v(o.x);c.save(),c.strokeStyle=o.color||`#facc15`,c.setLineDash([4,3]),c.lineWidth=1.2,c.beginPath(),c.moveTo(e,19),c.lineTo(e,u-18),c.stroke(),c.fillStyle=o.color||`#facc15`,c.font=`9.5px Inter, sans-serif`,c.fillText(o.label||``,Math.min(l-42,e+3),29),c.restore()}for(let e of d){c.strokeStyle=e.color||`#56c2ff`,c.lineWidth=e.width||1.75,c.beginPath();for(let t=0;t<e.xs.length;t+=1){let n=v(e.xs[t]),r=y(e.ys[t]);t===0?c.moveTo(n,r):c.lineTo(n,r)}c.stroke(),e.fill&&(c.lineTo(v(e.xs[e.xs.length-1]),u-18),c.lineTo(v(e.xs[0]),u-18),c.closePath(),c.fillStyle=e.fill,c.fill())}if(Array.isArray(s)){c.fillStyle=`#94a3b8`,c.font=`9.5px Inter, sans-serif`;for(let e of s){let t=v(e.x);c.fillText(e.label,Math.max(26,Math.min(l-22,t-5)),u-4)}}c.fillStyle=`#a5bce0`,c.font=`10px Inter, sans-serif`,c.fillText(n,8,13)}function Rr(e,t,n,r={}){Lr(e,[{xs:t,ys:n,color:r.color||`#56c2ff`,width:r.width||1.8}],r)}function zr(e,t){let n=Ir(e),r=e.width,i=e.height;if(n.fillStyle=`#060b14`,n.fillRect(0,0,r,i),!t?.chartData)return;let{maxZ:a,maxN:o}=t.chartDims,s=[null,`#22c55e`,`#38bdf8`,`#f472b6`,`#facc15`,`#ef4444`];for(let e=1;e<=a;e+=1)for(let c=0;c<o;c+=1){let l=Math.round(t.chartData[((e-1)*o+c)*4+3]);if(l<=0)continue;n.fillStyle=s[l]||`#fff`;let u=12+c/o*(r-24),d=i-12-e/a*(i-24);n.fillRect(u,d,2,2)}let c=12+t.N/o*(r-24),l=i-12-t.Z/a*(i-24);n.strokeStyle=`#ffffff`,n.lineWidth=1.5,n.strokeRect(c-4,l-4,8,8)}function Br(e,t,n){if(!n){Rr(e,Array.from(t.alphaWkb.rFm),Array.from(t.alphaWkb.vMeV),{label:`V_nuc + V_coul (MeV vs fm)`,color:`#facc15`});return}let r=Array.from(n.rGridFm),i=Array.from(n.potRawMeV),a=Array.from(n.prob),o=Math.max(12,...i),s=Math.max(1e-6,...a),c=a.map(e=>n.qEffMeV+e/s*(o*.65));Lr(e,[{xs:r,ys:i,color:`#facc15`,width:1.8},{xs:r,ys:c,color:`#38bdf8`,width:1.8,fill:`rgba(56, 189, 248, 0.24)`}],{label:`GPU TDSE |ψ(r,t)|² (cyan) vs V(r) (gold) · P_tunnel=${Q(n.pTunneled*100,2)}%`,hLine:{y:n.qEffMeV,color:`#f472b6`,label:`Q=${Q(n.qEffMeV,1)}MeV`}})}function Vr(e,t,n=``){let r=Ir(e),i=e.width,a=e.height;if(r.fillStyle=`#060b14`,r.fillRect(0,0,i,a),!t?.channels){r.fillStyle=`#94a3b8`,r.font=`11px Inter, sans-serif`,r.fillText(`Stepping Maxwell-ADE-FDTD photon wavepackets on WebGPU…`,10,68);return}let o=t.channels,s=[`610nm R`,`535nm G`,`440nm B`,`${Math.round(o[3].wavelengthNm)}nm`],c=[`#ef4444`,`#22c55e`,`#3b82f6`,xr(br(o[3].wavelengthNm))],l=(i-12-78)/4;r.fillStyle=`#a5bce0`,r.font=`10px Inter, sans-serif`,r.fillText(`${n}Live GPU FDTD: Reflectance R (solid) vs Shell Absorption A (hatch)`,8,13);for(let e=0;e<4;e+=1){let n=o[e],i=12+e*l,u=Math.max(12,l*.34),d=a-22-22,f=Math.min(1,n.reflectance)*d,p=Math.min(1,n.absorption)*d,m=Math.min(1,n.transmittance)*d;r.fillStyle=c[e],r.fillRect(i+3,a-22-f,u,f),r.fillStyle=`rgba(192, 132, 252, 0.85)`,r.fillRect(i+5+u,a-22-p,u*.72,p),!t.isMetal&&m>1&&(r.strokeStyle=`#38bdf8`,r.lineWidth=1.5,r.strokeRect(i+3,a-22-m,u,m)),r.fillStyle=`#cbd5e1`,r.font=`9px ui-monospace, monospace`,r.fillText(s[e],i+2,a-7),r.fillText(`R${Math.round(n.reflectance*100)}%`,i+2,Math.max(30,a-22-f-2))}let u=i-66;r.fillStyle=xr(t.emergentReflectedSrgb),r.fillRect(u,26,54,48),r.strokeStyle=`rgba(255,255,255,0.6)`,r.lineWidth=1.2,r.strokeRect(u,26,54,48),r.fillStyle=`#e2e8f0`,r.font=`9px Inter, sans-serif`,r.fillText(`Emergent`,u+4,86),r.fillText(`FDTD RGB`,u+3,97)}function Hr(e,t,n,r,i,a){if(Array.isArray(t)&&t.length>=2&&Array.isArray(n)){let o=[{xs:t,ys:n.map(e=>e*100),color:`#fbbf24`,width:2}];if(Array.isArray(r)&&r.length===t.length){let e=Math.max(1,...r);o.push({xs:t,ys:r.map(t=>t/e*80),color:`#38bdf8`,width:1.4})}if(Lr(e,o,{label:`UV-Vis R(λ)% (gold) & scaled n(λ) (blue) — ${a}`,yMin:0,yMax:105,xTicks:[{x:380,label:`380nm`},{x:550,label:`550nm`},{x:740,label:`780nm`}]}),Array.isArray(i)&&i.length===3){let t=Ir(e);t.fillStyle=xr(i),t.fillRect(e.width-34,6,24,13),t.strokeStyle=`rgba(255,255,255,0.45)`,t.strokeRect(e.width-34,6,24,13)}}else Rr(e,[380,550,780],[0,0,0],{label:`No spectral samples available`,color:`#64748b`,yMin:0,yMax:100})}function Ur(e,t,n,r,i){let a=Ir(e),o=e.width,s=e.height;a.fillStyle=`#060b14`,a.fillRect(0,0,o,s);let c=o*.5,l=s*.54,u=Math.min(o,s)*.36;a.strokeStyle=`rgba(148,163,184,0.18)`,a.lineWidth=1,a.beginPath(),a.arc(c,l,u,0,Math.PI*2),a.moveTo(c-u,l),a.lineTo(c+u,l),a.moveTo(c,l-u),a.lineTo(c,l+u),a.stroke();let d=e=>{let r=Math.cos(e),i=Math.sin(e),a=Math.abs(n);return t===0?.72:t===1?a===0?r:i:t===2?a===0?.5*(3*r*r-1):a===1?1.5*i*r:.75*i*i:.5*r*(5*r*r-3)};for(let e of[1,-1]){a.beginPath();let t=!1;for(let n=0;n<=180;n+=1){let r=n/180*Math.PI*2,i=d(r),o=i*e>0?Math.abs(i)*u:0,s=c+o*Math.sin(r),f=l-o*Math.cos(r);t?a.lineTo(s,f):(a.moveTo(s,f),t=!0)}a.closePath(),a.fillStyle=e>0?`rgba(255, 255, 255, 0.25)`:`rgba(97, 43, 222, 0.35)`,a.fill(),a.strokeStyle=e>0?`#ffffff`:`#8b5cf6`,a.lineWidth=1.6,a.stroke()}a.fillStyle=`#a5bce0`,a.font=`10px Inter, sans-serif`,a.fillText(`${r} · |Y_${t},${n}(θ)| polar slice · unpaired=${i}`,8,13)}function Wr(e,t,n=null){let r=Ir(e),i=e.width,a=e.height;if(r.fillStyle=`#060b14`,r.fillRect(0,0,i,a),!t?.polytopes?.length)return;let o={solid:`rgba(86, 194, 255, 0.36)`,liquid:`rgba(52, 211, 153, 0.38)`,gas:`rgba(251, 146, 60, 0.34)`,plasma:`rgba(192, 132, 252, 0.36)`},s={solid:`#56c2ff`,liquid:`#34d399`,gas:`#fb923c`,plasma:`#c084fc`},c=Math.log10(Math.max(1,Math.min(...t.polytopes.map(e=>e.axes[0].min)))),l=Math.log10(Math.max(10,Math.max(...t.polytopes.map(e=>e.axes[0].max)))),u=Math.min(...t.polytopes.map(e=>Math.log10(e.axes[1].min))),d=Math.max(...t.polytopes.map(e=>Math.log10(e.axes[1].max))),f=e=>30+(Math.log10(Math.max(1,e))-c)/Math.max(1e-6,l-c)*(i-30-10),p=e=>a-20-(e-u)/Math.max(1e-6,d-u)*(a-18-20);for(let e of t.polytopes){let t=Math.log10(e.axes[1].min),n=Math.log10(e.axes[1].max),i=[],a=[];for(let r=0;r<=12;r+=1){let o=t+r/12*(n-t),s=e.axes[0].min,c=e.axes[0].max;for(let t of e.inequalities||[]){let e=t.a[0],n=t.a[1],r=t.b;if(Math.abs(e)>1e-9){let t=(r-n*o)/e;e>0?c=Math.min(c,t):s=Math.max(s,t)}}c>s&&(i.push([f(s),p(o)]),a.push([f(c),p(o)]))}if(i.length>=2){r.beginPath(),r.moveTo(i[0][0],i[0][1]);for(let e of i)r.lineTo(e[0],e[1]);for(let e=a.length-1;e>=0;--e)r.lineTo(a[e][0],a[e][1]);r.closePath(),r.fillStyle=o[e.phase]||`rgba(255,255,255,0.2)`,r.fill(),r.strokeStyle=s[e.phase]||`#93c5fd`,r.lineWidth=1.2,r.stroke()}}if(n){let e=f(n.temperatureK),t=p(Math.log10(Math.max(1e-6,n.pressurePa)));r.strokeStyle=n.hit?`#facc15`:`#f87171`,r.lineWidth=1.8,r.beginPath(),r.arc(e,t,5,0,Math.PI*2),r.stroke()}r.fillStyle=`#a5bce0`,r.font=`9.5px Inter, sans-serif`,r.fillText(`A x <= b (${t.materialKey}, ${t.polytopeCount} cells)`,30,12),r.fillText(`T: ${Math.round(10**c)}..${Math.round(10**l)} K`,30,a-5),r.fillText(`log10 P: ${u.toFixed(0)}..${d.toFixed(0)}`,i-102,a-5)}function Gr(){if(!G)return;if(J===`compound`&&X?.visualData?.molQm?.atomOrbitalParams){let e=X.visualData.molQm.atomOrbitalParams,t=Yn?.pointsBuffer??null;if(Yn=bt(G,{posZeta:e.posZeta,weights:e.weights,boxHalfBohr:e.boxHalfBohr,mode:Z.molOrbitalMode,pointCount:Math.min(24e4,Z.pointCount),seed:Z.cloudSeed,reuseBuffer:t}),t&&t!==Yn?.pointsBuffer)try{t.destroy()}catch{}return}if(!Y?.visualData?.atom)return;let e=Y.visualData.atom;Z.l=Math.max(0,Math.min(Z.n-1,Z.l)),Z.m=Math.max(-Z.l,Math.min(Z.l,Z.m));let t=null;if(Array.isArray(e.orbitalWavefunctions)&&Array.isArray(e.orbitals)){let n=e.orbitals.findIndex(e=>e.n===Z.n&&e.l===Z.l);n>=0&&e.orbitalWavefunctions[n]&&(t=e.orbitalWavefunctions[n])}let n=Jn?.pointsBuffer??null;if(Jn=yt(G,{Z:e.atomicNumberZ,n:Z.n,l:Z.l,m:Z.m,pointCount:Z.pointCount,rGrid:e.radialGrid?.r||null,orbitalU:t,screeningExchange:Z.functional!==`bare`,relativisticSpinOrbit:Z.relativisticSpinOrbit,colorMode:Z.colorMode,seed:Z.cloudSeed,reuseBuffer:n}),n&&n!==Jn?.pointsBuffer)try{n.destroy()}catch{}let r=Tr(e.atomicNumberZ,e),i=(t,n)=>{if(!Array.isArray(e.orbitalWavefunctions)||!Array.isArray(e.orbitals))return null;let r=e.orbitals.findIndex(e=>e.n===t&&e.l===n);return r>=0?e.orbitalWavefunctions[r]:null},a=Xn?.posBuffer??null,o=Xn?.ampBuffer??null;Xn=Et(G,{Z:e.atomicNumberZ,n0:r.n0,l0:r.l0,n1:r.n1,l1:r.l1,m:r.m,rGrid:e.radialGrid?.r||null,u0:i(r.n0,r.l0),u1:i(r.n1,r.l1),pointCount:18e4,screeningExchange:Z.functional!==`bare`,relativisticSpinOrbit:Z.relativisticSpinOrbit,seed:Z.cloudSeed,reusePosBuffer:a,reuseAmpBuffer:o})}function Kr(){return J===`compound`&&Yn?.pointsBuffer?Yn:Jn}function qr(){if(!G)return;if(Qn){try{Qn.destroy()}catch{}Qn=null}$n=null;let e=Cr();if(e){Zn=Dt(e,{probeWavelengthNm:Z.probeWavelengthNm});for(let e=0;e<45;e+=1)Zn.stepFs(.08);if(J===`compound`&&X){let e=(X.bundle?.nuclear?.isotopologueSites||[]).reduce((e,t)=>Math.max(e,t.Z||1),8),t=Tr(e,null);Xn=Et(G,{Z:e,n0:t.n0,l0:t.l0,n1:t.n1,l1:t.l1,m:t.m,pointCount:16e4,screeningExchange:!0,relativisticSpinOrbit:!0,reusePosBuffer:Xn?.posBuffer??null,reuseAmpBuffer:Xn?.ampBuffer??null})}Qn=Ut(G,e,{probeWavelengthNm:Z.probeWavelengthNm});for(let e=0;e<5;e+=1)Qn.stepSync(24);Qn.readTelemetry().then(t=>{if(!t)return;$n=t;let n=Sr();n&&Yt({closureRegistry:un,materialKey:n.materialKey,electromagnetic:e,telemetry:t}).catch(()=>{}),q===`crystal`&&$()}).catch(()=>{})}}function Jr(){if(!G)return;if(tr){try{tr.destroy()}catch{}tr=null}nr=null;let e=Y?.visualData?.nuclear;e&&(tr=Jt(G,e))}function Yr(e=null){if(ir){try{ir.destroy()}catch{}ir=null}if(ar=null,or=[],cr=null,G){if(J===`compound`&&X?.visualData?.mdConfig){let t=X.visualData.mdConfig,n=X.bundle,r=Math.max(20,Number(n.thermodynamic.meltingPointK||300)),i=e??Math.max(20,Math.min(2400,.7*r));Z.mdTargetTempK=Math.round(i);let a=Oe({crystalStructure:t.crystalStructure,cellsPerSide:2,latticeConstantA:t.latticeConstantA,massU:t.massU,temperatureK:i});ir=De(G,{...a,potentialModel:t.potentialModel,epsilonEv:t.epsilonEv,sigmaOrR0A:t.sigmaOrR0A,alphaOrLambda:t.alphaOrLambda,rcutA:t.rcutA,eamAEv:t.eamAEv,eamBeta:t.eamBeta,dtFs:t.dtFs,targetTemperatureK:i,thermostatCouplingFs:35}),cr={label:n.materialKey,crystalStructure:t.crystalStructure,modelName:t.modelName,rcutA:t.rcutA,meltingPointK:r},ar=X.visualData.mdTelemetry}else if(Y?.visualData?.thermo?.potential){let t=Y.visualData.bulk,n=Y.visualData.thermo.potential,r=Y.bundle,i=Math.max(1,Number(r.nuclear.atomicMassU||28)),a=Math.max(20,Number(r.thermodynamic.meltingPointK||600)),o=e??Math.max(30,Math.min(1800,.7*a));Z.mdTargetTempK=Math.round(o);let s=Oe({crystalStructure:t.crystalStructure,cellsPerSide:3,latticeConstantA:Math.max(2.4,Number(t.latticeConstantA||3.6)),massU:i,temperatureK:o});ir=De(G,{...s,potentialModel:n.potentialModel,epsilonEv:n.epsilonEv,sigmaOrR0A:n.sigmaOrR0A,alphaOrLambda:n.alphaOrLambda,rcutA:n.rcutA,eamAEv:n.eamAEv,eamBeta:n.eamBeta,swGamma:n.swGamma,dtFs:Math.min(2,Math.max(.45,.09*Math.sqrt(i))),targetTemperatureK:o,thermostatCouplingFs:35}),cr={label:r.nuclear.isotope||r.symbol,crystalStructure:t.crystalStructure,modelName:n.modelName,rcutA:n.rcutA,meltingPointK:a},ar=Y.visualData.thermo.mdTelemetry}ar&&or.push({t:0,T:ar.temperatureK,msd:ar.msdA2})}}function Xr(){if(!hn)return;let e=Sr();if(q===`nuclear`)hn.innerHTML=`
      <div class="ctrl-group">
        <button id="ctrl-tdse-play" class="action">${Z.tdsePlaying?`Pause TDSE`:`Play TDSE`}</button>
        <button id="ctrl-tdse-reset" class="action">Reset α-Wavepacket</button>
      </div>
      <div class="ctrl-group">
        <label>Live 1D Symplectic Visscher TDSE inside Gate 1 Woods–Saxon + Coulomb Gamow Barrier</label>
      </div>`,document.getElementById(`ctrl-tdse-play`)?.addEventListener(`click`,()=>{Z.tdsePlaying=!Z.tdsePlaying,Xr()}),document.getElementById(`ctrl-tdse-reset`)?.addEventListener(`click`,()=>{tr?.resetWavepacket(),$()});else if(q===`atomic`){if(J===`compound`&&X?.visualData?.molQm){hn.innerHTML=`
        <div class="ctrl-group">
          <label>Molecular Orbital</label>
          <button class="action${Z.molOrbitalMode===0?` active-toggle`:``}" data-mol-mode="0">Total ρ(r)</button>
          <button class="action${Z.molOrbitalMode===1?` active-toggle`:``}" data-mol-mode="1">HOMO</button>
          <button class="action${Z.molOrbitalMode===2?` active-toggle`:``}" data-mol-mode="2">LUMO</button>
        </div>
        <div class="ctrl-group">
          <label>Render</label>
          <button class="action${Z.atomicViewMode===`cloud`?` active-toggle`:``}" data-aview="cloud">3D Point Cloud</button>
          <button class="action${Z.atomicViewMode===`volume`?` active-toggle`:``}" data-aview="volume">Volumetric</button>
        </div>
        <div class="ctrl-group">
          <label><input id="ctrl-guides" type="checkbox" ${Z.showGuides?`checked`:``} /> Grid+Axes</label>
          <button id="ctrl-rotate" class="action${Z.autoRotate?` active-toggle`:``}">${Z.autoRotate?`Pause Rot`:`Rotate`}</button>
        </div>`;for(let e of hn.querySelectorAll(`[data-mol-mode]`))e.addEventListener(`click`,()=>{Z.molOrbitalMode=Number(e.dataset.molMode),Gr(),Xr(),$()})}else{let e=Array.from({length:Z.n},(e,t)=>`<option value="${t}" ${t===Z.l?`selected`:``}>l=${t} (${hr[t]||t})</option>`).join(``),t=Array.from({length:2*Z.l+1},(e,t)=>{let n=t-Z.l;return`<option value="${n}" ${n===Z.m?`selected`:``}>m=${n}</option>`}).join(``);hn.innerHTML=`
        <div class="ctrl-group">
          <label>n=<b id="lbl-n">${Z.n}</b></label>
          <input id="ctrl-n" type="range" min="1" max="7" value="${Z.n}" style="width:58px;" />
          <select id="ctrl-l">${e}</select>
          <select id="ctrl-m">${t}</select>
          <button id="ctrl-valence" class="action" title="Snap to active atom valence subshell">Valence</button>
          <button id="ctrl-rand-nlm" class="action" title="Random Element + (n, l, m)">Rand</button>
        </div>
        <div class="ctrl-group">
          <label>XC</label>
          <select id="ctrl-xc" title="Re-solve GPU Kohn-Sham with PBE GGA, LDA, or Bare Nucleus">
            <option value="pbe" ${Z.functional===`pbe`?`selected`:``}>PBE GGA</option>
            <option value="lda" ${Z.functional===`lda`?`selected`:``}>LDA</option>
            <option value="bare" ${Z.functional===`bare`?`selected`:``}>Bare Z</option>
          </select>
          <label title="Koelling-Harmon Relativistic + Spin-Orbit (live GPU re-solve!)">
            <input id="ctrl-rel" type="checkbox" ${Z.relativisticSpinOrbit?`checked`:``} /> Relativistic+SO
          </label>
        </div>
        <div class="ctrl-group">
          <label>Pts <b id="lbl-pts">${Math.round(Z.pointCount/1e3)}K</b></label>
          <input id="ctrl-pts" type="range" min="50000" max="500000" step="25000" value="${Z.pointCount}" style="width:66px;" />
          <label>Size</label>
          <input id="ctrl-psize" type="range" min="0.006" max="0.045" step="0.002" value="${Z.pointSize}" style="width:50px;" />
          <label>Opac</label>
          <input id="ctrl-opac" type="range" min="0.08" max="0.80" step="0.04" value="${Z.opacity}" style="width:50px;" />
        </div>
        <div class="ctrl-group">
          <select id="ctrl-cmode" title="Shell color alternation mode">
            <option value="0" ${Z.colorMode===0?`selected`:``}>Radial Shells</option>
            <option value="1" ${Z.colorMode===1?`selected`:``}>±ψ Phase</option>
          </select>
          <input id="ctrl-col-a" type="color" value="${Z.shellColorA}" title="Color A" />
          <input id="ctrl-col-b" type="color" value="${Z.shellColorB}" title="Color B" />
          <label><input id="ctrl-guides" type="checkbox" ${Z.showGuides?`checked`:``} /> Grid</label>
          <button class="action${Z.atomicViewMode===`cloud`?` active-toggle`:``}" data-aview="cloud">Cloud</button>
          <button class="action${Z.atomicViewMode===`volume`?` active-toggle`:``}" data-aview="volume">Vol</button>
          <button id="ctrl-regen" class="action">Resample</button>
          <button id="ctrl-rotate" class="action${Z.autoRotate?` active-toggle`:``}">${Z.autoRotate?`Pause`:`Rotate`}</button>
        </div>`,document.getElementById(`ctrl-n`)?.addEventListener(`input`,e=>{Z.n=Number(e.target.value),Z.l=Math.min(Z.l,Z.n-1),Z.m=Math.max(-Z.l,Math.min(Z.l,Z.m)),Gr(),Xr(),$()}),document.getElementById(`ctrl-l`)?.addEventListener(`change`,e=>{Z.l=Number(e.target.value),Z.m=Math.max(-Z.l,Math.min(Z.l,Z.m)),Gr(),Xr(),$()}),document.getElementById(`ctrl-m`)?.addEventListener(`change`,e=>{Z.m=Number(e.target.value),Gr(),$()}),document.getElementById(`ctrl-valence`)?.addEventListener(`click`,()=>{let e=wr(Gn);Z.n=e.n,Z.l=e.l,Z.m=e.m,Gr(),Xr(),$()}),document.getElementById(`ctrl-rand-nlm`)?.addEventListener(`click`,()=>{let e=1+Math.floor(Math.random()*92),t=2+Math.floor(Math.random()*5),n=Math.floor(Math.random()*t),r=Math.floor(Math.random()*(2*n+1))-n;Gn=e,Kn=null,Sn.value=String(e),Z.n=t,Z.l=n,Z.m=r,ti(e,null,{preserveQuantumNumbers:!0})}),document.getElementById(`ctrl-xc`)?.addEventListener(`change`,e=>{Z.functional=e.target.value,ti(Gn,Kn,{preserveQuantumNumbers:!0})}),document.getElementById(`ctrl-rel`)?.addEventListener(`change`,e=>{Z.relativisticSpinOrbit=!!e.target.checked,ti(Gn,Kn,{preserveQuantumNumbers:!0})}),document.getElementById(`ctrl-pts`)?.addEventListener(`change`,e=>{Z.pointCount=Number(e.target.value),document.getElementById(`lbl-pts`).textContent=`${Math.round(Z.pointCount/1e3)}K`,Gr(),$()}),document.getElementById(`ctrl-psize`)?.addEventListener(`input`,e=>{Z.pointSize=Number(e.target.value),Zr()}),document.getElementById(`ctrl-opac`)?.addEventListener(`input`,e=>{Z.opacity=Number(e.target.value),Zr()}),document.getElementById(`ctrl-cmode`)?.addEventListener(`change`,e=>{Z.colorMode=Number(e.target.value),Gr(),Zr()}),document.getElementById(`ctrl-col-a`)?.addEventListener(`input`,e=>{Z.shellColorA=e.target.value,Zr()}),document.getElementById(`ctrl-col-b`)?.addEventListener(`input`,e=>{Z.shellColorB=e.target.value,Zr()}),document.getElementById(`ctrl-regen`)?.addEventListener(`click`,()=>{Z.cloudSeed+=1,Gr(),Zr()})}for(let e of hn.querySelectorAll(`[data-aview]`))e.addEventListener(`click`,()=>{Z.atomicViewMode=e.dataset.aview,Xr(),$()});document.getElementById(`ctrl-guides`)?.addEventListener(`change`,e=>{Z.showGuides=!!e.target.checked,Zr()}),document.getElementById(`ctrl-rotate`)?.addEventListener(`click`,()=>{Z.autoRotate=!Z.autoRotate,Xr()})}else if(q===`crystal`){let e=J===`element`;hn.innerHTML=`
      <div class="ctrl-group">
        <button class="action${Z.crystalViewMode===`tdks-atom`?` active-toggle`:``}" data-cview="tdks-atom" title="Live 180K-point Dirac-KS quantum electron cloud evolving |psi(r,t)|^2 under photon dipole coupling + retarded Hertzian re-radiation!">Atom TD-KS Cloud↔Photon</button>
        <button class="action${Z.crystalViewMode===`photon-shell`?` active-toggle`:``}" data-cview="photon-shell" title="2D 128x128 Maxwell-ADE-FDTD bulk slab showing Snell refraction bending & Golden vs Silver reflected beam!">2D Maxwell Slab (Snell)</button>
        ${e?`<button class="action${Z.crystalViewMode===`bloch`?` active-toggle`:``}" data-cview="bloch">3D Bloch + Fermi</button>`:``}
        <button class="action${Z.crystalViewMode===`lattice`?` active-toggle`:``}" data-cview="lattice">Crystal Cell</button>
      </div>
      <div class="ctrl-group">
        <button id="ctrl-ps-rgb" class="action${Z.photonModeMono?``:` active-toggle`}">White Light (RGB)</button>
        <button id="ctrl-ps-mono" class="action${Z.photonModeMono?` active-toggle`:``}">Single λ</button>
        <label>λ=<b id="lbl-lambda">${Z.probeWavelengthNm}</b>nm</label>
        <input id="ctrl-lambda" type="range" min="380" max="780" step="10" value="${Z.probeWavelengthNm}" style="width:72px;" />
      </div>
      <div class="ctrl-group">
        <button id="ctrl-ps-fire" class="action gold-btn">Fire Pulse</button>
        <button id="ctrl-ps-play" class="action">${Z.photonPlaying?`Pause`:`Play`}</button>
        ${e?`<label title="Toggle Dirac-KS Relativistic + Spin-Orbit LIVE! On Gold (Z=79), watch 5d→6p shift from UV to Blue, turning Silver → Gold!">
          <input id="ctrl-ps-rel" type="checkbox" ${Z.relativisticSpinOrbit?`checked`:``} /> Relativistic (Au Color!)
        </label>`:``}
      </div>`;for(let e of hn.querySelectorAll(`[data-cview]`))e.addEventListener(`click`,()=>{Z.crystalViewMode=e.dataset.cview,Xr(),$()});document.getElementById(`ctrl-ps-rgb`)?.addEventListener(`click`,()=>{Z.photonModeMono=!1,Xr(),$()}),document.getElementById(`ctrl-ps-mono`)?.addEventListener(`click`,()=>{Z.photonModeMono=!0,Xr(),$()}),document.getElementById(`ctrl-lambda`)?.addEventListener(`input`,e=>{Z.probeWavelengthNm=Number(e.target.value),document.getElementById(`lbl-lambda`).textContent=String(Z.probeWavelengthNm),Z.photonModeMono=!0,Zn?.reset(Z.probeWavelengthNm);for(let e=0;e<35;e+=1)Zn?.stepFs(.08);Qn?.reset(null,{nextProbeWavelengthNm:Z.probeWavelengthNm}),Qn?.stepSync(100),Xr(),$()}),document.getElementById(`ctrl-ps-fire`)?.addEventListener(`click`,()=>{Zn?.reset(Z.probeWavelengthNm),Qn?.reset(null,{nextProbeWavelengthNm:Z.probeWavelengthNm}),Qn?.stepSync(60),Z.photonPlaying=!0,Xr(),$()}),document.getElementById(`ctrl-ps-play`)?.addEventListener(`click`,()=>{Z.photonPlaying=!Z.photonPlaying,Xr()}),document.getElementById(`ctrl-ps-rel`)?.addEventListener(`change`,e=>{Z.relativisticSpinOrbit=!!e.target.checked,ti(Gn,Kn,{preserveQuantumNumbers:!0})})}else if(q===`md`){let t=Math.max(20,Math.round(cr?.meltingPointK||e?.thermodynamic?.meltingPointK||600)),n=Math.max(1500,Math.min(8e3,Math.round(t*3)));hn.innerHTML=`
      <div class="ctrl-group">
        <label>T=<b id="lbl-md-t">${Z.mdTargetTempK}</b> K (T_m=${t} K)</label>
        <input id="ctrl-md-t" type="range" min="15" max="${n}" step="10" value="${Math.min(n,Z.mdTargetTempK)}" style="width:110px;" />
      </div>
      <div class="ctrl-group">
        <button class="action" data-md-frac="0.30">Solid</button>
        <button class="action" data-md-frac="0.72">Warm</button>
        <button class="action gold-btn" data-md-frac="1.18">Melt</button>
        <button class="action" data-md-frac="1.65">Liquid</button>
        <button class="action" data-md-frac="2.50">Vapor</button>
      </div>
      <div class="ctrl-group">
        <button id="ctrl-md-play" class="action">${Z.mdPlaying?`Pause MD`:`Play MD`}</button>
        <button id="ctrl-md-reset" class="action">Reset Lattice</button>
      </div>`,document.getElementById(`ctrl-md-t`)?.addEventListener(`input`,e=>{Z.mdTargetTempK=Number(e.target.value),document.getElementById(`lbl-md-t`).textContent=String(Z.mdTargetTempK)});for(let e of hn.querySelectorAll(`[data-md-frac]`))e.addEventListener(`click`,()=>{let r=Number(e.dataset.mdFrac);Z.mdTargetTempK=Math.max(15,Math.min(n,Math.round(t*r))),document.getElementById(`lbl-md-t`).textContent=String(Z.mdTargetTempK);let i=document.getElementById(`ctrl-md-t`);i&&(i.value=String(Z.mdTargetTempK))});document.getElementById(`ctrl-md-play`)?.addEventListener(`click`,()=>{Z.mdPlaying=!Z.mdPlaying,Xr()}),document.getElementById(`ctrl-md-reset`)?.addEventListener(`click`,()=>{Yr(Z.mdTargetTempK),$()})}else if(q===`compound`){let e=Un?.energiesEv?.length||0,t=X?.bundle?.materialKey||An.value||`H2O`;hn.innerHTML=`
      ${e>=2?`<div class="ctrl-group">
        <label>CI-NEB ξ=<b id="lbl-neb-xi">${(Z.nebImageIdx/Math.max(1,e-1)).toFixed(2)}</b> (Img #${Z.nebImageIdx}/${e-1}${Z.nebImageIdx===Un.saddleImageIndex?` ‡ TS`:``})</label>
        <input id="ctrl-neb-xi" type="range" min="0" max="${e-1}" step="1" value="${Z.nebImageIdx}" style="width:96px;" />
        <button id="ctrl-neb-play" class="action">${Z.nebPlaying?`Pause MEP`:`Play Reaction Path`}</button>
      </div>`:``}
      <div class="ctrl-group">
        <label>Orbital</label>
        <button class="action${Z.molOrbitalMode===0?` active-toggle`:``}" data-c-mol="0">Total ρ</button>
        <button class="action${Z.molOrbitalMode===1?` active-toggle`:``}" data-c-mol="1">HOMO</button>
        <button class="action${Z.molOrbitalMode===2?` active-toggle`:``}" data-c-mol="2">LUMO</button>
      </div>
      ${X?`<div class="ctrl-group">
        <button id="ctrl-backfeed-now" class="action gold-btn">Backfeed ${t} → All Property, Optics, MD &amp; Polytope Sims</button>
      </div>`:``}`,document.getElementById(`ctrl-neb-xi`)?.addEventListener(`input`,e=>{Z.nebImageIdx=Number(e.target.value),Z.nebPlaying=!1,Xr(),$()}),document.getElementById(`ctrl-neb-play`)?.addEventListener(`click`,()=>{Z.nebPlaying=!Z.nebPlaying,Xr()});for(let e of hn.querySelectorAll(`[data-c-mol]`))e.addEventListener(`click`,()=>{Z.molOrbitalMode=Number(e.dataset.cMol),Gr(),ni(),Xr(),$()});document.getElementById(`ctrl-backfeed-now`)?.addEventListener(`click`,()=>{ai(X,`crystal`)})}else q===`polytope`&&(hn.innerHTML=`
      <div class="ctrl-group">
        <label>Pressure Domain</label>
        <button id="ctrl-poly-lab" class="action${Z.polytopeRegime===`lab`?` active-toggle`:``}">Lab (10 GPa)</button>
        <button id="ctrl-poly-plan" class="action${Z.polytopeRegime===`planetary`?` active-toggle`:``}">Planetary Core (1 TPa)</button>
      </div>
      <div class="ctrl-group">
        <label>Hover or click anywhere on the GPU phase diagram to run live <code>eval_polytope_atlas_2d</code> (incl. hatched fail-closed outer border!)</label>
      </div>`,document.getElementById(`ctrl-poly-lab`)?.addEventListener(`click`,()=>ei(`lab`)),document.getElementById(`ctrl-poly-plan`)?.addEventListener(`click`,()=>ei(`planetary`)))}function Zr(){if(K)if(q===`nuclear`){if(J===`compound`&&zn)K.renderVolume3D({gpuVec4Buffer:zn.buffer,dim:zn.dim,channels:4,yaw:lr,pitch:ur,tint:[1,.58,.3]});else if(Y?.visualData?.nuclear){let e=Y.visualData.nuclear;K.renderVolume3D({vec4Data:e.volumeData,dim:e.volDim,channels:4,yaw:lr,pitch:ur,tint:[1,.62,.34]})}}else if(q===`atomic`)if(J===`compound`&&X?.visualData?.molQm)if(Z.atomicViewMode===`cloud`&&Yn)K.renderOrbitalPointCloud({pointsBuffer:Yn.pointsBuffer,pointCount:Yn.pointCount,yaw:lr,pitch:ur,camDist:dr,pointSize:Z.pointSize*1.15,opacity:Math.min(.65,Z.opacity*1.4),alternateShellColors:!0,colorA:[1,.65,.32],colorB:[.36,.72,1],showGuides:Z.showGuides,showNucleus:!1});else{let e=X.visualData.molQm;K.renderVolume3D({vec4Data:e.volumeData,dim:e.volDim,channels:4,yaw:lr,pitch:ur,tint:[.75,.52,.99]})}else J===`compound`&&Bn?K.renderStaticCrystalLattice({...Bn,yaw:lr,pitch:ur,tint:X?.bundle?.electromagnetic?.opticalSrgb||[.75,.82,.95]}):Z.atomicViewMode===`cloud`&&Jn?K.renderOrbitalPointCloud({pointsBuffer:Jn.pointsBuffer,pointCount:Jn.pointCount,yaw:lr,pitch:ur,camDist:dr,pointSize:Z.pointSize,opacity:Z.opacity,alternateShellColors:Z.alternateShellColors,colorA:yr(Z.shellColorA),colorB:yr(Z.shellColorB),showGuides:Z.showGuides,showNucleus:!0}):Rn&&K.renderVolume3D({gpuVec4Buffer:Rn.buffer,dim:Rn.dim,channels:4,yaw:lr,pitch:ur,tint:[.34,.76,1]});else if(q===`crystal`){let e=Cr();if(Z.crystalViewMode===`tdks-atom`&&Xn&&Zn)K.renderTdksPhotonCloudScene({pairCloud:Xn,blochSession:Zn,yaw:(lr-.42)*.8+.14,pitch:Math.max(-.85,Math.min(.85,(ur-.28)*.8+.12)),camDist:dr,modeMono:Z.photonModeMono,probeRgb:br(Z.probeWavelengthNm),emergentReflSrgb:$n?.emergentReflectedSrgb||e?.opticalSrgb||[.94,.86,.65],pointSize:Z.pointSize});else if(Z.crystalViewMode===`photon-shell`&&Qn){let t=Kr();K.renderPhotonShellScene({photonSession:Qn,shellPointsBuffer:t?.pointsBuffer??null,shellPointCount:Math.min(1800,t?.pointCount||1400),yaw:(lr-.42)*.45,pitch:Math.max(.25,Math.min(1.48,1.08+(ur-.28)*.6)),camDist:Math.max(2.2,Math.min(4.6,dr+.3)),modeMono:Z.photonModeMono,probeRgb:br(Z.probeWavelengthNm),slabTint:e?.opticalSrgb||[.82,.86,.94],waveGain:1.05})}else if(Z.crystalViewMode===`bloch`&&J===`element`&&Y?.visualData?.bulk){let t=Y.visualData.bulk;K.renderVolume3D({scalarData:t.blochDensity3d,dim:t.blochDensityGridN,channels:1,yaw:lr,pitch:ur,tint:e?.opticalSrgb||[.34,.88,.65],showFermiIso:t.isMetal})}else ir&&K.renderLiveMd({positionsBuffer:ir.positionsBuffer,velocitiesBuffer:ir.velocitiesBuffer,atomCount:ir.atomCount,boxLengthsA:ir.boxLengthsA,yaw:lr,pitch:ur,tint:e?.opticalSrgb||[.65,.82,.96],velocityColorScale:16})}else if(q===`md`&&ir){let e=Cr();K.renderLiveMd({positionsBuffer:ir.positionsBuffer,velocitiesBuffer:ir.velocitiesBuffer,atomCount:ir.atomCount,boxLengthsA:ir.boxLengthsA,yaw:lr,pitch:ur,tint:e?.opticalSrgb||[.65,.8,.96],velocityColorScale:32})}else if(q===`compound`&&X){let e=Wn[Z.nebImageIdx]||null;e?.pointsBuffer?K.renderOrbitalPointCloud({pointsBuffer:e.pointsBuffer,pointCount:e.pointCount,yaw:lr,pitch:ur,camDist:dr,pointSize:.015,opacity:.34,alternateShellColors:!0,colorA:[1,.64,.3],colorB:[.46,.72,1],showGuides:Z.showGuides,showNucleus:!1}):Yn?.pointsBuffer?K.renderOrbitalPointCloud({pointsBuffer:Yn.pointsBuffer,pointCount:Yn.pointCount,yaw:lr,pitch:ur,camDist:dr,pointSize:.015,opacity:.34,alternateShellColors:!0,colorA:[1,.64,.3],colorB:[.46,.72,1],showGuides:Z.showGuides,showNucleus:!1}):Bn&&K.renderStaticCrystalLattice({...Bn,yaw:lr,pitch:ur,tint:X.bundle.electromagnetic.opticalSrgb||[.75,.82,.95]})}else q===`polytope`&&Vn&&K.renderPolytopeAtlas(Vn,Z.polytopeProbe)}function $(){if(K){if(Zr(),Dr(``),q===`nuclear`){if(J===`compound`&&X){let e=X.bundle,t=e.nuclear.isotopologueSites||[];Er(`WebGPU 3D Composite Nuclear Fermi Volume — ${e.materialKey} (Backfed Compound)`,`Total Z=${e.nuclear.totalProtonsZ} · A=${e.nuclear.totalNucleonsA} · Molar Mass=${Q(e.nuclear.molarMassU,3)} u · ΣB=${Q(e.nuclear.totalBindingEnergyMeV,1)} MeV`),Y?.visualData?.nuclear&&(Fn.textContent=`GPU 118×200 Chart of Nuclides (Click Any Isotope)`,zr(vn,Y.visualData.nuclear)),In.textContent=`Constituent Nuclei Binding Energy B/A (${e.materialKey})`;let n=t.map((e,t)=>t),r=t.map(e=>T(e.Z,e.A).bindingPerNucleonMeV);Rr(yn,n.length>=2?n:[0,1],r.length>=2?r:[r[0]||0,r[0]||0],{label:`Constituent sites: ${t.map(e=>`${u(e.Z)}-${e.A}`).join(`, `)}`,color:`#facc15`,yMin:0}),Ln.textContent=`Constituent Nuclear Charge Radii R_rms (fm)`;let i=t.map(e=>T(e.Z,e.A).chargeRadiusFm);Rr(bn,n.length>=2?n:[0,1],i.length>=2?i:[i[0]||0,i[0]||0],{label:`Fermi charge radius R_rms (fm) per atomic site`,color:`#ff9c54`,yMin:0})}else if(Y?.visualData?.nuclear){let e=Y.visualData.nuclear;Er(`WebGPU 3D Volumetric Nuclear Fermi Density — ${e.isotope} (R_rms = ${Q(e.chargeRadiusFm,2)} fm)`,`B/A = ${Q(e.bindingPerNucleonMeV,3)} MeV · I^π = ${e.spinI}${e.parity} · μ_I = ${Q(e.magneticMomentMuN,2)} μ_N · Mode: ${e.dominantMode}`),nr&&Dr(`<div class="live-meter">Live GPU TDSE (step ${nr.stepCount}): P_well=${Q(nr.pInside*100,1)}% · P_barrier=${Q(nr.pBarrier*100,2)}% · P_tunneled=${Q(nr.pTunneled*100,3)}%</div>`),Fn.textContent=`GPU 118×200 Chart of Nuclides (Click to Pick Z, A)`,zr(vn,e),In.textContent=`Live GPU TDSE Tunneling vs WKB Gamow Barrier (Q_α = ${Q(e.qAlphaMeV,2)} MeV)`,Br(yn,e,nr),Ln.textContent=`Fermi Proton/Neutron Skin Profile ρ(r) — ${e.isotope}`;let t=Array.from({length:40},(t,n)=>n/39*Math.max(8,e.chargeRadiusFm*2.1)),n=t.map(t=>1/(1+Math.exp((t-e.chargeRadiusFm)/.54))),r=t.map(t=>e.N/Math.max(1,e.Z)/(1+Math.exp((t-e.chargeRadiusFm*1.03)/.55)));Lr(bn,[{xs:t,ys:n,color:`#ff9c54`,width:2},{xs:t,ys:r,color:`#38bdf8`,width:1.6}],{label:`Proton (orange) vs Neutron (blue) density vs r (fm)`,yMin:0})}}else if(q===`atomic`){if(J===`compound`&&X){let e=X.bundle,t=X.visualData.molQm;if(Er(`WebGPU 3D Molecular RHF ${[`Total Electron Density ρ(r)`,`HOMO Signed Orbital ψ`,`LUMO Signed Orbital ψ`][Z.molOrbitalMode]||`Total ρ`} — ${e.materialKey} (Backfed Compound)`,t?`GPU Löwdin RHF · ${Yn?.pointCount?.toLocaleString()||`0`} GPU samples · E = ${Q(t.totalEnergyHa,3)} Ha · μ = ${Q(t.dipoleDebye,2)} D · Gap = ${Q(t.homoLumoGapEv,2)} eV`:`Ionic/Covalent Crystal Prototype (${e.mechanical.crystalStructure}) · Pauling Ionicity = ${Q(e.atomic.paulingIonicity,2)}`),t?.orbitalEnergiesHa){Fn.textContent=`GPU Molecular Orbital Spectrum (${e.materialKey})`,Rr(vn,t.orbitalEnergiesHa.map((e,t)=>t),t.orbitalEnergiesHa,{label:`MO Energy (Ha) · HOMO-LUMO Gap = ${Q(t.homoLumoGapEv,2)} eV`,color:`#c084fc`}),In.textContent=`Mulliken Atomic Charges q_i (${e.materialKey})`;let n=t.mullikenCharges||[0,0];Rr(yn,n.map((e,t)=>t),n,{label:`Atomic charges (e): ${n.map(e=>Q(e,2)).join(`, `)}`,color:`#34d399`,hLine:{y:0,color:`#64748b`,label:`0e`}})}Ln.textContent=`Derived Optical Dispersion — ${e.materialKey}`,Hr(bn,e.electromagnetic.spectralWavelengthsNm,e.electromagnetic.spectralReflectance,e.electromagnetic.spectralNRe,e.electromagnetic.opticalSrgb,e.materialKey)}else if(Y?.visualData?.atom){let e=Y.visualData.atom,t=e.radialGrid,n=Y.bundle.atomic.unpairedElectrons||0,r=Jn?.sourceKind===`webgpu-kohn-sham-eigenstate`?`EXACT GPU Kohn–Sham Eigenstate u_nl(r)`:`Slater-KS Screened Associated Laguerre R_nl(r)`;Er(`WebGPU 3D Schrödinger / Dirac–KS Orbital |ψ_${Z.n}${hr[Z.l]||Z.l},${Z.m}|² — ${e.symbol} (Z=${e.atomicNumberZ})`,`${Jn?.pointCount?.toLocaleString()||`0`} GPU samples · ${r} · ${e.relativisticMethod} · E = ${Q(e.totalEnergyHa,2)} Ha`),Dr(`<div class="live-meter">n=${Z.n}, l=${Z.l} (${hr[Z.l]||Z.l}), m=${Z.m} · Radial Nodes=${Jn?.radialNodeCount??Z.n-Z.l-1} · Extent=±${Q(Jn?.rExtentBohr||4,2)} a₀ · XC=${e.functional.toUpperCase()}</div>`),Fn.textContent=`Radial Probability 4πr²ρ(r) & Selected Subshell |u_nl(r)|²`;let i=t.r.map((e,n)=>4*Math.PI*e*e*t.rho[n]),a=t.r.findIndex(e=>e>Math.max(6,(Jn?.rExtentBohr||6)*1.1)),o=a>12?a:t.r.length,s=[{xs:t.r.slice(0,o),ys:i.slice(0,o),color:`#56c2ff`,width:1.8}],c=e.orbitals.findIndex(e=>e.n===Z.n&&e.l===Z.l);if(c>=0&&e.orbitalWavefunctions?.[c]){let n=e.orbitalWavefunctions[c],r=Math.max(1e-5,...i.slice(0,o)),a=Math.max(1e-8,...Array.from(n.slice(0,o),e=>e*e));s.push({xs:t.r.slice(0,o),ys:Array.from(n.slice(0,o),e=>e*e/a*r*.9),color:`#a78bfa`,width:2})}Lr(vn,s,{label:`Total 4πr²ρ (blue) & Active ${Z.n}${hr[Z.l]} |u|² (violet)`,yMin:0}),In.textContent=`Relativistic Orbital Eigenvalues ε_nl & Spin-Orbit j± (Ha)`;let l=e.orbitals.filter(e=>Number(e.occupancy??1)>0),u=l.map((e,t)=>t);Lr(yn,[{xs:u,ys:l.map(e=>e.energyHa),color:`#34d399`,width:2},{xs:u,ys:l.map(e=>e.energyJPlusHa??e.energyHa),color:`#facc15`,width:1.3},{xs:u,ys:l.map(e=>e.energyJMinusHa??e.energyHa),color:`#f472b6`,width:1.3}],{label:`Subshell ε_nl (green), j+ (gold), j− (pink) · ${Z.relativisticSpinOrbit?`Rel+SO ON`:`Non-Rel`}`}),Ln.textContent=`Angular Spherical Harmonic |Y_${Z.l},${Z.m}(θ)| Cross-Section`,Ur(bn,Z.l,Z.m,e.symbol,n)}}else if(q===`crystal`){let e=Sr(),t=Cr(),n=$n;if((Z.crystalViewMode===`tdks-atom`||Z.crystalViewMode===`photon-shell`)&&e){let r=n?.channels?.[0],i=n?.channels?.[1],a=n?.channels?.[2],o=n?.channels?.[3],s=i?.nMeasuredFdtd??o?.nMeasuredFdtd??r?.nMeasuredFdtd,c=Zn?.channels?.[Z.photonModeMono?3:2];if(Z.crystalViewMode===`tdks-atom`&&Xn&&Zn){let t=`${Xn.n0}${hr[Xn.l0]||``}`,n=`${Xn.n1}${hr[Xn.l1]||``}`;Er(`Live WebGPU TD-KS Electron Cloud |ψ(r,t)|² ↔ Photon Wavepacket — ${e.materialKey} (${t} ↔ ${n})`,`${Xn.pointCount.toLocaleString()} GPU samples · ΔE=${Q(Zn.transEv,2)} eV (${Zn.transLabel}) · Excited |c_${n}|²=${Q((c?.rho11||0)*100,1)}% · Dipole d(t)=${Q(c?.dipole||0,2)} · t=${Q(Zn.getTimeFs(),2)} fs`)}else if(n){let t=n.oscillators.filter(e=>e.active).slice(0,2).map(e=>`${e.label} @ ${Q(e.energyEv,2)} eV`).join(` | `)||`Drude Free-Electron Gas`;Er(`Live WebGPU 2D (128×128) Maxwell–ADE-FDTD Bulk Optical Cavity — ${e.materialKey}`,`${n.isMetal?`Drude ω_p=${Q(n.plasmaEv,2)} eV`:`Dielectric Gap=${Q(e.electromagnetic.bandGapEv,2)} eV`} · ${t} · t=${Q(n.simTimeFs,2)} fs`)}if(n&&r&&i&&a){let o=r.reflectance+i.reflectance+a.reflectance>.04,c=xr(o?n.emergentReflectedSrgb:t?.opticalSrgb||n.analyticReflectedSrgb),l=i.refractAngleDeg==null?``:` · Snell θ_t=${Q(i.refractAngleDeg,1)}°`,u;if(Z.crystalViewMode===`tdks-atom`&&Zn){let e=Zn.channels[0],t=Zn.channels[1],n=Zn.channels[2];u=`TD-KS Shell Excitation |c₁|²: <span style="color:#f87171">610nm=${Q(e.rho11*100,1)}%</span> · <span style="color:#4ade80">535nm=${Q(t.rho11*100,1)}%</span> · <span style="color:#60a5fa">440nm=${Q(n.rho11*100,1)}%</span> | Blue Abs=${Q(n.absorbedEnergy,2)}`}else u=n.isMetal?`2D FDTD Reflected R: <span style="color:#f87171">610nm=${Q(r.reflectance*100,1)}%</span> · <span style="color:#4ade80">535nm=${Q(i.reflectance*100,1)}%</span> · <span style="color:#60a5fa">440nm=${Q(a.reflectance*100,1)}%</span> | Blue Shell Abs=${Q(a.absorption*100,1)}%`:`Live 2D FDTD n(λ) = <b>${s?Q(s,3):`propagating…`}</b> (analytic ${Q(i.analyticNRe,2)})${l} · T=${Q(i.transmittance*100,1)}%`;Dr(`<div class="live-meter">${u}</div><div class="live-meter"><i class="swatch" style="background:${c};"></i> ${o?`Emergent FDTD Reflected Color`:`GPU Optical Reflected Color`} ${J===`element`?Z.relativisticSpinOrbit?`(Relativistic ON)`:`(Relativistic OFF)`:`(Backfed Compound)`}</div>`),Fn.textContent=`Live 2D Maxwell–FDTD R(λ) vs Electron-Shell Absorption A(λ)`,Vr(vn,n,`${e.materialKey} · `)}}else if(J===`element`&&Y?.visualData?.bulk){let e=Y.visualData.bulk;Er(`WebGPU 3D FFT Bloch Charge Density & Fermi Isosurface — ${e.symbol} (${e.crystalStructure})`,`a₀ = ${Q(e.latticeConstantA,2)} Å · ρ = ${Q(e.densityKgPerM3,0)} kg/m³ · E_F = ${Q(e.fermiEnergyEv,2)} eV · Gap = ${Q(e.bandGapEv,2)} eV · ${t.magneticPhase}`),Fn.textContent=`All Brillouin Bands E_n(k) & Fermi Level E_F`;let n=e.bandsEv[0]?.length||1,r=e.bandsEv.map((e,t)=>t),i=[`#56c2ff`,`#a78bfa`,`#34d399`,`#f472b6`,`#fb923c`,`#38bdf8`,`#c084fc`,`#94a3b8`],a=Array.from({length:n},(t,n)=>({xs:r,ys:e.bandsEv.map(e=>e[n]),color:i[n%i.length],width:n<4?1.7:1.15})),o=(e.kPathLabels||[]).map((e,t)=>e?{x:t,label:e}:null).filter(Boolean);Lr(vn,a,{label:`${n} Bloch Bands (eV) · E_F=${Q(e.fermiEnergyEv,1)} eV`,hLine:{y:e.fermiEnergyEv,color:`#facc15`,label:`E_F`},xTicks:o})}else e&&Er(`WebGPU 3D Crystal Lattice — ${e.materialKey} (${e.mechanical.crystalStructure})`,`a₀ = ${Q(e.mechanical.latticeConstantA,2)} Å · ρ = ${Q(e.mechanical.densityKgPerM3,0)} kg/m³ · Gap = ${Q(e.electromagnetic.bandGapEv,2)} eV`);if(J===`element`&&Y?.visualData?.bulk){let e=Y.visualData.bulk;In.textContent=`Electronic DOS g(E) & Brillouin Fermi Level`,Lr(yn,[{xs:Array.from(e.dosEnergyEv),ys:Array.from(e.dosValues),color:`#f472b6`,width:2}],{label:`g(E_F)=${Q(e.dosAtFermiStatesPerEvAtom,2)} · ${t.magneticPhase}`,yMin:0,vLine:{x:e.fermiEnergyEv,color:`#facc15`,label:`E_F`}})}else if(n){In.textContent=`FDTD Channel Energy Balance (R + T + A = 1.0)`;let e=n.channels.map(e=>e.wavelengthNm);Lr(yn,[{xs:e,ys:n.channels.map(e=>e.reflectance*100),color:`#facc15`,width:2},{xs:e,ys:n.channels.map(e=>e.transmittance*100),color:`#38bdf8`,width:2},{xs:e,ys:n.channels.map(e=>e.absorption*100),color:`#c084fc`,width:1.8}],{label:`FDTD R% (gold), T% (cyan), Shell Abs% (violet)`,yMin:0,yMax:105})}Ln.textContent=`GPU Optical UV-Vis Reflectance R(λ) & n(λ) (380–780 nm)`,Hr(bn,t?.spectralWavelengthsNm,t?.spectralReflectance,t?.spectralNRe,t?.opticalSrgb,`${e?.materialKey||``} (${Z.relativisticSpinOrbit?`Rel`:`NonRel`})`)}else if(q===`md`){let e=Sr(),t=ar,n=cr;Er(`Zero-Copy WebGPU Instanced 3D MD — ${n?.label||e?.materialKey||``} (${n?.crystalStructure||``}, ${n?.modelName||``})`,t?`Atoms: ${t.atomCount} | Steps: ${t.totalSteps} | t=${Q(t.timeFs,1)} fs | T=${Q(t.temperatureK,1)} K (target ${Z.mdTargetTempK} K) | P=${Q(t.pressureGPa,2)} GPa | MSD=${Q(t.msdA2,4)} Å²`:`Initializing live WebGPU MD buffers…`),t?.rdf&&(Fn.textContent=`GPU Radial Distribution Function g(r) (Order → Melting)`,Rr(vn,Array.from(t.rdf).map((e,r)=>(r+.5)/t.rdf.length*(n?.rcutA||5.5)),Array.from(t.rdf),{label:`g(r) vs r (Å) — sharp peaks=solid, broad=liquid`,color:`#34d399`,yMin:0})),In.textContent=`Live MD Temperature T(t) (${n?.label||``})`,or.length>=2&&(Lr(yn,[{xs:or.map(e=>e.t),ys:or.map(e=>e.T),color:`#ff9c54`,width:2}],{label:`T(t) K · T_m=${Q(n?.meltingPointK||600,0)} K`,yMin:0,hLine:{y:n?.meltingPointK||600,color:`#facc15`,label:`T_m`}}),Ln.textContent=`Live MD Mean-Squared Displacement MSD(t) (Å²)`,Rr(bn,or.map(e=>e.t),or.map(e=>e.msd),{label:`MSD(t) Å² · Diffusion slope spikes above T_m!`,color:`#38bdf8`,yMin:0}))}else if(q===`compound`&&X){let e=X.visualData.molQm,t=X.bundle,n=Un,r=n?` · CI-NEB Image #${Z.nebImageIdx}/${n.energiesEv.length-1} (ΔE=${Q(n.energiesEv[Z.nebImageIdx],2)} eV${Z.nebImageIdx===n.saddleImageIndex?` ‡ TS`:``})`:``;if(Er(e?`WebGPU 3D Reactive RHF Orbitals — ${t.materialKey}${r}`:`WebGPU 3D Ionic/Covalent Crystal — ${t.materialKey} (${t.mechanical.crystalStructure})`,e?`E = ${Q(e.totalEnergyHa,3)} Ha · μ = ${Q(e.dipoleDebye,2)} D · HOMO-LUMO Gap = ${Q(e.homoLumoGapEv,2)} eV · GPU RHF calls=${n?.gpuRhfCalls??1}`:`a₀ = ${Q(t.mechanical.latticeConstantA,2)} Å · ρ = ${Q(t.mechanical.densityKgPerM3,0)} kg/m³ · Gap = ${Q(t.electromagnetic.bandGapEv,2)} eV`),e?.orbitalEnergiesHa?(Fn.textContent=`Molecular Orbital Spectrum (${t.materialKey} GPU RHF)`,Rr(vn,e.orbitalEnergiesHa.map((e,t)=>t),e.orbitalEnergiesHa,{label:`MO Energy (Ha) | HOMO-LUMO Gap = ${Q(e.homoLumoGapEv,2)} eV`,color:`#c084fc`})):(Fn.textContent=`Ionic/Covalent Crystal Summary (${t.materialKey})`,Rr(vn,[0,1,2],[t.mechanical.bulkModulusPa*1e-9,t.mechanical.shearModulusPa*1e-9,t.electromagnetic.bandGapEv*10],{label:`K=${Q(t.mechanical.bulkModulusPa*1e-9,1)} GPa · G=${Q(t.mechanical.shearModulusPa*1e-9,1)} GPa`,color:`#c084fc`,yMin:0})),n?.energiesEv?.length>=3){In.textContent=`WebGPU CI-NEB Barrier (${t.materialKey}: E_a = ${Q(n.forwardBarrierEv,2)} eV)`,Rr(yn,n.energiesEv.map((e,t)=>t/(n.energiesEv.length-1)),n.energiesEv,{label:`GPU MEP ΔE (eV) · TS‡ #${n.saddleImageIndex} (${n.pathwayLabel})`,color:`#ff9c54`,yMin:Math.min(0,...n.energiesEv)});let e=Ir(yn),r=n.energiesEv,i=Math.min(0,...r),a=Math.max(1e-6,...r),o=(t,n,o)=>{let s=26+t/Math.max(1,r.length-1)*(yn.width-36),c=yn.height-18-(r[t]-i)/Math.max(1e-9,a-i)*(yn.height-37);e.fillStyle=n,e.beginPath(),e.arc(s,c,4.5,0,Math.PI*2),e.fill(),o&&e.fillText(o,Math.min(yn.width-36,s+6),Math.max(22,c-4))};o(n.saddleImageIndex,`#facc15`,`‡ TS`),o(Z.nebImageIdx,`#38bdf8`,``)}else In.textContent=`Compound Phase Transitions (${t.materialKey})`,Rr(yn,[0,1,2],[0,t.thermodynamic.meltingPointK,t.thermodynamic.boilingPointK],{label:`T_m = ${Q(t.thermodynamic.meltingPointK,0)} K · T_b = ${Q(t.thermodynamic.boilingPointK,0)} K`,color:`#38bdf8`,yMin:0});Ln.textContent=`Compound GPU Optical UV-Vis Spectrum (${t.materialKey})`,Hr(bn,t.electromagnetic.spectralWavelengthsNm,t.electromagnetic.spectralReflectance,t.electromagnetic.spectralNRe,t.electromagnetic.opticalSrgb,t.materialKey)}else if(q===`polytope`&&Vn){let e=Z.polytopeProbe;Er(`Live WebGPU eval_polytope_atlas_2d — ${Vn.materialKey} (${Vn.polytopeCount} Convex Cells · ${Z.polytopeRegime===`planetary`?`1 TPa Planetary`:`10 GPa Lab`})`,`Slanted Clausius–Clapeyron A x <= b · Clenshaw Chebyshev log10(ρ) contours · Hover/Click to probe GPU`),e&&(e.hit?Dr(`<div class="live-meter">GPU Probe (${Q(e.temperatureK,1)} K, ${Q(e.pressurePa*1e-5,2)} bar): Phase=<b>${e.phase.toUpperCase()}</b> · ρ_GPU=<b>${Q(e.densityKgPerM3,2)} kg/m³</b>${e.eosRho?` (EOS ${Q(e.eosRho,2)}, err ${Q(e.relErrPct,2)}%)`:``} · margin=${Q(e.margin,3)}</div>`):Dr(`<div class="live-meter fail-closed">GPU Probe (${Q(e.temperatureK,1)} K, ${Q(e.pressurePa*1e-5,2)} bar): <b>OUT OF DOMAIN (FAIL-CLOSED · hitFlag=0)</b> — triggers Tier-2/3 synthesis, never silent extrapolation!</div>`)),Fn.textContent=`Convex Polytopes (${Vn.materialKey}): ${Vn.polytopeCount} Cells`,Wr(vn,Vn,e),In.textContent=`GPU Chebyshev Max Relative Residuals (%)`;let t=Vn.polytopes.map(e=>(e.fit?.maxRelativeError??0)*100);Rr(yn,t.map((e,t)=>t),t,{label:`Max Rel Error (%) per Polytope`,color:`#38bdf8`,yMin:0}),Ln.textContent=`1 atm Multi-Phase Density Curve log10 ρ(T)`;let n=Sr();if(n){let e=n.thermodynamic.meltingPointK,t=n.thermodynamic.boilingPointK,r=Array.from({length:32},(n,r)=>10**(Math.log10(Math.max(5,e*.25))+r/31*(Math.log10(Math.max(t*3,5e3))-Math.log10(Math.max(5,e*.25))))),i=r.map(r=>Math.log10(Math.max(1e-5,v(n,r<e?`solid`:r<t?`liquid`:`gas`,r,101325))));Rr(bn,r.map(e=>Math.log10(e)),i,{label:`log10 ρ(kg/m³) vs log10 T(K) at 1 atm (solid→liquid→gas)`,color:`#34d399`})}}}}var Qr=0;function $r(e){Qr+=1,Z.autoRotate&&(q===`atomic`||q===`compound`)&&(lr+=.008),q===`crystal`&&(Z.crystalViewMode===`tdks-atom`||Z.crystalViewMode===`photon-shell`)&&Z.photonPlaying&&(Zn&&Zn.stepFs(.065),Qn&&(Qn.getStepIndex()>=380?(Qn.reset(null,{nextProbeWavelengthNm:Z.probeWavelengthNm}),Qn.stepSync(24)):Qn.stepSync(3),!er&&Qr%8==0&&(er=!0,Qn.readTelemetry({nonBlocking:!0}).then(e=>{if(!e)return;$n=e,window.__ulgElementsLabState&&(window.__ulgElementsLabState.photonTelemetry=e);let t=Sr();t&&Fr(t,J===`element`?Y?.g7Advisory:{hasReference:!1,note:`Backfed compound live Maxwell–FDTD optics.`}),q===`crystal`&&$()}).catch(()=>{}).finally(()=>{er=!1})))),q===`nuclear`&&J===`element`&&tr&&Z.tdsePlaying&&!rr&&Qr%3==0&&(rr=!0,tr.stepBatch(14,{nonBlocking:!0}).then(e=>{e&&(nr=e,e.stepCount>=1400&&tr.resetWavepacket(),window.__ulgElementsLabState&&(window.__ulgElementsLabState.tdseTelemetry={stepCount:e.stepCount,pInside:e.pInside,pBarrier:e.pBarrier,pTunneled:e.pTunneled}),q===`nuclear`&&$())}).catch(()=>{}).finally(()=>{rr=!1})),q===`compound`&&Z.nebPlaying&&Un?.energiesEv?.length>=2&&e-Z.nebLastTickMs>=520&&(Z.nebLastTickMs=e,Z.nebImageIdx=(Z.nebImageIdx+1)%Un.energiesEv.length,Xr(),$()),Zr(),q===`md`&&ir&&Z.mdPlaying&&!sr&&(sr=!0,ir.stepBatch(4,{readTelemetry:!0,temperatureK:Z.mdTargetTempK}).then(e=>{ir&&(ar=e,or.push({t:e.timeFs,T:e.temperatureK,msd:e.msdA2}),or.length>80&&or.shift(),q===`md`&&$())}).catch(()=>{}).finally(()=>{sr=!1})),requestAnimationFrame($r)}async function ei(e){let t=Sr();if(!(!G||!t)){Z.polytopeRegime=e,Z.polytopeProbe=null,Mn.textContent=`Fitting ${t.materialKey} ${e} Atlas…`;try{Vn=await y(G,t,{degrees:[4,3],relativeTolerance:.05,maxBisectDepth:2,pressureRangePa:[100,e===`planetary`?0xe8d4a51000:1e10],materialIndex:t.atomicNumber||0}),window.__ulgElementsLabState&&(window.__ulgElementsLabState.atlasPolytopeCount=Vn.polytopeCount),Mn.textContent=`${t.materialKey} · ${e} Atlas OK`,Xr(),$()}catch(e){Mn.textContent=`Atlas err: ${e.message}`}}}async function ti(e,t=null,{preserveQuantumNumbers:n=!1,switchToTab:r=null}={}){if(!G)return;let i=t!=null&&Number.isFinite(Number(t))?Math.max(e,Math.min(310,Math.trunc(Number(t)))):null;Mn.textContent=`Solving ${i==null?`${u(e)} (Z=${e})`:`${u(e)}-${i}`}…`,J=`element`,Nr();try{Y=await Ve(G,e,{massNumberA:i,runNuclearGpuVolume:!0,runLiveMd:!0,mdSteps:16,atomicMaxScf:50,nuclearVolDim:24,blochGridN:16,functional:Z.functional,scalarRelativistic:Z.relativisticSpinOrbit,spinOrbit:Z.relativisticSpinOrbit,returnOrbitalWavefunctions:!0});let t=Y.visualData.atom,a=Y.bundle.atomic.unpairedElectrons||0;if(!n){let t=wr(e);Z.n=t.n,Z.l=t.l,Z.m=t.m}Rn=K.buildAtomicVolumeOnGpu({rGrid:t.radialGrid.r,rhoGrid:t.radialGrid.rho,valenceL:Z.l,unpairedCount:a,totalElectrons:t.electronCount,dim:32}),Gr(),qr(),Jr();let o=Y.bundle.nuclear.A;Cn&&(Cn.value=String(o)),Hn=E(e,o,{maxDepth:12});let s=Z.polytopeRegime===`planetary`?0xe8d4a51000:1e10;Vn=await y(G,Y.bundle,{degrees:[4,3],relativeTolerance:.05,maxBisectDepth:2,pressureRangePa:[100,s],materialIndex:e}),Z.polytopeProbe=null,Yr(),Pr(Y.bundle,Hn),Fr(Y.bundle,Y.g7Advisory),Or({kind:`element`,Z:e,A:o,label:Y.bundle.nuclear.isotope}),r?ci(r):(Xr(),$()),Mn.textContent=`${Y.bundle.nuclear.isotope} · WebGPU OK`,li()}catch(e){Mn.textContent=`Error: ${e.message}`,console.error(e)}}async function ni(){for(let e of Wn)if(e?.pointsBuffer)try{e.pointsBuffer.destroy()}catch{}if(Wn=[],!(!G||!Un?.imageOrbitalParams?.length))for(let e of Un.imageOrbitalParams){let t=bt(G,{posZeta:e.posZeta,weights:e.weights,boxHalfBohr:e.boxHalfBohr,mode:Z.molOrbitalMode,pointCount:11e4,seed:1});Wn.push(t)}}async function ri(e){let t=e?.visualData?.molQm?.atoms;if(!G||!Array.isArray(t)||t.length<2||t.length>5||t.some(e=>e.Z>10))return null;let n=t.map(e=>({Z:e.Z,position:[e.x,e.y,e.z]})),r,i;t.length>=3?(r=t.map((e,t)=>t===0?{Z:e.Z,position:[e.x,e.y,e.z]}:{Z:e.Z,position:[e.x,-e.y,e.z]}),i=`molecular inversion TS (WebGPU)`):(r=t.map((e,t)=>t===0?{Z:e.Z,position:[e.x,e.y,e.z]}:{Z:e.Z,position:[e.x*1.85,e.y*1.85,e.z*1.85]}),i=`bond stretch MEP (WebGPU)`);try{let e=await k(G,n,r,{nImages:5,maxSteps:4,stepSize:.14,climbStartStep:1,basisName:`sto-3g`}),t=e.energiesHa[0],a=27.211386245988,o=e.energiesHa.map(e=>(e-t)*a),s=[];for(let t of e.images){let e=await ee(G,t,{maxScf:22,volDim:16,sampleVolume:!0});e?.atomOrbitalParams&&s.push(e.atomOrbitalParams)}return{backend:e.backend,gpuRhfCalls:e.gpuRhfCalls+s.length,pathwayLabel:i,saddleImageIndex:e.saddleImageIndex,forwardBarrierEv:e.forwardBarrierHa*a,reverseBarrierEv:e.reverseBarrierHa*a,energiesHa:e.energiesHa,energiesEv:o,steps:e.steps,imageOrbitalParams:s}}catch{return null}}function ii(e){if(!K||!e)return null;let t=e.visualData?.molQm?.atoms,n=e.bundle.nuclear.isotopologueSites||[],r=[];if(Array.isArray(t)&&t.length>0)r=t.map((e,t)=>{let r=n[t]||{Z:e.Z,A:w(e.Z)},i=T(r.Z,r.A);return{x:e.x,y:e.y,z:e.z,Z:i.Z,N:i.N,chargeRadiusFm:i.chargeRadiusFm}});else{let e=[];for(let t of n){let n=T(t.Z,t.A);for(let r=0;r<Math.min(4,t.count||1);r+=1)e.push(n)}let t=Math.max(1,e.length);r=e.map((e,n)=>{let r=n/t*Math.PI*2;return{x:t===1?0:Math.cos(r),y:t===1?0:Math.sin(r)*.5,z:t===1?0:Math.sin(r)*.7,Z:e.Z,N:e.N,chargeRadiusFm:e.chargeRadiusFm}})}return K.buildCompositeNuclearVolumeOnGpu(r,24)}async function ai(e,t=`crystal`){if(!G||!e)return;X=e,J=`compound`,Nr(),zn=ii(e),Bn=Oe({crystalStructure:e.bundle.mechanical.crystalStructure,cellsPerSide:2,latticeConstantA:Math.max(2.6,Number(e.bundle.mechanical.latticeConstantA||4.2)),massU:Math.max(2,Number(e.bundle.nuclear.molarMassU||28)),temperatureK:300}),Gr(),qr(),Yr();let n=Z.polytopeRegime===`planetary`?0xe8d4a51000:1e10;Vn=await y(G,e.bundle,{degrees:[4,3],relativeTolerance:.05,maxBisectDepth:2,pressureRangePa:[100,n]}),Z.polytopeProbe=null,Pr(e.bundle),Fr(e.bundle,{hasReference:!1,note:`Backfed compound running live across Nuclear, RHF QM, Maxwell Photon–Shell Optics, WebGPU MD & Polytope Atlas.`}),Or({kind:`compound`,formula:e.bundle.materialKey,label:e.bundle.materialKey}),ci(t),Mn.textContent=`${e.bundle.materialKey} · Backfed OK`,li()}async function oi(e,{backfeedAllTabs:t=!1,switchToTab:n=`compound`}={}){if(G){Mn.textContent=`Deriving ${e}…`;try{X=await tt(G,e,{runLiveMd:!0,mdSteps:10,mdCellsPerSide:2,reactionContext:{source:`elements-lab-interactive`}}),zn=ii(X),Bn=Oe({crystalStructure:X.bundle.mechanical.crystalStructure,cellsPerSide:2,latticeConstantA:Math.max(2.6,Number(X.bundle.mechanical.latticeConstantA||4.2)),massU:Math.max(2,Number(X.bundle.nuclear.molarMassU||28)),temperatureK:300}),Un=await ri(X),Z.nebImageIdx=Un?Un.saddleImageIndex:0,await ni(),J=`compound`,Nr(),Gr(),qr(),Yr();let r=Z.polytopeRegime===`planetary`?0xe8d4a51000:1e10;Vn=await y(G,X.bundle,{degrees:[4,3],relativeTolerance:.05,maxBisectDepth:2,pressureRangePa:[100,r]}),Z.polytopeProbe=null,Pr(X.bundle),Fr(X.bundle,{hasReference:!1,note:`Recursive compound feedback bundle (zero hardcoded compound table).`}),Or({kind:`compound`,formula:X.bundle.materialKey,label:X.bundle.materialKey}),ci(t?n:`compound`),Mn.textContent=`${e} · Compound OK`,li()}catch(e){Mn.textContent=`Error: ${e.message}`,console.error(e)}}}async function si(e,t){if(!G)return;let n=String(e||``).trim(),r=String(t||``).trim();if(!(!n||!r)){Mn.textContent=`Reacting ${n} + ${r}…`;try{let e=await rt(G,[n,r],{runLiveMd:!0,mdSteps:10,mdCellsPerSide:2});if(!e.derivedProducts.length){kn.innerHTML=`<div class="product-card" style="border-color:rgba(248,113,113,0.45);">No balanced reaction candidate found for <b>${n} + ${r}</b>. Try e.g. Na+H2O, H2+O2, Na+Cl2, Fe+O2, Cs+F2.</div>`,Mn.textContent=`No reaction candidate`;return}let t=e.candidates?.[0],i=t?.energetics?.reactionEnthalpyJPerBalancedEquation==null?`derived`:`${Q(t.energetics.reactionEnthalpyJPerBalancedEquation*.001,1)} kJ/mol`,a=`<div class="product-card">
      <div style="font-weight:700;color:#e9d5ff;margin-bottom:3px;">${t?.equation||`${n} + ${r} → ${e.productFormulas.join(` + `)}`}</div>
      <div style="font-size:10px;color:var(--muted);margin-bottom:4px;">${t?.familyLabel||`Stoichiometric discovery`} · ΔH = ${i}</div>`;e.derivedProducts.forEach((e,t)=>{let n=e.bundle;a+=`<button class="action backfeed-btn" data-bf-idx="${t}">Backfeed ${n.materialKey} (ρ=${Q(n.mechanical.densityKgPerM3,0)} · T_m=${Q(n.thermodynamic.meltingPointK,0)}K · n=${Q(n.electromagnetic.refractiveIndex550Nm,2)}) → All Sims</button>`}),a+=`</div>`,kn.innerHTML=a;for(let t of kn.querySelectorAll(`[data-bf-idx]`))t.addEventListener(`click`,()=>{let n=e.derivedProducts[Number(t.dataset.bfIdx)];n&&ai(n,`crystal`)});let o=e.derivedProducts[0];An.value=o.bundle.materialKey,X=o,zn=ii(o),Bn=Oe({crystalStructure:o.bundle.mechanical.crystalStructure,cellsPerSide:2,latticeConstantA:Math.max(2.6,Number(o.bundle.mechanical.latticeConstantA||4.2)),massU:Math.max(2,Number(o.bundle.nuclear.molarMassU||28)),temperatureK:300}),Un=await ri(o),Z.nebImageIdx=Un?Un.saddleImageIndex:0,await ni(),J=`compound`,Nr(),Gr(),qr(),Yr(),Vn=await y(G,o.bundle,{degrees:[4,3],relativeTolerance:.05,maxBisectDepth:2}),Pr(o.bundle),Fr(o.bundle,{hasReference:!1,note:`Discovered from ${n} + ${r}; click Backfeed to run across all tabs.`}),Or({kind:`compound`,formula:o.bundle.materialKey,label:o.bundle.materialKey}),ci(`compound`),Mn.textContent=`${n}+${r} → ${e.productFormulas.join(`+`)} OK`,li()}catch(e){Mn.textContent=`Reaction err: ${e.message}`,console.error(e)}}}function ci(e){q=e;for(let t of document.querySelectorAll(`.tab-btn`))t.classList.toggle(`active`,t.dataset.tab===e);Xr(),$(),li()}function li(){let e=Sr(),t=J===`compound`;window.__ulgElementsLabState={mode:t?`compound`:`element`,activeSpecimenKind:J,currentTab:q,rendererBackend:`webgpu`,cameraAutoSpin:!1,mdPerFrameCpuPositionReadback:!1,Z:t?null:Gn,A:t?null:Y?.bundle?.nuclear?.A??Kn,isotope:t?null:Y?.bundle?.nuclear?.isotope??null,formula:t?X?.bundle?.materialKey??null:null,backfedFormula:t?X?.bundle?.materialKey??null:null,relativisticSpinOrbit:Z.relativisticSpinOrbit,functional:Z.functional,bundle:e,decayChain:Hn,nebBackend:Un?.backend??null,nebBarrier:Un,atlasPolytopeCount:Vn?.polytopeCount??0,polytopeProbe:Z.polytopeProbe,photonTelemetry:$n,tdseTelemetry:nr?{stepCount:nr.stepCount,pInside:nr.pInside,pTunneled:nr.pTunneled}:null,orbitalCloudStats:Jn?{pointCount:Jn.pointCount,n:Jn.n,l:Jn.l,m:Jn.m,sourceKind:Jn.sourceKind}:null,registeredModules:j.listModules().map(e=>e.methodKey),closureCount:cn.size,g7Advisory:t?null:Y?.g7Advisory},window.__ulgElementsLabApi={setTab:e=>ci(e),solveElement:(e,t=null,n={})=>(Gn=e,Kn=t,Sn.value=String(e),Cn&&(Cn.value=String(t??w(e))),ti(e,t,n)),setRelativistic:e=>(Z.relativisticSpinOrbit=!!e,ti(Gn,Kn,{preserveQuantumNumbers:!0})),setOrbital:(e,t,n)=>{Z.n=e,Z.l=t,Z.m=n,Gr(),Xr(),$()},setCrystalViewMode:e=>{Z.crystalViewMode=e,Xr(),$()},stepTdks:(e=40)=>{if(!Zn)return null;for(let t=0;t<e;t+=1)Zn.stepFs(.065);return $(),Zn.channels.map(e=>({nm:e.wavelengthNm,rho11:e.rho11,dipole:e.dipole,absorbed:e.absorbedEnergy}))},stepPhotonFdtd:async(e=220)=>{if(!Qn)return null;let t=await Qn.stepBatch(e,{readObs:!0});return t&&($n=t),$(),li(),t},stepTdse:async(e=120)=>{if(!tr)return null;let t=await tr.stepBatch(e);return t&&(nr=t),$(),li(),t},runReaction:(e,t)=>si(e,t),backfeedCompound:(e,t=`crystal`)=>oi(e,{backfeedAllTabs:!0,switchToTab:t}),probePolytope:async(e,t)=>{if(!Vn||!K)return null;let n=await K.probePolytopeAtlasOnGpu(Vn,e,t),r=K.getPolytopeAxisBounds(Vn),i=(Math.log10(Math.max(1,e))-r.minLt)/Math.max(1e-6,r.maxLt-r.minLt),a=(Math.log10(Math.max(1e-6,t))-r.minLp)/Math.max(1e-6,r.maxLp-r.minLp);return Z.polytopeProbe={...n,fx:i,fy:a},$(),li(),n},captureCanvasDataUrl:()=>new Promise(e=>{requestAnimationFrame(()=>{Zr(),e(dn.toDataURL(`image/png`))})})}}async function ui(){Mr(),jr();for(let e of document.querySelectorAll(`.tab-btn`))e.addEventListener(`click`,()=>ci(e.dataset.tab));for(let e of document.querySelectorAll(`#hero-presets [data-hero-z]`))e.addEventListener(`click`,()=>{let t=Number(e.dataset.heroZ),n=e.dataset.heroA?Number(e.dataset.heroA):null,r=e.dataset.heroTab||null;Gn=t,Kn=n,Sn.value=String(t),Cn&&(Cn.value=String(n??w(t))),r===`crystal`&&(Z.crystalViewMode=`tdks-atom`),ti(t,n,{switchToTab:r})});for(let e of document.querySelectorAll(`#hero-presets [data-hero-compound]`))e.addEventListener(`click`,()=>{let t=e.dataset.heroCompound,n=e.dataset.heroTab||`crystal`;An.value=t,n===`crystal`&&(Z.crystalViewMode=`photon-shell`),oi(t,{backfeedAllTabs:!0,switchToTab:n})});for(let e of document.querySelectorAll(`#hero-presets [data-hero-react]`))e.addEventListener(`click`,()=>{let[t,n]=e.dataset.heroReact.split(`|`);En&&(En.value=t),Dn&&(Dn.value=n),si(t,n)});for(let e of document.querySelectorAll(`#reaction-presets [data-rxn]`))e.addEventListener(`click`,()=>{let[t,n]=e.dataset.rxn.split(`|`);En&&(En.value=t),Dn&&(Dn.value=n),si(t,n)});Tn.addEventListener(`click`,()=>{let e=Math.max(1,Math.min(118,Math.trunc(Number(Sn.value)||26))),t=Cn?.value?.trim(),n=t?Math.trunc(Number(t)):null;Gn=e,Kn=n&&n>=e&&n<=310?n:null,ti(e,Kn)}),wn?.addEventListener(`click`,()=>{let e=Math.max(1,Math.min(118,Math.trunc(Number(Sn.value)||Gn)));Gn=e,Kn=null,Cn&&(Cn.value=String(w(e))),ti(e,null)}),On?.addEventListener(`click`,()=>{si(En?.value,Dn?.value)}),jn.addEventListener(`click`,()=>{oi(An.value||`H2O`)}),vn.style.cursor=`crosshair`,vn.addEventListener(`click`,e=>{if(q!==`nuclear`||!Y?.visualData?.nuclear?.chartDims)return;let t=vn.getBoundingClientRect(),n=(e.clientX-t.left)/Math.max(1,t.width)*vn.width,r=(e.clientY-t.top)/Math.max(1,t.height)*vn.height,{maxZ:i,maxN:a}=Y.visualData.nuclear.chartDims,o=Math.round((n-12)/Math.max(1,vn.width-24)*a),s=Math.round((vn.height-12-r)/Math.max(1,vn.height-24)*i);s>=1&&s<=i&&o>=0&&o<a&&(Gn=s,Kn=s+o,Sn.value=String(Gn),Cn&&(Cn.value=String(Kn)),ti(Gn,Kn))});let e=null;for(let t=0;t<8&&!e;t+=1)e=await navigator.gpu?.requestAdapter({powerPreference:`high-performance`}),e||await new Promise(e=>setTimeout(e,250));if(!e){Mn.textContent=`WebGPU unavailable (fail-closed)`;return}G=await e.requestDevice(),G.addEventListener(`uncapturederror`,e=>console.error(`WebGPU error:`,e.error?.message||String(e.error))),K=sn(G,dn);let t=new URLSearchParams(window.location.search),n=Math.max(1,Math.min(118,Math.trunc(Number(t.get(`z`))||26))),r=t.get(`a`),i=r&&Number.isFinite(Number(r))?Math.max(n,Math.min(310,Math.trunc(Number(r)))):null,a=t.get(`tab`);Gn=n,Kn=i,Sn.value=String(n),Cn&&(Cn.value=String(i??w(n))),await ti(n,i,{switchToTab:a||null}),requestAnimationFrame($r)}ui();