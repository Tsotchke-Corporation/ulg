import{F as e,H as t,I as n,L as r,R as i,at as a,ct as o,et as s,it as c,nt as l,ot as u,rt as d,st as f,tt as p}from"./eshkolTriadClosures-CAdZ5Pha.js";import{d as m,f as h,o as g}from"./materialFoundationAbi-FyZ8ey5s.js";import{t as _}from"./ClosureRegistry-DFBzDEUV.js";import{r as v,t as y}from"./polytopeAtlasBuilder-QwnCNpa5.js";import{computeBufferBinding as b,createCachedExplicitComputePipeline as x}from"../runtime/webgpuComputeLayout.js";import{r as S}from"./formula-D3fFrMJF.js";import{i as C,n as w,o as T,r as E,s as D,t as O}from"./nuclearStructureGpu-YpGyo3WZ.js";import{c as k,i as A}from"./nuclearCherenkovClosure-BK2zIv-T.js";import{i as j}from"./reactionCandidates-oczNxTvL.js";import{a as M,c as N,i as P,o as F,r as ee}from"./simulationModuleRegistry-B9GELnPw.js";import{n as te}from"./fft3dWebGpu-U-dm_fNS.js";import{r as ne}from"./opticalResolverWebGpu-lrCWoCIq.js";var re=`ulg.electronic.periodic-bulk-dft-webgpu.v1`,I=27.211386245988,ie=n/e**3*1e-9,ae=e*1e10,oe=1054571817e-43,se=1380649e-29;function ce(e){let t=c(e),n=t.reduce((e,t)=>Math.max(e,t.n),0),r=t.find(e=>e.n===n&&e.l===0),i=t.find(e=>e.n===n&&e.l===1),a=t.find(e=>e.n===n&&e.l===2),o=a||t.find(e=>e.n===n-1&&e.l===2),s=a?0:r?.occupancy??0,l=a?0:i?.occupancy??0;return{maxN:n,sSub:r,pSub:i,dSub:o,sOcc:s,pOcc:l,dOcc:o?.occupancy??0,isClosedShell:(n===1&&s===2||l===6)&&!a,isMolecularNonmetal:!a&&(n===1&&s===1||l===5||n===2&&l>=3&&l<=4),isCovalentTetrahedral:!a&&(n>=2&&n<=5&&l===2||n===2&&l===1)}}var le=Object.freeze({fcc:Object.freeze({id:`fcc`,spaceGroup:`Fm-3m (225)`,madelungAlpha:-1.79175,coord:12,atomsPerConv:4,packingFactor:Math.PI/(3*Math.SQRT2),shearRatioGOverK:.45,basisFractional:[[0,0,0]]}),bcc:Object.freeze({id:`bcc`,spaceGroup:`Im-3m (229)`,madelungAlpha:-1.79186,coord:8,atomsPerConv:2,packingFactor:Math.PI*Math.sqrt(3)/8,shearRatioGOverK:.48,basisFractional:[[0,0,0]]}),hcp:Object.freeze({id:`hcp`,spaceGroup:`P6_3/mmc (194)`,madelungAlpha:-1.79168,coord:12,atomsPerConv:4,packingFactor:Math.PI/(3*Math.SQRT2),shearRatioGOverK:.46,basisFractional:[[0,0,0],[1/3,2/3,.5]]}),diamond:Object.freeze({id:`diamond`,spaceGroup:`Fd-3m (227)`,madelungAlpha:-1.67085,coord:4,atomsPerConv:8,packingFactor:Math.PI*Math.sqrt(3)/16,shearRatioGOverK:.72,basisFractional:[[-.125,-.125,-.125],[.125,.125,.125]]}),"vdw-fcc":Object.freeze({id:`vdw-fcc`,spaceGroup:`Fm-3m (vdW)`,madelungAlpha:-1.79175,coord:12,atomsPerConv:4,packingFactor:Math.PI/(3*Math.SQRT2),shearRatioGOverK:.32,basisFractional:[[0,0,0]]})});function ue(e){let t=ce(e);return t.isClosedShell||t.isMolecularNonmetal?[`vdw-fcc`]:t.isCovalentTetrahedral?[`diamond`,`fcc`]:!t.dSub&&!t.pSub&&t.sOcc===1?[`bcc`,`fcc`]:!t.dSub&&!t.pSub&&t.sOcc===2?[`hcp`,`fcc`,`bcc`]:t.dOcc>=1&&t.dOcc<=9?[`bcc`,`fcc`,`hcp`]:[`fcc`,`bcc`,`hcp`]}var L=Object.freeze([[0,0,0],[1,1,1],[-1,1,1],[1,-1,1],[1,1,-1],[-1,-1,1],[-1,1,-1],[1,-1,-1],[-1,-1,-1],[2,0,0],[-2,0,0],[0,2,0],[0,-2,0],[0,0,2],[0,0,-2]]);function R(e,n,r,i,a){let o=L.length,s=new Float32Array(o*o),c=2*Math.PI/Math.max(1.5,n),l=a===`bcc`?n**3/2:a===`diamond`?n**3/8:n**3/4,u=t(r/Math.max(1e-6,l)),d=1.919158292677513/Math.max(.25,u);for(let t=0;t<o;t+=1){let n=L[t],u=(e[0]+n[0])*c,f=(e[1]+n[1])*c,p=(e[2]+n[2])*c;s[t*o+t]=.5*(u*u+f*f+p*p);for(let e=t+1;e<o;e+=1){let u=L[e],f=(n[0]-u[0])*c,p=(n[1]-u[1])*c,m=(n[2]-u[2])*c,h=Math.hypot(f,p,m);if(h<1e-8)continue;let g=-(4*Math.PI*r/(l*h*h))*Math.cos(h*i),_=h/(2*d),v=_<1e-4?1:Math.abs(_-1)<1e-4?.5:.5+(1-_*_)/(4*_)*Math.log(Math.abs((1+_)/(1-_))),y=1+4*d/(Math.PI*h*h)*v,b=1;if(a===`diamond`){let e=(n[0]-u[0]+(n[1]-u[1])+(n[2]-u[2]))*(Math.PI/4);b=Math.cos(e)}else if(a===`hcp`){let e=((n[0]-u[0])/3+2*(n[1]-u[1])/3+.5*(n[2]-u[2]))*Math.PI;b=Math.cos(e)}let x=g/y*b;s[t*o+e]=x,s[e*o+t]=x}}return s}function de(){let e=[{label:`Γ`,k:[0,0,0]},{label:`X`,k:[0,1,0]},{label:`W`,k:[.5,1,0]},{label:`L`,k:[.5,.5,.5]},{label:`Γ`,k:[0,0,0]}],t=[];for(let n=0;n<e.length-1;n+=1){let r=e[n].k,i=e[n+1].k;for(let a=0;a<4;a+=1){let o=a/4;t.push({label:a===0?e[n].label:``,k:[r[0]+o*(i[0]-r[0]),r[1]+o*(i[1]-r[1]),r[2]+o*(i[2]-r[2])]})}}return t.push(e[e.length-1]),t}function fe(e,t,n){let a=Math.max(.8,e),{Z:o,zv:s,rcBohr:c,polarizabilityBohr3:l,rVdwBohr:u,dOcc:d,fOcc:f,relSContraction:p,spGapHa:m}=n,h=4*Math.PI/3*a**3;if(t.id===`vdw-fcc`){let e=a*2.2097,t=.75*Math.max(.15,n.ionizationPotentialHa||.5)*l*l,r=Math.max(2.2,u*1.52),i=(r/e)**6;return 2*Math.max(1e-5,t/(4*r**6))*(12.13188*i*i-14.45392*i)}let g=a/Math.cbrt(Math.max(1,s)),_=1.10495/(g*g)*s,v=(i(g)+r(g))*s,y=t.madelungAlpha*s*s/(2*a),b=2*Math.PI*s*s*c*c/h,x=0;if(d>0&&d<10){let e=.38*Math.min(1.6,1+.008*o)*(3/a)**3.2;x-=.5*e*d*(1-d/10),x+=.16*e*(d/10+.35)*(2.85/a)**6}if(f>0&&f<14){let e=.08*(3.4/a)**4;x-=.25*e*f*(1-f/14)}if(t.id===`diamond`){let e=a*1.3959,t=Math.max(2.6,c*2.35),n=Math.exp(-.9*(e-t)),r=Math.max(.25,.11*s*s/Math.max(2,t));x+=(s>=3&&s<=5?2.4:.5)*r*(n*n-2*n)}d===10&&s===2&&p>.08&&(x+=.18*p*(m||.2)*(3.2/a)**2.5);let{sOcc:S=0,pOcc:C=0}=n,w=0;return t.id===`bcc`?w=d>=3&&d<=6||d===0&&C===0&&S===1?-.0085:.0045:t.id===`fcc`?w=d>=8&&d<=10&&!(d===10&&S===2&&C===0)||d===0&&S===2&&C>=1||d===10&&C>=1?-.0095:.0015:t.id===`hcp`&&(w=d===0&&C===0&&S===2||d===1||d===2||d===7||d===10&&S===2&&C===0||f>0&&f<14?-.009:.002),_+v+y+b+x+w}function pe(e,t){let n=0;for(let e=1;e<t.length;e+=1)t[e]<t[n]&&(n=e);let r=Math.max(1,Math.min(t.length-2,n)),i=4*Math.PI/3*e[r-1]**3,a=4*Math.PI/3*e[r]**3,o=4*Math.PI/3*e[r+1]**3,s=t[r-1],c=t[r],l=t[r+1],u=(c-s)/(a-i),d=(l-c)/(o-a),f=2*(d-u)/(o-i),p=.5*(u+d),m=a-(f>1e-12?p/f:0);m=Math.max(i*.9,Math.min(o*1.1,m));let h=Math.cbrt(3*m/(4*Math.PI)),g=c-(f>1e-12?.5*p*p/f:0),_=Math.max(1e-7,m*Math.max(1e-9,f))*ie;return{rWsEq:h,vEqBohr3:m,eMinHa:g,bulkModulusGPa:_}}function me(e,t){let n=c(e),r=n.reduce((e,t)=>Math.max(e,t.n),0),i=n.find(e=>e.n===r&&e.l===2),a=i||n.find(e=>e.n===r-1&&e.l===2),s=n.find(e=>e.n===r-2&&e.l===3),l=i?null:n.find(e=>e.n===r&&e.l===0),u=i?null:n.find(e=>e.n===r&&e.l===1),d=Math.max(1,o(e)||(a?Math.min(4,a.occupancy):1)),f=2,p=3.2,m=6,h=t?.radialGrid;if(h?.r&&h?.rho){let{r:e,rho:t,dx:n}=h,r=0,i=0;for(let r=0;r<e.length;r+=1)i+=4*Math.PI*e[r]*e[r]*e[r]*t[r]*n;let a=0,o=0;for(let s=0;s<e.length;s+=1){let c=4*Math.PI*e[s]*e[s]*e[s]*t[s]*n;r+=c,r>=.88*i&&f===2&&(f=e[s]),t[s]>=.001&&(p=e[s]),r>=Math.max(0,i-d-1)&&(a+=e[s]*e[s]*c,o+=c)}o>1e-6&&(m=a/o)}let g=Math.max(.55,Math.min(3.2,f*.78)),_=Array.isArray(t?.orbitals)?t.orbitals.filter(e=>Number(e.occupancy??1)>0):[],v=_.length?Math.max(..._.map(e=>Number(e.energyHa??e.energy??-.4))):-.35,y=Math.max(.12,-v),b=Math.max(1.2,Math.min(450,4/(9*Math.max(1,d))*m**2*d)),x=Math.min(.35,.5*(e/137.036)**2);return Object.freeze({Z:e,zv:d,rcBohr:g,rVdwBohr:Math.max(1.8,p),meanR2Valence:m,polarizabilityBohr3:b,ionizationPotentialHa:y,dOcc:a?.occupancy??0,fOcc:s?.occupancy??0,sOcc:l?.occupancy??0,pOcc:u?.occupancy??0,relSContraction:x,spGapHa:.22+.4*x})}async function z(t,n,r,{densityGridN:i=16,atomicMassU:o=null}={}){if(!t||typeof t.createBuffer!=`function`)throw TypeError(`solveBulkCrystalWebGpu requires a live WebGPU GPUDevice`);let s=me(n,r),c=ue(n),d=null;for(let e of c){let t=le[e],n=e===`vdw-fcc`?Math.max(2,s.rVdwBohr*.72):Math.max(1.3,s.rcBohr*1.15),r=e===`vdw-fcc`?Math.max(n+2.5,s.rVdwBohr*1.45):Math.max(n+2.8,s.rcBohr*3.1),i=new Float64Array(19),a=new Float64Array(19);for(let e=0;e<19;e+=1)i[e]=n+e/18*(r-n),a[e]=fe(i[e],t,s);let o=pe(i,a);(!d||o.eMinHa<d.fit.eMinHa)&&(d={struct:t,fit:o})}let{struct:f,fit:p}=d,m=Number(o),h=Number.isFinite(m)&&m>0?m*16605390666e-37:l(n),_=Math.max(1e6,p.bulkModulusGPa*1e9),v=_*f.shearRatioGOverK,y=p.vEqBohr3*e**3,b=h/y,x=Math.sqrt((_+4/3*v)/b),S=Math.sqrt(v/b),C=Math.cbrt(3/(1/x**3+2/S**3)),w=oe/se*Math.cbrt(6*Math.PI*Math.PI/y)*C,T=Math.min(.18,1.5*1.6*se*w/Math.max(1e-24,_*y)),E=p.vEqBohr3*(1+T),D=E*e**3,O=h/D,k=Math.cbrt(f.atomsPerConv*E),A=k*ae,j=(3*_-2*v)/(2*(3*_+v)),M=_+4/3*v,N=_-2/3*v,P=v,ee=Math.sqrt((_+4/3*v)/O),ne=Math.sqrt(v/O),ie=Math.cbrt(3/(1/ee**3+2/ne**3)),z=1/D,he=oe/se*Math.cbrt(6*Math.PI*Math.PI*z)*ie,ge=Math.max(.01,Math.min(11,Math.abs(p.eMinHa)*I*.45+(f.id===`vdw-fcc`?0:.6))),_e=de(),ve=L.length,ye=new Float32Array(_e.length*ve*ve);for(let e=0;e<_e.length;e+=1){let t=R(_e[e].k,k,s.zv,s.rcBohr,f.id);ye.set(t,e*ve*ve)}let be=await F(t,{matrices:ye,n:ve,batchCount:_e.length,maxSweeps:28,tolerance:1e-5}),xe=[],Se=[],Ce=Math.max(1,Math.ceil(s.zv/2)),we=-1/0,Te=1/0;for(let e=0;e<_e.length;e+=1){let t=[];for(let n=0;n<Math.min(8,ve);n+=1){let r=be.eigenvalues[e*ve+n]*I;t.push(r),Se.push(r)}xe.push(t);let n=Math.min(t.length-2,Ce-1);we=Math.max(we,t[n]),Te=Math.min(Te,t[n+1])}Se.sort((e,t)=>e-t);let Ee=Se[Math.min(Se.length-1,Math.floor(_e.length*(s.zv/2)))],De=Math.max(0,Te-we);if(f.id===`vdw-fcc`){let e=ce(n);De=Math.max(De,Math.min(21.5,s.ionizationPotentialHa*I*(e.isClosedShell?.85:.42)))}else f.id===`diamond`?De=Math.max(.4,(De+.35)*(1+1.8/Math.max(1.5,A*.45))):De<.25&&(De=0);let Oe=Math.min(...Se)-2,B=Math.max(...Se)+2,ke=new Float32Array(48),Ae=new Float32Array(48),je=Math.max(.35,(B-Oe)/36);for(let e=0;e<48;e+=1){let t=Oe+e/47*(B-Oe);ke[e]=t;let n=0;for(let e of Se){let r=(t-e)/je;n+=Math.exp(-.5*r*r)}Ae[e]=2*n/(_e.length*je*Math.sqrt(2*Math.PI))}let Me=0;if(De===0){let e=Math.max(0,Math.min(47,Math.round((Ee-Oe)/Math.max(1e-6,B-Oe)*47)));Me=Math.max(.15,Ae[e]+(s.dOcc>0&&s.dOcc<10?.32*Math.sin(Math.PI*s.dOcc/10)*6.5:0))}let Ne=i,Pe=Ne**3,Fe=new Float32Array(Pe*2);for(let e=0;e<ve;e+=1){let[t,n,r]=L[e],i=(t%Ne+Ne)%Ne,a=(n%Ne+Ne)%Ne,o=((r%Ne+Ne)%Ne*Ne+a)*Ne+i,s=be.eigenvectors[e*ve+0],c=Ce>1?be.eigenvectors[e*ve+1]:0;Fe[o*2]+=s,Fe[o*2+1]+=c}let Ie=await te(t,{data:Fe,n:Ne,inverse:!0}),Le=new Float32Array(Pe),Re=1e-12;for(let e=0;e<Pe;e+=1){let t=Ie.data[e*2],n=Ie.data[e*2+1],r=t*t+n*n;Le[e]=r,r>Re&&(Re=r)}for(let e=0;e<Pe;e+=1)Le[e]/=Re;return Object.freeze({schema:re,backend:`webgpu`,Z:n,symbol:u(n),crystalStructure:f.id,spaceGroup:f.spaceGroup,coordinationNumber:f.coord,latticeConstantA:A,wignerSeitzRadiusBohr:p.rWsEq,densityKgPerM3:O,cohesiveEnergyEv:ge,bulkModulusPa:_,bulkModulusGPa:_*1e-9,shearModulusPa:v,poissonRatio:j,elasticConstantsGPa:Object.freeze({c11:M*1e-9,c12:N*1e-9,c44:P*1e-9}),soundSpeedLongMPerS:ee,soundSpeedTransMPerS:ne,debyeTemperatureK:he,fermiEnergyEv:Ee,bandGapEv:De,isMetal:De===0,dosAtFermiStatesPerEvAtom:Me,kPathLabels:_e.map(e=>e.label),bandsEv:xe,dosEnergyEv:ke,dosValues:Ae,blochDensityGridN:Ne,blochDensity3d:Le,spinUnpairedElectrons:a(n).reduce((e,t)=>e+(t.occUp-t.occDown),0),accuracyTier:n<=100?f.id===`vdw-fcc`||s.fOcc>0?g.TIER_2_REPRESENTATIVE_EFFECTIVE:g.TIER_1_QUANTITATIVE:g.TIER_3_THEORETICAL_ENVELOPE,provenance:Object.freeze({status:`webgpu-derived`,scientificValidation:!1,solver:`gpumath-bloch-pw-fft3d-bm3`})})}var he=`ulg.electromagnetic.closure-webgpu.v1`,ge=1602176634e-28,_e=91093837015e-41,ve=88541878128e-22,ye=125663706212e-17,be=92740100783e-34,xe=1054571817e-43,Se=1380649e-29,Ce=1602176634e-28,we=27.211386245988;async function Te(t,{Z:n,atomResult:r,bulkResult:i,temperatureK:o=300}={}){let s=c(n),l=a(n),u=s.reduce((e,t)=>Math.max(e,t.n),0),d=s.find(e=>e.n===u&&e.l===2),f=d||s.find(e=>e.n===u-1&&e.l===2),p=s.find(e=>e.n===u-2&&e.l===3),m=d?null:s.find(e=>e.n===u&&e.l===0),h=d?null:s.find(e=>e.n===u&&e.l===1),_=f?.occupancy??0,v=p?.occupancy??0,y=m?.occupancy??0,b=h?.occupancy??0,x=l.reduce((e,t)=>e+(t.occUp-t.occDown),0),S=d?1.2:Math.max(1,y+b+.18*Math.min(_,10-_)),C=4*Math.PI/3*(i.wignerSeitzRadiusBohr*e)**3,w=1/Math.max(1e-32,C),T=i.isMetal?S*w:0,E=xe*(i.isMetal?Math.sqrt(T*ge*ge/(ve*_e)):0)/Ce,D=(u===4&&_>0&&_<10?.92:v>0&&v<14?.58:_>0&&_<10?.55:.25)*(.5*(i.dosAtFermiStatesPerEvAtom||0)),O=n*(.65*e)**2;if(r?.radialGrid?.r&&r?.radialGrid?.rho){let{r:t,rho:n,dx:i}=r.radialGrid,a=0;for(let e=0;e<t.length;e+=1)a+=4*Math.PI*t[e]**5*n[e]*i;Number.isFinite(a)&&a>0&&(O=a*e**2)}let k=-(w*ye*ge*ge*O)/(6*_e),A=i.isMetal?ye*be*be*(i.dosAtFermiStatesPerEvAtom/Ce)*w:0,j=`diamagnetic`,M=0,N=0,P=k+2/3*A;i.isMetal&&u===4&&_>=6&&_<=8&&D>.85?(j=`ferromagnetic`,M=Math.max(.55,(10-_)*.62-.12),N=Math.max(350,320*M*D),P=o>N?ye*w*(M*be)**2/(3*Se*Math.max(10,o-N)):1e3):i.isMetal&&v>=6&&v<=11?(j=`ferromagnetic`,M=x*.95,N=Math.max(20,42*(x*(x+2))/20),P=o>N?ye*w*(M*be)**2/(3*Se*Math.max(10,o-N)):500):i.isMetal&&u===4&&(_===4||_===5)?(j=`antiferromagnetic`,M=.6+.35*(_-4),N=_===5?210:120,P=ye*w*(M*be)**2/(3*Se*(o+N))):x>0&&!i.isMetal?(j=`paramagnetic`,M=Math.sqrt(x*(x+2)),P=k+ye*w*(M*be)**2/(3*Se*Math.max(1,o))):P>0&&(j=`paramagnetic`);let F=Math.max(30,i.debyeTemperatureK||250),ee=i.isMetal?Math.max(.08,Math.min(1.8,.14+.16*(i.dosAtFermiStatesPerEvAtom||.5)*(300/F))):0,te=0;if(i.isMetal){let e=o/F,t=e>=.4?1:(e/.4)**4,n=Math.max(1e11,2*Math.PI*ee*Se*o/xe*t);te=T*ge*ge/(_e*n)}else{let e=i.bandGapEv*Ce,t=2*(_e*Se*o/(2*Math.PI*xe*xe))**1.5*Math.exp(-e/(2*Se*Math.max(1,o))),n=.05*(300/Math.max(10,o))**1.5;te=Math.max(1e-18,t*ge*n)}let re=1/Math.max(1e-20,te),I=Array.isArray(r?.orbitals)?r.orbitals.filter(e=>Number(e.occupancy??1)>0):[],ie=I.length?Math.max(...I.map(e=>Number(e.energyHa??e.energy??-.35))):-.35,ae=Math.max(1.8,Math.min(6.5,-ie*we*.52+.65)),oe=i.isMetal?1/0:1+((E||10.5)/Math.max(.5,i.bandGapEv*1.4))**2,se=.12,ce=y+b,le=i.dosAtFermiStatesPerEvAtom||.5,ue=_>0&&_<10?.31*le*(450/F)**.35:0,L=ce>=2?.18*(ce-.85)*(350/Math.max(80,F))**.5*(1+.28*le):0,R=i.isMetal?Math.max(ee,Math.min(1.65,.08+ue+L)):0,de=0;if(i.isMetal&&j!==`ferromagnetic`&&j!==`antiferromagnetic`&&R>se*1.45){let e=-(1.04*(1+R))/Math.max(.05,R-se*(1+.62*R));de=Math.max(0,F/1.45*Math.exp(e))}let fe=[`s`,`p`,`d`,`f`,`g`],pe=[];if(i.isMetal&&Array.isArray(r?.orbitals)&&r.orbitals.length>0){let t=Math.max(1e-9,T)*e**3,n=Math.cbrt(3*Math.PI*Math.PI*t),a=Math.sqrt(4*n/Math.PI),o=.5*we*a*a,s=r.orbitals.filter(e=>Number(e.occupancy??e.occ??0)>0),c=r.orbitals.filter(e=>Number(e.occupancy??e.occ??0)<2*(2*e.l+1));for(let e of s){if(e.l<2)continue;let t=2*(2*e.l+1),n=Number(e.occupancy??e.occ??0),r=Number.isFinite(e.energyJPlusHa),a=r?e.energyJPlusHa:Number(e.energyHa??e.energy??-.5);for(let s of c){if(s.n===e.n&&s.l===e.l||Math.abs(s.l-e.l)!==1)continue;let c=Number(s.energyHa??s.energy??-.05);if(!(c>a))continue;let l=Math.max(0,Math.min(1.6,.16*Number(i.fermiEnergyEv||0))),u=(c-a)*we+l;if(!(u>.2&&u<9.5))continue;let d=2*(2*s.l+1),f=Number(s.occupancy??s.occ??0),p=Math.min(1,Math.max(0,n/t)),m=Math.min(1,Math.max(0,1-f/d)),h=s.l>e.l?(e.l+1)/(2*e.l+1):e.l/(2*e.l+1),g=p*m*h*(e.l===2?1.85:.75);if(!(g>0))continue;let _=Math.max(.22,.1*u+.032*o*Math.sqrt(g)),v=r?`(${2*e.l+1}/2)`:``,y=`${e.n}${fe[e.l]||e.l}${v}→${s.n}${fe[s.l]||s.l}`;pe.push(Object.freeze({energyEv:u,dampingEv:_,strengthWeight:g,transitionLabel:y}))}}pe.sort((e,t)=>e.energyEv-t.energyEv||t.strengthWeight-e.strengthWeight),pe.splice(4)}let me=i.isMetal?Math.max(.08,Math.min(2.6,xe*(T*ge*ge)/Math.max(1e-20,_e*te)/Ce+(_>0&&_<10?.55:0))):.25,z=null;t&&typeof t.createBuffer==`function`&&(z=(await ne(t,[i.isMetal?{mode:0,atomicNumberZ:n,conductionElectronDensityPerM3:Math.max(1e27,T),plasmaEnergyEv:Math.max(1,E),dampingEv:me,interbandOscillators:pe,pathLengthM:.1}:{mode:2,atomicNumberZ:n,electronicGapEv:Math.max(.2,i.bandGapEv),pathLengthM:.1}]))?.results?.[0]??null);let Te=z?.spectralSamples?.find(e=>Math.abs(e.wavelengthNm-550)<=6)||z?.spectralSamples?.[Math.floor((z?.spectralSamples?.length||1)/2)]||null,Ee=Array.isArray(z?.baseColorSrgb)&&z.baseColorSrgb.length===3?z.baseColorSrgb.map(e=>Math.max(0,Math.min(1,Number(e)||0))):i.isMetal?[.7,.72,.76]:[.85,.9,.96],De=Number.isFinite(Te?.nRe)&&Te.nRe>0?Te.nRe:i.isMetal?1.5:Math.sqrt(Math.max(1,oe)),Oe=Number.isFinite(Te?.reflectance)?Te.reflectance:Number.isFinite(z?.reflectance)?z.reflectance:i.isMetal?.72:.04;return Object.freeze({schema:he,backend:z?`webgpu`:`analytical-em`,Z:n,temperatureK:o,isMetal:i.isMetal,bandGapEv:i.bandGapEv,plasmaEnergyEv:E,drudeDampingEv:me,interbandOscillators:Object.freeze(pe),workFunctionEv:ae,electronPhononLambda:ee,electricalConductivitySPerM:te,electricalResistivityOhmM:re,staticDielectricConstant:oe,magneticPhase:j,stonerProduct:D,magneticMomentMuB:M,curieOrNeelTempK:N,magneticSusceptibilitySi:P,superconductingTcK:de,opticalSrgb:Ee,refractiveIndex550Nm:De,reflectance550Nm:Oe,spectralWavelengthsNm:z?.spectralSamples?.map(e=>e.wavelengthNm)??null,spectralReflectance:z?.spectralSamples?.map(e=>e.reflectance??0)??null,spectralNRe:z?.spectralSamples?.map(e=>e.nRe??1)??null,spectralAbsorptionPerM:z?.spectralSamples?.map(e=>e.absorptionPerM??0)??null,accuracyTier:g.TIER_2_REPRESENTATIVE_EFFECTIVE,provenance:Object.freeze({status:z?z.resolverStatus||`webgpu-derived`:`reduced-estimate`,oscillatorSource:z?.oscillatorSource??`none`,scientificValidation:!1,model:`stoner-bloch-gruneisen-kubo-drude-mcmillan`})})}var Ee=`ulg.gpumath.molecular-dynamics-webgpu.v1`,De=Object.freeze({LENNARD_JONES:0,MORSE_EAM:1,STILLINGER_WEBER:2}),Oe=Object.freeze({EQUILIBRIUM:0,STRAIN:1,ACOUSTIC:2,SHEAR_NEMD:3,THERMAL_NEMD:4,SURFACE_SLAB:5}),B=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128}),ke=10.1805057,Ae=8617333262e-14,je=128,Me=`
struct MdParams {
  // x=atomCount, y=potentialModel (0=LJ, 1=Morse+EAM, 2=SW), z=rdfBins(64), w=thermostatActive | (expMode << 8)
  counts: vec4<u32>,
  // x=boxLx, y=boxLy, z=boxLz, w=dt_internal
  box_dt: vec4<f32>,
  // x=epsilon_ev, y=sigma_or_r0_A, z=alpha_or_lambda, w=rcut_A
  pot0: vec4<f32>,
  // x=eam_A_ev, y=eam_beta, z=sw_gamma_or_p, w=target_temp_k
  pot1: vec4<f32>,
  // x=thermostat_alpha (dt / tau), y=scale_factor, z=collect_telemetry, w=shear_wall_vel
  ctrl: vec4<f32>,
  // x=hot_vel_scale, y=cold_vel_scale, z=strain_sx, w=strain_sy
  nemd: vec4<f32>,
  // x=strain_sz, y=shear_xy, z=pulse_amp, w=pulse_pol (0=longitudinal X, 1=transverse Y)
  nemd2: vec4<f32>,
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
//   [0]=E_kin*1e4, [1]=E_pot*1e4, [2]=virial*1e4, [3]=msd*1e6,
//   [4]=px*1e4, [5]=py*1e4, [6]=pz*1e4, [7]=sxy*1e4, [8]=sxz*1e4, [9]=syz*1e4,
//   [10]=vir_x*1e4, [11]=vir_y*1e4, [12]=vir_z*1e4, [13]=kin_x*1e4, [14]=kin_y*1e4, [15]=kin_z*1e4,
//   [16..79]=RDF histogram bins, [80]=vacf_num*1e5, [81]=vacf_den*1e5, [82]=heat_add*1e5, [83]=heat_rem*1e5,
//   [84..115]=8 spatial slabs * 4 (count, ke*1e4, vx*1e4, vy*1e4)
@group(0) @binding(6) var<storage, read_write> telemetry: array<atomic<i32>>;
// vel_init: reference velocities for live GPU Velocity Autocorrelation (VACF) & Phonon VDOS g(w)!
@group(0) @binding(7) var<storage, read> vel_init: array<vec4<f32>>;

fn min_image(d: vec3<f32>, box_l: vec3<f32>) -> vec3<f32> {
  return d - box_l * round(d / box_l);
}

fn wrap_box(p: vec3<f32>, box_l: vec3<f32>) -> vec3<f32> {
  return p - box_l * floor(p / box_l);
}

@compute @workgroup_size(64)
fn reset_telemetry(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x < 128u) {
    atomicStore(&telemetry[id.x], 0);
  }
}

@compute @workgroup_size(64)
fn apply_affine_strain(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.x) { return; }
  let box_l = params.box_dt.xyz;
  let s_vec = vec3<f32>(params.nemd.z, params.nemd.w, params.nemd2.x);
  var p3 = pos[i].xyz * s_vec;
  p3.x = p3.x + params.nemd2.y * (p3.y - 0.5 * box_l.y);
  pos[i] = vec4<f32>(wrap_box(p3, box_l), pos[i].w);
  var u3 = unwrapped[i].xyz * s_vec;
  u3.x = u3.x + params.nemd2.y * (u3.y - 0.5 * box_l.y);
  unwrapped[i] = vec4<f32>(u3, unwrapped[i].w);
}

@compute @workgroup_size(64)
fn inject_acoustic_pulse(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.x) { return; }
  let box_l = params.box_dt.xyz;
  let fx = pos[i].x / max(1.0e-5, box_l.x);
  // Zero-mean localized dipole/Gaussian planar acoustic wavepacket near x = 0.14 Lx
  let d = fx - 0.14;
  let env = exp(-(d * d) / (2.0 * 0.055 * 0.055));
  let env_back = exp(-((fx - 0.86) * (fx - 0.86)) / (2.0 * 0.055 * 0.055));
  let amp = params.nemd2.z * (env - 0.25 * env_back);
  var v4 = vel[i];
  if (params.nemd2.w < 0.5) {
    v4.x = v4.x + amp; // Longitudinal P-wave (v_L)
  } else {
    v4.y = v4.y + amp; // Transverse S-wave (v_T)
  }
  vel[i] = v4;
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
  var vir_v = vec3<f32>(0.0);
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
    vir_v = vir_v + 0.5 * (d * fij);
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
    let vir_i = vir_v.x + vir_v.y + vir_v.z;
    atomicAdd(&telemetry[1], i32(clamp(epot_i * 1.0e4, -2.0e9, 2.0e9)));
    atomicAdd(&telemetry[2], i32(clamp(vir_i * 1.0e4, -2.0e9, 2.0e9)));
    atomicAdd(&telemetry[7], i32(clamp(sxy * 1.0e4, -2.0e9, 2.0e9)));
    atomicAdd(&telemetry[8], i32(clamp(sxz * 1.0e4, -2.0e9, 2.0e9)));
    atomicAdd(&telemetry[9], i32(clamp(syz * 1.0e4, -2.0e9, 2.0e9)));
    atomicAdd(&telemetry[10], i32(clamp(vir_v.x * 1.0e4, -2.0e9, 2.0e9)));
    atomicAdd(&telemetry[11], i32(clamp(vir_v.y * 1.0e4, -2.0e9, 2.0e9)));
    atomicAdd(&telemetry[12], i32(clamp(vir_v.z * 1.0e4, -2.0e9, 2.0e9)));
  }
}

@compute @workgroup_size(64)
fn vv_second_kick_reduce(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.counts.x) { return; }
  let dt = params.box_dt.w;
  let box_l = params.box_dt.xyz;
  let v4 = vel[i];
  let m = max(v4.w, 1.0e-6);
  var v_new = v4.xyz + (0.5 * dt / m) * force[i].xyz;
  let therm_on = (params.counts.w & 1u) != 0u;
  let exp_mode = (params.counts.w >> 8u) & 15u;
  let p3 = pos[i].xyz;
  var heat_delta_add = 0.0;
  var heat_delta_rem = 0.0;

  if (exp_mode == 3u) {
    // Couette Shear NEMD: opposite boundary slab velocity drive along X (bottom y < 0.18 -> -v_wall, top y > 0.82 -> +v_wall)
    let fy = p3.y / max(1.0e-5, box_l.y);
    let v_wall = params.ctrl.w;
    if (fy < 0.18) {
      v_new.x = mix(v_new.x, -v_wall, 0.25);
    } else if (fy > 0.82) {
      v_new.x = mix(v_new.x, v_wall, 0.25);
    }
    if (therm_on) {
      // Thermostat transverse (y, z) thermal velocity only so Couette x-shear profile stays physical!
      v_new.y = v_new.y * params.ctrl.y;
      v_new.z = v_new.z * params.ctrl.y;
    }
  } else if (exp_mode == 4u) {
    // Thermal Gradient NEMD: hot slab x in [0, 0.20] and cold slab x in [0.50, 0.70]
    let fx = p3.x / max(1.0e-5, box_l.x);
    let ke_before = 0.5 * m * dot(v_new, v_new);
    if (fx < 0.20) {
      v_new = v_new * params.nemd.x;
      let ke_after = 0.5 * m * dot(v_new, v_new);
      heat_delta_add = ke_after - ke_before;
    } else if (fx >= 0.50 && fx < 0.70) {
      v_new = v_new * params.nemd.y;
      let ke_after = 0.5 * m * dot(v_new, v_new);
      heat_delta_rem = ke_before - ke_after;
    }
  } else if (therm_on) {
    v_new = v_new * params.ctrl.y;
  }

  vel[i] = vec4<f32>(v_new, m);

  if (params.ctrl.z > 0.5) {
    let ekin = 0.5 * m * dot(v_new, v_new);
    let kin_v = m * (v_new * v_new); // 2 * K_alpha
    let disp = unwrapped[i].xyz - pos_init[i].xyz;
    let msd_i = dot(disp, disp);
    let v0 = vel_init[i].xyz;
    let vacf_i = dot(v_new, v0);
    let vacf_d = dot(v0, v0);

    atomicAdd(&telemetry[0], i32(clamp(ekin * 1.0e4, -2.0e9, 2.0e9)));
    atomicAdd(&telemetry[3], i32(clamp(msd_i * 1.0e6, 0.0, 1.5e7)));
    atomicAdd(&telemetry[4], i32(clamp(m * v_new.x * 1.0e4, -2.0e9, 2.0e9)));
    atomicAdd(&telemetry[5], i32(clamp(m * v_new.y * 1.0e4, -2.0e9, 2.0e9)));
    atomicAdd(&telemetry[6], i32(clamp(m * v_new.z * 1.0e4, -2.0e9, 2.0e9)));
    atomicAdd(&telemetry[13], i32(clamp(kin_v.x * 1.0e4, -2.0e9, 2.0e9)));
    atomicAdd(&telemetry[14], i32(clamp(kin_v.y * 1.0e4, -2.0e9, 2.0e9)));
    atomicAdd(&telemetry[15], i32(clamp(kin_v.z * 1.0e4, -2.0e9, 2.0e9)));
    atomicAdd(&telemetry[80], i32(clamp(vacf_i * 1.0e5, -2.0e8, 2.0e8)));
    atomicAdd(&telemetry[81], i32(clamp(vacf_d * 1.0e5, 0.0, 2.0e8)));
    atomicAdd(&telemetry[82], i32(clamp(heat_delta_add * 1.0e5, -2.0e8, 2.0e8)));
    atomicAdd(&telemetry[83], i32(clamp(heat_delta_rem * 1.0e5, -2.0e8, 2.0e8)));

    // 8-slab spatial diagnostics (along Y for Shear NEMD, along X for Thermal NEMD & Acoustic waves!)
    let coord_f = select(p3.x / max(1.0e-5, box_l.x), p3.y / max(1.0e-5, box_l.y), exp_mode == 3u);
    let slab = u32(clamp(floor(coord_f * 8.0), 0.0, 7.0));
    let sbase = 84u + slab * 4u;
    atomicAdd(&telemetry[sbase + 0u], 1i);
    atomicAdd(&telemetry[sbase + 1u], i32(clamp(ekin * 1.0e4, -2.0e8, 2.0e8)));
    atomicAdd(&telemetry[sbase + 2u], i32(clamp(v_new.x * 1.0e4, -2.0e8, 2.0e8)));
    atomicAdd(&telemetry[sbase + 3u], i32(clamp(v_new.y * 1.0e4, -2.0e8, 2.0e8)));
  }
}
`;function Ne(e,{positions:t,velocities:n,boxLengthsA:r,potentialModel:i=De.LENNARD_JONES,epsilonEv:a=.0103,sigmaOrR0A:o=3.405,alphaOrLambda:s=1.5,rcutA:c=8.5,eamAEv:l=0,eamBeta:u=1.2,swGamma:d=1.2,dtFs:f=2,targetTemperatureK:p=0,thermostatCouplingFs:m=0}={}){if(!e||typeof e.createBuffer!=`function`)throw TypeError(`createMolecularDynamicsSessionWebGpu requires a live WebGPU GPUDevice`);let h=t instanceof Float32Array?t:Float32Array.from(t),g=n instanceof Float32Array?n:Float32Array.from(n),_=Math.floor(h.length/4);if(!(_>=2&&g.length===_*4))throw RangeError(`Invalid MD buffers: atomCount=${_}, velFloats=${g.length}`);let v=Array.isArray(r)?[Number(r[0]),Number(r[1]),Number(r[2])]:[Number(r),Number(r),Number(r)],y=[b(0,`uniform`),b(1,`storage`),b(2,`storage`),b(3,`storage`),b(4,`storage`),b(5,`read-only-storage`),b(6,`storage`),b(7,`read-only-storage`)],S=t=>x(e,{cacheKey:`ulg-gpumath-md-${t}.v2`,label:`ulg-gpumath-md-${t}`,code:Me,entryPoint:t,bindings:y}),C=S(`reset_telemetry`),w=S(`apply_affine_strain`),T=S(`inject_acoustic_pulse`),E=S(`vv_half_kick_drift`),D=S(`compute_eam_density`),O=S(`compute_forces`),k=S(`vv_second_kick_reduce`),A=_*16,j=(t,n,r)=>{let i=e.createBuffer({label:t,size:Math.max(16,n?n.byteLength:A),usage:r});return n&&e.queue.writeBuffer(i,0,n),i},M=e.createBuffer({label:`ulg-md-params`,size:112,usage:B.UNIFORM|B.COPY_DST}),N=j(`ulg-md-pos`,h,B.STORAGE|B.COPY_DST|B.COPY_SRC),P=j(`ulg-md-vel`,g,B.STORAGE|B.COPY_DST|B.COPY_SRC),F=j(`ulg-md-force`,new Float32Array(_*4),B.STORAGE|B.COPY_DST|B.COPY_SRC),ee=j(`ulg-md-unwrapped`,h,B.STORAGE|B.COPY_DST|B.COPY_SRC),te=j(`ulg-md-pos-init`,h,B.STORAGE|B.COPY_DST),ne=j(`ulg-md-vel-init`,g,B.STORAGE|B.COPY_DST),re=e.createBuffer({label:`ulg-md-telemetry`,size:je*4,usage:B.STORAGE|B.COPY_SRC}),I=e.createBuffer({label:`ulg-md-telemetry-read`,size:je*4,usage:B.MAP_READ|B.COPY_DST}),ie=e.createBindGroup({layout:O.bindGroupLayout,entries:[M,N,P,F,ee,te,re,ne].map((e,t)=>({binding:t,resource:{buffer:e}}))}),ae=Number(f)/ke,oe=[...v],se=Math.max(1,Number(p)||300),ce=se*1.25,le=Math.max(1,se*.75),ue=0,L=!1,R=Oe.EQUILIBRIUM,de=0,fe=0,pe=0,me=0,z=0,he=null,ge=!1,_e=({collectTelemetry:t=!1,scaleVel:n=1,useThermostat:r=!1,hotScale:h=1,coldScale:g=1,strainSx:y=1,strainSy:b=1,strainSz:x=1,shearXY:S=0,pulseAmp:C=0,pulsePol:w=0}={})=>{let T=new ArrayBuffer(112),E=!!r|(R&15)<<8;new Uint32Array(T,0,4).set([_,i,64,E]),new Float32Array(T,16,4).set([v[0],v[1],v[2],ae]),new Float32Array(T,32,4).set([a,o,s,c]),new Float32Array(T,48,4).set([l,u,d,p]),new Float32Array(T,64,4).set([m>0?f/m:0,n,+!!t,de]),new Float32Array(T,80,4).set([h,g,y,b]),new Float32Array(T,96,4).set([x,S,C,w]),e.queue.writeBuffer(M,0,T)},ve=Math.ceil(_/64);function ye(e,{shearWallVel:t=0,thermalDeltaT:n=0}={}){R=Math.max(0,Math.min(5,Math.trunc(Number(e)||0))),de=Number(t)||0,fe=Number(n)||0}function be({strainX:t=0,strainY:n=0,strainZ:r=0,shearXY:i=0}={}){if(ge)return;let a=Math.max(.82,Math.min(1.22,1+Number(t||0))),o=Math.max(.82,Math.min(1.22,1+Number(n||0))),s=Math.max(.82,Math.min(1.22,1+Number(r||0))),c=Math.max(-.22,Math.min(.22,Number(i||0)));v[0]*=a,v[1]*=o,v[2]*=s,pe=(v[0]-oe[0])/Math.max(1e-6,oe[0]),me=(v[1]-oe[1])/Math.max(1e-6,oe[1]),z+=c,_e({strainSx:a,strainSy:o,strainSz:s,shearXY:c});let l=e.createCommandEncoder({label:`ulg-md-apply-strain`}),u=l.beginComputePass();u.setBindGroup(0,ie),u.setPipeline(w.pipeline),u.dispatchWorkgroups(ve),u.end(),e.queue.submit([l.finish()]),L=!1}function xe({polarization:t=`longitudinal`,amplitude:n=.32}={}){if(ge)return;let r=+(t===`transverse`);_e({pulseAmp:Number(n)||.32,pulsePol:r});let i=e.createCommandEncoder({label:`ulg-md-inject-acoustic`}),a=i.beginComputePass();a.setBindGroup(0,ie),a.setPipeline(T.pipeline),a.dispatchWorkgroups(ve),a.end(),e.queue.submit([i.finish()])}function Se(){if(ge)return;let t=e.createCommandEncoder({label:`ulg-md-reset-vacf`});t.copyBufferToBuffer(P,0,ne,0,A),e.queue.submit([t.finish()])}async function Ce(t=10,{readTelemetry:n=!0,temperatureK:r=p,nptBarostatGPa:a=null,nonBlocking:o=!1}={}){if(ge)return null;if(n&&he){if(o)return null;try{await he}catch{}if(ge)return null}let s=Math.max(1,Math.trunc(Number(t))),l=Number(r)>0&&Number(m)>0,u=1;if(l&&se>0){let e=Math.min(.5,f/m);u=Math.sqrt(Math.max(.25,Math.min(4,1+e*(Number(r)/se-1))))}let d=Math.max(5,Number(r)||300),h=Math.max(10,Math.min(d*.65,fe||d*.35)),g=d+h,y=Math.max(5,d-h),b=Math.max(1,Math.min(s,14)),x=Math.max(.5,Math.min(2.8,g/Math.max(10,ce))),S=Math.max(.3,Math.min(1.6,y/Math.max(10,le))),w=Math.max(.96,Math.min(1.018,x**(.5/b))),T=Math.max(.955,Math.min(1.015,S**(.5/b))),A=e.createCommandEncoder({label:`ulg-md-batch-${s}`});if(!L){_e({collectTelemetry:!1,scaleVel:1,useThermostat:!1,hotScale:1,coldScale:1});let e=A.beginComputePass({label:`ulg-md-init-forces`});e.setBindGroup(0,ie),i===De.MORSE_EAM&&(e.setPipeline(D.pipeline),e.dispatchWorkgroups(ve)),e.setPipeline(O.pipeline),e.dispatchWorkgroups(ve),e.end(),L=!0}if(s>1){_e({collectTelemetry:!1,scaleVel:u,useThermostat:l,hotScale:w,coldScale:T});let e=A.beginComputePass({label:`ulg-md-steps-loop`});e.setBindGroup(0,ie);for(let t=0;t<s-1;t+=1)e.setPipeline(E.pipeline),e.dispatchWorkgroups(ve),i===De.MORSE_EAM&&(e.setPipeline(D.pipeline),e.dispatchWorkgroups(ve)),e.setPipeline(O.pipeline),e.dispatchWorkgroups(ve),e.setPipeline(k.pipeline),e.dispatchWorkgroups(ve);e.end()}e.queue.submit([A.finish()]);let j=e.createCommandEncoder({label:`ulg-md-final-step`});_e({collectTelemetry:n,scaleVel:u,useThermostat:l,hotScale:w,coldScale:T});let M=j.beginComputePass({label:`ulg-md-final-pass`});if(M.setBindGroup(0,ie),n&&(M.setPipeline(C.pipeline),M.dispatchWorkgroups(2)),M.setPipeline(E.pipeline),M.dispatchWorkgroups(ve),i===De.MORSE_EAM&&(M.setPipeline(D.pipeline),M.dispatchWorkgroups(ve)),M.setPipeline(O.pipeline),M.dispatchWorkgroups(ve),M.setPipeline(k.pipeline),M.dispatchWorkgroups(ve),M.end(),n&&j.copyBufferToBuffer(re,0,I,0,je*4),e.queue.submit([j.finish()]),ue+=s,!n)return null;let N=(async()=>{if(await I.mapAsync(B.MAP_READ),ge){try{I.unmap()}catch{}return null}let e=new Int32Array(I.getMappedRange().slice(0,je*4));I.unmap();let t=e[0]/1e4,n=e[1]/1e4,r=t+n,i=e[2]/1e4,o=e[3]/(1e6*_),s=[e[4]/1e4,e[5]/1e4,e[6]/1e4],l=v[0]*v[1]*v[2],u=Math.max(1,3*_-3),d=2*t/(u*Ae);se=Number.isFinite(d)&&d>0?d:se;let p=160.2176634,m=(2*t+i)/(3*l)*p,h=[e[7]/1e4/l*p,e[8]/1e4/l*p,e[9]/1e4/l*p],g=[(e[13]/1e4+e[10]/1e4)/l*p,(e[14]/1e4+e[11]/1e4)/l*p,(e[15]/1e4+e[12]/1e4)/l*p],y=Math.max(0,.5*v[2]*(.5*(g[0]+g[1])-g[2])*.1),b=e[81]/1e5,x=b>1e-6?Math.max(-1.2,Math.min(1.2,e[80]/1e5/b)):0,S=e[82]/1e5,C=e[83]/1e5,w=new Float32Array(8),T=new Float32Array(8),E=new Float32Array(8),D=new Float32Array(8);for(let t=0;t<8;t+=1){let n=84+t*4,r=Math.max(0,e[n]);w[t]=r,r>0&&(T[t]=2*(e[n+1]/1e4)/(3*r*Ae),E[t]=e[n+2]/1e4/r,D[t]=e[n+3]/1e4/r)}if(R===Oe.THERMAL_NEMD){let e=(T[0]+T[1])*.5,t=(T[4]+T[5])*.5;e>1&&(ce=e),t>1&&(le=t)}let O=null;if(R===Oe.SHEAR_NEMD&&de>1e-4){let e=Math.max(10,Math.abs(E[6]-E[1])*9822.7||2*de*9822.7)/Math.max(1e-10,v[1]*.65*1e-10),t=Math.abs(h[0])*1e9;e>1&&t>0&&(O=t/e)}let k=null;if(R===Oe.THERMAL_NEMD){let e=Math.max(1,Math.abs(T[0]-T[4])),t=Math.max(1e-10,.5*v[0]*1e-10),n=Math.max(1e-20,v[1]*v[2]*1e-20),r=.5*(Math.abs(S)+Math.abs(C))*1602176634e-28/(2*n*Math.max(1e-16,f*1e-15));r>0&&(k=r/(e/t))}if(a!=null&&Number.isFinite(Number(a))){let e=Number(a);if(R===Oe.STRAIN){let t=Math.max(.992,Math.min(1.008,1+.0018*(g[1]-e))),n=Math.max(.992,Math.min(1.008,1+.0018*(g[2]-e)));(Math.abs(t-1)>1e-5||Math.abs(n-1)>1e-5)&&be({strainY:t-1,strainZ:n-1})}else{let t=Math.max(.992,Math.min(1.008,1+.0015*(m-e)));Math.abs(t-1)>1e-5&&be({strainX:t-1,strainY:t-1,strainZ:t-1})}}let A=new Float32Array(64),j=c/64,M=_/l;for(let t=0;t<64;t+=1){let n=(t+.5)*j,r=4*Math.PI*n*n*j,i=Math.max(1e-9,_*M*r);A[t]=e[16+t]/i}let N=l/Math.max(1e-6,oe[0]*oe[1]*oe[2]),P=Math.abs(pe)>.005?Math.max(-.2,Math.min(.49,-me/pe)):null;return Object.freeze({schema:Ee,backend:`webgpu`,experimentMode:R,totalSteps:ue,timeFs:ue*f,atomCount:_,boxLengthsA:Object.freeze([...v]),volumeRatio:N,strainX:pe,strainY:me,shearXY:z,poissonMeasured:P,kineticEnergyEv:t,potentialEnergyEv:n,totalEnergyEv:r,temperatureK:d,pressureGPa:m,diagPressureGPa:Object.freeze(g),msdA2:o,vacf:x,momentum:s,stressOffDiagGPa:h,surfaceTensionNPerM:y,nemdViscosityPaS:O,nemdThermalCondWPerMK:k,slabTempK:T,slabVx:E,slabVy:D,rdf:A})})();he=N;try{return await N}finally{he===N&&(he=null)}}async function we(){let t=_*16,n=e.createBuffer({size:t,usage:B.MAP_READ|B.COPY_DST}),r=e.createBuffer({size:t,usage:B.MAP_READ|B.COPY_DST}),i=e.createCommandEncoder({label:`ulg-md-read-pos-vel`});i.copyBufferToBuffer(N,0,n,0,t),i.copyBufferToBuffer(P,0,r,0,t),e.queue.submit([i.finish()]);try{await Promise.all([n.mapAsync(B.MAP_READ),r.mapAsync(B.MAP_READ)]);let e=new Float32Array(n.getMappedRange().slice(0,t)),i=new Float32Array(r.getMappedRange().slice(0,t));return n.unmap(),r.unmap(),{positions:e,velocities:i}}finally{n.destroy(),r.destroy()}}return Object.freeze({schema:Ee,atomCount:_,get boxLengthsA(){return[...v]},positionsBuffer:N,velocitiesBuffer:P,forcesBuffer:F,setExperimentMode:ye,applyStrain:be,injectAcousticPulse:xe,resetVacfOrigin:Se,stepBatch:Ce,readPositionsAndVelocities:we,destroy(){ge=!0;for(let e of[M,N,P,F,ee,te,ne,re,I])try{e.destroy()}catch{}}})}function Pe(e,t=8,n=32){let r=Array.isArray(e)?e.length:0,i=new Float32Array(n),a=new Float32Array(n);if(r<4)return{freqsThz:i,vdos:a,peakThz:0,effectiveDebyeK:0};let o=Math.min(24,500/Math.max(1,t)),s=1e-6,c=0;for(let l=0;l<n;l+=1){let u=(l+.5)/n*o;i[l]=u;let d=2*Math.PI*u*.001,f=0;for(let n=0;n<r;n+=1){let i=.5*(1+Math.cos(Math.PI*n/Math.max(1,r-1)));f+=e[n]*i*Math.cos(d*n*t)}let p=Math.max(0,f);a[l]=p,p>s&&(s=p,c=l)}for(let e=0;e<n;e+=1)a[e]/=s;let l=i[c];return{freqsThz:i,vdos:a,peakThz:l,effectiveDebyeK:l*47.99243*1.25}}function Fe(e){return!e||typeof e.registerModule!=`function`?null:{mechMod:e.registerModule({method:{model:`md-mechanical-probe`,version:`1`},kernel:{sourceModule:`src/runtime/gpuMath/molecularDynamicsWebGpu.js`,entryPoint:`apply_affine_strain`,workgroupSize:64,wgsl:Me},parameterSchema:{strainX:{type:`number`,min:-.18,max:.18},shearXY:{type:`number`,min:-.18,max:.18},steps:{type:`number`,min:1,max:512}},stateLayout:{tensorId:`md_crystal_stress_strain`,dtype:`f32`,components:4},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`md-mechanical-probe@1 requires a WebGPU device`);let r=e?.parameters||{},i=Ne(n,{...Ie(r.crystal||{crystalStructure:`fcc`,cellsPerSide:2,latticeConstantA:4.05,massU:27,temperatureK:100}),...r.potential||{}});try{i.setExperimentMode(Oe.STRAIN);let e=await i.stepBatch(6,{readTelemetry:!0,temperatureK:r.temperatureK??100});return i.applyStrain({strainX:r.strainX??-.02,shearXY:r.shearXY??0}),{status:`ok`,baseline:e,strained:await i.stepBatch(r.steps??12,{readTelemetry:!0,temperatureK:r.temperatureK??100})}}finally{i.destroy()}}}),nemdMod:e.registerModule({method:{model:`md-nemd-transport`,version:`1`},kernel:{sourceModule:`src/runtime/gpuMath/molecularDynamicsWebGpu.js`,entryPoint:`vv_second_kick_reduce`,workgroupSize:64,wgsl:Me},parameterSchema:{mode:{type:`number`,min:0,max:5},steps:{type:`number`,min:1,max:512}},stateLayout:{tensorId:`md_nemd_slab_transport`,dtype:`f32`,components:4},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`md-nemd-transport@1 requires a WebGPU device`);let r=e?.parameters||{},i=Ne(n,{...Ie(r.crystal||{crystalStructure:`fcc`,cellsPerSide:2,latticeConstantA:4.05,massU:27,temperatureK:300}),...r.potential||{}});try{return i.setExperimentMode(r.mode??Oe.THERMAL_NEMD,{shearWallVel:r.shearWallVel??.12,thermalDeltaT:r.thermalDeltaT??120}),{status:`ok`,telemetry:await i.stepBatch(r.steps??20,{readTelemetry:!0,temperatureK:r.temperatureK??300})}}finally{i.destroy()}}})}}function Ie({crystalStructure:e=`fcc`,cellsPerSide:t=3,cellsVec:n=null,vacuumZFactor:r=1,latticeConstantA:i=4.05,massU:a=26.982,temperatureK:o=300,seed:s=1337}={}){let c=Math.max(2,Math.trunc(t)),l=Array.isArray(n)?Math.max(2,Math.trunc(n[0])):c,u=Array.isArray(n)?Math.max(2,Math.trunc(n[1])):c,d=Array.isArray(n)?Math.max(2,Math.trunc(n[2])):c,f=Math.max(1,Number(r)||1),p=Number(i),m=String(e||`fcc`).toLowerCase(),h,g=[1,1,1];if(m===`bcc`||m.startsWith(`cscl`))h=[[0,0,0],[.5,.5,.5]];else if(m===`diamond`||m.startsWith(`zincblende`))h=[[0,0,0],[.5,.5,0],[.5,0,.5],[0,.5,.5],[.25,.25,.25],[.75,.75,.25],[.75,.25,.75],[.25,.75,.75]];else if(m===`hcp`){let e=p/Math.SQRT2;g=[e/p,Math.sqrt(3)*e/p,1.632993*e/p],h=[[0,0,0],[.5,.5,0],[0,1/3,.5],[.5,5/6,.5]]}else h=[[0,0,0],[.5,.5,0],[.5,0,.5],[0,.5,.5]];let _=h.length*l*u*d,v=new Float32Array(_*4),y=new Float32Array(_*4),b=s>>>0,x=()=>(b=Math.imul(1664525,b)+1013904223>>>0,(b+.5)/4294967296),S=()=>Math.sqrt(-2*Math.log(x()))*Math.cos(2*Math.PI*x()),C=Math.sqrt(Math.max(1e-9,Ae*o/Math.max(a,1e-6))),w=p*g[0],T=p*g[1],E=p*g[2],D=f>1.01?.5*(f-1)*d*E:0,O=0,k=0,A=0,j=0;for(let e=0;e<l;e+=1)for(let t=0;t<u;t+=1)for(let n=0;n<d;n+=1)for(let[r,i,o]of h){v[O*4+0]=(e+r)*w,v[O*4+1]=(t+i)*T,v[O*4+2]=(n+o)*E+D,v[O*4+3]=0;let s=S()*C,c=S()*C,l=S()*C;y[O*4+0]=s,y[O*4+1]=c,y[O*4+2]=l,y[O*4+3]=a,k+=s,A+=c,j+=l,O+=1}k/=_,A/=_,j/=_;let M=0;for(let e=0;e<_;e+=1){y[e*4+0]-=k,y[e*4+1]-=A,y[e*4+2]-=j;let t=y[e*4+0],n=y[e*4+1],r=y[e*4+2];M+=.5*a*(t*t+n*n+r*r)}let N=.5*(3*_-3)*Ae*o,P=M>0?Math.sqrt(N/M):0;for(let e=0;e<_;e+=1)y[e*4+0]*=P,y[e*4+1]*=P,y[e*4+2]*=P;return{crystalStructure:m,atomCount:_,positions:v,velocities:y,boxLengthsA:[l*w,u*T,d*E*f]}}var Le=`ulg.thermodynamic.element-md-webgpu.v1`,Re=1380649e-29,ze=602214076e15,Be=1602176634e-28,Ve=8.314462618,He=2.44300455e-8;function Ue(e,t,n){let r=Math.max(.5,Number(e)),i=Math.max(1,Number(t)),a=i/r,o=0,s=a/32;for(let e=0;e<32;e+=1){let t=(e+.5)*s;if(t>60)continue;let n=Math.exp(t);o+=t*t*t*t*n/((n-1)*(n-1))*s}return 9*Re*(r/i)**3*o/Math.max(1e-30,n)}function We({Z:e,bulkResult:t}){let n=t.crystalStructure,r=Math.max(2,t.latticeConstantA),i=Math.max(.005,t.cohesiveEnergyEv),a=t.coordinationNumber||12,o=n===`bcc`?r*Math.sqrt(3)/2:n===`diamond`?r*Math.sqrt(3)/4:r/Math.SQRT2;if(n===`vdw-fcc`){let e=o/2**(1/6),t=Math.max(5e-4,i/8.61);return Object.freeze({potentialModel:De.LENNARD_JONES,modelName:`shifted-force-lj-london`,epsilonEv:t,sigmaOrR0A:e,alphaOrLambda:0,rcutA:Math.min(r*1.45,e*2.5),eamAEv:0,eamBeta:0,swGamma:0,rNearestNeighborA:o})}if(n===`diamond`){let e=o/1.1225,t=Math.max(.2,i/2);return Object.freeze({potentialModel:De.STILLINGER_WEBER,modelName:`stillinger-weber-sp3`,epsilonEv:t,sigmaOrR0A:e,alphaOrLambda:21,rcutA:Math.min(r*1.35,e*1.8),eamAEv:0,eamBeta:0,swGamma:1.2,rNearestNeighborA:o})}let s=(t.bulkModulusPa||5e10)/160217663400,c=r**3/(n===`bcc`?2:4),l=.55*i/(.5*a),u=.45*i/Math.sqrt(a),d=Math.max(.9,Math.min(2.6,Math.sqrt(Math.max(.1,9*s*c/Math.max(1e-4,a*l*o*o))))),f=o*(1+.24/d);return Object.freeze({potentialModel:De.MORSE_EAM,modelName:`morse-finnis-sinclair-eam`,epsilonEv:l,sigmaOrR0A:f,alphaOrLambda:d,rcutA:Math.min(r*1.45,o*1.85),eamAEv:u,eamBeta:d*1.05,swGamma:0,rNearestNeighborA:o})}async function Ge(e,{Z:t,atomicMassU:n=null,bulkResult:r,emResult:i,temperatureK:a=300,runLiveMd:o=!0,mdSteps:c=20,mdCellsPerSide:u=3}={}){let d=Number(n),f=Number.isFinite(d)&&d>0?d:s[t-1]||l(t)/16605390666e-37,p=f*16605390666e-37,m=f*.001,h=We({Z:t,bulkResult:r}),_=Math.max(15,r.debyeTemperatureK),v=r.cohesiveEnergyEv*Be,y=h.rNearestNeighborA*1e-10,b=p*(Re*_/1054571817e-43)**2*(.095*y)**2/(9*Re),x=r.crystalStructure===`vdw-fcc`?.68*h.epsilonEv*Be/Re:.029*v/Re,S=Math.min(.35*x,.085*_),C=r.crystalStructure===`vdw-fcc`?Math.max(1.5,x-S):Math.max(1.5,.55*x+.45*Math.min(x*1.8,b)-.15*S),w=Math.max(1,Math.min(4200,C)),T=Math.max(1500,v*ze*(r.crystalStructure===`vdw-fcc`?.92:.88)),E=Math.max(w*1.15+2,T/88),D=Ve*1.15*w/m,O=T/m,k=Ue(a,_,p)+(i?.isMetal?Math.PI*Math.PI/3*Re*Re*((r.dosAtFermiStatesPerEvAtom||.5)/Be)/p:0)*a,A=r.crystalStructure===`diamond`?.85:1.75,j=A*k*r.densityKgPerM3/Math.max(1e6,r.bulkModulusPa),M=k+a*r.bulkModulusPa*j*j/Math.max(1,r.densityKgPerM3),N=null;if(o&&e&&typeof e.createBuffer==`function`){let t=Math.max(10,Math.min(a,.65*w)),n=Ne(e,{...Ie({crystalStructure:r.crystalStructure,cellsPerSide:u,latticeConstantA:Math.max(2.2,r.latticeConstantA),massU:f,temperatureK:t}),potentialModel:h.potentialModel,epsilonEv:h.epsilonEv,sigmaOrR0A:h.sigmaOrR0A,alphaOrLambda:h.alphaOrLambda,rcutA:h.rcutA,eamAEv:h.eamAEv,eamBeta:h.eamBeta,swGamma:h.swGamma,dtFs:Math.min(2,Math.max(.4,.08*Math.sqrt(f))),targetTemperatureK:t,thermostatCouplingFs:40});try{N=await n.stepBatch(c,{readTelemetry:!0,temperatureK:t})}finally{n.destroy()}}let P=w;if(N&&Number.isFinite(N.temperatureK)&&N.temperatureK>0){let e=Math.max(0,Number(N.msdA2)||0),t=Math.max(1.2,h.rNearestNeighborA),n=Math.sqrt(e)/t;if(n>1e-4&&n<.45){let e=N.temperatureK*(.1/Math.max(.015,n))**2,t=Math.max(.85,Math.min(1.15,e/Math.max(1,w)));P=Math.max(1,Math.min(4200,w*(.85+.15*t)))}}let F=P,ee=Math.max(F*1.15+2,E),te=r.densityKgPerM3*(r.crystalStructure===`diamond`?1.05:.92),ne=Math.max(a,w*1.05),re=Math.max(1e-5,18e-8*Math.sqrt(f*w)/(m/Math.max(1,te)*1e6)**(2/3)*Math.exp(2.6*(w/ne-1))),I=Math.max(18e-11,h.rNearestNeighborA*92e-12),ie=5/(16*Math.sqrt(Math.PI))*Math.sqrt(p*Re*Math.max(a,E))/(I*I),ae=(p/Math.max(1,te))**(2/3),oe=Math.max(.001,.16*v/Math.max(1e-21,ae)),se=i?.isMetal?He*(i.electricalConductivitySPerM||0)*a:0,ce=Math.max(.02,31e-9*f*Math.cbrt(p/Math.max(1,r.densityKgPerM3))*1e10*_**3/Math.max(1,A*A*a)),le=Math.min(2500,se+Math.min(400,ce)),ue=1/te-1/r.densityKgPerM3,L=Math.max(-60,Math.min(180,w*ue/Math.max(1e3,D)*101325*Math.LN10)),R=Math.max(5,Math.min(900,Ve*E*E*Math.LN10/Math.max(1e3,T)));return Object.freeze({schema:Le,backend:N?`webgpu-md+qha`:`qha-analytical`,Z:t,temperatureK:a,potential:h,heatCapacityCvJPerKgK:k,heatCapacityCpJPerKgK:M,thermalExpansionVolPerK:j,meltingPointK:F,boilingPointK:ee,latentHeatFusionJPerKg:D,latentHeatVaporizationJPerKg:O,meltingSlopeKPerLogP:L,boilingSlopeKPerLogP:R,liquidDensityKgPerM3:te,dynamicViscosityLiquidPaS:re,dynamicViscosityGasPaS:ie,surfaceTensionNPerM:oe,thermalConductivityWPerMK:le,kElectronicWPerMK:se,kPhononWPerMK:Math.min(400,ce),mdTelemetry:N,accuracyTier:t<=100?g.TIER_2_REPRESENTATIVE_EFFECTIVE:g.TIER_3_THEORETICAL_ENVELOPE,provenance:Object.freeze({status:N?`webgpu-derived`:`reduced-estimate`,scientificValidation:!1,model:`dft-fitted-md-qha-wiedemann-franz-andrade`})})}var Ke=`ulg-periodic-table-engine-webgpu.v1`,qe=Object.freeze({1:{symbol:`H`,bPerAMeV:0,rhoKgM3:88,meltingK:14.01,boilingK:20.28,mag:`diamagnetic`},2:{symbol:`He`,bPerAMeV:7.074,rhoKgM3:145,meltingK:.95,boilingK:4.22,mag:`diamagnetic`},6:{symbol:`C`,bPerAMeV:7.68,rhoKgM3:3515,meltingK:3823,boilingK:4300,mag:`diamagnetic`},10:{symbol:`Ne`,bPerAMeV:8.032,rhoKgM3:1444,meltingK:24.56,boilingK:27.07,mag:`diamagnetic`},11:{symbol:`Na`,bPerAMeV:8.111,rhoKgM3:968,meltingK:370.9,boilingK:1156,mag:`paramagnetic`},13:{symbol:`Al`,bPerAMeV:8.332,rhoKgM3:2700,meltingK:933.5,boilingK:2792,mag:`paramagnetic`},14:{symbol:`Si`,bPerAMeV:8.448,rhoKgM3:2329,meltingK:1687,boilingK:3538,mag:`diamagnetic`},18:{symbol:`Ar`,bPerAMeV:8.595,rhoKgM3:1623,meltingK:83.8,boilingK:87.3,mag:`diamagnetic`},26:{symbol:`Fe`,bPerAMeV:8.79,rhoKgM3:7874,meltingK:1811,boilingK:3134,mag:`ferromagnetic`},29:{symbol:`Cu`,bPerAMeV:8.752,rhoKgM3:8960,meltingK:1358,boilingK:2835,mag:`diamagnetic`},47:{symbol:`Ag`,bPerAMeV:8.554,rhoKgM3:10490,meltingK:1235,boilingK:2435,mag:`diamagnetic`},79:{symbol:`Au`,bPerAMeV:8,rhoKgM3:19300,meltingK:1337,boilingK:3129,mag:`diamagnetic`},80:{symbol:`Hg`,bPerAMeV:7.921,rhoKgM3:13534,meltingK:234.3,boilingK:629.9,mag:`diamagnetic`},82:{symbol:`Pb`,bPerAMeV:7.867,rhoKgM3:11340,meltingK:600.6,boilingK:2022,mag:`diamagnetic`},92:{symbol:`U`,bPerAMeV:7.57,rhoKgM3:19050,meltingK:1405,boilingK:4404,mag:`paramagnetic`}});function Je(e,t){let n=qe[e]||null;if(!n)return Object.freeze({g7Advisory:!0,hasReference:!1,note:e>100?`Superheavy element: no experimental bulk properties exist (tier-3 theoretical prediction).`:`No checked-in G7 snapshot benchmark row for this Z.`});let r=(e,t)=>t>0?Math.abs(e-t)/t:Math.abs(e-t);return Object.freeze({g7Advisory:!0,hasReference:!0,bindingPerNucleonRelErr:r(t.nuclear.bindingPerNucleonMeV,n.bPerAMeV),densityRelErr:r(t.mechanical.densityKgPerM3,n.rhoKgM3),meltingRelErr:r(t.thermodynamic.meltingPointK,n.meltingK),boilingRelErr:r(t.thermodynamic.boilingPointK,n.boilingK),magneticPhaseMatch:t.electromagnetic.magneticPhase===n.mag,reference:n})}async function Ye(e,t,{massNumberA:n=null,temperatureK:r=300,runNuclearGpuVolume:i=!0,runLiveMd:o=!0,mdSteps:s=16,mdCellsPerSide:l=3,atomicMaxScf:p=55,atomicGridPointsN:h=256,nuclearVolDim:_=24,blochGridN:v=16,functional:y=`pbe`,scalarRelativistic:b=!0,spinOrbit:x=!0,returnOrbitalWavefunctions:S=!1}={}){let C=Math.trunc(Number(t));if(!(C>=1&&C<=118))throw RangeError(`Element atomicNumberZ out of range 1..118: ${t}`);let w=u(C),T=i?await D(e,C,n,{volDim:_}):E(C,n),O=c(C),k=O.map(e=>({...e})),A=(e,t)=>{let n=Math.max(e,t+1);for(;k.some(e=>e.n===n&&e.l===t);)n+=1;k.push({n,l:t,occupancy:0})};for(let e of O)e.occupancy>0&&e.l>=2&&(e.l-1>=0&&A(e.n+1,e.l-1),e.l+1<=4&&A(e.n+1,e.l+1));k.sort((e,t)=>e.n+e.l-(t.n+t.l)||e.n-t.n||e.l-t.l);let j=await N(e,C,{functional:y,spinOrbit:x,scalarRelativistic:b,configuration:k,nuclearChargeRadiusBohr:T.chargeRadiusBohr,nuclearMassU:T.atomicMassU,nuclearSpinI:T.spinI,nuclearMagneticMomentMuN:T.magneticMomentMuN,gridPointsN:h,rMinBohr:Math.min(1e-4,Math.max(1e-5,T.chargeRadiusBohr*.5)),maxScf:p,returnRadialDensity:!0,returnOrbitalWavefunctions:S}),M=await z(e,C,j,{densityGridN:v,atomicMassU:T.atomicMassU}),P=await Te(e,{Z:C,atomResult:j,bulkResult:M,temperatureK:r}),F=await Ge(e,{Z:C,atomicMassU:T.atomicMassU,bulkResult:M,emResult:P,temperatureK:r,runLiveMd:o,mdSteps:s,mdCellsPerSide:l}),ee=C>100?g.TIER_3_THEORETICAL_ENVELOPE:M.accuracyTier===g.TIER_1_QUANTITATIVE?g.TIER_1_QUANTITATIVE:g.TIER_2_REPRESENTATIVE_EFFECTIVE,te=m({materialKey:n==null?w:T.isotope,symbol:w,atomicNumber:C,massNumberA:T.A,isotope:T.isotope,family:`element`,accuracyTier:ee,generatorFingerprint:Ke,nuclear:{isotope:T.isotope,Z:T.Z,N:T.N,A:T.A,bindingEnergyMeV:T.bindingEnergyMeV,bindingPerNucleonMeV:T.bindingPerNucleonMeV,atomicMassU:T.atomicMassU,massExcessMeV:T.massExcessMeV,chargeRadiusFm:T.chargeRadiusFm,chargeRadiusBohr:T.chargeRadiusBohr,spinI:T.spinI,parity:T.parity,shellLabel:T.shellLabel,magneticMomentMuN:T.magneticMomentMuN,fissility:T.fissility,fissionBarrierMeV:T.fissionBarrierMeV,qAlphaMeV:T.qAlphaMeV,qBetaMinusMeV:T.qBetaMinusMeV,qElectronCaptureMeV:T.qElectronCaptureMeV,dominantMode:T.dominantMode,daughterZ:T.daughterZ,daughterA:T.daughterA,log10HalfLifeS:T.log10HalfLifeS},atomic:{configurationString:d(C),configuration:c(C),spinConfiguration:a(C),unpairedElectrons:f(C),totalEnergyHa:j.totalEnergyHa,qedRadiativeShiftHa:j.qedRadiativeShiftHa??0,reducedMassFactor:j.reducedMassFactor??1,isotopeMassShiftHa:j.isotopeMassShiftHa??0,hyperfineSplittingHz:j.hyperfineSplittingHz??0,finiteNucleusUsed:!!j.finiteNucleusUsed,relativisticMethod:j.relativisticMethod,resolverStatus:j.resolverStatus,perScfCpuReadbacks:j.perScfCpuReadbacks,integratedElectrons:j.integratedElectrons,orbitals:j.orbitals},electromagnetic:{isMetal:P.isMetal,bandGapEv:P.bandGapEv,fermiEnergyEv:M.fermiEnergyEv,dosAtFermiStatesPerEvAtom:M.dosAtFermiStatesPerEvAtom,plasmaEnergyEv:P.plasmaEnergyEv,drudeDampingEv:P.drudeDampingEv,interbandOscillators:P.interbandOscillators,workFunctionEv:P.workFunctionEv,electricalConductivitySPerM:P.electricalConductivitySPerM,electricalResistivityOhmM:P.electricalResistivityOhmM,staticDielectricConstant:P.staticDielectricConstant,magneticPhase:P.magneticPhase,stonerProduct:P.stonerProduct,magneticMomentMuB:P.magneticMomentMuB,curieOrNeelTempK:P.curieOrNeelTempK,magneticSusceptibilitySi:P.magneticSusceptibilitySi,superconductingTcK:P.superconductingTcK,opticalSrgb:P.opticalSrgb,refractiveIndex550Nm:P.refractiveIndex550Nm,reflectance550Nm:P.reflectance550Nm,spectralWavelengthsNm:P.spectralWavelengthsNm,spectralReflectance:P.spectralReflectance,spectralNRe:P.spectralNRe,oscillatorSource:P.provenance?.oscillatorSource??`none`},mechanical:{crystalStructure:M.crystalStructure,spaceGroup:M.spaceGroup,coordinationNumber:M.coordinationNumber,latticeConstantA:M.latticeConstantA,densityKgPerM3:M.densityKgPerM3,cohesiveEnergyEv:M.cohesiveEnergyEv,bulkModulusPa:M.bulkModulusPa,shearModulusPa:M.shearModulusPa,poissonRatio:M.poissonRatio,elasticConstantsGPa:M.elasticConstantsGPa,soundSpeedLongMPerS:M.soundSpeedLongMPerS,soundSpeedTransMPerS:M.soundSpeedTransMPerS,debyeTemperatureK:M.debyeTemperatureK},thermodynamic:{temperatureK:r,heatCapacityCvJPerKgK:F.heatCapacityCvJPerKgK,heatCapacityCpJPerKgK:F.heatCapacityCpJPerKgK,thermalExpansionVolPerK:F.thermalExpansionVolPerK,meltingPointK:F.meltingPointK,boilingPointK:F.boilingPointK,latentHeatFusionJPerKg:F.latentHeatFusionJPerKg,latentHeatVaporizationJPerKg:F.latentHeatVaporizationJPerKg,meltingSlopeKPerLogP:F.meltingSlopeKPerLogP,boilingSlopeKPerLogP:F.boilingSlopeKPerLogP,liquidDensityKgPerM3:F.liquidDensityKgPerM3,dynamicViscosityLiquidPaS:F.dynamicViscosityLiquidPaS,dynamicViscosityGasPaS:F.dynamicViscosityGasPaS,surfaceTensionNPerM:F.surfaceTensionNPerM,thermalConductivityWPerMK:F.thermalConductivityWPerMK,potentialModel:F.potential.modelName,mdEnergyEv:F.mdTelemetry?.totalEnergyEv??null,mdTempK:F.mdTelemetry?.temperatureK??null,mdPressureGPa:F.mdTelemetry?.pressureGPa??null,mdMsdA2:F.mdTelemetry?.msdA2??null},provenance:{status:P.provenance?.status===`hybrid-webgpu-spectral-cpu-oscillators`?`hybrid-webgpu-spectral-cpu-oscillators`:`webgpu-derived`,scientificValidation:!1,extrapolationPolicy:`fail-closed`}}),ne=Je(C,te);return Object.freeze({bundle:te,g7Advisory:ne,visualData:Object.freeze({nuclear:T,atom:j,bulk:M,em:P,thermo:F})})}var Xe=`ulg.compound.recursive-pipeline-webgpu.v1`,Ze=`ulg-recursive-compound-feedback-webgpu.v1`,Qe=602214076e15,$e=8.314462618,et=1602176634e-28,tt=1602176634e-28,nt=88541878128e-22,rt=529177210903e-22;function it(e){let t=c(e),n=t.reduce((e,t)=>Math.max(e,t.n),0);if(n===1)return!0;let r=t.find(e=>e.n===n&&e.l===1)?.occupancy??0;return r>0&&(r>=n||n===2&&r>=1||n===3&&r>=2||n>=6&&r>=5)}var at=Object.freeze([{id:`rocksalt-B1`,spaceGroup:`Fm-3m (225)`,madelung:1.74756,coord:6,packing:.68,stoich:`AB`},{id:`cscl-B2`,spaceGroup:`Pm-3m (221)`,madelung:1.76267,coord:8,packing:.72,stoich:`AB`},{id:`zincblende-B3`,spaceGroup:`F-43m (216)`,madelung:1.63806,coord:4,packing:.56,stoich:`AB`},{id:`fluorite-C1`,spaceGroup:`Fm-3m (225)`,madelung:2.51939,coord:8,packing:.66,stoich:`AB2`},{id:`rutile-C4`,spaceGroup:`P4_2/mnm (136)`,madelung:2.408,coord:6,packing:.62,stoich:`AB2`},{id:`corundum-D51`,spaceGroup:`R-3c (167)`,madelung:4.1719,coord:6,packing:.65,stoich:`A2B3`}]);function ot(e){let t=c(e).reduce((e,t)=>Math.max(e,t.n),1),n=1+.55*(Math.max(1,o(e))-1)+(t>3?.8:0);return Math.max(.65,Math.min(4.8,t*t/n*.72))}function st(e){let t=c(e),n=t.reduce((e,t)=>Math.max(e,t.n),1);if(n===1)return e===1?2.2:3.2;let r=0,i=0,a=0;for(let e of t)e.n===n&&(e.l===0||e.l===1)?r+=e.occupancy:e.n===n-1?i+=e.occupancy:a+=e.occupancy;let o=.35*Math.max(0,r-1)+.85*i+1*a,s=Math.max(1,e-o),l=n<=3?n:3.4+.3*(n-3),u=Math.max(.55,Math.min(2.6,.385*l*l/s**.68));return Math.max(.7,Math.min(4,.359*(s/(u*u))+.744))}function ct(e){let t=S(e).elements.map(e=>({sym:e.symbol,Z:e.Z,count:e.count}));if(t.length===0)throw RangeError(`Cannot parse formula: ${e}`);let n=[];for(let e of t)for(let t=0;t<e.count&&n.length<12;t+=1)n.push({sym:e.sym,Z:e.Z,r:ot(e.Z)});if(n.length===1)return[{Z:n[0].Z,x:0,y:0,z:0}];if(n.length===2){let e=Math.max(1.4,(n[0].r+n[1].r)*.88);return[{Z:n[0].Z,x:-.5*e,y:0,z:0},{Z:n[1].Z,x:.5*e,y:0,z:0}]}n.sort((e,t)=>t.Z-e.Z);let r=n[0],i=n.slice(1),a=[[.8165,.5774,0],[-.8165,.5774,0],[0,-.5774,.8165],[0,-.5774,-.8165],[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],[.577,.577,.577]],s=o(r.Z),c=i.length===2&&(s===4||s===2),l=[{Z:r.Z,x:0,y:0,z:0}];for(let e=0;e<i.length;e+=1){let t=i[e],n=Math.max(1.6,(r.r+t.r)*.86),o=a[e%a.length];c&&(o=e===0?[1,0,0]:[-1,0,0]),l.push({Z:t.Z,x:o[0]*n,y:o[1]*n,z:o[2]*n})}return l}async function lt(e,t,{temperatureK:n=300,runLiveMd:r=!0,mdSteps:i=12,mdCellsPerSide:a=3,reactionContext:c=null}={}){let l=String(t||``).trim(),u=S(l),d=u.elements.map(e=>({sym:e.symbol,Z:e.Z,count:e.count})),f=u.sites,p=Object.fromEntries(d.map(e=>[e.sym,e.count]));if(d.length===0)throw RangeError(`Invalid compound formula: ${t}`);let h=0,_=0,v=0,y=0,b=0,x=0,C=!0,w=1/0,T=-1/0,D=0;for(let e of f){let t=E(e.Z,e.A);h+=e.Z*e.count,_+=t.A*e.count,v+=t.bindingEnergyMeV*e.count,y+=e.atomicMassU*e.count,b+=(s[e.Z-1]||t.atomicMassU)*e.count,x=Math.max(x,t.chargeRadiusFm),D+=e.count,it(e.Z)||(C=!1);let n=st(e.Z);n<w&&(w=n),n>T&&(T=n)}let O=y/Math.max(1e-6,b),k=0,A=0;for(let e of f)e.Z===1&&(k+=e.atomicMassU*e.count,A+=e.count);let j=A>0?k/A:s[0],N=Math.max(0,T-w),P=1-Math.exp(-.25*N*N),F=!C&&P>=.3,ee=!C&&!F,te=y*.001,re=te/Qe,I=null,ie=D<=10&&d.every(e=>e.Z<=36)&&h%2==0;if(e&&typeof e.createBuffer==`function`&&ie){let t=ct(l);try{I=await M(e,t,{maxScf:25,volDim:20})}catch{I=null}}let ae=`molecular-fcc`,oe=`P1 (molecular)`,se=4.5,ce=1e3,le=22e8,ue=0,L=.45,R=I?Math.max(1.2,I.homoLumoGapEv*.65):5.5,de=ee,fe=273,pe=373,me=260;if(F){let e=d.map(e=>e.count).sort((e,t)=>e-t),t=e.length>=2&&e[0]===1&&e[1]===2?`AB2`:e.length>=2&&e[0]===2&&e[1]===3?`A2B3`:`AB`,n=at.filter(e=>e.stoich===t),r=d.reduce((e,t)=>e+ot(t.Z)*rt*t.count,0)/D*2.15,i=Math.max(1,Math.min(6,d.length>=2?1+Math.floor(P*2.2):1)),a=n[0]||at[0],o=1/0;for(let e of n.length?n:at){let t=-(e.madelung*i*tt*tt/(4*Math.PI*nt*r))*(1-1/9);t<o&&(o=t,a=e)}ae=a.id,oe=a.spaceGroup,L=Math.max(1.8,Math.min(14,Math.abs(o)/et));let s=Math.max(15e-30,d.reduce((e,t)=>e+4*Math.PI/3*(ot(t.Z)*rt*1.12)**3*t.count,0)/a.packing);ce=Math.max(600,Math.min(24e3,re/s)),se=Math.cbrt(s*4)*1e10,le=Math.max(8e9,8*Math.abs(o)/(9*s)),ue=.44*le,R=Math.max(2.5,Math.min(11.5,3.2+5.5*P)),de=!1,me=Math.max(150,Math.min(950,120*Math.sqrt(le*1e-9/(ce*.001)))),fe=Math.max(450,Math.min(3100,185*L+120)),pe=Math.max(fe*1.45,fe+550)}else if(ee){ae=`fcc-alloy`,oe=`Fm-3m (225)`;let e=d.reduce((e,t)=>e+4*Math.PI/3*(ot(t.Z)*rt*1.22)**3*t.count,0),t=d.reduce((e,t)=>e+Math.max(1,o(t.Z))*t.count,0)/Math.max(1,D),n=Math.cbrt(e/Math.max(1,D)*3/(4*Math.PI))/rt;ce=Math.max(600,Math.min(24e3,re/Math.max(1e-29,e))),se=Math.cbrt(e/Math.max(1,D)*4)*1e10,L=Math.max(.6,Math.min(9.5,1.45*t/Math.max(1.4,n)*D*.65)),le=Math.max(5e9,1.9*L*et/Math.max(1e-29,e)),ue=.44*le,R=0,de=!0,me=Math.max(60,Math.min(1200,118*Math.sqrt(le*1e-9/(ce*.001)))),fe=Math.max(250,Math.min(3600,360*L/Math.max(1,D)+120)),pe=Math.max(fe*1.5,fe+600)}else{let e=I?.dipoleDebye??(N>.3?1.4*N:0),t=!!p.H,r=!!(p.N||p.O||p.F),i=t&&r?.21*Math.min(p.H,2*((p.N||0)+(p.O||0)+(p.F||0))):0,a=i>0?i*.095*(1-Math.sqrt(s[0]/Math.max(.5,j))):0,o=.012*b**.72+.045*e*e;L=Math.max(.01,o+i+a);let c=Math.max(13e-11,d.reduce((e,t)=>e+(ot(t.Z)*rt)**3*t.count,0)**(1/3)*1.65),l=4*Math.PI/3*c**3/.56;ce=Math.max(40,Math.min(4500,re/Math.max(1e-29,l))),se=Math.cbrt(l*4)*1e10,le=Math.max(2e8,L*et/Math.max(1e-29,l)*1.8),fe=Math.max(12,Math.min(600,460*L+12)),ue=n<fe?.35*le:0,pe=Math.max(fe*1.2+5,L*et*Qe/96),me=Math.max(60,Math.min(450,fe*.9/Math.sqrt(Math.max(.2,O))))}let z=null;e&&typeof e.createBuffer==`function`&&(z=(await ne(e,[de?{mode:0,conductionElectronDensityPerM3:Math.max(1e27,ce/Math.max(1e-27,re)*D),interbandOscillators:[],pathLengthM:.2}:{mode:2,electronicGapEv:Math.max(.25,R),pathLengthM:.2}]))?.results?.[0]??null);let he=Math.max(15,Math.min(n,.65*fe)),ge=re/Math.max(1,ce)*1e30,_e=ae.startsWith(`cscl`)||ae===`bcc`?2:ae.startsWith(`zincblende`)||ae===`diamond`?8:4,ve=Math.max(2.6,Math.min(9.5,Math.cbrt(ge*_e))),ye=ve*(_e===2?Math.sqrt(3)/2:_e===8?Math.sqrt(3)/4:1/Math.SQRT2),be=Object.freeze({crystalStructure:ae,latticeConstantA:ve,massU:Math.max(2,y),potentialModel:F?De.MORSE_EAM:De.LENNARD_JONES,modelName:F?`Morse+EAM (Ionic Lattice)`:`Lennard-Jones (Molecular/Dispersion)`,epsilonEv:Math.max(.005,Math.min(1.5,L/8)),sigmaOrR0A:F?Math.max(1.8,ye*1.08):Math.max(1.8,ye/2**(1/6)),alphaOrLambda:1.4,eamAEv:F?L*.2:0,eamBeta:1.4,rcutA:Math.max(4.5,ve*1.25),dtFs:Math.min(2,Math.max(.5,.14*Math.sqrt(Math.max(2,y)))),defaultTemperatureK:he}),xe=null;if(r&&e&&typeof e.createBuffer==`function`){let t=Ne(e,{...Ie({crystalStructure:be.crystalStructure,cellsPerSide:a,latticeConstantA:be.latticeConstantA,massU:be.massU,temperatureK:he}),potentialModel:be.potentialModel,epsilonEv:be.epsilonEv,sigmaOrR0A:be.sigmaOrR0A,alphaOrLambda:be.alphaOrLambda,eamAEv:be.eamAEv,eamBeta:be.eamBeta,rcutA:be.rcutA,dtFs:be.dtFs,targetTemperatureK:he,thermostatCouplingFs:40});try{xe=await t.stepBatch(i,{readTelemetry:!0,temperatureK:he})}finally{t.destroy()}}let Se=Math.max(2e3,L*et*Qe*.92),Ce=$e*1.4*fe/te,we=Se/te,Te=3*D*$e/te,Ee=ce*.92,Oe=1/Math.max(1,Ee)-1/Math.max(1,ce),B=Math.max(-40,Math.min(180,fe*Oe/Math.max(1e3,Ce)*101325*Math.LN10)),ke=Math.max(8,Math.min(600,$e*pe*pe*Math.LN10/Se)),Ae=z?.spectralSamples?.find(e=>Math.abs(e.wavelengthNm-550)<=6)||z?.spectralSamples?.[Math.floor((z?.spectralSamples?.length||1)/2)]||null,je=Array.isArray(z?.baseColorSrgb)&&z.baseColorSrgb.length===3?z.baseColorSrgb.map(e=>Math.max(0,Math.min(1,Number(e)||0))):de?[.74,.76,.79]:[.85,.9,.96],Me=Number.isFinite(Ae?.nRe)&&Ae.nRe>0?Ae.nRe:Math.sqrt(1+(9.5/Math.max(.5,R))**2),Pe=Number.isFinite(Ae?.reflectance)?Ae.reflectance:Number.isFinite(z?.reflectance)?z.reflectance:de?.72:.04,Fe=de?Math.max(5e5,300/Math.max(50,n)*25e6*(me/300)):Math.max(1e-16,1e-4*Math.exp(-R/(2*8617e-8*Math.max(100,n)))),Le=de?2.44300455e-8*Fe*n:0,Re=F?1.5:2,ze=Math.cbrt(re/Math.max(1,ce)/Math.max(1,D))*1e10,Be=Math.max(.04,Math.min(120,y/Math.max(1,D)*31e-9*ze*me**3/Math.max(1,Re*Re*n*D**(2/3)))),Ve=Math.min(1200,Le+Be),He=m({materialKey:u.canonicalIsotopologue,formula:l,canonicalFormula:u.canonicalFormula,canonicalIsotopologue:u.canonicalIsotopologue,hasExplicitIsotopes:u.hasExplicitIsotopes,family:`compound`,accuracyTier:g.TIER_2_REPRESENTATIVE_EFFECTIVE,generatorFingerprint:Ze,nuclear:{totalProtonsZ:h,totalNucleonsA:_,molarMassU:y,isotopeMassRatio:O,totalBindingEnergyMeV:v,maxNuclearRadiusFm:x,stoichiometry:p,isotopologueSites:f},atomic:{molecularRhfSolvedOnGpu:!!I,totalEnergyHa:I?.totalEnergyHa??null,homoLumoGapEv:I?.homoLumoGapEv??R,dipoleDebye:I?.dipoleDebye??0,paulingIonicity:P,mullikenCharges:I?.mullikenCharges??null},electromagnetic:{isMetal:de,bandGapEv:R,plasmaEnergyEv:de?Math.max(1.5,Number(z?.plasmaEnergyEv)||8):0,drudeDampingEv:de?.45:.08,interbandOscillators:[],electricalConductivitySPerM:Fe,staticDielectricConstant:de?1/0:1+(9.5/Math.max(.5,R))**2+(I?.dipoleDebye??0)**2*18,magneticPhase:h%2==1?`paramagnetic`:`diamagnetic`,opticalSrgb:je,refractiveIndex550Nm:Me,reflectance550Nm:Pe,spectralWavelengthsNm:z?.spectralSamples?.map(e=>e.wavelengthNm)??null,spectralReflectance:z?.spectralSamples?.map(e=>e.reflectance??0)??null,spectralNRe:z?.spectralSamples?.map(e=>e.nRe??Me)??null,spectralAbsorptionPerM:z?.spectralSamples?.map(e=>e.absorptionPerM??0)??null},mechanical:{crystalStructure:ae,spaceGroup:oe,latticeConstantA:se,densityKgPerM3:ce,cohesiveEnergyEv:L,bulkModulusPa:le,shearModulusPa:ue,debyeTemperatureK:me},thermodynamic:{temperatureK:n,heatCapacityCvJPerKgK:Te*.92,heatCapacityCpJPerKgK:Te,meltingPointK:fe,boilingPointK:pe,latentHeatFusionJPerKg:Ce,latentHeatVaporizationJPerKg:we,meltingSlopeKPerLogP:B,boilingSlopeKPerLogP:ke,liquidDensityKgPerM3:Ee,dynamicViscosityLiquidPaS:Math.max(1e-4,4e-4*Math.exp(fe/Math.max(n,fe)*1.8)),surfaceTensionNPerM:Math.max(.005,.14*L*et/(re/Ee)**(2/3)),thermalConductivityWPerMK:Ve,mdTempK:xe?.temperatureK??null,mdEnergyEv:xe?.totalEnergyEv??null,mdPressureGPa:xe?.pressureGPa??null},provenance:{status:I||xe||z?`webgpu-derived`:`reduced-estimate`,gpuStagesExecuted:{molecularRhf:!!I,opticalSpectrum:!!z,molecularDynamics:!!xe},scientificValidation:!1,extrapolationPolicy:`fail-closed`,reactionContext:c}});return Object.freeze({schema:Xe,bundle:He,visualData:Object.freeze({molQm:I,optics:z,mdTelemetry:xe,mdConfig:be})})}function ut(e,t){let n,r;try{n=S(e),r=S(t)}catch{return null}if(n.elements.length!==1||r.elements.length!==1)return null;let i=n.elements[0].Z===1?{f:e,d:n}:r.elements[0].Z===1?{f:t,d:r}:null,a=n.elements[0].Z===8?{f:e,d:n}:r.elements[0].Z===8?{f:t,d:r}:null;if(!i||!a)return null;let o=i.d.sites[0],s=o.A===2?`D`:o.A===3?`T`:`H`,c=i.d.elements[0].count,l=a.d.elements[0].count,u=`${s}2O`,d=c===1&&l===1?1:2,f=2*d/c,p=d/l,m=(e,t)=>e===1?t:`${e} ${t}`;return Object.freeze({familyId:`hydrogen-oxygen-synthesis`,familyLabel:`hydrogen + oxygen -> water synthesis`,equation:`${m(f,i.f)} + ${m(p,a.f)} -> ${m(d,u)}`,reactants:[{coefficient:f,formula:i.f,atomCounts:{1:c}},{coefficient:p,formula:a.f,atomCounts:{8:l}}],products:[{coefficient:d,formula:u,atomCounts:{1:2,8:1}}],productFormula:u,atomBalance:{balanced:!0,reactants:{1:2*d,8:d},products:{1:2*d,8:d}},energetics:{model:`provisional-hydrogen-oxygen-combustion-v0`,provisional:!0,reactionEnthalpyJPerBalancedEquation:-241800*d},sedenionScope:{reactiveClass:`reactive`},scientificValidation:!1})}async function dt(e,t,n={}){let r=Array.isArray(t)?t:[t],i=[];for(let e=0;e<r.length;e+=1)for(let t=e+1;t<r.length;t+=1){let a=j(r[e],r[t],n.discoveryOptions||{});if(Array.isArray(a?.candidates)&&a.candidates.length>0)i.push(...a.candidates);else{let n=ut(r[e],r[t]);n&&i.push(n)}}let a=[],o=new Set;for(let e of i)for(let t of e.products||[]){let e=String(t.formula||t.material||``).trim();e&&!o.has(e)&&(o.add(e),a.push(e))}let s=[];for(let t of a){let i=await lt(e,t,{runLiveMd:n.runLiveMd!==!1,mdSteps:n.mdSteps??10,mdCellsPerSide:n.mdCellsPerSide??2,reactionContext:{source:`discoverAndDeriveReactionProductsWebGpu`,reactants:r}});s.push(i)}return Object.freeze({schema:`ulg.reaction-feedback-pipeline-webgpu.v1`,reactants:Object.freeze([...r]),candidateCount:i.length,candidates:Object.freeze(i),productFormulas:Object.freeze(a),derivedProducts:Object.freeze(s)})}var ft=`ulg.electronic.orbital-cloud-webgpu.v1`,pt=1/137.035999084,mt=512,ht=256,gt=Object.freeze({COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128});function _t(e){let t=1;for(let n=2;n<=e;n+=1)t*=n;return t}function vt(e,t){return t<0||t>e?0:_t(e)/(_t(t)*_t(e-t))}function yt(e,t,n){let r=0,i=1;for(let a=0;a<=e;a+=1){let o=a&1?-1:1;r+=o*vt(e+t,e-a)/_t(a)*i,i*=n}return r}function bt(e,t,n){let r=Math.max(-1,Math.min(1,n)),i=1;if(t>0){let e=Math.sqrt(Math.max(0,(1-r)*(1+r))),n=1;for(let r=1;r<=t;r+=1)i*=-n*e,n+=2}if(e===t)return i;let a=r*(2*t+1)*i;if(e===t+1)return a;let o=0;for(let n=t+2;n<=e;n+=1)o=((2*n-1)*r*a-(n+t-1)*i)/(n-t),i=a,a=o;return o}function xt(e,t,n,r){if(!r)return e;let i=0;for(let e=1;e<t;e+=1)i+=2*e*e;let a=Math.max(0,Math.min(2*t*t,e-i)),o=t>1?i-2*(t-1)*(t-1):0,s=t>1?Math.max(0,Math.min(2*(t-1)*(t-1),e-o-a)):0,c=Math.max(0,a-1),l=Math.max(0,e-a-s),u=n<=1?.85:1,d=n>0?.02*((2*n+1)/Math.max(1,t)):0;return Math.max(1,Math.min(e,e-(.35*c+u*s+l)+d))}function St(e,t,n,r){if(!r)return e;let i=(pt*e)**2,a=n<=1?1+i*.36/(Math.max(1,t)*(n+1)):Math.max(.75,1-i*.18/Math.max(1,t));return Math.max(.8,e*a)}function Ct({Z:e=26,n:t=3,l:n=2,m:r=0,rGrid:i=null,orbitalU:a=null,screeningExchange:o=!0,relativisticSpinOrbit:s=!0}={}){let c=Math.max(1,Math.min(8,Math.trunc(t))),l=Math.max(0,Math.min(c-1,Math.trunc(n))),u=Math.max(-l,Math.min(l,Math.trunc(r))),d=Math.abs(u),f=new Float32Array(mt),p=new Float32Array(mt),m=new Float32Array(mt),h=new Float32Array(mt),g=Array.isArray(i)&&i.length>=32&&a&&a.length===i.length,_=6,v=`analytic-laguerre-slater`;if(g){v=`webgpu-kohn-sham-eigenstate`;let e=new Float64Array(i.length),t=0;for(let n=0;n<i.length;n+=1){let r=n===0?i[1]-i[0]:n===i.length-1?i[n]-i[n-1]:.5*(i[n+1]-i[n-1]),o=a[n],s=o*o*Math.max(1e-8,r);e[n]=s,t+=s}let n=0;_=Math.max(1.5,i[i.length-1]*.5);for(let r=0;r<i.length;r+=1)if(n+=e[r],n>=t*.994){_=Math.max(.8,Math.min(36,i[r]*1.15));break}let r=0,o=0,s=0,c=0;for(let e=0;e<mt;e+=1){let t=(e+.5)/mt*_;for(f[e]=t;c+1<i.length&&i[c+1]<t;)c+=1;let n=Math.min(i.length-2,c),l=i[n],u=Math.max(l+1e-9,i[n+1]),d=Math.max(0,Math.min(1,(t-l)/(u-l))),g=a[n]*(1-d)+a[n+1]*d,v=g>=0?1:-1;s!==0&&v!==s&&Math.abs(g)>1e-6&&(o+=1),Math.abs(g)>1e-6&&(s=v),r+=g*g,p[e]=r,m[e]=o,h[e]=v}let l=r>0?1/r:1;for(let e=0;e<mt;e+=1)p[e]*=l}else{let t=St(xt(e,c,l,o),c,l,s),n=(3*c*c-l*(l+1))/(2*Math.max(.5,t));_=Math.max(1.2,Math.min(42,n*2.55+1.4/Math.sqrt(Math.max(1,t))));let r=Math.sqrt((2*t/c)**3*(_t(c-l-1)/(2*c*_t(c+l)))),i=0,a=0,u=0;for(let e=0;e<mt;e+=1){let n=(e+.5)/mt*_;f[e]=n;let o=2*t*n/c,s=yt(c-l-1,2*l+1,o),d=n*(r*Math.exp(-.5*o)*o**+l*s),g=d>=0?1:-1;u!==0&&g!==u&&Math.abs(d)>1e-8&&(a+=1),Math.abs(d)>1e-8&&(u=g),i+=d*d,p[e]=i,m[e]=a,h[e]=g}let d=i>0?1/i:1;for(let e=0;e<mt;e+=1)p[e]*=d}let y=(pt*xt(e,c,l,o))**2,b=s&&l>0&&u!==0?y*.28*l/Math.max(1,c*c):0,x=new Float32Array(ht),S=new Float32Array(ht),C=0;for(let e=0;e<ht;e+=1){let t=-1+(e+.5)/ht*2,n=bt(l,d,t),r=b>0?Math.max(.35,Math.min(1.65,1+b*t*(u/Math.max(1,l)))):1;C+=n*n*r,x[e]=C,S[e]=n>=0?1:-1}let w=C>0?1/C:1;for(let e=0;e<ht;e+=1)x[e]*=w;let T=new Float32Array(mt*4);for(let e=0;e<mt;e+=1)T[e*4+0]=f[e]/Math.max(1e-6,_),T[e*4+1]=p[e],T[e*4+2]=m[e],T[e*4+3]=h[e];let E=new Float32Array(ht*2);for(let e=0;e<ht;e+=1)E[e*2+0]=x[e],E[e*2+1]=S[e];return Object.freeze({radialPacked:T,polarPacked:E,rExtentBohr:_,n:c,l,m:u,radialNodeCount:Math.max(0,Math.round(m[mt-1])),sourceKind:v})}var wt=`
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
`,Tt=`
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
`,Et=new WeakMap;function Dt(e){let t=Et.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-orbital-cloud-sampler`,code:wt}),r=e.createComputePipeline({label:`ulg-orbital-cloud-sampler-pipe`,layout:`auto`,compute:{module:n,entryPoint:`sample_orbital_cloud`}}),i=e.createShaderModule({label:`ulg-mol-cloud-sampler`,code:Tt});return t={atomPipe:r,molPipe:e.createComputePipeline({label:`ulg-mol-cloud-sampler-pipe`,layout:`auto`,compute:{module:i,entryPoint:`sample_molecular_cloud`}}),atomParamsBuf:e.createBuffer({size:32,usage:gt.UNIFORM|gt.COPY_DST}),radialTableBuf:e.createBuffer({size:mt*16,usage:gt.STORAGE|gt.COPY_DST}),polarTableBuf:e.createBuffer({size:ht*8,usage:gt.STORAGE|gt.COPY_DST}),molParamsBuf:e.createBuffer({size:32,usage:gt.UNIFORM|gt.COPY_DST}),molAzBuf:null,molAzSize:0,molWBuf:null,molWSize:0},Et.set(e,t),t}function Ot(e,{Z:t=26,n=3,l:r=2,m:i=0,pointCount:a=25e4,rGrid:o=null,orbitalU:s=null,screeningExchange:c=!0,relativisticSpinOrbit:l=!0,colorMode:u=0,seed:d=1,reuseBuffer:f=null}={}){let p=Math.max(4096,Math.min(5e5,Math.trunc(a))),m=Ct({Z:t,n,l:r,m:i,rGrid:o,orbitalU:s,screeningExchange:c,relativisticSpinOrbit:l}),{atomPipe:h,atomParamsBuf:g,radialTableBuf:_,polarTableBuf:v}=Dt(e),y=p*16,b=f&&f.size>=y?f:e.createBuffer({label:`ulg-orbital-cloud-pts`,size:y,usage:gt.STORAGE|gt.VERTEX|gt.COPY_SRC}),x=new ArrayBuffer(32),S=new Uint32Array(x),C=new Int32Array(x);S[0]=p>>>0,S[1]=mt>>>0,S[2]=ht>>>0,S[3]=d>>>0||1,C[4]=m.m,S[5]=Math.abs(m.m)>>>0,S[6]=u>>>0,S[7]=0,e.queue.writeBuffer(g,0,x),e.queue.writeBuffer(_,0,m.radialPacked),e.queue.writeBuffer(v,0,m.polarPacked);let w=e.createBindGroup({layout:h.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:g}},{binding:1,resource:{buffer:_}},{binding:2,resource:{buffer:v}},{binding:3,resource:{buffer:b}}]}),T=e.createCommandEncoder({label:`ulg-orbital-cloud-sample-enc`}),E=T.beginComputePass();return E.setPipeline(h),E.setBindGroup(0,w),E.dispatchWorkgroups(Math.ceil(p/64)),E.end(),e.queue.submit([T.finish()]),Object.freeze({schema:ft,pointsBuffer:b,pointCount:p,rExtentBohr:m.rExtentBohr,n:m.n,l:m.l,m:m.m,radialNodeCount:m.radialNodeCount,sourceKind:m.sourceKind})}function kt(e,{posZeta:t,weights:n,boxHalfBohr:r=4,mode:i=0,pointCount:a=16e4,seed:o=1,reuseBuffer:s=null}={}){if(!t||!n||t.length<4)return null;let c=Math.floor(t.length/4),l=Math.max(4096,Math.min(35e4,Math.trunc(a))),u=Dt(e),{molPipe:d,molParamsBuf:f}=u,p=l*16,m=s&&s.size>=p?s:e.createBuffer({label:`ulg-mol-cloud-pts`,size:p,usage:gt.STORAGE|gt.VERTEX|gt.COPY_SRC}),h=Math.max(16,t.byteLength),g=Math.max(16,n.byteLength);(!u.molAzBuf||u.molAzSize<h)&&(u.molAzBuf=e.createBuffer({size:Math.max(256,h),usage:gt.STORAGE|gt.COPY_DST}),u.molAzSize=Math.max(256,h)),(!u.molWBuf||u.molWSize<g)&&(u.molWBuf=e.createBuffer({size:Math.max(256,g),usage:gt.STORAGE|gt.COPY_DST}),u.molWSize=Math.max(256,g));let _=new ArrayBuffer(32);new Uint32Array(_,0,4).set([l>>>0,c>>>0,i>>>0,o>>>0||1]),new Float32Array(_,16,4).set([Math.max(1,Number(r)||4),0,0,0]),e.queue.writeBuffer(f,0,_),e.queue.writeBuffer(u.molAzBuf,0,t),e.queue.writeBuffer(u.molWBuf,0,n);let v=e.createBindGroup({layout:d.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:f}},{binding:1,resource:{buffer:u.molAzBuf}},{binding:2,resource:{buffer:u.molWBuf}},{binding:3,resource:{buffer:m}}]}),y=e.createCommandEncoder({label:`ulg-mol-cloud-sample-enc`}),b=y.beginComputePass();return b.setPipeline(d),b.setBindGroup(0,v),b.dispatchWorkgroups(Math.ceil(l/64)),b.end(),e.queue.submit([y.finish()]),Object.freeze({schema:ft,pointsBuffer:m,pointCount:l,boxHalfBohr:Math.max(1,Number(r)||4),mode:i,sourceKind:`webgpu-molecular-rhf`})}function At(e){return!e||typeof e.registerModule!=`function`?null:{orbitalCloudMod:e.registerModule({method:{model:`quantum-orbital-cloud`,version:`1`},kernel:{sourceModule:`src/runtime/electronicStructure/orbitalPointCloudWebGpu.js`,entryPoint:`sample_orbital_cloud`,workgroupSize:64,wgsl:wt},parameterSchema:{Z:{type:`number`,min:1,max:118,required:!0},n:{type:`number`,min:1,max:8,required:!0},l:{type:`number`,min:0,max:7,required:!0},m:{type:`number`,min:-7,max:7},pointCount:{type:`number`,min:4096,max:5e5}},stateLayout:{tensorId:`orbital_points_vec4`,dtype:`f32`,components:4},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`quantum-orbital-cloud@1 requires a WebGPU device`);let r=Ot(n,e?.parameters||{});return{status:`ok`,pointCount:r.pointCount,rExtentBohr:r.rExtentBohr,radialNodeCount:r.radialNodeCount,sourceKind:r.sourceKind,pointsBuffer:r.pointsBuffer}}}),tdksPhotonMod:e.registerModule({method:{model:`quantum-tdks-photon`,version:`1`},kernel:{sourceModule:`src/runtime/electronicStructure/orbitalPointCloudWebGpu.js`,entryPoint:`sample_dipole_coupled_pair`,workgroupSize:64,wgsl:jt},parameterSchema:{Z:{type:`number`,min:1,max:118,required:!0},pointCount:{type:`number`,min:4096,max:3e5}},stateLayout:{tensorId:`tdks_dipole_pair_cloud`,dtype:`f32`,components:8},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`quantum-tdks-photon@1 requires a WebGPU device`);let r=Ft(n,e?.parameters||{});return{status:`ok`,pointCount:r.pointCount,rExtentBohr:r.rExtentBohr}}})}}var jt=`
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
`,Mt=new WeakMap;function Nt(e){let t=Mt.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-dipole-pair-sampler`,code:jt});return t={pipe:e.createComputePipeline({label:`ulg-dipole-pair-sampler-pipe`,layout:`auto`,compute:{module:n,entryPoint:`sample_dipole_coupled_pair`}}),paramsBuf:e.createBuffer({size:32,usage:gt.UNIFORM|gt.COPY_DST}),radBuf:e.createBuffer({size:mt*16,usage:gt.STORAGE|gt.COPY_DST}),polBuf:e.createBuffer({size:ht*16,usage:gt.STORAGE|gt.COPY_DST})},Mt.set(e,t),t}function Pt(e,t,n,r,i,a,o,s){let c=new Float32Array(a.length);if(Array.isArray(r)&&r.length>=32&&i&&i.length===r.length){let e=0;for(let t=0;t<a.length;t+=1){let n=a[t];for(;e+1<r.length&&r[e+1]<n;)e+=1;let o=Math.min(r.length-2,e),s=r[o],l=Math.max(s+1e-9,r[o+1]),u=Math.max(0,Math.min(1,(n-s)/(l-s)));c[t]=i[o]*(1-u)+i[o+1]*u}}else{let r=St(xt(e,t,n,o),t,n,s),i=Math.sqrt((2*r/t)**3*(_t(t-n-1)/(2*t*_t(t+n))));for(let e=0;e<a.length;e+=1){let o=a[e],s=2*r*o/t,l=yt(t-n-1,2*n+1,s);c[e]=o*i*Math.exp(-.5*s)*s**+n*l}}let l=0;for(let e=0;e<c.length;e+=1)l+=c[e]*c[e];let u=1/Math.sqrt(Math.max(1e-12,l));for(let e=0;e<c.length;e+=1)c[e]*=u;return c}function Ft(e,{Z:t=79,n0:n=5,l0:r=2,n1:i=6,l1:a=1,m:o=0,rGrid:s=null,u0:c=null,u1:l=null,pointCount:u=18e4,screeningExchange:d=!0,relativisticSpinOrbit:f=!0,seed:p=1,reusePosBuffer:m=null,reuseAmpBuffer:h=null}={}){let g=Math.max(8192,Math.min(3e5,Math.trunc(u))),_=Math.max(1,Math.min(8,Math.trunc(n))),v=Math.max(0,Math.min(_-1,Math.trunc(r))),y=Math.max(1,Math.min(8,Math.trunc(i))),b=Math.max(0,Math.min(y-1,Math.trunc(a))),x=Math.max(-Math.min(v,b),Math.min(Math.min(v,b),Math.trunc(o))),S=Math.abs(x),C=Ct({Z:t,n:_,l:v,m:x,rGrid:s,orbitalU:c,screeningExchange:d,relativisticSpinOrbit:f}),w=Ct({Z:t,n:y,l:b,m:x,rGrid:s,orbitalU:l,screeningExchange:d,relativisticSpinOrbit:f}),T=Math.max(C.rExtentBohr,Math.min(C.rExtentBohr*1.45,w.rExtentBohr)),E=new Float32Array(mt);for(let e=0;e<mt;e+=1)E[e]=(e+.5)/mt*T;let D=Pt(t,_,v,s,c,E,d,f),O=Pt(t,y,b,s,l,E,d,f),k=new Float32Array(mt*4),A=0;for(let e=0;e<mt;e+=1)A+=.5*(D[e]*D[e]+O[e]*O[e]),k[e*4+0]=E[e]/T,k[e*4+1]=A,k[e*4+2]=D[e],k[e*4+3]=O[e];let j=A>0?1/A:1;for(let e=0;e<mt;e+=1)k[e*4+1]*=j;let M=new Float32Array(ht),N=new Float32Array(ht),P=0,F=0;for(let e=0;e<ht;e+=1){let t=-1+(e+.5)/ht*2;M[e]=bt(v,S,t),N[e]=bt(b,S,t),P+=M[e]*M[e],F+=N[e]*N[e]}let ee=1/Math.sqrt(Math.max(1e-12,P/ht)),te=1/Math.sqrt(Math.max(1e-12,F/ht)),ne=new Float32Array(ht*4),re=0;for(let e=0;e<ht;e+=1){let t=-1+(e+.5)/ht*2,n=M[e]*ee,r=N[e]*te;re+=.5*(n*n+r*r),ne[e*4+0]=re,ne[e*4+1]=n,ne[e*4+2]=r,ne[e*4+3]=t}let I=re>0?1/re:1;for(let e=0;e<ht;e+=1)ne[e*4+0]*=I;let{pipe:ie,paramsBuf:ae,radBuf:oe,polBuf:se}=Nt(e),ce=g*16,le=m&&m.size>=ce?m:e.createBuffer({label:`ulg-tdks-pair-pos`,size:ce,usage:gt.STORAGE|gt.VERTEX}),ue=h&&h.size>=ce?h:e.createBuffer({label:`ulg-tdks-pair-amp`,size:ce,usage:gt.STORAGE}),L=new ArrayBuffer(32),R=new Uint32Array(L),de=new Int32Array(L);R[0]=g>>>0,R[1]=mt>>>0,R[2]=ht>>>0,R[3]=p>>>0||1,R[4]=S>>>0,de[5]=x,R[6]=0,R[7]=0,e.queue.writeBuffer(ae,0,L),e.queue.writeBuffer(oe,0,k),e.queue.writeBuffer(se,0,ne);let fe=e.createBindGroup({layout:ie.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:ae}},{binding:1,resource:{buffer:oe}},{binding:2,resource:{buffer:se}},{binding:3,resource:{buffer:le}},{binding:4,resource:{buffer:ue}}]}),pe=e.createCommandEncoder({label:`ulg-tdks-pair-sample`}),me=pe.beginComputePass();return me.setPipeline(ie),me.setBindGroup(0,fe),me.dispatchWorkgroups(Math.ceil(g/64)),me.end(),e.queue.submit([pe.finish()]),Object.freeze({posBuffer:le,ampBuffer:ue,pointCount:g,rExtentBohr:T,n0:_,l0:v,n1:y,l1:b,m:x,groundSource:C.sourceKind,excitedSource:w.sourceKind})}function It(e={},{probeWavelengthNm:t=440}={}){let n=1239.841984,r=.6582119569,i=!!e?.isMetal,a=Array.isArray(e?.interbandOscillators)?e.interbandOscillators:[],o=5,s=.45,c=`Valence→Cond`;if(i&&a.length>0){let e=a.find(e=>e.energyEv>=2.2&&e.energyEv<=4.2)||a[0];o=Math.max(.6,Number(e.energyEv)||3),s=Math.max(.22,Number(e.dampingEv)||.55),c=e.transitionLabel||`d→p`}else{let t=Math.max(.5,Number(e?.bandGapEv)||5.5);o=Math.max(2.6,t+1.4),s=t<3.4?.4:.14,c=`Valence→Cond (${o.toFixed(1)} eV)`}let l=o/r,u=s/r,d=u*.42,f=1.65,p=[610,535,440,Math.max(380,Math.min(780,Number(t)||440))].map(e=>({wavelengthNm:e,photonEv:n/e,omega:n/e/r,rho01Re:0,rho01Im:0,rho11:0,dipole:0,dipolePrev:0,dipoleAccel:0,absorbedEnergy:0,incidentEnergy:0,eNow:0,radHistory:new Float32Array(128)})),m=0,h=0,g=4.2,_=2.4;function v(e,t){let n=t-g;return Math.exp(n/_*-.5*(n/_))*Math.cos(e.omega*n)}function y(e=null){if(m=0,h=0,e!=null){let t=Math.max(380,Math.min(780,Number(e)||440));p[3].wavelengthNm=t,p[3].photonEv=n/t,p[3].omega=p[3].photonEv/r}for(let e of p)e.rho01Re=0,e.rho01Im=0,e.rho11=0,e.dipole=0,e.dipolePrev=0,e.dipoleAccel=0,e.absorbedEnergy=0,e.incidentEnergy=0,e.eNow=0,e.radHistory.fill(0)}function b(e=.08){let t=e/12;for(let e=0;e<12;e+=1){let n=m+e*t;for(let e of p){let r=f*v(e,n),i=(e,t,n,r)=>{let i=2*n-1;return[-l*t-.5*u*e,l*e-.5*u*t+r*i,-d*n-2*r*t]},[a,o,s]=i(e.rho01Re,e.rho01Im,e.rho11,r),c=f*v(e,n+.5*t),[p,m,h]=i(e.rho01Re+.5*t*a,e.rho01Im+.5*t*o,e.rho11+.5*t*s,c),[g,_,y]=i(e.rho01Re+.5*t*p,e.rho01Im+.5*t*m,e.rho11+.5*t*h,c),b=v(e,n+t),x=f*b,[S,C,w]=i(e.rho01Re+t*g,e.rho01Im+t*_,e.rho11+t*y,x),T=2*e.rho01Re;e.rho01Re+=t/6*(a+2*p+2*g+S),e.rho01Im+=t/6*(o+2*m+2*_+C),e.rho11=Math.max(0,Math.min(.98,e.rho11+t/6*(s+2*h+2*y+w)));let E=2*e.rho01Re,D=(E-T)/t;e.dipoleAccel=(E-2*e.dipole+e.dipolePrev)/Math.max(1e-6,t*t),e.dipolePrev=e.dipole,e.dipole=E,e.eNow=b,e.absorbedEnergy+=Math.max(0,b*D*t),e.incidentEnergy+=b*b*t}}m+=e,h=(h+1)%128;for(let e of p)e.radHistory[h]=Math.max(-2.5,Math.min(2.5,-e.dipoleAccel*.045));m>13.5&&y()}return Object.freeze({transEv:o,gammaEv:s,transLabel:c,historyLen:128,channels:p,getTimeFs:()=>m,getHistCursor:()=>h,pulseT0Fs:g,pulseWidthFs:_,reset:y,stepFs:b})}var Lt=27.211386245988,Rt=.529177210903,zt=51.4220674763;function Bt({atomResult:e=null,eFieldVPerA:t=0}={}){let n=Number(t)||0,r=n/zt,i=4,a=24,o=Math.max(1,Number(e?.electronCount)||1);if(e?.radialGrid?.r&&e?.radialGrid?.rho){let{r:t,rho:n,dx:r}=e.radialGrid,s=0,c=0,l=0;for(let e=0;e<t.length;e+=1){let i=4*Math.PI*t[e]**3*n[e]*r;s+=i,c+=i*t[e]**2,l+=i*t[e]**4}s>.1&&(o=s,i=c/s,a=l/s)}let s=Array.isArray(e?.orbitals)?e.orbitals.filter(e=>Number(e.occupancy??1)>0):[],c=s.length?Math.max(...s.map(e=>Number(e.energyHa??e.energy??-.35))):-.35,l=Math.max(.12,-c),u=Math.max(1,Math.sqrt(Math.max(1,a))*.85),d=Math.max(.8,Math.min(450,.55*(4/9*o*i*i)+.45*(2*u/(3*l)))),f=d*Rt**3,p=d*r,m=p*2.541746473,h=-.5*d*r*r*Lt,g=Math.max(-.65,Math.min(.65,p/Math.max(1.2,Math.sqrt(u)*3)));return Object.freeze({eFieldVPerA:n,eFieldAu:r,alpha0Bohr3:d,alpha0Angstrom3:f,inducedDipoleAu:p,inducedDipoleDebye:m,starkShiftEv:h,starkMixLambda:g,homoBindingEv:l*Lt})}async function Vt(e,{Z:t,solveAtomFullWebGpu:n,baseConfiguration:r,baseAtomResult:i,functional:a=`pbe`,scalarRelativistic:o=!0,spinOrbit:s=!0,nuclearChargeRadiusBohr:c=null,nuclearMassU:l=null}={}){if(!e||typeof n!=`function`)throw TypeError(`solveDeltaScfIonizationWebGpu requires GPUDevice and solveAtomFullWebGpu.`);let u=(r||[]).map(e=>({...e})),d=-1,f=-1;for(let e=0;e<u.length;e+=1)if((u[e].occupancy||0)>0){let t=u[e].n*10+u[e].l;t>=f&&(f=t,d=e)}if(d<0)return null;let p=u[d],m=`${p.n}${[`s`,`p`,`d`,`f`,`g`][p.l]||p.l}`;u[d].occupancy=Math.max(0,u[d].occupancy-1);let h=await n(e,t,{functional:a,scalarRelativistic:o,spinOrbit:s,configuration:u,nuclearChargeRadiusBohr:c,nuclearMassU:l,maxScf:50,gridPointsN:Math.max(64,Math.min(512,Number(i?.radialGrid?.r?.length)||512)),returnRadialDensity:!0,returnOrbitalWavefunctions:!0}),g=Number(h.totalEnergyHa)-Number(i?.totalEnergyHa??0),_=(i?.orbitals||[]).find(e=>e.n===p.n&&e.l===p.l),v=(h?.orbitals||[]).find(e=>e.n===p.n&&e.l===p.l),y=Number(_?.energyHa??_?.energy),b=Number(v?.energyHa??v?.energy),x=Number.isFinite(y)&&Number.isFinite(b)?-.5*(y+b)*Lt:g*Lt,S=Math.max(1.5,x);return Object.freeze({Z:t,chargeState:1,removedShell:m,neutralEnergyHa:Number(i?.totalEnergyHa??0),cationEnergyHa:Number(h.totalEnergyHa),rawDeltaScfEv:g*Lt,neutralOrbitalEv:Number.isFinite(y)?y*Lt:null,cationOrbitalEv:Number.isFinite(b)?b*Lt:null,ionizationEnergyEv:S,cationAtom:h})}var Ht=`ulg.optics.photon-shell-fdtd-2d-webgpu.v1`,Ut=`ulg.nuclear.tunneling-tdse-webgpu.v1`,Wt=16384,Gt=2e-8,Kt=.5,qt=Kt*Gt/299792458,Jt=6582119569e-25,Yt=1239.841984,Xt=.36,V=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128});function Zt(e={},{probeWavelengthNm:t=535}={}){let n=!!e?.isMetal,r=n?Math.max(.5,Math.min(24,Number(e?.plasmaEnergyEv)||8)):0,i=n?Math.max(.05,Math.min(4,Number(e?.drudeDampingEv)||Math.max(.15,r/25))):0,a=[];if(n){let t=Array.isArray(e?.interbandOscillators)?e.interbandOscillators:[],n=r*r;for(let e=0;e<Math.min(4,t.length);e+=1){let r=t[e],i=Math.max(.25,Math.min(18,Number(r.energyEv)||3)),o=Math.max(.12,Math.min(6,Number(r.dampingEv)||.45)),s=Math.max(0,Math.min(8,Number(r.strengthWeight)||0)),c=Xt*n*s/(i*i);a.push({energyEv:i,dampingEv:o,deltaEps:Math.min(25,c),label:r.transitionLabel||`Interband #${e+1}`})}}else{let t=Math.max(.25,Math.min(18,Number(e?.bandGapEv)||5)),n=Number(e?.refractiveIndex550Nm),r=Number.isFinite(n)&&n>=1.005?Math.min(3.8,n):Math.min(3.8,Math.sqrt(1+(13.6/(t+3.47))**2)),i=Yt/550,o=Math.max(i*1.48,t+1.65),s=Math.max(.02,r*r-1)*(1-i*i/(o*o));if(a.push({energyEv:o,dampingEv:t<3.4?.42:.06,deltaEps:Math.min(16,Math.max(.02,s)),label:`Valence→Cond UV (${o.toFixed(1)} eV)`}),t<3.35){let e=Math.max(.6,t+.35);a.push({energyEv:e,dampingEv:Math.max(.25,.22*t),deltaEps:Math.min(4,Math.max(.15,(3.4-t)*.6)),label:`Band-Edge (${e.toFixed(2)} eV)`})}}for(;a.length<4;)a.push({energyEv:10,dampingEv:1,deltaEps:0,label:`inactive`});let o=qt/Jt,s=r*o,c=i*o,l=n?(1-.5*c)/(1+.5*c):0,u=n?s*s/(1+.5*c):0,d=a.map(e=>{let t=e.energyEv*o,n=1.35/Math.sqrt(1+Math.max(0,e.deltaEps)),r=Math.min(t,n),i=e.dampingEv*o,a=1+.5*i;return{a:(1-.5*i)/a,b:r*r/a,c:e.deltaEps,active:+(e.deltaEps>1e-6),...e}}),f=[610,535,440,Math.max(380,Math.min(780,Number(t)||535))],p=f.map(e=>Yt/e*o);return Object.freeze({isMetal:n,plasmaEv:r,drudeGammaEv:i,kDrude:l,betaDrude:u,oscillators:Object.freeze(d),wavelengthsNm:Object.freeze(f),omegaDtChannels:Object.freeze(p),expectedIor550:Number(e?.refractiveIndex550Nm)||1,slabX0:64,slabX1:104,incidenceDeg:24})}function Qt(e){let t=Math.max(0,Math.min(1,Number(e)||0));return t<=.0031308?12.92*t:1.055*t**(1/2.4)-.055}function $t(e,t){let n=Yt/Math.max(200,t),r=1,i=0;if(e.isMetal&&e.plasmaEv>0){let t=e.plasmaEv*e.plasmaEv,a=n*n,o=n*e.drudeGammaEv,s=Math.max(1e-30,a*a+o*o);r-=t*a/s,i+=t*o/s}for(let t of e.oscillators){if(!(t.deltaEps>1e-6))continue;let e=t.deltaEps*t.energyEv*t.energyEv,a=t.energyEv*t.energyEv-n*n,o=-t.dampingEv*n,s=Math.max(1e-30,a*a+o*o);r+=e*a/s,i-=e*o/s}let a=Math.hypot(r,i),o=Math.sqrt(Math.max(0,.5*(a+r))),s=Math.sqrt(Math.max(0,.5*(a-r))),c=(o-1)*(o-1)+s*s,l=Math.max(1e-30,(o+1)*(o+1)+s*s);return{nRe:o,kIm:s,reflectance:Math.max(0,Math.min(1,c/l))}}var en=`
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
`,tn=new WeakMap;function nn(e){let t=tn.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-photon-shell-fdtd-2d-wgsl`,code:en}),r=e.createBindGroupLayout({label:`ulg-photon-shell-fdtd-2d-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`storage`}},{binding:2,visibility:4,buffer:{type:`storage`}},{binding:3,visibility:4,buffer:{type:`storage`}},{binding:4,visibility:4,buffer:{type:`storage`}},{binding:5,visibility:4,buffer:{type:`storage`}},{binding:6,visibility:4,buffer:{type:`storage`}},{binding:7,visibility:4,buffer:{type:`storage`}},{binding:8,visibility:4,buffer:{type:`storage`}}]}),i=e.createPipelineLayout({bindGroupLayouts:[r]});return t={bgl:r,stepHPipe:e.createComputePipeline({label:`ulg-fdtd2d-step-h`,layout:i,compute:{module:n,entryPoint:`fdtd2d_step_h`}}),stepEPipe:e.createComputePipeline({label:`ulg-fdtd2d-step-e`,layout:i,compute:{module:n,entryPoint:`fdtd2d_step_e_and_shells`}}),reducePipe:e.createComputePipeline({label:`ulg-fdtd2d-reduce`,layout:i,compute:{module:n,entryPoint:`fdtd2d_reduce_observables`}})},tn.set(e,t),t}function rn(e,t={},{probeWavelengthNm:n=535,pulseWidthSteps:r=34,pulseT0Steps:i=78}={}){if(!e||typeof e.createComputePipeline!=`function`)throw TypeError(`createPhotonShellOpticsSessionWebGpu requires a valid WebGPU GPUDevice.`);let{bgl:a,stepHPipe:o,stepEPipe:s,reducePipe:c}=nn(e),l=Wt*4,u=l*4,d=l*16,f=e.createBuffer({label:`ulg-fdtd2d-ez`,size:u,usage:V.STORAGE|V.COPY_DST|V.COPY_SRC}),p=e.createBuffer({label:`ulg-fdtd2d-hx`,size:u,usage:V.STORAGE|V.COPY_DST}),m=e.createBuffer({label:`ulg-fdtd2d-hy`,size:u,usage:V.STORAGE|V.COPY_DST}),h=e.createBuffer({label:`ulg-fdtd2d-jd`,size:u,usage:V.STORAGE|V.COPY_DST}),g=e.createBuffer({label:`ulg-fdtd2d-pcurr`,size:d,usage:V.STORAGE|V.COPY_DST}),_=e.createBuffer({label:`ulg-fdtd2d-pprev`,size:d,usage:V.STORAGE|V.COPY_DST}),v=e.createBuffer({label:`ulg-fdtd2d-shell`,size:d,usage:V.STORAGE|V.COPY_DST|V.COPY_SRC}),y=e.createBuffer({size:128,usage:V.STORAGE|V.COPY_DST|V.COPY_SRC}),b=e.createBuffer({size:128,usage:V.MAP_READ|V.COPY_DST}),x=Array.from({length:24},()=>e.createBuffer({size:144,usage:V.UNIFORM|V.COPY_DST})),S=x.map(t=>e.createBindGroup({layout:a,entries:[t,f,p,m,h,g,_,v,y].map((e,t)=>({binding:t,resource:{buffer:e}}))})),C=Zt(t,{probeWavelengthNm:n}),w=0,T=null,E=!1,D=new Float32Array(l),O=new Float32Array(l*4),k=new Float32Array(32),A=24*Math.PI/180,j=Math.sin(A),M=Math.cos(A);function N(t,n){let a=new ArrayBuffer(144),o=new Uint32Array(a),s=new Float32Array(a);o[0]=128,o[1]=128,o[2]=4,o[3]=n>>>0,o[4]=C.slabX0,o[5]=C.slabX1,o[6]=18,o[7]=42,o[8]=110,o[9]=36,o[10]=12,o[11]=0,s[12]=Kt,s[13]=C.kDrude,s[14]=C.betaDrude,s[15]=i,s[16]=r,s[17]=j,s[18]=M,s[19]=11.5;for(let e=0;e<4;e+=1)s[20+e]=C.omegaDtChannels[e],s[24+e]=C.oscillators[e].a,s[28+e]=C.oscillators[e].b,s[32+e]=C.oscillators[e].c;e.queue.writeBuffer(t,0,a)}function P(n=null,{nextProbeWavelengthNm:r=null}={}){(n||r!=null)&&(C=Zt(n||t,{probeWavelengthNm:r??C.wavelengthsNm[3]}),n&&(t=n)),w=0,e.queue.writeBuffer(f,0,D),e.queue.writeBuffer(p,0,D),e.queue.writeBuffer(m,0,D),e.queue.writeBuffer(h,0,D),e.queue.writeBuffer(g,0,O),e.queue.writeBuffer(_,0,O),e.queue.writeBuffer(v,0,O),e.queue.writeBuffer(y,0,k)}P();function F(t=4){let n=Math.max(1,Math.min(24,Math.trunc(t)));for(let e=0;e<n;e+=1)N(x[e],w+e);let r=Math.ceil(l/64),i=e.createCommandEncoder({label:`ulg-fdtd2d-batch`}),a=i.beginComputePass({label:`ulg-fdtd2d-pass`});for(let e=0;e<n;e+=1){let t=S[e];a.setPipeline(o),a.setBindGroup(0,t),a.dispatchWorkgroups(r),a.setPipeline(s),a.setBindGroup(0,t),a.dispatchWorkgroups(r),a.setPipeline(c),a.setBindGroup(0,t),a.dispatchWorkgroups(4)}a.end(),e.queue.submit([i.finish()]),w+=n}async function ee({nonBlocking:t=!1}={}){if(E)return null;if(T){if(t)return null;try{await T}catch{}if(E)return null}let n=(async()=>{if(E)return null;let t=e.createCommandEncoder({label:`ulg-fdtd2d-read-obs`});if(t.copyBufferToBuffer(y,0,b,0,128),e.queue.submit([t.finish()]),await b.mapAsync(V.MAP_READ),E){try{b.unmap()}catch{}return null}let n=new Float32Array(b.getMappedRange().slice(0,128));b.unmap();let r=[];for(let e=0;e<4;e+=1){let t=e*8,i=n[t+0],a=n[t+1],o=n[t+2],s=n[t+3],c=n[t+4],l=n[t+5],u=n[t+6],d=n[t+7],f=i>1e-4,p=f?Math.max(0,Math.min(1.1,a/i)):0,m=f?Math.max(0,Math.min(1.1,o/i)):0,h=f?Math.max(0,Math.min(1.1,s/i)):0,g=C.omegaDtChannels[e]/Kt,_=null;if(!C.isMetal&&c>.001&&l>1e-6&&g>1e-5){let e=Math.asin(Math.min(.99,Math.sqrt(l/c)))/g;Number.isFinite(e)&&e>=.95&&e<=5.5&&(_=e)}let v=null,y=null;if(!C.isMetal&&u>.001){let e=Math.atan2(Math.abs(d),u);if(y=e*180/Math.PI,e>.04){let t=j/Math.sin(e);Number.isFinite(t)&&t>=.95&&t<=5.5&&(v=t)}}let b=$t(C,C.wavelengthsNm[e]);r.push(Object.freeze({wavelengthNm:C.wavelengthsNm[e],photonEv:Yt/C.wavelengthsNm[e],fluxInc:i,fluxRef:a,fluxTr:o,fluxAbs:s,reflectance:p,transmittance:m,absorption:h,energyBalance:p+m+h,nPhaseFdtd:_,nSnellFdtd:v,refractAngleDeg:y,nMeasuredFdtd:_??v??null,analyticNRe:b.nRe,analyticKIm:b.kIm,analyticReflectance:b.reflectance}))}let i=Math.max(0,Math.min(1,r[0].reflectance)),a=Math.max(0,Math.min(1,r[1].reflectance)),o=Math.max(0,Math.min(1,r[2].reflectance)),s=[Qt(i),Qt(a),Qt(o)];return Object.freeze({schema:Ht,stepIndex:w,simTimeFs:w*qt*0x38d7ea4c68000,isMetal:C.isMetal,plasmaEv:C.plasmaEv,drudeGammaEv:C.drudeGammaEv,oscillators:C.oscillators,channels:Object.freeze(r),emergentReflectedSrgb:Object.freeze(s),analyticReflectedSrgb:Object.freeze([Qt(r[0].analyticReflectance),Qt(r[1].analyticReflectance),Qt(r[2].analyticReflectance)])})})();T=n;try{return await n}finally{T===n&&(T=null)}}async function te(e=16,{readObs:t=!0}={}){let n=Math.max(1,Math.trunc(e));for(;n>0;){let e=Math.min(24,n);F(e),n-=e}return t?ee({nonBlocking:!1}):null}function ne(){E=!0;for(let e of[f,p,m,h,g,_,v,y,b,...x])try{e.destroy()}catch{}}return Object.freeze({schema:Ht,nx:128,ny:128,nCells:Wt,nChannels:4,slabX0:64,slabX1:104,eFieldBuffer:f,ezFieldBuffer:f,hxFieldBuffer:p,hyFieldBuffer:m,shellPowerBuffer:v,shellStateBuffer:v,getParams:()=>C,getStepIndex:()=>w,reset:P,stepSync:F,stepBatch:te,readTelemetry:ee,destroy:ne})}var an=256,on=`
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
`,sn=new WeakMap;function cn(e){let t=sn.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-nuclear-tdse-wgsl`,code:on}),r=e.createBindGroupLayout({entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`storage`}},{binding:3,visibility:4,buffer:{type:`storage`}},{binding:4,visibility:4,buffer:{type:`storage`}}]}),i=e.createPipelineLayout({bindGroupLayouts:[r]});return t={bgl:r,stepRe:e.createComputePipeline({layout:i,compute:{module:n,entryPoint:`tdse_step_re`}}),stepIm:e.createComputePipeline({layout:i,compute:{module:n,entryPoint:`tdse_step_im`}})},sn.set(e,t),t}function ln(e,t){if(!e||typeof e.createComputePipeline!=`function`)return null;let{bgl:n,stepRe:r,stepIm:i}=cn(e),a=t?.alphaWkb,o=Array.isArray(a?.rFm)?a.rFm:Array.from({length:64},(e,t)=>t/63*45),s=Array.isArray(a?.vMeV)?a.vMeV:o.map(e=>e<6?-20:120/e),c=Math.max(24,Number(o[o.length-1])||45),l=Math.max(2.5,Number(a?.rTouchFm)||(t?.chargeRadiusFm||4)*1.35),u=c/(an-1),d=new Float32Array(an),f=new Float32Array(an),p=1;for(let e=0;e<an;e+=1){let t=e*u;d[e]=t;let n=t/c*(o.length-1),r=Math.max(0,Math.min(o.length-2,Math.floor(n))),i=Math.max(0,Math.min(1,n-r)),a=s[r]*(1-i)+s[r+1]*i;f[e]=a,a>p&&(p=a)}let m=Math.max(3.5,Math.min(p*.82,Number(t?.qAlphaMeV)>.5?Number(t.qAlphaMeV):p*.55)),h=197.32698*197.32698/(2*3727.38*u*u),g=4*h+Math.max(p,25),_=.35/Math.max(1,g),v=Math.max(4,Math.min(an-16,Math.round(l/u))),y=Math.min(an-12,v+24);for(let e=v+1;e<an-4;e+=1)if(f[e]<=m){y=e;break}let b=e.createBuffer({size:32,usage:V.UNIFORM|V.COPY_DST}),x=e.createBuffer({size:an*4,usage:V.STORAGE|V.COPY_DST}),S=e.createBuffer({size:an*4,usage:V.STORAGE|V.COPY_DST}),C=e.createBuffer({size:an*4,usage:V.STORAGE|V.COPY_DST}),w=e.createBuffer({size:an*4,usage:V.STORAGE|V.COPY_DST|V.COPY_SRC}),T=e.createBuffer({size:an*4,usage:V.MAP_READ|V.COPY_DST}),E=new ArrayBuffer(32);new Uint32Array(E,0,4).set([an,v,y,0]),new Float32Array(E,16,4).set([h,_,.88,.08]),e.queue.writeBuffer(b,0,E),e.queue.writeBuffer(x,0,f);let D=e.createBindGroup({layout:n,entries:[b,x,S,C,w].map((e,t)=>({binding:t,resource:{buffer:e}}))}),O=0,k=null,A=!1;function j(){O=0;let t=new Float32Array(an),n=new Float32Array(an),r=new Float32Array(an),i=Math.max(1.5,l*.52),a=Math.max(.85,l*.22),o=Math.sqrt(Math.max(.2,(m+18)/Math.max(1e-4,h*u*u))),s=0;for(let e=1;e<an-1;e+=1){let r=d[e],c=Math.exp(-.5*((r-i)/a)**2);t[e]=c*Math.cos(o*(r-i)),n[e]=c*Math.sin(o*(r-i)),s+=t[e]*t[e]+n[e]*n[e]}let c=1/Math.sqrt(Math.max(1e-12,s));for(let e=0;e<an;e+=1)t[e]*=c,n[e]*=c,r[e]=t[e]*t[e]+n[e]*n[e];e.queue.writeBuffer(S,0,t),e.queue.writeBuffer(C,0,n),e.queue.writeBuffer(w,0,r)}j();async function M(t=12,{nonBlocking:n=!1}={}){if(A)return null;if(k){if(n)return null;try{await k}catch{}if(A)return null}let a=(async()=>{if(A)return null;let n=Math.max(1,Math.min(64,Math.trunc(t))),a=Math.ceil(an/64),o=e.createCommandEncoder({label:`ulg-nuclear-tdse`}),s=o.beginComputePass();for(let e=0;e<n;e+=1)s.setPipeline(r),s.setBindGroup(0,D),s.dispatchWorkgroups(a),s.setPipeline(i),s.setBindGroup(0,D),s.dispatchWorkgroups(a);if(s.end(),o.copyBufferToBuffer(w,0,T,0,an*4),e.queue.submit([o.finish()]),O+=n,await T.mapAsync(V.MAP_READ),A){try{T.unmap()}catch{}return null}let c=new Float32Array(T.getMappedRange().slice(0,an*4));T.unmap();let u=0,p=0,h=0;for(let e=0;e<an;e+=1)e<=v?u+=c[e]:e<=y?p+=c[e]:h+=c[e];return Object.freeze({schema:Ut,stepCount:O,rGridFm:d,potRawMeV:f,prob:c,qEffMeV:m,rTouchFm:l,pInside:u,pBarrier:p,pTunneled:h})})();k=a;try{return await a}finally{k===a&&(k=null)}}function N(){A=!0;for(let e of[b,x,S,C,w,T])try{e.destroy()}catch{}}return Object.freeze({schema:Ut,rGridFm:d,potRawMeV:f,qEffMeV:m,resetWavepacket:j,stepBatch:M,destroy:N})}async function un({closureRegistry:e,materialKey:t=`unknown`,electromagnetic:n={},telemetry:r=null,closureId:i=null}={}){let a=Zt(n),o={closureId:i||`ulg-photon-shell-fdtd-optics:${t}.v1`,closureKind:`optical-photon-shell-fdtd-dispersion`,inputHash:`${t}:metal=${+!!a.isMetal}:wp=${a.plasmaEv.toFixed(3)}:osc=${a.oscillators.filter(e=>e.active).length}`,methodHash:`maxwell-2d-ade-fdtd-drude-lorentz-webgpu.v1`,execution:{mode:`webgpu-2d-maxwell-ade-fdtd`,params:a,measuredChannels:r?.channels??null,emergentReflectedSrgb:r?.emergentReflectedSrgb??null},validity:{wavelengthNm:[380,780],dxMeters:Gt,courant:Kt,incidenceDeg:24},provenance:{schema:Ht,sourceModule:`src/runtime/material/photonShellOpticsWebGpu.js`,scientificValidation:!1}};return{ref:e?await e.store(o):null,artifact:o}}function dn(e){return!e||typeof e.registerModule!=`function`?null:{opticsMod:e.registerModule({method:{model:`photon-shell-fdtd`,version:`1`},kernel:{sourceModule:`src/runtime/material/photonShellOpticsWebGpu.js`,entryPoint:`fdtd2d_step_e_and_shells`,workgroupSize:64,wgsl:en},parameterSchema:{steps:{type:`number`,min:1,max:4096},probeWavelengthNm:{type:`number`,min:380,max:780}},stateLayout:{tensorId:`fdtd2d_em_shell_fields`,dtype:`f32`,components:4},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`photon-shell-fdtd@1 requires a WebGPU device`);let r=e?.parameters||{},i=rn(n,r.electromagnetic||{},{probeWavelengthNm:r.probeWavelengthNm??535});try{return{status:`ok`,telemetry:await i.stepBatch(r.steps??280,{readObs:!0})}}finally{i.destroy()}}}),tdseMod:e.registerModule({method:{model:`nuclear-tunneling-tdse`,version:`1`},kernel:{sourceModule:`src/runtime/material/photonShellOpticsWebGpu.js`,entryPoint:`tdse_step_re`,workgroupSize:64,wgsl:on},parameterSchema:{steps:{type:`number`,min:1,max:2048}},stateLayout:{tensorId:`tdse_wavepacket_prob`,dtype:`f32`,components:1},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`nuclear-tunneling-tdse@1 requires a WebGPU device`);let r=e?.parameters||{},i=ln(n,r.nuclear||{});try{return{status:`ok`,telemetry:await i.stepBatch(r.steps??48)}}finally{i.destroy()}}})}}var fn=`ulg.magnetic.spin-lattice-llg-webgpu.v1`,pn=8617333262e-14,mn=5788381806e-14,hn=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128});function gn(e={},t={}){let n=String(e?.magneticPhase||`diamagnetic`),r=Math.max(4,Math.min(12,Number(t?.coordinationNumber)||6)),i=Number(e?.magneticMomentMuB)||0,a=Math.max(0,Number(e?.curieOrNeelTempK)||0),o=Number(e?.magneticSusceptibilitySi)||-1e-5,s=Number(e?.stonerProduct)||0,c=0,l=Math.max(.5,i),u=0,d=1;n===`ferromagnetic`?(c=.693*pn*Math.max(25,a||500),l=Math.max(.6,i||2),u=.08*c):n===`antiferromagnetic`?(c=-.693*pn*Math.max(25,a||180),l=Math.max(.6,i||1.2),u=.055*Math.abs(c)):n===`paramagnetic`?(c=0,l=Math.max(1,i||1.73),u=0):(c=0,l=.35,u=0,d=-1);let f=Math.max(.008,Math.abs(c),l*mn*5);return Object.freeze({magneticPhase:n,exchangeJEv:c,momentMuB:l,anisotropyEv:u,diamagneticSign:d,curieOrNeelTempK:a,stonerProduct:s,magneticSusceptibilitySi:o,coordinationNumber:r,refEnergyEv:f})}var _n=`
struct SpinParams {
  // x=nx, y=ny, z=nz, w=step_index
  dims: vec4<u32>,
  // x=j_over_eref, y=k_anis_over_eref, z=bz_mu_over_eref, w=temp_over_eref
  ham: vec4<f32>,
  // x=alpha_damping, y=dt_dimless, z=dia_sign (+1 or -1), w=collect_obs (0/1)
  ctrl: vec4<f32>,
};

@group(0) @binding(0) var<uniform> p: SpinParams;
// spins: vec4(sx, sy, sz, local_energy_norm)
@group(0) @binding(1) var<storage, read> spins_in: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> spins_out: array<vec4<f32>>;
// obs fixed-point atomic i32 (scale 1e4):
// [0]=sum_mx, [1]=sum_my, [2]=sum_mz, [3]=sum_stag_x, [4]=sum_stag_y, [5]=sum_stag_z,
// [6]=sum_energy, [7]=sum_domain_align
@group(0) @binding(3) var<storage, read_write> obs: array<atomic<i32>>;

fn hash_u32(v_in: u32) -> u32 {
  var v = v_in;
  v = v ^ (v >> 16u);
  v = v * 0x7feb352du;
  v = v ^ (v >> 15u);
  v = v * 0x846ca68bu;
  v = v ^ (v >> 16u);
  return v;
}

fn rand_normal_pair(seed0: u32, seed1: u32) -> vec2<f32> {
  let u1 = max(1.0e-5, f32(hash_u32(seed0) & 0x00ffffffu) / 16777216.0);
  let u2 = f32(hash_u32(seed1) & 0x00ffffffu) / 16777216.0;
  let r = sqrt(-2.0 * log(u1));
  let th = 6.283185307 * u2;
  return vec2<f32>(r * cos(th), r * sin(th));
}

fn idx3(x: u32, y: u32, z: u32) -> u32 {
  return (z * p.dims.y + y) * p.dims.x + x;
}

fn llg_rhs(s: vec3<f32>, h: vec3<f32>, alpha: f32) -> vec3<f32> {
  let sxh = cross(s, h);
  let sx_sxh = cross(s, sxh);
  return -(sxh + alpha * sx_sxh) / (1.0 + alpha * alpha);
}

@compute @workgroup_size(64)
fn reset_spin_obs(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x < 8u) {
    atomicStore(&obs[gid.x], 0);
  }
}

@compute @workgroup_size(64)
fn step_spin_llg(@builtin(global_invocation_id) gid: vec3<u32>) {
  let nx = p.dims.x;
  let ny = p.dims.y;
  let nz = p.dims.z;
  let n_tot = nx * ny * nz;
  let idx = gid.x;
  if (idx >= n_tot) { return; }

  let x = idx % nx;
  let y = (idx / nx) % ny;
  let z = idx / (nx * ny);

  let xm = (x + nx - 1u) % nx;
  let xp = (x + 1u) % nx;
  let ym = (y + ny - 1u) % ny;
  let yp = (y + 1u) % ny;
  let zm = (z + nz - 1u) % nz;
  let zp = (z + 1u) % nz;

  let s0 = normalize(spins_in[idx].xyz);
  let sum_nn =
    spins_in[idx3(xm, y, z)].xyz + spins_in[idx3(xp, y, z)].xyz +
    spins_in[idx3(x, ym, z)].xyz + spins_in[idx3(x, yp, z)].xyz +
    spins_in[idx3(x, y, zm)].xyz + spins_in[idx3(x, y, zp)].xyz;

  // Stochastic thermal Langevin field satisfying Fluctuation-Dissipation Theorem:
  //   Var(h_th) = 2 * alpha * (k_B T / E_ref) / dt
  let step_i = p.dims.w;
  let base_seed = ((idx + 1u) * 747796405u) ^ ((step_i + 1u) * 2891336453u);
  let g01 = rand_normal_pair(base_seed, base_seed + 17u);
  let g23 = rand_normal_pair(base_seed + 31u, base_seed + 53u);
  let alpha = p.ctrl.x;
  let dt = p.ctrl.y;
  let temp_norm = max(0.0, p.ham.w);
  let sigma_th = sqrt(max(0.0, (2.0 * alpha * temp_norm) / max(1.0e-4, dt)));
  let h_th = vec3<f32>(g01.x, g01.y, g23.x) * sigma_th;

  let j_n = p.ham.x;
  let k_anis = p.ham.y;
  // External Zeeman field along Z (+ 4.5-degree polycrystal canting so unstable collinear poles nucleate domain reversal!)
  let bz_eff = p.ham.z * p.ctrl.z;
  let b_vec = vec3<f32>(bz_eff * 0.08, 0.0, bz_eff);

  // Predictor-corrector (Heun) sLLG step preserving |s_i| = 1 strictly
  let h0 = j_n * sum_nn + b_vec + vec3<f32>(0.0, 0.0, 2.0 * k_anis * s0.z) + h_th;
  let k1 = llg_rhs(s0, h0, alpha);
  let s_pred = normalize(s0 + dt * k1);

  let h1 = j_n * sum_nn + b_vec + vec3<f32>(0.0, 0.0, 2.0 * k_anis * s_pred.z) + h_th;
  let k2 = llg_rhs(s_pred, h1, alpha);
  let s_next = normalize(s0 + 0.5 * dt * (k1 + k2));

  // Local dimensionless Heisenberg + Zeeman energy per spin
  let e_loc = -0.5 * j_n * dot(s_next, sum_nn) - dot(s_next, b_vec) - k_anis * s_next.z * s_next.z;
  let align = dot(s_next, sum_nn) / 6.0;
  spins_out[idx] = vec4<f32>(s_next, align);

  if (p.ctrl.w > 0.5) {
    let parity = select(-1.0, 1.0, ((x + y + z) & 1u) == 0u);
    atomicAdd(&obs[0], i32(clamp(s_next.x * 1.0e4, -2.0e6, 2.0e6)));
    atomicAdd(&obs[1], i32(clamp(s_next.y * 1.0e4, -2.0e6, 2.0e6)));
    atomicAdd(&obs[2], i32(clamp(s_next.z * 1.0e4, -2.0e6, 2.0e6)));
    atomicAdd(&obs[3], i32(clamp(s_next.x * parity * 1.0e4, -2.0e6, 2.0e6)));
    atomicAdd(&obs[4], i32(clamp(s_next.y * parity * 1.0e4, -2.0e6, 2.0e6)));
    atomicAdd(&obs[5], i32(clamp(s_next.z * parity * 1.0e4, -2.0e6, 2.0e6)));
    atomicAdd(&obs[6], i32(clamp(e_loc * 1.0e4, -2.0e7, 2.0e7)));
    atomicAdd(&obs[7], i32(clamp(align * 1.0e4, -2.0e6, 2.0e6)));
  }
}
`,vn=new WeakMap;function yn(e){let t=vn.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-spin-llg-wgsl`,code:_n}),r=e.createBindGroupLayout({label:`ulg-spin-llg-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`read-only-storage`}},{binding:2,visibility:4,buffer:{type:`storage`}},{binding:3,visibility:4,buffer:{type:`storage`}}]}),i=e.createPipelineLayout({bindGroupLayouts:[r]});return t={bgl:r,resetPipe:e.createComputePipeline({label:`ulg-spin-reset-obs`,layout:i,compute:{module:n,entryPoint:`reset_spin_obs`}}),stepPipe:e.createComputePipeline({label:`ulg-spin-step-llg`,layout:i,compute:{module:n,entryPoint:`step_spin_llg`}})},vn.set(e,t),t}function bn(e,t={},n={},{nx:r=10,ny:i=10,nz:a=10,temperatureK:o=300,fieldBZTesla:s=0,alphaDamping:c=.5,seed:l=1337}={}){if(!e||typeof e.createComputePipeline!=`function`)throw TypeError(`createSpinLatticeSessionWebGpu requires a valid WebGPU GPUDevice.`);let{bgl:u,resetPipe:d,stepPipe:f}=yn(e),p=gn(t,n),m=r*i*a,h=m*16,g=e.createBuffer({label:`ulg-spin-buf-a`,size:h,usage:hn.STORAGE|hn.COPY_DST|hn.COPY_SRC}),_=e.createBuffer({label:`ulg-spin-buf-b`,size:h,usage:hn.STORAGE|hn.COPY_DST|hn.COPY_SRC}),v=e.createBuffer({label:`ulg-spin-obs`,size:32,usage:hn.STORAGE|hn.COPY_SRC}),y=e.createBuffer({label:`ulg-spin-obs-read`,size:32,usage:hn.MAP_READ|hn.COPY_DST}),b=Array.from({length:24},()=>e.createBuffer({size:48,usage:hn.UNIFORM|hn.COPY_DST})),x=b.map(t=>e.createBindGroup({layout:u,entries:[{binding:0,resource:{buffer:t}},{binding:1,resource:{buffer:g}},{binding:2,resource:{buffer:_}},{binding:3,resource:{buffer:v}}]})),S=b.map(t=>e.createBindGroup({layout:u,entries:[{binding:0,resource:{buffer:t}},{binding:1,resource:{buffer:_}},{binding:2,resource:{buffer:g}},{binding:3,resource:{buffer:v}}]})),C=0,w=0,T=Math.max(1,Number(o)||300),E=Number(s)||0,D=null,O=!1;function k({orderedBias:t=0,initSeed:n=l}={}){let r=new Float32Array(m*4),i=n>>>0||1,a=()=>(i=Math.imul(1664525,i)+1013904223>>>0,i/4294967296);for(let e=0;e<m;e+=1){let n=2*a()-1+t,i=2*Math.PI*a(),o=Math.sqrt(Math.max(.01,1-Math.max(-.98,Math.min(.98,n))**2)),s=o*Math.cos(i),c=o*Math.sin(i),l=Math.max(-.99,Math.min(.99,n)),u=1/Math.hypot(s,c,l);r[e*4+0]=s*u,r[e*4+1]=c*u,r[e*4+2]=l*u,r[e*4+3]=0}e.queue.writeBuffer(g,0,r),e.queue.writeBuffer(_,0,r),C=0,w=0}k({orderedBias:p.magneticPhase===`ferromagnetic`?.35:0});function A(t,n,o){let s=p.refEnergyEv,l=p.exchangeJEv/s,u=p.anisotropyEv/s,d=p.magneticPhase===`ferromagnetic`||p.magneticPhase===`antiferromagnetic`?Math.max(mn*p.momentMuB,.62*Math.abs(p.exchangeJEv)):Math.max(mn*p.momentMuB*40,.004),f=E*d/s,m=pn*T/s,h=Math.max(1,6*Math.abs(l)+Math.abs(f)+2*Math.abs(u)),g=Math.min(.095,.26/h),_=new ArrayBuffer(48);new Uint32Array(_,0,4).set([r,i,a,n>>>0]),new Float32Array(_,16,4).set([l,u,f,m]),new Float32Array(_,32,4).set([c,g,p.diamagneticSign,+!!o]),e.queue.writeBuffer(t,0,_)}function j(t=8,{temperatureK:n=null,fieldBZTesla:r=null,collectObsOnLast:i=!1}={}){if(O)return;n!=null&&Number.isFinite(Number(n))&&(T=Math.max(1,Number(n))),r!=null&&Number.isFinite(Number(r))&&(E=Number(r));let a=Math.max(1,Math.min(24,Math.trunc(t)));for(let e=0;e<a;e+=1)A(b[e],w+e,i&&e===a-1);let o=Math.ceil(m/64),s=e.createCommandEncoder({label:`ulg-spin-llg-batch`}),c=s.beginComputePass({label:`ulg-spin-llg-pass`});for(let e=0;e<a;e+=1){let t=C===0?x[e]:S[e];i&&e===a-1&&(c.setPipeline(d),c.setBindGroup(0,t),c.dispatchWorkgroups(1)),c.setPipeline(f),c.setBindGroup(0,t),c.dispatchWorkgroups(o),C^=1}c.end(),e.queue.submit([s.finish()]),w+=a}async function M({nonBlocking:t=!1}={}){if(O)return null;if(D){if(t)return null;try{await D}catch{}if(O)return null}let n=(async()=>{if(O)return null;let t=e.createCommandEncoder({label:`ulg-spin-read-obs`});if(t.copyBufferToBuffer(v,0,y,0,32),e.queue.submit([t.finish()]),await y.mapAsync(hn.MAP_READ),O){try{y.unmap()}catch{}return null}let n=new Int32Array(y.getMappedRange().slice(0,32));y.unmap();let o=1/(m*1e4),s=n[0]*o,c=n[1]*o,l=n[2]*o,u=Math.hypot(s,c,l),d=n[3]*o,f=n[4]*o,h=n[5]*o,g=Math.hypot(d,f,h),_=n[6]*o*p.refEnergyEv,b=n[7]*o,x=p.diamagneticSign<0?l*Math.min(.25,Math.abs(E)*.04):l;return Object.freeze({schema:fn,stepIndex:w,spinCount:m,dims:Object.freeze([r,i,a]),magneticPhase:p.magneticPhase,temperatureK:T,fieldBZTesla:E,curieOrNeelTempK:p.curieOrNeelTempK,exchangeJEv:p.exchangeJEv,momentMuB:p.momentMuB,magnetizationVec:Object.freeze([s,c,x]),magnetizationZ:x,magnetizationMag:p.diamagneticSign<0?Math.abs(x):u,staggeredOrderMag:g,neighborAlign:b,energyPerSpinEv:_})})();D=n;try{return await n}finally{D===n&&(D=null)}}async function N(e=16,{temperatureK:t=null,fieldBZTesla:n=null,readObs:r=!0,nonBlocking:i=!1}={}){let a=Math.max(1,Math.trunc(e));for(;a>0;){let e=Math.min(24,a);j(e,{temperatureK:t,fieldBZTesla:n,collectObsOnLast:r&&a===e}),a-=e}return r?M({nonBlocking:i}):null}function P(){O=!0;for(let e of[g,_,v,y,...b])try{e.destroy()}catch{}}return Object.freeze({schema:fn,dims:Object.freeze([r,i,a]),spinCount:m,params:p,getActiveSpinsBuffer:()=>C===0?g:_,getStepIndex:()=>w,getTemperatureK:()=>T,getFieldBZTesla:()=>E,resetDomains:(e={})=>k(e),stepSync:j,stepBatch:N,readTelemetry:M,destroy:P})}async function xn({closureRegistry:e,materialKey:t=`unknown`,electromagnetic:n={},mechanical:r={},telemetry:i=null}={}){let a=gn(n,r),o={closureId:`ulg-spin-lattice-llg:${t}.v1`,closureKind:`magnetic-spin-lattice-llg`,inputHash:`${t}:phase=${a.magneticPhase}:J=${a.exchangeJEv.toFixed(5)}:mu=${a.momentMuB.toFixed(2)}`,methodHash:`stochastic-llg-heun-3d-webgpu.v1`,execution:{mode:`webgpu-3d-sllg`,params:a,telemetry:i},validity:{temperatureK:[1,1e4],fieldTesla:[-20,20]},provenance:{schema:fn,sourceModule:`src/runtime/material/spinLatticeMagnetismWebGpu.js`,scientificValidation:!1}};return{ref:e?await e.store(o):null,artifact:o}}function Sn(e){return!e||typeof e.registerModule!=`function`?null:e.registerModule({method:{model:`spin-lattice-llg`,version:`1`},kernel:{sourceModule:`src/runtime/material/spinLatticeMagnetismWebGpu.js`,entryPoint:`step_spin_llg`,workgroupSize:64,wgsl:_n},parameterSchema:{temperatureK:{type:`number`,min:1,max:1e4},fieldBZTesla:{type:`number`,min:-20,max:20},steps:{type:`number`,min:1,max:4096}},stateLayout:{tensorId:`spin_lattice_3d_unit_vectors`,dtype:`f32`,components:4},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`spin-lattice-llg@1 requires a WebGPU device`);let r=e?.parameters||{},i=bn(n,r.electromagnetic||{},r.mechanical||{},{temperatureK:r.temperatureK??300,fieldBZTesla:r.fieldBZTesla??0});try{return{status:`ok`,telemetry:await i.stepBatch(r.steps??64,{readObs:!0})}}finally{i.destroy()}}})}var Cn=`ulg.electromagnetic.electron-transport-webgpu.v1`,wn=1602176634e-28,Tn=91093837015e-41,En=1054571817e-43,Dn=1380649e-29,On=1602176634e-28,kn=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,UNIFORM:64,STORAGE:128});function An(e={},t={},{temperatureK:n=300,eFieldVPerM:r=1e4}={}){let i=Math.max(.5,Number(n)||300),a=!!e?.isMetal,o=Math.max(0,Number(e?.bandGapEv)||0),s=Math.max(25,Number(t?.debyeTemperatureK)||250),c=Math.max(0,Number(e?.superconductingTcK)||0),l=Math.max(.05,Number(e?.dosAtFermiStatesPerEvAtom)||.5),u=Math.max(0,Number(e?.plasmaEnergyEv)||(a?8.5:0)),d=Math.max(1e-18,Number(e?.electricalConductivitySPerM)||(a?1e7:1e-6)),f=u*On/En,p=a?Math.max(1e27,88541878128e-22*Tn*f*f/(wn*wn)):0,m=a?Math.max(.08,Math.min(1.8,.14+.16*l*(300/s))):.25,h=i/s,g=h>=.4?1:(h/.4)**4,_=2*Math.PI*m*Dn*i/En*g,v=2e11,y=a&&c>.05&&i<c,b=y?Math.max(.05,1-(i/c)**4):0,x=1,S=p;if(!a){let e=o*On,t=2*(Tn*Dn*i/(2*Math.PI*En*En))**1.5;S=Math.max(1e8,t*Math.exp(-e/(2*Dn*i)));let n=Math.exp(-o/Math.max(.06,8617333e-11*i*14));x=Math.max(0,Math.min(1,n))}let C=y?(1-b)*(_+v):_+v,w=y?0:Math.max(.004,Math.min(.65,C/0xec77f7a44000)),T=Math.min(.22,.018*Math.sqrt(i/Math.max(25,s))),E=d;if(y)E=1/0;else if(a)E=p*wn*wn/(Tn*Math.max(1e11,C));else{let e=.05*(300/Math.max(10,i))**1.5;E=Math.max(1e-18,S*wn*e)}return Object.freeze({isMetal:a,isSuperconducting:y,cooperFraction:b,bandGapEv:o,debyeTempK:s,superconductingTcK:c,temperatureK:i,eFieldVPerM:Number(r)||0,nCarrierM3:S,activeCarrierFraction:x,lambdaEp:m,totalScatterHz:C,scatterProbStep:w,phononVibAmp:T,analyticSigmaSPerM:E,analyticResistivityOhmM:y?0:1/Math.max(1e-20,E)})}var jn=`
struct TransportParams {
  // x=carrier_count, y=step_index, z=is_metal (0/1), w=collect_obs (0/1)
  counts: vec4<u32>,
  // x=e_accel (unit/step), y=scatter_prob, z=v_thermal, w=cooper_fraction
  phys: vec4<f32>,
  // x=active_carrier_frac, y=phonon_vib_amp, z=dt_step, w=0
  env: vec4<f32>,
};

@group(0) @binding(0) var<uniform> p: TransportParams;
// pos: xyz in [-1, 1]^3, w = carrier_type (-1 = electron, +1 = hole, -2 = Cooper pair, 0 = bound valence)
@group(0) @binding(1) var<storage, read_write> pos: array<vec4<f32>>;
// vel: vxyz (box-units/step), w = scatter_flash [0..1] (decays after phonon collision!)
@group(0) @binding(2) var<storage, read_write> vel: array<vec4<f32>>;
// obs fixed-point atomic i32 (scale 1e4):
// [0]=sum_jx (current density -q*vx), [1]=sum_speed, [2]=scatter_events, [3]=mobile_count, [4]=cooper_count
@group(0) @binding(3) var<storage, read_write> obs: array<atomic<i32>>;

fn hash_u32(v_in: u32) -> u32 {
  var v = v_in;
  v = v ^ (v >> 16u);
  v = v * 0x7feb352du;
  v = v ^ (v >> 15u);
  v = v * 0x846ca68bu;
  v = v ^ (v >> 16u);
  return v;
}

fn rand01(seed: u32) -> f32 {
  return f32(hash_u32(seed) & 0x00ffffffu) / 16777216.0;
}

@compute @workgroup_size(64)
fn reset_transport_obs(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x < 8u) {
    atomicStore(&obs[gid.x], 0);
  }
}

@compute @workgroup_size(64)
fn step_electron_transport(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let n = p.counts.x;
  if (i >= n) { return; }

  let step_i = p.counts.y;
  let seed = ((i + 1u) * 2654435761u) ^ ((step_i + 1u) * 2246822519u);
  let r0 = rand01(seed);
  let r1 = rand01(seed + 13u);
  let r2 = rand01(seed + 29u);
  let r3 = rand01(seed + 47u);

  var p4 = pos[i];
  var v4 = vel[i];
  let frac_i = (f32(i) + 0.5) / f32(n);

  // Classify carrier strictly from active physics (metal / superconductor / thermally activated semiconductor)
  var ctype = -1.0; // mobile conduction electron (q = -1)
  if (p.counts.z == 1u) {
    if (frac_i < p.phys.w) {
      ctype = -2.0; // superconducting Cooper pair (lossless condensate)
    } else {
      ctype = -1.0; // normal Drude electron
    }
  } else {
    if (frac_i < p.env.x) {
      // Equal electron (-1) and hole (+1) pairs excited across band gap E_g!
      ctype = select(1.0, -1.0, (i & 1u) == 0u);
    } else {
      ctype = 0.0; // bound valence electron oscillating near lattice site
    }
  }

  let dt = p.env.z;
  var flash = max(0.0, v4.w - 0.10);
  var scattered = 0i;

  if (ctype == 0.0) {
    // Bound valence state: damped thermal jitter around home lattice node, zero net drift
    let jitter = (vec3<f32>(r0, r1, r2) - 0.5) * 0.015 * max(0.1, p.env.y * 5.0);
    v4 = vec4<f32>(jitter, 0.0);
    p4 = vec4<f32>(p4.xyz, 0.0);
  } else if (ctype < -1.5) {
    // Superconducting Cooper pair: ballistic zero-scattering supercurrent along -E (capped at critical velocity v_c)
    let a_sc = -p.phys.x * 1.4;
    var vx = clamp(v4.x + a_sc * dt, -0.58, 0.58);
    // Smooth phase coherence: transverse thermal momentum damps to coherent condensate flow
    let vy = v4.y * 0.88;
    let vz = v4.z * 0.88;
    v4 = vec4<f32>(vx, vy, vz, 0.0);
    var np = p4.xyz + v4.xyz * dt;
    np = fract((np + 1.0) * 0.5) * 2.0 - 1.0;
    p4 = vec4<f32>(np, ctype);
  } else {
    // Normal Drude-Boltzmann carrier (electron q=-1 or hole q=+1): accelerate under E, scatter off phonons!
    let q_sign = select(-1.0, 1.0, ctype > 0.0);
    var v_new = v4.xyz + vec3<f32>(q_sign * p.phys.x * dt, 0.0, 0.0);
    // Soft Fermi/saturation ceiling keeps numeric velocity bounded under strong E
    v_new = clamp(v_new, vec3<f32>(-0.95), vec3<f32>(0.95));

    if (r0 < p.phys.y) {
      // Phonon scattering collision: randomize direction onto isotropic thermal sphere of radius v_thermal!
      let cos_t = 2.0 * r1 - 1.0;
      let sin_t = sqrt(max(0.0, 1.0 - cos_t * cos_t));
      let phi = 6.283185307 * r2;
      let v_mag = p.phys.z * (0.65 + 0.7 * r3);
      v_new = vec3<f32>(sin_t * cos(phi), sin_t * sin(phi), cos_t) * v_mag;
      flash = 1.0;
      scattered = 1i;
    }

    var np = p4.xyz + v_new * dt;
    np = fract((np + 1.0) * 0.5) * 2.0 - 1.0;
    p4 = vec4<f32>(np, ctype);
    v4 = vec4<f32>(v_new, flash);
  }

  pos[i] = p4;
  vel[i] = v4;

  if (p.counts.w != 0u) {
    if (ctype != 0.0) {
      let q_s = select(-1.0, 1.0, ctype > 0.0);
      // Electric current contribution J_x = q * v_x (electrons drift along -E => q*v_x > 0 for E > 0!)
      let jx = q_s * v4.x;
      atomicAdd(&obs[0], i32(clamp(jx * 1.0e4, -2.0e6, 2.0e6)));
      atomicAdd(&obs[1], i32(clamp(length(v4.xyz) * 1.0e4, 0.0, 2.0e6)));
      atomicAdd(&obs[2], scattered);
      atomicAdd(&obs[3], 1i);
      if (ctype < -1.5) { atomicAdd(&obs[4], 1i); }
    }
  }
}
`,Mn=new WeakMap;function Nn(e){let t=Mn.get(e);if(t)return t;let n=e.createShaderModule({label:`ulg-electron-transport-wgsl`,code:jn}),r=e.createBindGroupLayout({label:`ulg-electron-transport-bgl`,entries:[{binding:0,visibility:4,buffer:{type:`uniform`}},{binding:1,visibility:4,buffer:{type:`storage`}},{binding:2,visibility:4,buffer:{type:`storage`}},{binding:3,visibility:4,buffer:{type:`storage`}}]}),i=e.createPipelineLayout({bindGroupLayouts:[r]});return t={bgl:r,resetPipe:e.createComputePipeline({label:`ulg-tr-reset-obs`,layout:i,compute:{module:n,entryPoint:`reset_transport_obs`}}),stepPipe:e.createComputePipeline({label:`ulg-tr-step`,layout:i,compute:{module:n,entryPoint:`step_electron_transport`}})},Mn.set(e,t),t}function Pn(e,t={},n={},{carrierCount:r=1024,temperatureK:i=300,eFieldVPerM:a=1e4,seed:o=4242}={}){if(!e||typeof e.createComputePipeline!=`function`)throw TypeError(`createElectronTransportSessionWebGpu requires a valid WebGPU GPUDevice.`);let{bgl:s,resetPipe:c,stepPipe:l}=Nn(e),u=Math.max(64,Math.min(4096,Math.trunc(r))),d=u*16,f=e.createBuffer({label:`ulg-tr-pos`,size:d,usage:kn.STORAGE|kn.COPY_DST|kn.COPY_SRC}),p=e.createBuffer({label:`ulg-tr-vel`,size:d,usage:kn.STORAGE|kn.COPY_DST|kn.COPY_SRC}),m=e.createBuffer({label:`ulg-tr-obs`,size:32,usage:kn.STORAGE|kn.COPY_SRC}),h=e.createBuffer({label:`ulg-tr-obs-read`,size:32,usage:kn.MAP_READ|kn.COPY_DST}),g=Array.from({length:16},()=>e.createBuffer({size:48,usage:kn.UNIFORM|kn.COPY_DST})),_=g.map(t=>e.createBindGroup({layout:s,entries:[{binding:0,resource:{buffer:t}},{binding:1,resource:{buffer:f}},{binding:2,resource:{buffer:p}},{binding:3,resource:{buffer:m}}]})),v=Math.max(.5,Number(i)||300),y=Number(a)||1e4,b=An(t,n,{temperatureK:v,eFieldVPerM:y}),x=0,S=null,C=!1;function w(t=o){let n=new Float32Array(u*4),r=new Float32Array(u*4),i=t>>>0||1,a=()=>(i=Math.imul(1664525,i)+1013904223>>>0,i/4294967296);for(let e=0;e<u;e+=1)n[e*4+0]=a()*2-1,n[e*4+1]=a()*2-1,n[e*4+2]=a()*2-1,n[e*4+3]=b.isMetal?-1:0,r[e*4+0]=(a()-.5)*.25,r[e*4+1]=(a()-.5)*.25,r[e*4+2]=(a()-.5)*.25,r[e*4+3]=0;e.queue.writeBuffer(f,0,n),e.queue.writeBuffer(p,0,r),x=0}w();function T(t,n,r){let i=.16*Math.max(-2.5,Math.min(2.5,y/1e4)),a=Math.max(.05,Math.min(.45,.14*Math.sqrt(v/300))),o=new ArrayBuffer(48);new Uint32Array(o,0,4).set([u,n>>>0,+!!b.isMetal,+!!r]),new Float32Array(o,16,4).set([i,b.scatterProbStep,a,b.cooperFraction]),new Float32Array(o,32,4).set([b.activeCarrierFraction,b.phononVibAmp,.28,0]),e.queue.writeBuffer(t,0,o)}function E(r=4,{temperatureK:i=null,eFieldVPerM:a=null,collectObsOnLast:o=!1}={}){if(C)return;let s=!1;i!=null&&Number.isFinite(Number(i))&&(v=Math.max(.5,Number(i)),s=!0),a!=null&&Number.isFinite(Number(a))&&(y=Number(a),s=!0),s&&(b=An(t,n,{temperatureK:v,eFieldVPerM:y}));let d=Math.max(1,Math.min(16,Math.trunc(r)));for(let e=0;e<d;e+=1)T(g[e],x+e,o&&e===d-1);let f=Math.ceil(u/64),p=e.createCommandEncoder({label:`ulg-tr-batch`}),m=p.beginComputePass({label:`ulg-tr-pass`});for(let e=0;e<d;e+=1){let t=_[e];o&&e===d-1&&(m.setPipeline(c),m.setBindGroup(0,t),m.dispatchWorkgroups(1)),m.setPipeline(l),m.setBindGroup(0,t),m.dispatchWorkgroups(f)}m.end(),e.queue.submit([p.finish()]),x+=d}async function D({nonBlocking:t=!1}={}){if(C)return null;if(S){if(t)return null;try{await S}catch{}if(C)return null}let n=(async()=>{if(C)return null;let t=e.createCommandEncoder({label:`ulg-tr-read-obs`});if(t.copyBufferToBuffer(m,0,h,0,32),e.queue.submit([t.finish()]),await h.mapAsync(kn.MAP_READ),C){try{h.unmap()}catch{}return null}let n=new Int32Array(h.getMappedRange().slice(0,32));h.unmap();let r=Math.max(0,n[3]),i=Math.max(0,n[4]),a=Math.max(0,n[2]),o=r>0?n[0]/1e4/r:0,s=n[0]/1e4/u,c=r>0?n[1]/1e4/r:0,l=r>0?a/r:0,d=Math.max(.05,Math.abs(y/1e4)),f=Math.abs(s)/(d*.25),p=b.isSuperconducting?1/0:b.isMetal?Math.max(1e3,b.analyticSigmaSPerM*Math.max(.35,Math.min(2.2,f*1.4+.45))):b.analyticSigmaSPerM*(r>0?Math.max(.4,Math.min(2,f*3+.5)):1);return Object.freeze({schema:Cn,stepIndex:x,carrierCount:u,mobileCount:r,cooperCount:i,scatterEvents:a,temperatureK:v,eFieldVPerM:y,isMetal:b.isMetal,isSuperconducting:b.isSuperconducting,superconductingTcK:b.superconductingTcK,bandGapEv:b.bandGapEv,phononVibAmp:b.phononVibAmp,avgCurrentPerCarrier:o,meanDriftNorm:s,meanSpeedNorm:c,measuredScatterRateFrac:l,sigmaGpuSPerM:p,resistivityGpuOhmM:b.isSuperconducting?0:1/Math.max(1e-20,p),analyticSigmaSPerM:b.analyticSigmaSPerM})})();S=n;try{return await n}finally{S===n&&(S=null)}}async function O(e=12,{temperatureK:t=null,eFieldVPerM:n=null,readObs:r=!0,nonBlocking:i=!1}={}){let a=Math.max(1,Math.trunc(e));for(;a>0;){let e=Math.min(16,a);E(e,{temperatureK:t,eFieldVPerM:n,collectObsOnLast:r&&a===e}),a-=e}return r?D({nonBlocking:i}):null}function k(){C=!0;for(let e of[f,p,m,h,...g])try{e.destroy()}catch{}}return Object.freeze({schema:Cn,carrierCount:u,posBuffer:f,velBuffer:p,getParams:()=>b,getStepIndex:()=>x,resetCarriers:w,stepSync:E,stepBatch:O,readTelemetry:D,destroy:k})}async function Fn({closureRegistry:e,materialKey:t=`unknown`,electromagnetic:n={},mechanical:r={},telemetry:i=null}={}){let a=An(n,r),o={closureId:`ulg-electron-transport:${t}.v1`,closureKind:`electrical-drude-boltzmann-transport`,inputHash:`${t}:metal=${+!!a.isMetal}:Tc=${a.superconductingTcK.toFixed(2)}:Eg=${a.bandGapEv.toFixed(2)}`,methodHash:`drude-boltzmann-phonon-bcs-webgpu.v1`,execution:{mode:`webgpu-3d-electron-transport`,params:a,telemetry:i},validity:{temperatureK:[.5,5e3],eFieldVPerM:[-1e6,1e6]},provenance:{schema:Cn,sourceModule:`src/runtime/material/electronTransportWebGpu.js`,scientificValidation:!1}};return{ref:e?await e.store(o):null,artifact:o}}function In(e){return!e||typeof e.registerModule!=`function`?null:e.registerModule({method:{model:`electron-transport-gpu`,version:`1`},kernel:{sourceModule:`src/runtime/material/electronTransportWebGpu.js`,entryPoint:`step_electron_transport`,workgroupSize:64,wgsl:jn},parameterSchema:{temperatureK:{type:`number`,min:.5,max:5e3},eFieldVPerM:{type:`number`,min:-1e6,max:1e6},steps:{type:`number`,min:1,max:2048}},stateLayout:{tensorId:`electron_transport_carriers_3d`,dtype:`f32`,components:4},stepCapsule:async(e,t)=>{let n=t?.device;if(!n)throw Error(`electron-transport-gpu@1 requires a WebGPU device`);let r=e?.parameters||{},i=Pn(n,r.electromagnetic||{},r.mechanical||{},{temperatureK:r.temperatureK??300,eFieldVPerM:r.eFieldVPerM??1e4});try{return{status:`ok`,telemetry:await i.stepBatch(r.steps??48,{readObs:!0})}}finally{i.destroy()}}})}var H=Object.freeze({MAP_READ:1,COPY_SRC:4,COPY_DST:8,VERTEX:32,UNIFORM:64,STORAGE:128}),Ln=`
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
`,Rn=`
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
`,zn=`
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
`,Bn=`
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
  let inv_portrait = 1.0 / max(0.35, min(1.0, aspect));
  let ndc = vec2<f32>(in.uv.x * aspect, in.uv.y) * inv_portrait;
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
`,Vn=`
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
  let max_half = max(half_box.x, max(half_box.y, half_box.z));
  let p_norm = (pos4.xyz - half_box) / max_half;
  let view = world_to_view(p_norm);

  let aspect = u.resolution.x / max(1.0, u.resolution.y);
  let fov_scale = 1.65 * min(1.0, aspect);
  let rad = u.box_l.w * clamp(min(half_box.x, min(half_box.y, half_box.z)) / max_half, 0.42, 1.0);
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
  let half_box = max(vec3<f32>(0.5), u.box_l.xyz * 0.5);
  let max_half = max(half_box.x, max(half_box.y, half_box.z));
  let box_scale = half_box / max_half;
  let view = world_to_view(edges[vid] * box_scale);
  let aspect = u.resolution.x / max(1.0, u.resolution.y);
  let fov_scale = 1.65 * min(1.0, aspect);
  let cx = (view.x * fov_scale) / max(0.35, view.z * aspect);
  let cy = (view.y * fov_scale) / max(0.35, view.z);
  let depth_z = clamp((view.z - 0.35) / 8.0, 0.001, 0.999);
  return vec4<f32>(cx, cy, depth_z, 1.0);
}

@fragment
fn fs_wire() -> @location(0) vec4<f32> {
  return vec4<f32>(0.34, 0.76, 1.0, 0.32);
}
`,Hn=`
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
`,Un=`
struct OrbitalCloudUniforms {
  res_yaw_pitch: vec4<f32>, // (w, h, yaw, pitch)
  cam_style: vec4<f32>,     // (cam_dist, point_size, opacity, alt_shell_colors)
  color_a: vec4<f32>,       // (r, g, b, show_guides)
  color_b: vec4<f32>,       // (r, g, b, nuc_radius)
  stark: vec4<f32>,         // (stark_mix_lambda, e_field_norm, 0, 0)
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
  // First-order Stark perturbation dipolar cloud shift opposite to applied +X electric field:
  // outer valence shells polarize more strongly (~r^2) than tight core shells!
  let r2_pt = dot(pt.xyz, pt.xyz);
  let stark_lam = u.stark.x;
  let pos_eff = pt.xyz - vec3<f32>(stark_lam * (0.42 + 0.85 * min(1.8, r2_pt)), 0.0, 0.0);
  let view = project_pt(pos_eff);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.95 * min(1.0, aspect);
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
  var base_rgb = select(
    u.color_a.rgb,
    select(u.color_b.rgb, u.color_a.rgb, is_a),
    u.cam_style.w > 0.5
  );
  if (abs(stark_lam) > 0.01) {
    let pol_side = clamp(-pos_eff.x * sign(stark_lam) * 1.4, -1.0, 1.0);
    let pol_col = select(vec3<f32>(1.0, 0.55, 0.28), vec3<f32>(0.32, 0.88, 1.0), pol_side >= 0.0);
    base_rgb = mix(base_rgb, pol_col, min(0.55, abs(stark_lam) * 1.15) * abs(pol_side));
  }

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
  let fov = 1.95 * min(1.0, aspect);
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
  let fov = 1.95 * min(1.0, aspect);
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
`,Wn=`
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
  let fov = 1.85 * min(1.0, aspect);
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
  let fov = 1.85 * min(1.0, aspect);
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
`,Gn=`
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
  let fov = 1.92 * min(1.0, aspect);
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
  // Collimated optical beam waist around y = 0 so the incident photon packet travels
  // cleanly across the atom instead of washing the entire viewport in a flat wall!
  let beam_env_y = exp(-0.5 * (y / 0.36) * (y / 0.36));
  let c_vis = 0.56; // visual speed of light (world units / fs)
  let t_ret_inc = u.cam_time.y - x / c_vis;
  let dt_inc = t_ret_inc - u.cam_time.z;
  let env_inc = exp(-0.5 * (dt_inc / u.cam_time.w) * (dt_inc / u.cam_time.w)) * beam_env_y;

  // Angular radiation pattern of a Y-polarized oscillating quantum dipole d_y(t): sin(theta_y) = |x| / r
  let sin_dip = clamp(abs(x) / max(0.08, r), 0.14, 1.0);
  let r_falloff = smoothstep(0.18, 0.42, r) / (0.65 + r * 1.15);

  var col = vec3<f32>(0.0);

  // Subtle concentric distance reticle around the atom (fades smoothly to 0 well inside quad)
  let ring_d = smoothstep(0.009, 0.0, abs(fract(r * 1.5) - 0.5)) * 0.035 * exp(-0.5 * (r / 1.15) * (r / 1.15));
  col = col + vec3<f32>(0.24, 0.42, 0.68) * ring_d;

  if (u.wave_rgb.y > 0.5) {
    // Single-lambda coherent wavepacket + exact retarded Hertzian dipole re-radiation rings!
    let e_inc = env_inc * cos(u.wave_rgb.x * dt_inc);
    let e_rad = sample_retarded_dipole(3u, r) * sin_dip * r_falloff * 1.35;
    let e_tot = e_inc + e_rad;
    let crest = max(0.0, e_tot);
    let trough = max(0.0, -e_tot);
    let c_pos = u.probe_rgb.rgb;
    let c_neg = mix(u.probe_rgb.rgb * 0.32, vec3<f32>(0.18, 0.38, 0.82), 0.45);
    col = col + c_pos * crest * 0.42 + c_neg * trough * 0.24 + u.probe_rgb.rgb * abs(e_rad) * 0.38;
  } else {
    // Coherent white-light photon wavepacket + retarded dipole re-radiation rings:
    // Use one coherent group carrier for the incident white packet (eliminating artificial
    // R/G/B carrier-beating rainbow stripes!) while coloring the retarded dipole rings
    // strictly by the live emergent reflected/scattered spectrum (Gold vs Silver)!
    let carrier = cos(3.55 * dt_inc);
    let inc_wave = env_inc * (0.26 + 0.74 * abs(carrier));
    let trans_att = select(1.0, 0.48 + 0.52 * (1.0 - u.refl_srgb.w), x > 0.0);
    // Subtle physical blue-absorption shift downstream of the atom (x > 0)
    let inc_tint = vec3<f32>(0.92, 0.95, 1.0 * trans_att);
    let inc_rgb = inc_tint * inc_wave * 0.34;

    let rad_r = sample_retarded_dipole(0u, r);
    let rad_g = sample_retarded_dipole(1u, r);
    let rad_b = sample_retarded_dipole(2u, r);
    let rad_mag = (abs(rad_r) + abs(rad_g) + abs(rad_b)) * 0.3333 * sin_dip * r_falloff;
    let refl = max(u.refl_srgb.rgb, vec3<f32>(0.18));
    let sc_rgb = refl * (rad_mag * 1.15 + smoothstep(0.14, 0.68, rad_mag) * 0.32);

    col = col + inc_rgb + sc_rgb;
  }

  // Smooth elliptical Gaussian fade well inside quad bounds -> ZERO hard quad border at any orbit angle!
  let ell = (x / 1.65) * (x / 1.65) + (y / 1.05) * (y / 1.05);
  let vig = exp(-0.75 * ell) * smoothstep(2.05, 1.25, abs(x)) * smoothstep(1.38, 0.82, abs(y));
  let out_rgb = clamp(col * vig, vec3<f32>(0.0), vec3<f32>(0.92));
  return vec4<f32>(out_rgb, max(out_rgb.r, max(out_rgb.g, out_rgb.b)));
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
  let fov = 1.92 * min(1.0, aspect);
  let inv_z = 1.0 / max(0.3, view.z);

  let min_px = 1.0 / max(1.0, u.res_yaw_pitch.y);
  let world_r = clamp(u.probe_rgb.w * 0.56 * fov * inv_z, min_px * 1.15, 0.0155);

  // Color decomposition strictly by quantum-mechanical contribution at this 3D point:
  //   Ground shell (phi_0^2): MoonLab crisp white / royal violet (#FFFFFF / #612BDE)
  //   Dipole interference (+cross / -cross): electric cyan / warm amber polarization shift
  //   Excited shell population (rho_11 * phi_1^2): radiant resonant gold-magenta bloom!
  let base_gnd = select(vec3<f32>(0.44, 0.24, 0.96), vec3<f32>(0.95, 0.97, 1.0), amp4.w >= 0.0);
  let exc_col = vec3<f32>(1.0, 0.78, 0.24); // Radiant resonant excitation gold
  let dip_col = select(vec3<f32>(0.30, 0.82, 1.0), vec3<f32>(0.98, 0.50, 0.84), cross >= 0.0);

  let gnd_frac = (rho00 * p0_sq) / max(1e-4, prob_w);
  let exc_frac = (rho11 * p1_sq) / max(1e-4, prob_w);
  let dip_frac = clamp(abs(cross) / max(1e-4, prob_w), 0.0, 0.85);

  var rgb = base_gnd * clamp(gnd_frac, 0.0, 1.0) + exc_col * clamp(exc_frac * 1.35, 0.0, 1.05);
  rgb = mix(rgb, dip_col, dip_frac * 0.62);
  let shade = clamp(0.92 - 0.28 * pos4.w, 0.34, 0.96);
  // Crisp MoonLab additive exposure (bright jewel-like orbital lobes without white core saturation!)
  let alpha = clamp(0.025 * sqrt(prob_w), 0.0, 0.095);

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
  if (in.color.a <= 0.001) { discard; }
  let r2 = dot(in.local_uv, in.local_uv);
  if (r2 > 1.0) { discard; }
  let soft = exp(-r2 * 3.4) * (1.0 - r2);
  let a = in.color.a * soft;
  return vec4<f32>(in.color.rgb * a, a);
}
`,Kn=`
struct SpinSceneUniforms {
  res_yaw_pitch: vec4<f32>, // (w, h, yaw, pitch)
  dims_cam: vec4<f32>,      // (nx, ny, nz, cam_dist)
  field_meta: vec4<f32>,    // (bz_tesla, is_afm, arrow_scale, 0)
};

@group(0) @binding(0) var<uniform> u: SpinSceneUniforms;
@group(0) @binding(1) var<storage, read> spins: array<vec4<f32>>;

struct SpinArrowOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) color: vec3<f32>,
  @location(1) shade: f32,
};

fn project_spin(p: vec3<f32>) -> vec3<f32> {
  let cy = cos(u.res_yaw_pitch.z); let sy = sin(u.res_yaw_pitch.z);
  let cp = cos(u.res_yaw_pitch.w); let sp = sin(u.res_yaw_pitch.w);
  let x1 = p.x * cy - p.z * sy;
  let z1 = p.x * sy + p.z * cy;
  let y2 = p.y * cp - z1 * sp;
  let z2 = p.y * sp + z1 * cp + u.dims_cam.w;
  return vec3<f32>(x1, y2, z2);
}

@vertex
fn vs_spin_arrow(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> SpinArrowOut {
  let nx = u32(max(1.0, u.dims_cam.x));
  let ny = u32(max(1.0, u.dims_cam.y));
  let nz = u32(max(1.0, u.dims_cam.z));
  let n_tot = nx * ny * nz;

  // Last instance (iid == n_tot) renders a large translucent external B_z field indicator beside the lattice!
  var center = vec3<f32>(0.0);
  var dir = vec3<f32>(0.0, 1.0, 0.0);
  var arrow_len = u.field_meta.z;
  var arrow_w = arrow_len * 0.28;
  var col = vec3<f32>(1.0, 0.85, 0.35);

  if (iid < n_tot) {
    let ix = iid % nx;
    let iy = (iid / nx) % ny;
    let iz = iid / (nx * ny);
    let fx = (f32(ix) / max(1.0, f32(nx - 1u))) * 2.0 - 1.0;
    let fy = (f32(iy) / max(1.0, f32(ny - 1u))) * 2.0 - 1.0;
    let fz = (f32(iz) / max(1.0, f32(nz - 1u))) * 2.0 - 1.0;
    center = vec3<f32>(fx, fz, fy) * 0.92; // Map physical magnetic z-axis UP onto world Y!
    let s4 = spins[iid];
    // Map spin (sx, sy, sz) -> world (sx, sz, sy) so +z magnetization points cleanly UP!
    dir = normalize(vec3<f32>(s4.x, s4.z, s4.y) + vec3<f32>(1e-5, 0.0, 0.0));
    let sz = clamp(s4.z, -1.0, 1.0);
    // Color by spin z-projection: -1 deep sapphire blue -> 0 emerald teal -> +1 radiant solar gold/crimson!
    let c_down = vec3<f32>(0.22, 0.50, 1.0);
    let c_mid = vec3<f32>(0.20, 0.88, 0.68);
    let c_up = vec3<f32>(1.0, 0.72, 0.22);
    col = select(mix(c_down, c_mid, sz + 1.0), mix(c_mid, c_up, sz), sz >= 0.0);
  } else {
    // External applied B_z field indicator on the right margin of the lattice
    let bz = u.field_meta.x;
    center = vec3<f32>(1.30, 0.0, 0.0);
    dir = vec3<f32>(0.0, select(-1.0, 1.0, bz >= 0.0), 0.0);
    arrow_len = clamp(abs(bz) * 0.14, 0.0, 0.65);
    arrow_w = select(0.0, 0.085, arrow_len > 0.02);
    col = select(vec3<f32>(0.35, 0.72, 1.0), vec3<f32>(1.0, 0.90, 0.35), bz >= 0.0);
  }

  // 2D camera-facing billboard arrow aligned strictly along the projected 3D spin direction!
  let view_c = project_spin(center);
  let view_tip = project_spin(center + dir * arrow_len);
  let view_tail = project_spin(center - dir * (arrow_len * 0.45));
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.90 * min(1.0, aspect);

  let inv_z_c = 1.0 / max(0.35, view_c.z);
  let p_tip = vec2<f32>(view_tip.x * fov / (max(0.35, view_tip.z) * aspect), view_tip.y * fov / max(0.35, view_tip.z));
  let p_tail = vec2<f32>(view_tail.x * fov / (max(0.35, view_tail.z) * aspect), view_tail.y * fov / max(0.35, view_tail.z));
  let axis_2d = p_tip - p_tail;
  let axis_len = max(0.008, length(axis_2d));
  let fwd = axis_2d / axis_len;
  let perp = vec2<f32>(-fwd.y / aspect, fwd.x * aspect);
  let perp_n = normalize(perp);

  // 9 vertices = 3 triangles: shaft quad (6 verts) + arrowhead triangle (3 verts)
  var local = array<vec2<f32>, 9>(
    vec2<f32>(0.0, -0.26), vec2<f32>(0.62, -0.26), vec2<f32>(0.62,  0.26),
    vec2<f32>(0.0, -0.26), vec2<f32>(0.62,  0.26), vec2<f32>(0.0,   0.26),
    vec2<f32>(0.54, -0.78), vec2<f32>(1.00,  0.00), vec2<f32>(0.54,  0.78)
  );
  let lv = local[vid];
  let half_w = arrow_w * fov * inv_z_c;
  let ndc = p_tail + fwd * (lv.x * axis_len) + vec2<f32>(perp_n.x / aspect, perp_n.y) * (lv.y * half_w);
  let depth_z = clamp((view_c.z - 0.35) / 8.0, 0.001, 0.999);

  var out: SpinArrowOut;
  out.clip_pos = vec4<f32>(ndc.x, ndc.y, depth_z, 1.0);
  out.color = col;
  out.shade = 0.55 + 0.45 * lv.x;
  return out;
}

@fragment
fn fs_spin_arrow(in: SpinArrowOut) -> @location(0) vec4<f32> {
  return vec4<f32>(in.color * in.shade, 1.0);
}
`,qn=`
struct TransportSceneUniforms {
  res_yaw_pitch: vec4<f32>, // (w, h, yaw, pitch)
  cam_env: vec4<f32>,       // (cam_dist, phonon_vib_amp, time_s, is_superconducting)
  field_meta: vec4<f32>,    // (e_field_norm, carrier_count, 0, 0)
};

@group(0) @binding(0) var<uniform> u: TransportSceneUniforms;
@group(0) @binding(1) var<storage, read> c_pos: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> c_vel: array<vec4<f32>>;

struct TrPtOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) local_uv: vec2<f32>,
  @location(1) color: vec4<f32>,
};

fn project_tr(p: vec3<f32>) -> vec3<f32> {
  let cy = cos(u.res_yaw_pitch.z); let sy = sin(u.res_yaw_pitch.z);
  let cp = cos(u.res_yaw_pitch.w); let sp = sin(u.res_yaw_pitch.w);
  let x1 = p.x * cy - p.z * sy;
  let z1 = p.x * sy + p.z * cy;
  let y2 = p.y * cp - z1 * sp;
  let z2 = p.y * sp + z1 * cp + u.cam_env.x;
  return vec3<f32>(x1, y2, z2);
}

// Pass 1: 4x4x4 = 64 vibrating crystal ion cores oscillating with Debye phonon amplitude!
@vertex
fn vs_phonon_ions(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> TrPtOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let corner = quad[vid];
  let ix = iid % 4u;
  let iy = (iid / 4u) % 4u;
  let iz = iid / 16u;
  var p = (vec3<f32>(f32(ix), f32(iy), f32(iz)) / 3.0) * 1.72 - 0.86;
  // Acoustic phonon displacement wave driven by exact bundle thermal phonon amplitude!
  let ph = u.cam_env.z * 7.5 + f32(ix) * 1.3 + f32(iy) * 1.7 + f32(iz) * 2.1;
  let amp = u.cam_env.y * 0.42;
  p = p + vec3<f32>(sin(ph), cos(ph * 1.13), sin(ph * 0.87 + 1.0)) * amp;

  let view = project_tr(p);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.90 * min(1.0, aspect);
  let inv_z = 1.0 / max(0.35, view.z);
  let r = 0.048 * fov * inv_z;
  let col = select(vec3<f32>(0.28, 0.42, 0.62), vec3<f32>(0.36, 0.72, 0.88), u.cam_env.w > 0.5);

  var out: TrPtOut;
  out.clip_pos = vec4<f32>(
    view.x * fov * inv_z / aspect + corner.x * r / aspect,
    view.y * fov * inv_z + corner.y * r,
    0.55, 1.0
  );
  out.local_uv = corner;
  out.color = vec4<f32>(col, 0.45);
  return out;
}

// Pass 2: Streaming conduction electrons, holes, Cooper pairs & red phonon scattering flashes!
@vertex
fn vs_carriers(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32
) -> TrPtOut {
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  let corner = quad[vid];
  let p4 = c_pos[iid];
  let v4 = c_vel[iid];
  let ctype = p4.w;
  let flash = clamp(v4.w, 0.0, 1.0);

  let p_w = p4.xyz * 0.96;
  let view = project_tr(p_w);
  let aspect = u.res_yaw_pitch.x / max(1.0, u.res_yaw_pitch.y);
  let fov = 1.90 * min(1.0, aspect);
  let inv_z = 1.0 / max(0.35, view.z);

  // Elongate moving carriers along velocity vector so drift vs random thermal motion is visually unmistakable!
  let view_tip = project_tr(p_w + v4.xyz * 0.24);
  let inv_zt = 1.0 / max(0.35, view_tip.z);
  let p0_2d = vec2<f32>(view.x * fov * inv_z / aspect, view.y * fov * inv_z);
  let p1_2d = vec2<f32>(view_tip.x * fov * inv_zt / aspect, view_tip.y * fov * inv_zt);
  let dv_2d = p1_2d - p0_2d;
  let dv_len = length(dv_2d);
  let fwd = select(vec2<f32>(1.0, 0.0), dv_2d / max(1e-5, dv_len), dv_len > 0.002);
  let perp = normalize(vec2<f32>(-fwd.y / aspect, fwd.x * aspect));

  let base_r = select(0.022, 0.032, ctype < -1.5) * fov * inv_z;
  let stretch = select(1.0, clamp(1.0 + dv_len / max(0.008, base_r), 1.0, 4.5), ctype != 0.0);
  let rad_x = base_r * stretch + flash * base_r * 1.4;
  let rad_y = base_r * (1.0 + flash * 1.2);
  let offset = fwd * (corner.x * rad_x) + vec2<f32>(perp.x / aspect, perp.y) * (corner.y * rad_y);

  var col = vec3<f32>(0.24, 0.84, 1.0); // normal electron: electric cyan
  var alpha = 0.78;
  if (ctype == 0.0) {
    col = vec3<f32>(0.42, 0.30, 0.65); // bound valence state: subtle violet
    alpha = 0.24;
  } else if (ctype > 0.5) {
    col = vec3<f32>(1.0, 0.38, 0.76); // thermally activated hole (+): radiant magenta
    alpha = 0.85;
  } else if (ctype < -1.5) {
    col = vec3<f32>(1.0, 0.86, 0.34); // superconducting Cooper pair: radiant gold!
    alpha = 0.92;
  }
  // Phonon scattering burst highlights collision site in bright orange-red!
  col = mix(col, vec3<f32>(1.0, 0.34, 0.14), flash * 0.90);

  var out: TrPtOut;
  out.clip_pos = vec4<f32>(p0_2d.x + offset.x, p0_2d.y + offset.y, 0.45, 1.0);
  out.local_uv = corner;
  out.color = vec4<f32>(col, alpha);
  return out;
}

@fragment
fn fs_tr_dot(in: TrPtOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.local_uv, in.local_uv);
  if (r2 > 1.0) { discard; }
  let soft = exp(-r2 * 2.8) * (1.0 - r2);
  let a = in.color.a * soft;
  return vec4<f32>(in.color.rgb * a, a);
}
`;function Jn(e,t){let n=t.getContext(`webgpu`);if(!n)throw Error(`Failed to acquire WebGPU canvas context on #gpu-canvas`);let r=navigator.gpu.getPreferredCanvasFormat(),i=Math.max(2048,Number(e.limits?.maxTextureDimension2D)||4096),a=0,o=0;function s(s,c){let l=Math.max(64,Math.min(i,Math.trunc(s))),u=Math.max(64,Math.min(i,Math.trunc(c)));t.width=l,t.height=u;let d=[{device:e,format:r,alphaMode:`opaque`,usage:17},{device:e,format:r,alphaMode:`opaque`},{device:e,format:r,alphaMode:`premultiplied`}],f=!1,p=null;for(let e of d)try{n.configure(e),f=!0;break}catch(e){p=e}if(!f&&p)throw p;a=l,o=u}let c=t.getBoundingClientRect(),l=typeof window<`u`&&(window.innerWidth<1120||window.matchMedia?.(`(pointer: coarse)`)?.matches),u=Math.min(typeof window<`u`&&window.devicePixelRatio||1,l?1.5:2);s(Math.max(64,Math.round((c.width||t.clientWidth||640)*u)),Math.max(64,Math.round((c.height||t.clientHeight||480)*u)));let d=e.createShaderModule({code:zn,label:`ulg-lab-atomic-vol-cs`}),f=e.createComputePipeline({label:`ulg-lab-atomic-vol-pipe`,layout:`auto`,compute:{module:d,entryPoint:`build_atomic_volume`}}),p=e.createShaderModule({code:Bn,label:`ulg-lab-vol-raymarch`}),m=e.createRenderPipeline({label:`ulg-lab-vol-raymarch-pipe`,layout:`auto`,vertex:{module:p,entryPoint:`vs_fullscreen`},fragment:{module:p,entryPoint:`fs_raymarch`,targets:[{format:r}]},primitive:{topology:`triangle-list`}}),h=e.createShaderModule({code:Vn,label:`ulg-lab-instanced-atoms`}),g=e.createRenderPipeline({label:`ulg-lab-instanced-atoms-pipe`,layout:`auto`,vertex:{module:h,entryPoint:`vs_atom`},fragment:{module:h,entryPoint:`fs_atom`,targets:[{format:r}]},primitive:{topology:`triangle-list`},depthStencil:{format:`depth24plus`,depthWriteEnabled:!0,depthCompare:`less`}}),_=e.createRenderPipeline({label:`ulg-lab-md-wireframe-pipe`,layout:`auto`,vertex:{module:h,entryPoint:`vs_wire`},fragment:{module:h,entryPoint:`fs_wire`,targets:[{format:r,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`line-list`},depthStencil:{format:`depth24plus`,depthWriteEnabled:!1,depthCompare:`less`}}),v=e.createShaderModule({code:Hn,label:`ulg-lab-polytope-shader`}),y=e.createRenderPipeline({label:`ulg-lab-polytope-pipe`,layout:`auto`,vertex:{module:v,entryPoint:`vs_poly`},fragment:{module:v,entryPoint:`fs_poly`,targets:[{format:r}]},primitive:{topology:`triangle-list`}}),b=e.createShaderModule({code:Ln,label:`ulg-lab-comp-nuc-cs`}),x=e.createComputePipeline({label:`ulg-lab-comp-nuc-pipe`,layout:`auto`,compute:{module:b,entryPoint:`build_composite_nuclear_volume`}}),S=e.createShaderModule({code:Rn,label:`ulg-lab-poly-probe-cs`}),C=e.createComputePipeline({label:`ulg-lab-poly-probe-pipe`,layout:`auto`,compute:{module:S,entryPoint:`probe_polytope_point`}}),w={color:{srcFactor:`one`,dstFactor:`one`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one`,operation:`add`}},T={color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}},E=e.createShaderModule({code:Un,label:`ulg-lab-orbital-cloud`}),D=e.createRenderPipeline({label:`ulg-lab-orbital-cloud-pipe`,layout:`auto`,vertex:{module:E,entryPoint:`vs_cloud`},fragment:{module:E,entryPoint:`fs_cloud`,targets:[{format:r,blend:w}]},primitive:{topology:`triangle-list`}}),O=e.createRenderPipeline({label:`ulg-lab-orbital-nuc-pipe`,layout:`auto`,vertex:{module:E,entryPoint:`vs_nucleus`},fragment:{module:E,entryPoint:`fs_nucleus`,targets:[{format:r,blend:w}]},primitive:{topology:`triangle-list`}}),k=e.createRenderPipeline({label:`ulg-lab-orbital-guides-pipe`,layout:`auto`,vertex:{module:E,entryPoint:`vs_guides`},fragment:{module:E,entryPoint:`fs_guides`,targets:[{format:r,blend:T}]},primitive:{topology:`line-list`}}),A=e.createShaderModule({code:Wn,label:`ulg-lab-photon-shell-scene`}),j=e.createRenderPipeline({label:`ulg-lab-ps-wave-plane-pipe`,layout:`auto`,vertex:{module:A,entryPoint:`vs_wave_plane`},fragment:{module:A,entryPoint:`fs_wave_plane`,targets:[{format:r}]},primitive:{topology:`triangle-list`}}),M=e.createRenderPipeline({label:`ulg-lab-ps-shells-pipe`,layout:`auto`,vertex:{module:A,entryPoint:`vs_driven_shells`},fragment:{module:A,entryPoint:`fs_shell_dot`,targets:[{format:r,blend:w}]},primitive:{topology:`triangle-list`}}),N=e.createBuffer({size:80,usage:H.UNIFORM|H.COPY_DST}),P=e.createBuffer({size:80,usage:H.UNIFORM|H.COPY_DST}),F=e.createBuffer({size:256,usage:H.STORAGE|H.COPY_DST}),ee=e.createBuffer({size:256,usage:H.STORAGE|H.COPY_DST}),te=e.createShaderModule({code:Kn,label:`ulg-lab-spin-llg-render`}),ne=e.createRenderPipeline({label:`ulg-lab-spin-arrow-pipe`,layout:`auto`,vertex:{module:te,entryPoint:`vs_spin_arrow`},fragment:{module:te,entryPoint:`fs_spin_arrow`,targets:[{format:r}]},primitive:{topology:`triangle-list`},depthStencil:{format:`depth24plus`,depthWriteEnabled:!0,depthCompare:`less`}}),re=e.createBuffer({size:48,usage:H.UNIFORM|H.COPY_DST}),I=e.createShaderModule({code:qn,label:`ulg-lab-electron-tr-render`}),ie=e.createRenderPipeline({label:`ulg-lab-tr-ions-pipe`,layout:`auto`,vertex:{module:I,entryPoint:`vs_phonon_ions`},fragment:{module:I,entryPoint:`fs_tr_dot`,targets:[{format:r,blend:w}]},primitive:{topology:`triangle-list`}}),ae=e.createRenderPipeline({label:`ulg-lab-tr-carriers-pipe`,layout:`auto`,vertex:{module:I,entryPoint:`vs_carriers`},fragment:{module:I,entryPoint:`fs_tr_dot`,targets:[{format:r,blend:w}]},primitive:{topology:`triangle-list`}}),oe=e.createBuffer({size:48,usage:H.UNIFORM|H.COPY_DST}),se=e.createShaderModule({code:Gn,label:`ulg-lab-tdks-photon-cloud`}),ce=e.createRenderPipeline({label:`ulg-lab-tdks-field-pipe`,layout:`auto`,vertex:{module:se,entryPoint:`vs_tdks_field`},fragment:{module:se,entryPoint:`fs_tdks_field`,targets:[{format:r,blend:w}]},primitive:{topology:`triangle-list`}}),le=e.createRenderPipeline({label:`ulg-lab-tdks-cloud-pipe`,layout:`auto`,vertex:{module:se,entryPoint:`vs_tdks_cloud`},fragment:{module:se,entryPoint:`fs_tdks_cloud`,targets:[{format:r,blend:w}]},primitive:{topology:`triangle-list`}}),ue=e.createBuffer({size:96,usage:H.UNIFORM|H.COPY_DST}),L=e.createBuffer({size:512*4,usage:H.STORAGE|H.COPY_DST}),R=e.createBuffer({size:48,usage:H.UNIFORM|H.COPY_DST}),de=e.createBuffer({size:48,usage:H.UNIFORM|H.COPY_DST}),fe=e.createBuffer({size:32,usage:H.UNIFORM|H.COPY_DST}),pe=e.createBuffer({size:16,usage:H.UNIFORM|H.COPY_DST}),me=e.createBuffer({size:16,usage:H.STORAGE|H.COPY_SRC}),z=e.createBuffer({size:16,usage:H.MAP_READ|H.COPY_DST}),he=e.createBuffer({size:16,usage:H.UNIFORM|H.COPY_DST}),ge=null,_e=0,ve=!1,ye=e.createBuffer({size:16,usage:H.STORAGE|H.COPY_DST}),be=e.createBuffer({size:16,usage:H.STORAGE|H.COPY_DST}),xe=null,Se=0,Ce=0,we=null,Te=0,Ee=null,De=0,Oe=null,B=0,ke=null,Ae=0,je=null,Me=0,Ne=null,Pe=0,Fe=e.createBuffer({size:32,usage:H.UNIFORM|H.COPY_DST}),Ie=null,Le=0,Re=null,ze=0,Be=null,Ve=null,He=null,Ue=null;function We(){let n=t.getBoundingClientRect();if(n.width<2||n.height<2)return{w:a||320,h:o||240};let r=typeof window<`u`&&(window.innerWidth<1120||window.matchMedia?.(`(pointer: coarse)`)?.matches),c=Math.min(typeof window<`u`&&window.devicePixelRatio||1,r?1.5:2),l=Math.max(64,Math.min(i,Math.round(n.width*c))),u=Math.max(64,Math.min(i,Math.round(n.height*c)));return(t.width!==l||t.height!==u||a!==l||o!==u)&&s(l,u),(!xe||Se!==l||Ce!==u)&&(xe&&xe.destroy(),xe=e.createTexture({size:[l,u],format:`depth24plus`,usage:16}),Se=l,Ce=u),{w:l,h:u}}function Ge({rGrid:t,rhoGrid:n,valenceL:r=0,unpairedCount:i=0,totalElectrons:a=1,dim:o=32}){let s=t.length,c=o*o*o,l=c*16;(!ke||Ae!==o)&&(ke&&ke.destroy(),ke=e.createBuffer({label:`ulg-lab-atomic-vol-3d`,size:l,usage:H.STORAGE}),Ae=o);let u=Math.max(16,s*4);(!je||Me<u)&&(je=e.createBuffer({size:u,usage:H.STORAGE|H.COPY_DST}),Me=u),(!Ne||Pe<u)&&(Ne=e.createBuffer({size:u,usage:H.STORAGE|H.COPY_DST}),Pe=u);let d=Float32Array.from(t),p=Float32Array.from(n),m=Math.min(8.5,d[s-1]||8),h=i>0?Math.min(1,i/Math.max(1,Math.min(10,a))*1.4):0,g=new ArrayBuffer(32);new Uint32Array(g,0,4).set([o,s,r>>>0,i>>>0]),new Float32Array(g,16,4).set([m,h,0,0]),e.queue.writeBuffer(je,0,d),e.queue.writeBuffer(Ne,0,p),e.queue.writeBuffer(Fe,0,g);let _=e.createBindGroup({layout:f.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Fe}},{binding:1,resource:{buffer:je}},{binding:2,resource:{buffer:Ne}},{binding:3,resource:{buffer:ke}}]}),v=e.createCommandEncoder({label:`ulg-lab-atomic-vol-enc`}),y=v.beginComputePass();return y.setPipeline(f),y.setBindGroup(0,_),y.dispatchWorkgroups(Math.ceil(c/64)),y.end(),e.queue.submit([v.finish()]),{buffer:ke,dim:o}}function Ke({gpuVec4Buffer:t=null,vec4Data:r=null,scalarData:i=null,dim:a=24,channels:o=4,yaw:s=.48,pitch:c=.28,tint:l=[.34,.76,1],showFermiIso:u=!1}){let{w:d,h:f}=We(),p=ye,h=be;if(o===4){if(t)p=t;else if(r){let t=Math.max(16,r.byteLength);(!we||Te<t)&&(we&&we.destroy(),we=e.createBuffer({size:t,usage:H.STORAGE|H.COPY_DST}),Te=t,Be=null),Be!==r&&(e.queue.writeBuffer(we,0,r),Be=r),p=we}}else if(i){let t=Math.max(16,i.byteLength);(!Ee||De<t)&&(Ee&&Ee.destroy(),Ee=e.createBuffer({size:t,usage:H.STORAGE|H.COPY_DST}),De=t,Ve=null),Ve!==i&&(e.queue.writeBuffer(Ee,0,i),Ve=i),h=Ee}let g=new ArrayBuffer(48);new Float32Array(g,0,4).set([d,f,s,c]),new Uint32Array(g,16,4).set([a>>>0,o>>>0,+!!u,0]),new Float32Array(g,32,4).set([l[0]??.34,l[1]??.76,l[2]??1,1]),e.queue.writeBuffer(R,0,g);let _=e.createBindGroup({layout:m.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:R}},{binding:1,resource:{buffer:p}},{binding:2,resource:{buffer:h}}]}),v=e.createCommandEncoder({label:`ulg-lab-render-vol`}),y=v.beginRenderPass({colorAttachments:[{view:n.getCurrentTexture().createView(),loadOp:`clear`,storeOp:`store`,clearValue:{r:.02,g:.035,b:.067,a:1}}]});y.setPipeline(m),y.setBindGroup(0,_),y.draw(3),y.end(),e.queue.submit([v.finish()])}function qe({positionsBuffer:t,velocitiesBuffer:r,atomCount:i,boxLengthsA:a,yaw:o=.45,pitch:s=.32,tint:c=[.65,.8,.96],velocityColorScale:l=28}){if(!t||!r||!(i>0))return;let{w:u,h:d}=We(),f=Number(a?.[0]||10),p=Number(a?.[1]||f),m=Number(a?.[2]||f),h=Math.max(.055,Math.min(.14,.56/Math.cbrt(Math.max(8,i)))),v=new Float32Array([u,d,o,s,f,p,m,h,c[0]??.65,c[1]??.8,c[2]??.96,l]);e.queue.writeBuffer(de,0,v);let y=e.createBindGroup({layout:g.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:de}},{binding:1,resource:{buffer:t}},{binding:2,resource:{buffer:r}}]}),b=e.createBindGroup({layout:_.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:de}}]}),x=e.createCommandEncoder({label:`ulg-lab-render-md`}),S=x.beginRenderPass({colorAttachments:[{view:n.getCurrentTexture().createView(),loadOp:`clear`,storeOp:`store`,clearValue:{r:.02,g:.035,b:.067,a:1}}],depthStencilAttachment:{view:xe.createView(),depthLoadOp:`clear`,depthStoreOp:`store`,depthClearValue:1}});S.setPipeline(g),S.setBindGroup(0,y),S.draw(6,i),S.setPipeline(_),S.setBindGroup(0,b),S.draw(24,1),S.end(),e.queue.submit([x.finish()])}function Je({positions:t,velocities:n,atomCount:r,boxLengthsA:i,yaw:a,pitch:o,tint:s}){if(!t||!n||!(r>0))return;let c=Math.max(16,t.byteLength),l=Math.max(16,n.byteLength);(!Ie||Le<c)&&(Ie=e.createBuffer({size:c,usage:H.STORAGE|H.COPY_DST}),Le=c,Ue=null),(!Re||ze<l)&&(Re=e.createBuffer({size:l,usage:H.STORAGE|H.COPY_DST}),ze=l,Ue=null),Ue!==t&&(e.queue.writeBuffer(Ie,0,t),e.queue.writeBuffer(Re,0,n),Ue=t),qe({positionsBuffer:Ie,velocitiesBuffer:Re,atomCount:r,boxLengthsA:i,yaw:a,pitch:o,tint:s,velocityColorScale:1})}function Ye(e){if(!e?.polytopes?.length)return{minLt:1,maxLt:4.2,minLp:2,maxLp:10};let t=Math.log10(Math.max(1,Math.min(...e.polytopes.map(e=>e.axes[0].min)))),n=Math.log10(Math.max(10,Math.max(...e.polytopes.map(e=>e.axes[0].max)))),r=Math.min(...e.polytopes.map(e=>Math.log10(e.axes[1].min))),i=Math.max(...e.polytopes.map(e=>Math.log10(e.axes[1].max))),a=Math.max(.12,(n-t)*.08),o=Math.max(.35,(i-r)*.08);return{minLt:t-a,maxLt:n+a,minLp:r-o,maxLp:i+o}}function Xe(t){let n=t.packedGpuAtlas.data,r=Math.max(64,n.byteLength);return(!Oe||B<r)&&(Oe&&Oe.destroy(),Oe=e.createBuffer({size:r,usage:H.STORAGE|H.COPY_DST}),B=r,He=null),He!==n&&(e.queue.writeBuffer(Oe,0,n),He=n),Oe}function Ze(t=[],n=24){if(!Array.isArray(t)||t.length===0)return null;let r=n*n*n,i=r*16;(!ge||_e!==n)&&(ge&&ge.destroy(),ge=e.createBuffer({label:`ulg-lab-comp-nuc-vol-3d`,size:i,usage:H.STORAGE}),_e=n);let a=Math.min(16,t.length),o=new Float32Array(a*4),s=new Float32Array(a*4),c=.01;for(let e=0;e<a;e+=1)c=Math.max(c,Math.abs(t[e].x||0),Math.abs(t[e].y||0),Math.abs(t[e].z||0));let l=a===1?0:.58/c;for(let e=0;e<a;e+=1){let n=t[e],r=Math.max(1.2,Number(n.chargeRadiusFm||3)),i=Math.max(.14,Math.min(.36,.12+.032*r));o.set([(n.x||0)*l,(n.y||0)*l,(n.z||0)*l,i],e*4),s.set([Math.max(1,Number(n.Z||1)),Math.max(0,Number(n.N||0)),1.05,.95],e*4)}e.queue.writeBuffer(he,0,new Uint32Array([n>>>0,a>>>0,0,0])),e.queue.writeBuffer(F,0,o),e.queue.writeBuffer(ee,0,s);let u=e.createBindGroup({layout:x.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:he}},{binding:1,resource:{buffer:F}},{binding:2,resource:{buffer:ee}},{binding:3,resource:{buffer:ge}}]}),d=e.createCommandEncoder({label:`ulg-lab-comp-nuc-enc`}),f=d.beginComputePass();return f.setPipeline(x),f.setBindGroup(0,u),f.dispatchWorkgroups(Math.ceil(r/64)),f.end(),e.queue.submit([d.finish()]),{buffer:ge,dim:n}}async function Qe(t,n,r){if(!t?.packedGpuAtlas?.data||ve)return null;ve=!0;try{let i=Xe(t);e.queue.writeBuffer(pe,0,new Float32Array([Number(n),Number(r),0,0]));let a=e.createBindGroup({layout:C.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:pe}},{binding:1,resource:{buffer:i}},{binding:2,resource:{buffer:me}}]}),o=e.createCommandEncoder({label:`ulg-lab-poly-probe`}),s=o.beginComputePass();s.setPipeline(C),s.setBindGroup(0,a),s.dispatchWorkgroups(1),s.end(),o.copyBufferToBuffer(me,0,z,0,16),e.queue.submit([o.finish()]),await z.mapAsync(H.MAP_READ);let c=new Float32Array(z.getMappedRange().slice(0,16));z.unmap();let l=c[3]>.5,u=Math.round(c[2]);return Object.freeze({temperatureK:Number(n),pressurePa:Number(r),hit:l,failClosed:!l,densityKgPerM3:l?c[0]:null,margin:c[1],phaseCode:l?u:-1,phase:l?[`solid`,`liquid`,`gas`,`plasma`][Math.max(0,Math.min(3,u))]||`solid`:`OUT OF DOMAIN (FAIL-CLOSED)`})}finally{ve=!1}}function $e(t,r=null){if(!t?.packedGpuAtlas?.data||!t?.polytopes?.length)return;We();let i=Xe(t),{minLt:a,maxLt:o,minLp:s,maxLp:c}=Ye(t),l=r&&Number.isFinite(r.fx)&&Number.isFinite(r.fy)?1:0;e.queue.writeBuffer(fe,0,new Float32Array([a,o,s,c,l>.5?r.fx:-1,l>.5?r.fy:-1,l,0]));let u=e.createBindGroup({layout:y.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:fe}},{binding:1,resource:{buffer:i}}]}),d=e.createCommandEncoder({label:`ulg-lab-render-polytope`}),f=d.beginRenderPass({colorAttachments:[{view:n.getCurrentTexture().createView(),loadOp:`clear`,storeOp:`store`,clearValue:{r:.02,g:.035,b:.067,a:1}}]});f.setPipeline(y),f.setBindGroup(0,u),f.draw(3),f.end(),e.queue.submit([d.finish()])}function et({pointsBuffer:t,pointCount:r,yaw:i=.48,pitch:a=.3,camDist:o=2.65,pointSize:s=.011,opacity:c=.22,alternateShellColors:l=!0,colorA:u=[1,1,1],colorB:d=[.38,.17,.87],showGuides:f=!1,showNucleus:p=!0,starkMixLambda:m=0,eFieldNorm:h=0}){if(!t||!(r>0))return;let{w:g,h:_}=We();e.queue.writeBuffer(N,0,new Float32Array([g,_,i,a,o,s,c,+!!l,u[0]??1,u[1]??1,u[2]??1,+!!f,d[0]??.38,d[1]??.17,d[2]??.87,.018,m,h,0,0]));let v=e.createBindGroup({layout:D.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:N}},{binding:1,resource:{buffer:t}}]}),y=e.createBindGroup({layout:O.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:N}}]}),b=f?e.createBindGroup({layout:k.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:N}}]}):null,x=e.createCommandEncoder({label:`ulg-lab-render-orbital-cloud`}),S=x.beginRenderPass({colorAttachments:[{view:n.getCurrentTexture().createView(),loadOp:`clear`,storeOp:`store`,clearValue:{r:.008,g:.011,b:.02,a:1}}]});f&&b&&(S.setPipeline(k),S.setBindGroup(0,b),S.draw(50)),S.setPipeline(D),S.setBindGroup(0,v),S.draw(6,r),p&&(S.setPipeline(O),S.setBindGroup(0,y),S.draw(6)),S.end(),e.queue.submit([x.finish()])}function tt({photonSession:t,shellPointsBuffer:r,shellPointCount:i=1800,yaw:a=.08,pitch:o=1.05,camDist:s=3.25,modeMono:c=!1,probeRgb:l=[.22,.96,.44],slabTint:u=[.94,.85,.52],waveGain:d=1}){if(!t?.ezFieldBuffer||!t?.shellStateBuffer)return;let{w:f,h:p}=We(),m=r?Math.floor(r.size/16):0,h=Math.max(256,Math.min(2e3,m,Math.trunc(i))),g=t.getParams();e.queue.writeBuffer(P,0,new Float32Array([f,p,a,o,t.nx,t.ny,t.slabX0,t.slabX1,+!!c,+!!g.isMetal,h,s,u[0]??.85,u[1]??.85,u[2]??.9,.24,l[0]??.25,l[1]??.92,l[2]??.45,d]));let _=e.createBindGroup({layout:j.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:P}},{binding:1,resource:{buffer:t.ezFieldBuffer}},{binding:2,resource:{buffer:t.shellStateBuffer}}]}),v=r&&h>0?e.createBindGroup({layout:M.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:P}},{binding:2,resource:{buffer:t.shellStateBuffer}},{binding:3,resource:{buffer:r}}]}):null,y=e.createCommandEncoder({label:`ulg-lab-render-photon-shell`}),b=y.beginRenderPass({colorAttachments:[{view:n.getCurrentTexture().createView(),loadOp:`clear`,storeOp:`store`,clearValue:{r:.008,g:.012,b:.024,a:1}}]});b.setPipeline(j),b.setBindGroup(0,_),b.draw(6),v&&(b.setPipeline(M),b.setBindGroup(0,v),b.draw(6,h*20)),b.end(),e.queue.submit([y.finish()])}function nt({pairCloud:t,blochSession:r,yaw:i=.24,pitch:a=.2,camDist:o=2.85,modeMono:s=!1,probeRgb:c=[.35,.55,1],emergentReflSrgb:l=[.94,.86,.65],pointSize:u=.012}){if(!t?.posBuffer||!t?.ampBuffer||!r)return;let{w:d,h:f}=We(),p=r.historyLen,m=new Float32Array(4*p);for(let e=0;e<4;e+=1)m.set(r.channels[e].radHistory,e*p);e.queue.writeBuffer(L,0,m);let h=s?r.channels[3]:r.channels[2],g=r.channels[0],_=r.channels[1],v=r.channels[2],y=s?h.rho11:Math.max(v.rho11,.5*(g.rho11+_.rho11)),b=Math.max(.02,1-y),x=s?2*h.rho01Re:.75*g.rho01Re+.75*_.rho01Re+1.1*v.rho01Re,S=s?h.eNow:(g.eNow+_.eNow+v.eNow)*.45;e.queue.writeBuffer(ue,0,new Float32Array([d,f,i,a,o,r.getTimeFs(),r.pulseT0Fs,r.pulseWidthFs,b,y,x,S,h.omega,+!!s,r.getHistCursor(),p,l[0]??.9,l[1]??.85,l[2]??.7,v.rho11,c[0]??.35,c[1]??.55,c[2]??1,u]));let C=e.createBindGroup({layout:ce.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:ue}},{binding:3,resource:{buffer:L}}]}),w=e.createBindGroup({layout:le.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:ue}},{binding:1,resource:{buffer:t.posBuffer}},{binding:2,resource:{buffer:t.ampBuffer}}]}),T=e.createCommandEncoder({label:`ulg-lab-render-tdks`}),E=T.beginRenderPass({colorAttachments:[{view:n.getCurrentTexture().createView(),loadOp:`clear`,storeOp:`store`,clearValue:{r:.005,g:.008,b:.016,a:1}}]});E.setPipeline(ce),E.setBindGroup(0,C),E.draw(6),E.setPipeline(le),E.setBindGroup(0,w),E.draw(6,t.pointCount),E.end(),e.queue.submit([T.finish()])}function rt({spinsBuffer:t,dims:r=[10,10,10],yaw:i=.48,pitch:a=.32,camDist:o=3.1,fieldBZTesla:s=0,isAntiferro:c=!1}){if(!t)return;let{w:l,h:u}=We(),[d,f,p]=r,m=1.65/Math.max(d,f,p);e.queue.writeBuffer(re,0,new Float32Array([l,u,i,a,d,f,p,o,s,+!!c,m,0]));let h=e.createBindGroup({layout:ne.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:re}},{binding:1,resource:{buffer:t}}]}),g=e.createCommandEncoder({label:`ulg-lab-render-spins`}),_=g.beginRenderPass({colorAttachments:[{view:n.getCurrentTexture().createView(),loadOp:`clear`,storeOp:`store`,clearValue:{r:.014,g:.022,b:.044,a:1}}],depthStencilAttachment:{view:xe.createView(),depthLoadOp:`clear`,depthStoreOp:`store`,depthClearValue:1}});_.setPipeline(ne),_.setBindGroup(0,h),_.draw(9,d*f*p+1),_.end(),e.queue.submit([g.finish()])}function it({posBuffer:t,velBuffer:r,carrierCount:i=1024,yaw:a=.42,pitch:o=.28,camDist:s=2.95,eFieldVPerM:c=1e4,phononVibAmp:l=.03,timeS:u=0,isSuperconducting:d=!1}){if(!t||!r||!(i>0))return;let{w:f,h:p}=We();e.queue.writeBuffer(oe,0,new Float32Array([f,p,a,o,s,l,u,+!!d,c/1e4,i,0,0]));let m=e.createBindGroup({layout:ie.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:oe}}]}),h=e.createBindGroup({layout:ae.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:oe}},{binding:1,resource:{buffer:t}},{binding:2,resource:{buffer:r}}]}),g=e.createCommandEncoder({label:`ulg-lab-render-transport`}),_=g.beginRenderPass({colorAttachments:[{view:n.getCurrentTexture().createView(),loadOp:`clear`,storeOp:`store`,clearValue:d?{r:.012,g:.02,b:.056,a:1}:{r:.01,g:.016,b:.034,a:1}}]});_.setPipeline(ie),_.setBindGroup(0,m),_.draw(6,64),_.setPipeline(ae),_.setBindGroup(0,h),_.draw(6,i),_.end(),e.queue.submit([g.finish()])}return Object.freeze({backend:`webgpu`,format:r,buildAtomicVolumeOnGpu:Ge,buildCompositeNuclearVolumeOnGpu:Ze,renderVolume3D:Ke,renderOrbitalPointCloud:et,renderPhotonShellScene:tt,renderTdksPhotonCloudScene:nt,renderSpinLatticeScene:rt,renderElectronTransportScene:it,renderLiveMd:qe,renderStaticCrystalLattice:Je,renderPolytopeAtlas:$e,probePolytopeAtlasOnGpu:Qe,getPolytopeAxisBounds:Ye})}try{At(ee),dn(ee),Sn(ee),In(ee),Fe(ee),T(ee)}catch{}var Yn=new Map,Xn=0,Zn=new _({artifactCache:{async put(e){Xn+=1;let t=`ulg-lab://closure/${e.closureId||`item`}#${Xn}`;return Yn.set(t,e),{uri:t,hash:e.inputHash||String(Xn)}},async get(e){return Yn.get(e?.uri)||null}}}),Qn=document.getElementById(`gpu-canvas`),$n=document.getElementById(`gpu-hud-title`),er=document.getElementById(`gpu-hud-sub`),tr=document.getElementById(`gpu-overlay-bottom`),nr=document.getElementById(`sim-controls`),rr=document.getElementById(`active-specimen-pill`),ir=document.getElementById(`specimen-history`),ar=document.getElementById(`plot1`),or=document.getElementById(`plot2`),sr=document.getElementById(`plot3`),cr=document.getElementById(`pt-grid`),lr=document.getElementById(`z-input`),ur=document.getElementById(`a-input`),dr=document.getElementById(`reset-a-btn`),fr=document.getElementById(`solve-z-btn`),pr=document.getElementById(`reactant-a`),mr=document.getElementById(`reactant-b`),hr=document.getElementById(`run-reaction-btn`),gr=document.getElementById(`reaction-results`),_r=document.getElementById(`compound-input`),vr=document.getElementById(`solve-compound-btn`),yr=document.getElementById(`status-badge`),br=document.getElementById(`bundle-readout`),xr=document.getElementById(`g7-card`),Sr=document.getElementById(`plot1-title`),Cr=document.getElementById(`plot2-title`),wr=document.getElementById(`plot3-title`),Tr=document.getElementById(`mobile-drawer-btn`),Er=document.getElementById(`mobile-drawer-close`),Dr=document.getElementById(`drawer-backdrop`),Or=document.getElementById(`canvas-reset-view-btn`),kr=document.getElementById(`webgpu-fallback`),Ar=document.getElementById(`webgpu-fallback-title`),jr=document.getElementById(`webgpu-fallback-msg`),Mr=document.getElementById(`webgpu-reload-btn`),Nr=typeof window<`u`&&(window.matchMedia?.(`(pointer: coarse)`)?.matches||window.innerWidth<900||/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||``));function Pr(){return typeof window<`u`&&window.innerWidth<1120}function Fr(e){let t=!!e&&Pr();document.body.classList.toggle(`drawer-open`,t),Dr&&Dr.setAttribute(`aria-hidden`,t?`false`:`true`)}function Ir(e,t){Ar&&e&&(Ar.textContent=e),jr&&t&&(jr.textContent=t),kr?.classList.add(`visible`)}function Lr(){kr?.classList.remove(`visible`)}var U=null,W=null,G=`nuclear`,K=`element`,q=null,Rr=null,J=null,zr=null,Br=null,Vr=null,Hr=null,Ur=null,Wr=[],Gr=26,Kr=null,qr=[],Jr=null,Yr=null,Xr=null,Zr=null,Qr=null,$r=null,ei=!1,ti=null,ni=null,ri=!1,Y=null,ii=null,ai=[],oi=[],si=[],ci=!1,li=null,ui=null,di=null,fi=[],pi=!1,mi=null,hi=null,gi=[],_i=!1,vi=null,yi=null,bi=null,xi=null,Si=null,X={nuclearViewMode:`tdse`,tdsePlaying:!0,fissionBeta2:0,fissionPlaying:!1,atomicViewMode:`cloud`,n:3,l:2,m:0,functional:`pbe`,relativisticSpinOrbit:!0,starkFieldVPerA:0,ionizedCation:!1,pointCount:Nr?9e4:24e4,pointSize:Nr?.015:.012,opacity:Nr?.3:.24,alternateShellColors:!0,colorMode:0,shellColorA:`#ffffff`,shellColorB:`#612bde`,showGuides:!1,autoRotate:!1,cloudSeed:1,molOrbitalMode:0,crystalViewMode:`photon-shell`,photonPlaying:!0,photonModeMono:!1,probeWavelengthNm:440,spinTempK:300,spinFieldBTesla:.5,spinSweepB:!1,spinSweepDir:1,spinPlaying:!0,transportTempK:300,transportEFieldVPerM:1e4,transportPlaying:!0,mdMode:`equilibrium`,mdNptBarostat:!1,mdPlaying:!0,mdTargetTempK:300,nebImageIdx:0,nebPlaying:!1,nebLastTickMs:0,polytopeRegime:`lab`,polytopeProbe:null},Ci=.42,wi=.28,Ti=2.85,Ei=!1,Di=0,Oi=0,ki=[`s`,`p`,`d`,`f`,`g`,`h`],Ai=new Set([2,10,18,36,54,86,118]),ji=new Set([9,17,35,53,85,117]),Mi=new Set([3,11,19,37,55,87]);function Ni(e){let t=String(e||`#ffffff`).replace(`#`,``).trim();if(t.length!==6)return[1,1,1];let n=Number.parseInt(t,16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]}function Pi(e){let t=Math.max(380,Math.min(780,Number(e)||550)),n=0,r=0,i=0;return t<440?(n=-(t-440)/60,i=1):t<490?(r=(t-440)/50,i=1):t<510?(r=1,i=-(t-510)/20):t<580?(n=(t-510)/70,r=1):t<645?(n=1,r=-(t-645)/65):n=1,[Math.max(.05,n),Math.max(.05,r),Math.max(.05,i)]}function Fi(e){let t=Array.isArray(e)&&e.length===3?e:[.7,.75,.85];return`rgb(${Math.round(Math.max(0,Math.min(1,t[0]))*255)}, ${Math.round(Math.max(0,Math.min(1,t[1]))*255)}, ${Math.round(Math.max(0,Math.min(1,t[2]))*255)})`}function Z(e,t=3){return e==null||!Number.isFinite(e)?String(e??`—`):Math.abs(e)>=1e4||Math.abs(e)>0&&Math.abs(e)<.01?e.toExponential(2):e.toFixed(t)}function Ii(){return K===`compound`&&J?.bundle?J.bundle:q?.bundle||null}function Li(){return K===`compound`&&J?.bundle?J.bundle.electromagnetic:q?.visualData?.em||q?.bundle?.electromagnetic||null}function Ri(e){let t=c(e),n=[...t].reverse().find(e=>e.l===2&&e.occupancy>0);if(n&&n.n>=3)return{n:n.n,l:n.l,m:2};let r=t.find(e=>e.occupancy<2*(2*e.l+1));if(r)return{n:r.n,l:r.l,m:r.l>=2?2:0};let i=t[t.length-1]||{n:1,l:0};return{n:i.n,l:i.l,m:0}}function zi(e,t){let n=c(e),r=[...n].reverse().find(e=>e.l===2&&e.occupancy>0);if(r)return{n0:r.n,l0:2,n1:r.n+1,l1:1,m:0};let i=[...n].reverse().find(e=>e.l===1&&e.occupancy>0);if(i)return{n0:i.n,l0:1,n1:i.n+1,l1:0,m:0};let a=n[n.length-1]||{n:1,l:0};return{n0:a.n,l0:0,n1:Math.max(2,a.n),l1:1,m:0}}function Bi(e,t){$n&&($n.textContent=e),er&&(er.textContent=t)}function Vi(e){tr&&(tr.innerHTML=e||``)}function Hi(e){let t=`${e.kind}:${e.label}`,n=qr.findIndex(e=>`${e.kind}:${e.label}`===t);n>=0&&qr.splice(n,1),qr.unshift(e),qr.length>6&&qr.pop(),Ui()}function Ui(){let e=Ii();if(!e)return;let t=Fi(e.electromagnetic?.opticalSrgb||[.7,.78,.9]),n=K===`compound`;rr.className=`specimen-pill${n?` backfed`:``}`,rr.innerHTML=`<i class="swatch" style="background:${t};"></i>`+(n?`<span>BACKFED COMPOUND: ${e.materialKey}</span> <span style="opacity:0.75;font-weight:400;">(${e.mechanical.crystalStructure} · ${e.electromagnetic.isMetal?`Metal`:`Gap ${Z(e.electromagnetic.bandGapEv,2)} eV`})</span>`:`<span>ELEMENT: ${e.nuclear.isotope} (Z=${e.atomicNumber})</span> <span style="opacity:0.75;font-weight:400;">(${e.mechanical.crystalStructure} · ${e.electromagnetic.isMetal?`Metal`:`Gap ${Z(e.electromagnetic.bandGapEv,2)} eV`})</span>`),ir.innerHTML=qr.map((e,t)=>`<button class="chip${e.kind===`compound`?` react`:``}" data-hist-idx="${t}">${e.label}</button>`).join(``);for(let e of ir.querySelectorAll(`[data-hist-idx]`))e.addEventListener(`click`,()=>{let t=qr[Number(e.dataset.histIdx)];t&&(t.kind===`element`?(Gr=t.Z,Kr=t.A??null,lr.value=String(Gr),ur&&(ur.value=String(Kr??C(Gr))),Ca(Gr,Kr)):(_r.value=t.formula,Oa(t.formula,{backfeedAllTabs:!0})))})}async function Wi(e,t=!1){if(G!==`polytope`||!Vr||!W)return;let n=Qn.getBoundingClientRect(),r=(e.clientX-n.left)/Math.max(1,n.width),i=1-(e.clientY-n.top)/Math.max(1,n.height);if(r<.06||r>.96||i<.08||i>.9)return;let a=(r-.06)/.9,o=(i-.08)/.82,s=W.getPolytopeAxisBounds(Vr),c=s.minLt+a*(s.maxLt-s.minLt),l=s.minLp+o*(s.maxLp-s.minLp),u=10**c,d=10**l,f=await W.probePolytopeAtlasOnGpu(Vr,u,d);if(!f)return;let p=Ii(),m=f.hit&&p?v(p,f.phase,u,d):null,h=f.hit&&m>0?Math.abs(f.densityKgPerM3-m)/m*100:null;X.polytopeProbe={...f,fx:a,fy:o,logT:c,logP:l,eosRho:m,relErrPct:h,locked:t},window.__ulgElementsLabState&&(window.__ulgElementsLabState.polytopeProbe=X.polytopeProbe),$()}function Gi(){Ci=.42,wi=.28,Ti=2.85,_a()}function Ki(){let e=!1,t=new Map,n=0,r=null,i=null;function a(){let e=[...t.values()];return e.length<2?0:Math.hypot(e[0].x-e[1].x,e[0].y-e[1].y)}Qn.addEventListener(`pointerdown`,e=>{if(G===`polytope`){t.set(e.pointerId,{x:e.clientX,y:e.clientY});try{Qn.setPointerCapture?.(e.pointerId)}catch{}Wi(e,!0);return}t.set(e.pointerId,{x:e.clientX,y:e.clientY});try{Qn.setPointerCapture?.(e.pointerId)}catch{}t.size===1?(Ei=!0,Di=e.clientX,Oi=e.clientY,n=0,r=e.pointerType===`touch`?{id:e.pointerId,x:e.clientX,y:e.clientY,moved:!1,t:performance.now()}:null):t.size>=2&&(Ei=!1,r=null,i=null,n=a())}),Qn.addEventListener(`pointermove`,i=>{if(G===`polytope`){if(i.pointerType!==`mouse`&&!t.has(i.pointerId))return;e||(e=!0,Wi(i,t.has(i.pointerId)).finally(()=>{e=!1}));return}if(!t.has(i.pointerId))return;if(t.set(i.pointerId,{x:i.clientX,y:i.clientY}),r&&r.id===i.pointerId&&Math.hypot(i.clientX-r.x,i.clientY-r.y)>10&&(r.moved=!0),t.size>=2){let e=a();if(n>4&&e>4){let t=n/e;Ti=Math.max(1.3,Math.min(5.4,Ti*t)),_a()}n=e;return}if(!Ei)return;let o=i.clientX-Di,s=i.clientY-Oi;Di=i.clientX,Oi=i.clientY;let c=i.pointerType===`touch`?.0105:.008;Ci+=o*c,wi=Math.max(-1.25,Math.min(1.25,wi+s*c)),_a()});let o=e=>{let a=!!(r&&r.id===e.pointerId&&!r.moved&&t.size===1&&performance.now()-r.t<260);if(t.delete(e.pointerId),t.size===1){let e=[...t.values()][0];Di=e.x,Oi=e.y,Ei=G!==`polytope`,n=0}else{if(Ei=!1,n=0,a&&G!==`polytope`){let t=performance.now();i&&t-i.t<300&&Math.hypot(e.clientX-i.x,e.clientY-i.y)<32?(i=null,Gi()):i={x:e.clientX,y:e.clientY,t}}r=null}};Qn.addEventListener(`pointerup`,o),Qn.addEventListener(`pointercancel`,o),Qn.addEventListener(`dblclick`,()=>{G!==`polytope`&&Gi()}),Qn.addEventListener(`wheel`,e=>{G!==`polytope`&&(e.preventDefault(),Ti=Math.max(1.3,Math.min(5.4,Ti+Math.sign(e.deltaY)*.18)),_a())},{passive:!1}),Or?.addEventListener(`click`,()=>Gi())}function qi(){cr.innerHTML=``;for(let e=1;e<=118;e+=1){let t=document.createElement(`button`),n=`el-btn`;Ai.has(e)?n+=` noble`:ji.has(e)?n+=` halogen`:Mi.has(e)?n+=` alkali`:(e>=21&&e<=30||e>=39&&e<=48||e>=72&&e<=80)&&(n+=` metal-d`),e===Gr&&K===`element`&&(n+=` active`),t.className=n,t.dataset.z=String(e),t.innerHTML=`<small>${e}</small>${p[e-1]}`,t.addEventListener(`click`,()=>{Gr=e,Kr=null,lr.value=String(e),ur.value=String(C(e)),Fr(!1),Ca(e,null)}),cr.appendChild(t)}}function Ji(){for(let e of cr.querySelectorAll(`.el-btn`))e.classList.toggle(`active`,K===`element`&&Number(e.dataset.z)===Gr)}function Yi(e,t=null){let n=e.nuclear.dominantMode?`${e.nuclear.spinI}${e.nuclear.parity} (μ=${Z(e.nuclear.magneticMomentMuN,2)} μ_N) · ${e.nuclear.dominantMode}`:`M=${Z(e.nuclear.molarMassU,3)} u`,r=t&&t.steps?.length>0?`${t.steps.slice(0,3).map(e=>`${e.isotope}→${e.daughterIsotope}(${e.mode})`).join(` → `)}${t.steps.length>3?` …→${t.endIsotope}`:``}`:e.nuclear.dominantMode===`stable`?`Stable (no decay chain)`:`—`,i=e.atomic?.hyperfineSplittingHz,a=e.electromagnetic?.interbandOscillators||[],o=a.length?a.slice(0,2).map(e=>`${e.transitionLabel||`d→p`} ${Z(e.energyEv,2)}eV`).join(`, `):e.electromagnetic.isMetal?`Drude free-e`:`UV gap ${Z(e.electromagnetic.bandGapEv,2)}eV`,s=[[`Specimen / Family`,`${e.materialKey} (${e.family})`],[`Accuracy Tier`,e.accuracyTier],[`Nuclear`,e.nuclear.isotope?`${e.nuclear.isotope} (M=${Z(e.nuclear.atomicMassU,3)} u) · B/A=${Z(e.nuclear.bindingPerNucleonMeV,2)} MeV · R=${Z(e.nuclear.chargeRadiusFm,2)} fm`:`Z=${e.nuclear.totalProtonsZ}, A=${e.nuclear.totalNucleonsA}`],[`Spin / Mode`,n],...t?[[`Decay Chain`,r]]:[],[`Quantum Solver`,e.atomic.totalEnergyHa==null?`Ionic/Covalent DFT`:`${Z(e.atomic.totalEnergyHa,2)} Ha (${e.atomic.relativisticMethod||`GPU RHF`})`],...Number.isFinite(i)?[[`Isotope HFS / NMS`,`${Z(i*1e-6,2)} MHz · ΔE=${Z(e.atomic.isotopeMassShiftHa,2)} Ha`]]:[],[`Crystal / Density`,`${e.mechanical.crystalStructure} · ${Z(e.mechanical.densityKgPerM3,0)} kg/m³`],[`Moduli / Debye`,`K=${Z(e.mechanical.bulkModulusPa*1e-9,1)} GPa · Θ_D=${Z(e.mechanical.debyeTemperatureK,0)} K`],[`EM / Band Gap`,`${e.electromagnetic.isMetal?`Metal (ω_p=${Z(e.electromagnetic.plasmaEnergyEv,1)} eV)`:`Gap ${Z(e.electromagnetic.bandGapEv,2)} eV`} · σ=${Z(e.electromagnetic.electricalConductivitySPerM)} S/m`],[`Shell Transitions`,o],[`Optics (550 nm)`,`n=${Z(e.electromagnetic.refractiveIndex550Nm,2)} · R=${Z((e.electromagnetic.reflectance550Nm??0)*100,1)}%`],[`Magnetism`,`${e.electromagnetic.magneticPhase}${e.electromagnetic.magneticMomentMuB?` (${Z(e.electromagnetic.magneticMomentMuB,2)} μ_B)`:``}`],[`Melting / Boiling`,`${Z(e.thermodynamic.meltingPointK,1)} K / ${Z(e.thermodynamic.boilingPointK,1)} K`],[`Thermal k / C_p`,`${Z(e.thermodynamic.thermalConductivityWPerMK,2)} W/mK · ${Z(e.thermodynamic.heatCapacityCpJPerKgK,0)} J/kgK`]];br.innerHTML=`<h3>5-Domain Bundle (${e.materialKey})</h3>`+s.map(([e,t])=>`<div class="kv"><span>${e}</span><span>${t}</span></div>`).join(``)}function Xi(e,t){let n=Fi(e.electromagnetic.opticalSrgb||[.7,.75,.8]),r=$r?.emergentReflectedSrgb?Fi($r.emergentReflectedSrgb):null,i=`<h3>Accuracy Tier &amp; G7 Advisory</h3>
    <div class="kv"><span>Status</span><span>${e.provenance.status} (scientificValidation: false)</span></div>
    <div class="kv"><span>Tier</span><span>${e.accuracyTier}</span></div>
    <div class="kv"><span>GPU Optical Color</span><span><i class="swatch" style="background:${n};"></i> ${n}</span></div>`;r&&(i+=`<div class="kv"><span>FDTD Reflected Color</span><span><i class="swatch" style="background:${r};"></i> ${r}</span></div>`),t?.hasReference?i+=`
      <div class="kv"><span>G7 B/A Error</span><span>${Z(t.bindingPerNucleonRelErr*100,2)}%</span></div>
      <div class="kv"><span>G7 Density Error</span><span>${Z(t.densityRelErr*100,1)}%</span></div>
      <div class="kv"><span>G7 Magnetic Match</span><span>${t.magneticPhaseMatch?`YES`:`DIFF`} (ref: ${t.reference.mag})</span></div>`:t?.note&&(i+=`<div style="font-size:10.5px;color:var(--muted);margin-top:4px;">${t.note}</div>`),xr.innerHTML=i}function Zi(e){let t=e.getBoundingClientRect();if(t.width>=120&&t.height>=60){let n=Math.round(t.width),r=Math.round(t.height);(Math.abs(e.width-n)>2||Math.abs(e.height-r)>2)&&(e.width=n,e.height=r)}return e.getContext(`2d`,{willReadFrequently:!0})}function Qi(e,t,{label:n=``,yMin:r=null,yMax:i=null,hLine:a=null,vLine:o=null,xTicks:s=null}={}){let c=Zi(e),l=e.width,u=e.height;c.fillStyle=`#060b14`,c.fillRect(0,0,l,u);let d=t.filter(e=>e.xs?.length>=2&&e.ys?.length>=2);if(!d.length)return;let f=1/0,p=-1/0,m=1/0,h=-1/0;for(let e of d){for(let t of e.xs)t<f&&(f=t),t>p&&(p=t);for(let t of e.ys)t<m&&(m=t),t>h&&(h=t)}r!=null&&(m=r),i!=null&&(h=i),a!=null&&(m=Math.min(m,a.y),h=Math.max(h,a.y));let g=Math.max(1e-9,p-f),_=Math.max(1e-9,h-m),v=e=>26+(e-f)/g*(l-26-10),y=e=>u-18-(e-m)/_*(u-19-18);if(c.strokeStyle=`rgba(148,163,184,0.14)`,c.lineWidth=1,c.beginPath(),c.moveTo(26,u-18),c.lineTo(l-10,u-18),c.stroke(),a!=null){let e=y(a.y);c.save(),c.strokeStyle=a.color||`#facc15`,c.setLineDash([4,3]),c.lineWidth=1.2,c.beginPath(),c.moveTo(26,e),c.lineTo(l-10,e),c.stroke(),c.fillStyle=a.color||`#facc15`,c.font=`9.5px Inter, sans-serif`,c.fillText(a.label||``,l-10-46,Math.max(27,e-3)),c.restore()}if(o!=null){let e=v(o.x);c.save(),c.strokeStyle=o.color||`#facc15`,c.setLineDash([4,3]),c.lineWidth=1.2,c.beginPath(),c.moveTo(e,19),c.lineTo(e,u-18),c.stroke(),c.fillStyle=o.color||`#facc15`,c.font=`9.5px Inter, sans-serif`,c.fillText(o.label||``,Math.min(l-42,e+3),29),c.restore()}for(let e of d){c.strokeStyle=e.color||`#56c2ff`,c.lineWidth=e.width||1.75,c.beginPath();for(let t=0;t<e.xs.length;t+=1){let n=v(e.xs[t]),r=y(e.ys[t]);t===0?c.moveTo(n,r):c.lineTo(n,r)}c.stroke(),e.fill&&(c.lineTo(v(e.xs[e.xs.length-1]),u-18),c.lineTo(v(e.xs[0]),u-18),c.closePath(),c.fillStyle=e.fill,c.fill())}if(Array.isArray(s)){c.fillStyle=`#94a3b8`,c.font=`9.5px Inter, sans-serif`;for(let e of s){let t=v(e.x);c.fillText(e.label,Math.max(26,Math.min(l-22,t-5)),u-4)}}c.fillStyle=`#a5bce0`,c.font=`10px Inter, sans-serif`,c.fillText(n,8,13)}function $i(e,t,n,r={}){Qi(e,[{xs:t,ys:n,color:r.color||`#56c2ff`,width:r.width||1.8}],r)}function ea(e,t){let n=Zi(e),r=e.width,i=e.height;if(n.fillStyle=`#060b14`,n.fillRect(0,0,r,i),!t?.chartData)return;let{maxZ:a,maxN:o}=t.chartDims,s=[null,`#22c55e`,`#38bdf8`,`#f472b6`,`#facc15`,`#ef4444`];for(let e=1;e<=a;e+=1)for(let c=0;c<o;c+=1){let l=Math.round(t.chartData[((e-1)*o+c)*4+3]);if(l<=0)continue;n.fillStyle=s[l]||`#fff`;let u=12+c/o*(r-24),d=i-12-e/a*(i-24);n.fillRect(u,d,2,2)}let c=12+t.N/o*(r-24),l=i-12-t.Z/a*(i-24);n.strokeStyle=`#ffffff`,n.lineWidth=1.5,n.strokeRect(c-4,l-4,8,8)}function ta(e,t,n){if(!n){$i(e,Array.from(t.alphaWkb.rFm),Array.from(t.alphaWkb.vMeV),{label:`V_nuc + V_coul (MeV vs fm)`,color:`#facc15`});return}let r=Array.from(n.rGridFm),i=Array.from(n.potRawMeV),a=Array.from(n.prob),o=Math.max(12,...i),s=Math.max(1e-6,...a),c=a.map(e=>n.qEffMeV+e/s*(o*.65));Qi(e,[{xs:r,ys:i,color:`#facc15`,width:1.8},{xs:r,ys:c,color:`#38bdf8`,width:1.8,fill:`rgba(56, 189, 248, 0.24)`}],{label:`GPU TDSE |ψ(r,t)|² (cyan) vs V(r) (gold) · P_tunnel=${Z(n.pTunneled*100,2)}%`,hLine:{y:n.qEffMeV,color:`#f472b6`,label:`Q=${Z(n.qEffMeV,1)}MeV`}})}function na(e,t,n=``){let r=Zi(e),i=e.width,a=e.height;if(r.fillStyle=`#060b14`,r.fillRect(0,0,i,a),!t?.channels){r.fillStyle=`#94a3b8`,r.font=`11px Inter, sans-serif`,r.fillText(`Stepping Maxwell-ADE-FDTD photon wavepackets on WebGPU…`,10,68);return}let o=t.channels,s=[`610nm R`,`535nm G`,`440nm B`,`${Math.round(o[3].wavelengthNm)}nm`],c=[`#ef4444`,`#22c55e`,`#3b82f6`,Fi(Pi(o[3].wavelengthNm))],l=(i-12-78)/4;r.fillStyle=`#a5bce0`,r.font=`10px Inter, sans-serif`,r.fillText(`${n}Live GPU FDTD: Reflectance R (solid) vs Shell Absorption A (hatch)`,8,13);for(let e=0;e<4;e+=1){let n=o[e],i=12+e*l,u=Math.max(12,l*.34),d=a-22-22,f=Math.min(1,n.reflectance)*d,p=Math.min(1,n.absorption)*d,m=Math.min(1,n.transmittance)*d;r.fillStyle=c[e],r.fillRect(i+3,a-22-f,u,f),r.fillStyle=`rgba(192, 132, 252, 0.85)`,r.fillRect(i+5+u,a-22-p,u*.72,p),!t.isMetal&&m>1&&(r.strokeStyle=`#38bdf8`,r.lineWidth=1.5,r.strokeRect(i+3,a-22-m,u,m)),r.fillStyle=`#cbd5e1`,r.font=`9px ui-monospace, monospace`,r.fillText(s[e],i+2,a-7),r.fillText(`R${Math.round(n.reflectance*100)}%`,i+2,Math.max(30,a-22-f-2))}let u=i-66;r.fillStyle=Fi(t.emergentReflectedSrgb),r.fillRect(u,26,54,48),r.strokeStyle=`rgba(255,255,255,0.6)`,r.lineWidth=1.2,r.strokeRect(u,26,54,48),r.fillStyle=`#e2e8f0`,r.font=`9px Inter, sans-serif`,r.fillText(`Emergent`,u+4,86),r.fillText(`FDTD RGB`,u+3,97)}function ra(e,t,n,r,i,a){if(Array.isArray(t)&&t.length>=2&&Array.isArray(n)){let o=[{xs:t,ys:n.map(e=>e*100),color:`#fbbf24`,width:2}];if(Array.isArray(r)&&r.length===t.length){let e=Math.max(1,...r);o.push({xs:t,ys:r.map(t=>t/e*80),color:`#38bdf8`,width:1.4})}if(Qi(e,o,{label:`UV-Vis R(λ)% (gold) & scaled n(λ) (blue) — ${a}`,yMin:0,yMax:105,xTicks:[{x:380,label:`380nm`},{x:550,label:`550nm`},{x:740,label:`780nm`}]}),Array.isArray(i)&&i.length===3){let t=Zi(e);t.fillStyle=Fi(i),t.fillRect(e.width-34,6,24,13),t.strokeStyle=`rgba(255,255,255,0.45)`,t.strokeRect(e.width-34,6,24,13)}}else $i(e,[380,550,780],[0,0,0],{label:`No spectral samples available`,color:`#64748b`,yMin:0,yMax:100})}function ia(e,t,n,r,i){let a=Zi(e),o=e.width,s=e.height;a.fillStyle=`#060b14`,a.fillRect(0,0,o,s);let c=o*.5,l=s*.54,u=Math.min(o,s)*.36;a.strokeStyle=`rgba(148,163,184,0.18)`,a.lineWidth=1,a.beginPath(),a.arc(c,l,u,0,Math.PI*2),a.moveTo(c-u,l),a.lineTo(c+u,l),a.moveTo(c,l-u),a.lineTo(c,l+u),a.stroke();let d=e=>{let r=Math.cos(e),i=Math.sin(e),a=Math.abs(n);return t===0?.72:t===1?a===0?r:i:t===2?a===0?.5*(3*r*r-1):a===1?1.5*i*r:.75*i*i:.5*r*(5*r*r-3)};for(let e of[1,-1]){a.beginPath();let t=!1;for(let n=0;n<=180;n+=1){let r=n/180*Math.PI*2,i=d(r),o=i*e>0?Math.abs(i)*u:0,s=c+o*Math.sin(r),f=l-o*Math.cos(r);t?a.lineTo(s,f):(a.moveTo(s,f),t=!0)}a.closePath(),a.fillStyle=e>0?`rgba(255, 255, 255, 0.25)`:`rgba(97, 43, 222, 0.35)`,a.fill(),a.strokeStyle=e>0?`#ffffff`:`#8b5cf6`,a.lineWidth=1.6,a.stroke()}a.fillStyle=`#a5bce0`,a.font=`10px Inter, sans-serif`,a.fillText(`${r} · |Y_${t},${n}(θ)| polar slice · unpaired=${i}`,8,13)}function aa(e,t,n=null){let r=Zi(e),i=e.width,a=e.height;if(r.fillStyle=`#060b14`,r.fillRect(0,0,i,a),!t?.polytopes?.length)return;let o={solid:`rgba(86, 194, 255, 0.36)`,liquid:`rgba(52, 211, 153, 0.38)`,gas:`rgba(251, 146, 60, 0.34)`,plasma:`rgba(192, 132, 252, 0.36)`},s={solid:`#56c2ff`,liquid:`#34d399`,gas:`#fb923c`,plasma:`#c084fc`},c=Math.log10(Math.max(1,Math.min(...t.polytopes.map(e=>e.axes[0].min)))),l=Math.log10(Math.max(10,Math.max(...t.polytopes.map(e=>e.axes[0].max)))),u=Math.min(...t.polytopes.map(e=>Math.log10(e.axes[1].min))),d=Math.max(...t.polytopes.map(e=>Math.log10(e.axes[1].max))),f=e=>30+(Math.log10(Math.max(1,e))-c)/Math.max(1e-6,l-c)*(i-30-10),p=e=>a-20-(e-u)/Math.max(1e-6,d-u)*(a-18-20);for(let e of t.polytopes){let t=Math.log10(e.axes[1].min),n=Math.log10(e.axes[1].max),i=[],a=[];for(let r=0;r<=12;r+=1){let o=t+r/12*(n-t),s=e.axes[0].min,c=e.axes[0].max;for(let t of e.inequalities||[]){let e=t.a[0],n=t.a[1],r=t.b;if(Math.abs(e)>1e-9){let t=(r-n*o)/e;e>0?c=Math.min(c,t):s=Math.max(s,t)}}c>s&&(i.push([f(s),p(o)]),a.push([f(c),p(o)]))}if(i.length>=2){r.beginPath(),r.moveTo(i[0][0],i[0][1]);for(let e of i)r.lineTo(e[0],e[1]);for(let e=a.length-1;e>=0;--e)r.lineTo(a[e][0],a[e][1]);r.closePath(),r.fillStyle=o[e.phase]||`rgba(255,255,255,0.2)`,r.fill(),r.strokeStyle=s[e.phase]||`#93c5fd`,r.lineWidth=1.2,r.stroke()}}if(n){let e=f(n.temperatureK),t=p(Math.log10(Math.max(1e-6,n.pressurePa)));r.strokeStyle=n.hit?`#facc15`:`#f87171`,r.lineWidth=1.8,r.beginPath(),r.arc(e,t,5,0,Math.PI*2),r.stroke()}r.fillStyle=`#a5bce0`,r.font=`9.5px Inter, sans-serif`,r.fillText(`A x <= b (${t.materialKey}, ${t.polytopeCount} cells)`,30,12),r.fillText(`T: ${Math.round(10**c)}..${Math.round(10**l)} K`,30,a-5),r.fillText(`log10 P: ${u.toFixed(0)}..${d.toFixed(0)}`,i-102,a-5)}function oa(){if(!U)return;if(K===`compound`&&J?.visualData?.molQm?.atomOrbitalParams){let e=J.visualData.molQm.atomOrbitalParams,t=Yr?.pointsBuffer??null;if(Yr=kt(U,{posZeta:e.posZeta,weights:e.weights,boxHalfBohr:e.boxHalfBohr,mode:X.molOrbitalMode,pointCount:Math.min(24e4,X.pointCount),seed:X.cloudSeed,reuseBuffer:t}),t&&t!==Yr?.pointsBuffer)try{t.destroy()}catch{}return}if(!q?.visualData?.atom)return;let e=q.visualData.atom;X.l=Math.max(0,Math.min(X.n-1,X.l)),X.m=Math.max(-X.l,Math.min(X.l,X.m));let t=null;if(Array.isArray(e.orbitalWavefunctions)&&Array.isArray(e.orbitals)){let n=e.orbitals.findIndex(e=>e.n===X.n&&e.l===X.l);n>=0&&e.orbitalWavefunctions[n]&&(t=e.orbitalWavefunctions[n])}let n=Jr?.pointsBuffer??null;if(Jr=Ot(U,{Z:e.atomicNumberZ,n:X.n,l:X.l,m:X.m,pointCount:X.pointCount,rGrid:e.radialGrid?.r||null,orbitalU:t,screeningExchange:X.functional!==`bare`,relativisticSpinOrbit:X.relativisticSpinOrbit,colorMode:X.colorMode,seed:X.cloudSeed,reuseBuffer:n}),n&&n!==Jr?.pointsBuffer)try{n.destroy()}catch{}let r=zi(e.atomicNumberZ,e),i=(t,n)=>{if(!Array.isArray(e.orbitalWavefunctions)||!Array.isArray(e.orbitals))return null;let r=e.orbitals.findIndex(e=>e.n===t&&e.l===n);return r>=0?e.orbitalWavefunctions[r]:null},a=Xr?.posBuffer??null,o=Xr?.ampBuffer??null;Xr=Ft(U,{Z:e.atomicNumberZ,n0:r.n0,l0:r.l0,n1:r.n1,l1:r.l1,m:r.m,rGrid:e.radialGrid?.r||null,u0:i(r.n0,r.l0),u1:i(r.n1,r.l1),pointCount:Nr?8e4:18e4,screeningExchange:X.functional!==`bare`,relativisticSpinOrbit:X.relativisticSpinOrbit,seed:X.cloudSeed,reusePosBuffer:a,reuseAmpBuffer:o})}function sa(){return K===`compound`&&Yr?.pointsBuffer?Yr:Jr}function ca(){if(!U)return;if(Qr){try{Qr.destroy()}catch{}Qr=null}$r=null;let e=Li();if(e){Zr=It(e,{probeWavelengthNm:X.probeWavelengthNm});for(let e=0;e<45;e+=1)Zr.stepFs(.08);if(K===`compound`&&J){let e=(J.bundle?.nuclear?.isotopologueSites||[]).reduce((e,t)=>Math.max(e,t.Z||1),8),t=zi(e,null);Xr=Ft(U,{Z:e,n0:t.n0,l0:t.l0,n1:t.n1,l1:t.l1,m:t.m,pointCount:Nr?75e3:16e4,screeningExchange:!0,relativisticSpinOrbit:!0,reusePosBuffer:Xr?.posBuffer??null,reuseAmpBuffer:Xr?.ampBuffer??null})}Qr=rn(U,e,{probeWavelengthNm:X.probeWavelengthNm});for(let e=0;e<5;e+=1)Qr.stepSync(24);Qr.readTelemetry().then(t=>{if(!t)return;$r=t;let n=Ii();n&&un({closureRegistry:Zn,materialKey:n.materialKey,electromagnetic:e,telemetry:t}).catch(()=>{}),G===`crystal`&&$()}).catch(()=>{})}}function la(){if(!U)return;if(ti){try{ti.destroy()}catch{}ti=null}ni=null;let e=q?.visualData?.nuclear;e&&(ti=ln(U,e))}function ua(e){if(!e?.steps?.length)return null;let t=e.steps,n=Math.max(1e-6,Math.min(1e24,Number(t[0].halfLifeS)||1)),r={};for(let e of t)r[e.isotope]=e;let i=[t[0].isotope,t[0].daughterIsotope];t.length>=2&&!i.includes(t[1].daughterIsotope)&&i.push(t[1].daughterIsotope),e.endIsotope&&!i.includes(e.endIsotope)&&i.push(e.endIsotope);let a=[],o=i.map(e=>({name:e,frac:[]})),s=1e6,c=[{isotope:t[0].isotope,A:t[0].A,atomCount:s}],l=n*6/35;for(let e=0;e<36;e+=1){a.push(e*l/n);for(let e=0;e<i.length;e+=1){let t=c.find(t=>t.isotope===i[e]);o[e].frac.push((t?.atomCount||0)/s)}e<35&&(c=k(c,l,{channels:r}).nextInventory)}return{tHalfUnits:a,firstHalfLifeS:n,curves:o}}function da(){if(!U||K!==`element`||!q?.visualData?.nuclear)return;let e=q.visualData.nuclear;yi=O(e.Z,e.A),vi=w(U,e,{beta2:X.fissionBeta2,dim:Nr?24:28,reuseBuffer:vi?.buffer??null})}function fa(){let e=X.ionizedCation&&xi?.cationAtom?xi.cationAtom:q?.visualData?.atom;if(!e){Si=null;return}Si=Bt({atomResult:e,eFieldVPerA:X.starkFieldVPerA})}async function pa(e){if(!U||K!==`element`||!q?.visualData?.atom)return;if(X.ionizedCation=!!e,X.ionizedCation&&(!xi||xi.Z!==Gr)){yr.textContent=`Solving ΔSCF ${u(Gr)}⁺…`;let e=q.visualData.atom,t=q.visualData.nuclear;xi=await Vt(U,{Z:Gr,solveAtomFullWebGpu:N,baseConfiguration:c(Gr),baseAtomResult:e,functional:X.functional,scalarRelativistic:X.relativisticSpinOrbit,spinOrbit:X.relativisticSpinOrbit,nuclearChargeRadiusBohr:t?.chargeRadiusBohr,nuclearMassU:t?.atomicMassU}),yr.textContent=`${u(Gr)}⁺ I₁=${Z(xi?.ionizationEnergyEv,2)} eV`}let t=X.ionizedCation&&xi?.cationAtom?xi.cationAtom:q.visualData.atom;if(t){let e=null;if(Array.isArray(t.orbitalWavefunctions)&&Array.isArray(t.orbitals)){let n=t.orbitals.findIndex(e=>e.n===X.n&&e.l===X.l);n>=0&&(e=t.orbitalWavefunctions[n])}let n=Jr?.pointsBuffer??null;Jr=Ot(U,{Z:X.ionizedCation?t.atomicNumberZ+.65:t.atomicNumberZ,n:X.n,l:X.l,m:X.m,pointCount:X.pointCount,rGrid:t.radialGrid?.r||null,orbitalU:e,screeningExchange:X.functional!==`bare`,relativisticSpinOrbit:X.relativisticSpinOrbit,colorMode:X.colorMode,seed:X.cloudSeed,reuseBuffer:n})}fa(),Q(),$(),ja()}function ma(){if(!U)return;if(ui){try{ui.destroy()}catch{}ui=null}di=null,fi=[];let e=Ii(),t=Li();if(!e||!t)return;let n=Number(t.curieOrNeelTempK)||0;X.spinTempK=(t.magneticPhase===`ferromagnetic`||t.magneticPhase===`antiferromagnetic`)&&n>20?Math.max(10,Math.round(n*.45)):300;let r=Nr?8:10;ui=bn(U,t,e.mechanical||{},{nx:r,ny:r,nz:r,temperatureK:X.spinTempK,fieldBZTesla:X.spinFieldBTesla}),ui.stepBatch(18,{readObs:!0}).then(n=>{n&&(di=n,fi.push({B:n.fieldBZTesla,Mz:n.magnetizationZ,Mmag:n.magnetizationMag,Mstag:n.staggeredOrderMag,T:n.temperatureK}),xn({closureRegistry:Zn,materialKey:e.materialKey,electromagnetic:t,mechanical:e.mechanical,telemetry:n}).catch(()=>{}),G===`crystal`&&X.crystalViewMode===`spin-llg`&&$(),ja())}).catch(()=>{})}function ha(e=null){if(!U)return;if(mi){try{mi.destroy()}catch{}mi=null}hi=null,gi=[];let t=Ii(),n=Li();if(!t||!n)return;let r=Number(n.superconductingTcK)||0;e==null?r>.8&&X.crystalViewMode===`transport`?X.transportTempK=Math.max(.5,Number((r*.35).toFixed(1))):X.transportTempK=300:X.transportTempK=Math.max(.5,Number(e)),mi=Pn(U,n,t.mechanical||{},{carrierCount:Nr?512:1024,temperatureK:X.transportTempK,eFieldVPerM:X.transportEFieldVPerM}),mi.stepBatch(16,{readObs:!0}).then(e=>{e&&(hi=e,gi.push({T:e.temperatureK,drift:e.meanDriftNorm,scatter:e.measuredScatterRateFrac,sigma:e.sigmaGpuSPerM}),Fn({closureRegistry:Zn,materialKey:t.materialKey,electromagnetic:n,mechanical:t.mechanical,telemetry:e}).catch(()=>{}),G===`crystal`&&X.crystalViewMode===`transport`&&$(),ja())}).catch(()=>{})}function ga(e=null,t=null){if(t&&(X.mdMode=t),Y){try{Y.destroy()}catch{}Y=null}if(ii=null,ai=[],oi=[],si=[],li=null,!U)return;let n=X.mdMode||`equilibrium`,r={equilibrium:Oe.EQUILIBRIUM,strain:Oe.STRAIN,acoustic:Oe.ACOUSTIC,shear:Oe.SHEAR_NEMD,thermal:Oe.THERMAL_NEMD,surface:Oe.SURFACE_SLAB}[n]??Oe.EQUILIBRIUM,i=n===`acoustic`?[5,2,2]:n===`thermal`?[4,2,2]:null,a=n===`surface`?2.5:1;if(K===`compound`&&J?.visualData?.mdConfig){let t=J.visualData.mdConfig,r=J.bundle,o=Math.max(20,Number(r.thermodynamic.meltingPointK||300)),s=e??Math.max(20,Math.min(2400,(n===`shear`?1.25:n===`strain`||n===`acoustic`?.25:.7)*o));X.mdTargetTempK=Math.round(s);let c=Ie({crystalStructure:t.crystalStructure,cellsPerSide:2,cellsVec:i,vacuumZFactor:a,latticeConstantA:t.latticeConstantA,massU:t.massU,temperatureK:s});Y=Ne(U,{...c,potentialModel:t.potentialModel,epsilonEv:t.epsilonEv,sigmaOrR0A:t.sigmaOrR0A,alphaOrLambda:t.alphaOrLambda,rcutA:t.rcutA,eamAEv:t.eamAEv,eamBeta:t.eamBeta,dtFs:t.dtFs,targetTemperatureK:s,thermostatCouplingFs:35}),li={label:r.materialKey,crystalStructure:t.crystalStructure,modelName:t.modelName,rcutA:t.rcutA,dtFs:t.dtFs,meltingPointK:o},ii=J.visualData.mdTelemetry}else if(q?.visualData?.thermo?.potential){let t=q.visualData.bulk,r=q.visualData.thermo.potential,o=q.bundle,s=Math.max(1,Number(o.nuclear.atomicMassU||28)),c=Math.max(20,Number(o.thermodynamic.meltingPointK||600)),l=e??Math.max(30,Math.min(2200,(n===`shear`?1.25:n===`strain`||n===`acoustic`?.25:.7)*c));X.mdTargetTempK=Math.round(l);let u=Math.min(2,Math.max(.45,.09*Math.sqrt(s))),d=Ie({crystalStructure:t.crystalStructure,cellsPerSide:n===`surface`?2:3,cellsVec:i,vacuumZFactor:a,latticeConstantA:Math.max(2.4,Number(t.latticeConstantA||3.6)),massU:s,temperatureK:l});Y=Ne(U,{...d,potentialModel:r.potentialModel,epsilonEv:r.epsilonEv,sigmaOrR0A:r.sigmaOrR0A,alphaOrLambda:r.alphaOrLambda,rcutA:r.rcutA,eamAEv:r.eamAEv,eamBeta:r.eamBeta,swGamma:r.swGamma,dtFs:u,targetTemperatureK:l,thermostatCouplingFs:35}),li={label:o.nuclear.isotope||o.symbol,crystalStructure:t.crystalStructure,modelName:r.modelName,rcutA:r.rcutA,dtFs:u,meltingPointK:c},ii=q.visualData.thermo.mdTelemetry}Y&&(Y.setExperimentMode(r,{shearWallVel:n===`shear`?.14:0,thermalDeltaT:n===`thermal`?Math.max(40,Math.round(X.mdTargetTempK*.4)):0}),n===`acoustic`&&Y.injectAcousticPulse({polarization:`longitudinal`,amplitude:.34})),ii&&ai.push({t:0,T:ii.temperatureK,msd:ii.msdA2})}function Q(){if(!nr)return;let e=Ii();if(G===`nuclear`){let e=K===`element`;nr.innerHTML=`
      <div class="ctrl-group">
        <button class="action${X.nuclearViewMode===`tdse`?` active-toggle`:``}" data-nview="tdse">Fermi + TDSE</button>
        ${e?`<button class="action${X.nuclearViewMode===`fission`?` active-toggle`:``}" data-nview="fission" title="Live 3D GPU Bohr-Wheeler quadrupole/necking liquid-drop fission!">3D Fission Saddle</button>`:``}
        ${e?`<button class="action${X.nuclearViewMode===`bateman`?` active-toggle`:``}" data-nview="bateman">Bateman Decay</button>`:``}
      </div>
      ${X.nuclearViewMode===`fission`&&e?`
        <div class="ctrl-group">
          <label>β₂=<b id="lbl-fiss-b2">${X.fissionBeta2.toFixed(2)}</b></label>
          <input id="ctrl-fiss-b2" type="range" min="0" max="1.35" step="0.03" value="${X.fissionBeta2}" style="width:96px;" />
          <button id="ctrl-fiss-play" class="action gold-btn">${X.fissionPlaying?`Pause`:`Play Fission`}</button>
          <button id="ctrl-fiss-saddle" class="action">Saddle β*</button>
        </div>`:`
        <div class="ctrl-group">
          <button id="ctrl-tdse-play" class="action">${X.tdsePlaying?`Pause TDSE`:`Play TDSE`}</button>
          <button id="ctrl-tdse-reset" class="action">Reset α-Wavepacket</button>
        </div>`}`;for(let e of nr.querySelectorAll(`[data-nview]`))e.addEventListener(`click`,()=>{X.nuclearViewMode=e.dataset.nview,X.nuclearViewMode===`fission`&&da(),Q(),$()});document.getElementById(`ctrl-fiss-b2`)?.addEventListener(`input`,e=>{X.fissionBeta2=Number(e.target.value),document.getElementById(`lbl-fiss-b2`).textContent=X.fissionBeta2.toFixed(2),da(),$()}),document.getElementById(`ctrl-fiss-play`)?.addEventListener(`click`,()=>{X.fissionPlaying=!X.fissionPlaying,Q()}),document.getElementById(`ctrl-fiss-saddle`)?.addEventListener(`click`,()=>{X.fissionBeta2=yi?.saddleBeta??.72,X.fissionPlaying=!1,da(),Q(),$()}),document.getElementById(`ctrl-tdse-play`)?.addEventListener(`click`,()=>{X.tdsePlaying=!X.tdsePlaying,Q()}),document.getElementById(`ctrl-tdse-reset`)?.addEventListener(`click`,()=>{ti?.resetWavepacket(),$()})}else if(G===`atomic`){if(K===`compound`&&J?.visualData?.molQm){nr.innerHTML=`
        <div class="ctrl-group">
          <label>Molecular Orbital</label>
          <button class="action${X.molOrbitalMode===0?` active-toggle`:``}" data-mol-mode="0">Total ρ(r)</button>
          <button class="action${X.molOrbitalMode===1?` active-toggle`:``}" data-mol-mode="1">HOMO</button>
          <button class="action${X.molOrbitalMode===2?` active-toggle`:``}" data-mol-mode="2">LUMO</button>
        </div>
        <div class="ctrl-group">
          <label>Render</label>
          <button class="action${X.atomicViewMode===`cloud`?` active-toggle`:``}" data-aview="cloud">3D Point Cloud</button>
          <button class="action${X.atomicViewMode===`volume`?` active-toggle`:``}" data-aview="volume">Volumetric</button>
        </div>
        <div class="ctrl-group">
          <label><input id="ctrl-guides" type="checkbox" ${X.showGuides?`checked`:``} /> Grid+Axes</label>
          <button id="ctrl-rotate" class="action${X.autoRotate?` active-toggle`:``}">${X.autoRotate?`Pause Rot`:`Rotate`}</button>
        </div>`;for(let e of nr.querySelectorAll(`[data-mol-mode]`))e.addEventListener(`click`,()=>{X.molOrbitalMode=Number(e.dataset.molMode),oa(),Q(),$()})}else{let e=Array.from({length:X.n},(e,t)=>`<option value="${t}" ${t===X.l?`selected`:``}>l=${t} (${ki[t]||t})</option>`).join(``),t=Array.from({length:2*X.l+1},(e,t)=>{let n=t-X.l;return`<option value="${n}" ${n===X.m?`selected`:``}>m=${n}</option>`}).join(``);nr.innerHTML=`
        <div class="ctrl-group">
          <label>n=<b id="lbl-n">${X.n}</b></label>
          <input id="ctrl-n" type="range" min="1" max="7" value="${X.n}" style="width:58px;" />
          <select id="ctrl-l">${e}</select>
          <select id="ctrl-m">${t}</select>
          <button id="ctrl-valence" class="action" title="Snap to active atom valence subshell">Valence</button>
          <button id="ctrl-rand-nlm" class="action" title="Random Element + (n, l, m)">Rand</button>
        </div>
        <div class="ctrl-group">
          <label>XC</label>
          <select id="ctrl-xc" title="Re-solve GPU Kohn-Sham with PBE GGA, LDA, or Bare Nucleus">
            <option value="pbe" ${X.functional===`pbe`?`selected`:``}>PBE GGA</option>
            <option value="lda" ${X.functional===`lda`?`selected`:``}>LDA</option>
            <option value="bare" ${X.functional===`bare`?`selected`:``}>Bare Z</option>
          </select>
          <label title="Koelling-Harmon Relativistic + Spin-Orbit (live GPU re-solve!)">
            <input id="ctrl-rel" type="checkbox" ${X.relativisticSpinOrbit?`checked`:``} /> Relativistic+SO
          </label>
        </div>
        <div class="ctrl-group">
          <label>Pts <b id="lbl-pts">${Math.round(X.pointCount/1e3)}K</b></label>
          <input id="ctrl-pts" type="range" min="50000" max="500000" step="25000" value="${X.pointCount}" style="width:66px;" />
          <label>Size</label>
          <input id="ctrl-psize" type="range" min="0.006" max="0.045" step="0.002" value="${X.pointSize}" style="width:50px;" />
          <label>Opac</label>
          <input id="ctrl-opac" type="range" min="0.08" max="0.80" step="0.04" value="${X.opacity}" style="width:50px;" />
        </div>
        <div class="ctrl-group">
          <select id="ctrl-cmode" title="Shell color alternation mode">
            <option value="0" ${X.colorMode===0?`selected`:``}>Radial Shells</option>
            <option value="1" ${X.colorMode===1?`selected`:``}>±ψ Phase</option>
          </select>
          <input id="ctrl-col-a" type="color" value="${X.shellColorA}" title="Color A" />
          <input id="ctrl-col-b" type="color" value="${X.shellColorB}" title="Color B" />
          <label><input id="ctrl-guides" type="checkbox" ${X.showGuides?`checked`:``} /> Grid</label>
          <button class="action${X.atomicViewMode===`cloud`?` active-toggle`:``}" data-aview="cloud">Cloud</button>
          <button class="action${X.atomicViewMode===`volume`?` active-toggle`:``}" data-aview="volume">Vol</button>
          <button id="ctrl-regen" class="action">Resample</button>
          <button id="ctrl-rotate" class="action${X.autoRotate?` active-toggle`:``}">${X.autoRotate?`Pause`:`Rotate`}</button>
        </div>
        <div class="ctrl-group">
          <label title="Apply static electric field E to measure polarizability alpha_0 & Stark dipole shift">Stark E=<b id="lbl-stark">${X.starkFieldVPerA.toFixed(1)}</b> V/Å</label>
          <input id="ctrl-stark" type="range" min="-5" max="5" step="0.5" value="${X.starkFieldVPerA}" style="width:76px;" />
          <button id="ctrl-ionize" class="action${X.ionizedCation?` active-toggle`:``}" title="Remove 1 valence electron and re-solve GPU Dirac-KS cation (Delta-SCF I_1)">${X.ionizedCation?`Cation +1 (ΔSCF ON)`:`Ionize −1e⁻ (ΔSCF)`}</button>
        </div>`,document.getElementById(`ctrl-n`)?.addEventListener(`input`,e=>{X.n=Number(e.target.value),X.l=Math.min(X.l,X.n-1),X.m=Math.max(-X.l,Math.min(X.l,X.m)),oa(),Q(),$()}),document.getElementById(`ctrl-l`)?.addEventListener(`change`,e=>{X.l=Number(e.target.value),X.m=Math.max(-X.l,Math.min(X.l,X.m)),oa(),Q(),$()}),document.getElementById(`ctrl-m`)?.addEventListener(`change`,e=>{X.m=Number(e.target.value),oa(),$()}),document.getElementById(`ctrl-valence`)?.addEventListener(`click`,()=>{let e=Ri(Gr);X.n=e.n,X.l=e.l,X.m=e.m,oa(),Q(),$()}),document.getElementById(`ctrl-rand-nlm`)?.addEventListener(`click`,()=>{let e=1+Math.floor(Math.random()*92),t=2+Math.floor(Math.random()*5),n=Math.floor(Math.random()*t),r=Math.floor(Math.random()*(2*n+1))-n;Gr=e,Kr=null,lr.value=String(e),X.n=t,X.l=n,X.m=r,Ca(e,null,{preserveQuantumNumbers:!0})}),document.getElementById(`ctrl-xc`)?.addEventListener(`change`,e=>{X.functional=e.target.value,Ca(Gr,Kr,{preserveQuantumNumbers:!0})}),document.getElementById(`ctrl-rel`)?.addEventListener(`change`,e=>{X.relativisticSpinOrbit=!!e.target.checked,Ca(Gr,Kr,{preserveQuantumNumbers:!0})}),document.getElementById(`ctrl-pts`)?.addEventListener(`change`,e=>{X.pointCount=Number(e.target.value),document.getElementById(`lbl-pts`).textContent=`${Math.round(X.pointCount/1e3)}K`,oa(),$()}),document.getElementById(`ctrl-psize`)?.addEventListener(`input`,e=>{X.pointSize=Number(e.target.value),_a()}),document.getElementById(`ctrl-opac`)?.addEventListener(`input`,e=>{X.opacity=Number(e.target.value),_a()}),document.getElementById(`ctrl-cmode`)?.addEventListener(`change`,e=>{X.colorMode=Number(e.target.value),oa(),_a()}),document.getElementById(`ctrl-col-a`)?.addEventListener(`input`,e=>{X.shellColorA=e.target.value,_a()}),document.getElementById(`ctrl-col-b`)?.addEventListener(`input`,e=>{X.shellColorB=e.target.value,_a()}),document.getElementById(`ctrl-regen`)?.addEventListener(`click`,()=>{X.cloudSeed+=1,oa(),_a()}),document.getElementById(`ctrl-stark`)?.addEventListener(`input`,e=>{X.starkFieldVPerA=Number(e.target.value),document.getElementById(`lbl-stark`).textContent=X.starkFieldVPerA.toFixed(1),fa(),$()}),document.getElementById(`ctrl-ionize`)?.addEventListener(`click`,()=>{pa(!X.ionizedCation)})}for(let e of nr.querySelectorAll(`[data-aview]`))e.addEventListener(`click`,()=>{X.atomicViewMode=e.dataset.aview,Q(),$()});document.getElementById(`ctrl-guides`)?.addEventListener(`change`,e=>{X.showGuides=!!e.target.checked,_a()}),document.getElementById(`ctrl-rotate`)?.addEventListener(`click`,()=>{X.autoRotate=!X.autoRotate,Q()})}else if(G===`crystal`){let e=K===`element`,t=Li(),n=Math.max(100,Math.round(Number(t?.curieOrNeelTempK)||400)),r=Math.max(1200,Math.round(n*2.2)),i=Number(t?.superconductingTcK)||0,a=X.crystalViewMode===`tdks-atom`||X.crystalViewMode===`photon-shell`,o=X.crystalViewMode===`spin-llg`,s=X.crystalViewMode===`transport`;nr.innerHTML=`
      <div class="ctrl-group">
        <button class="action${X.crystalViewMode===`photon-shell`?` active-toggle`:``}" data-cview="photon-shell">2D Maxwell Slab (Snell)</button>
        ${e?`<button class="action${X.crystalViewMode===`bloch`?` active-toggle`:``}" data-cview="bloch">3D Bloch + Fermi</button>`:``}
        <button class="action${X.crystalViewMode===`lattice`?` active-toggle`:``}" data-cview="lattice">Crystal Cell</button>
        <button class="action${X.crystalViewMode===`tdks-atom`?` active-toggle`:``}" data-cview="tdks-atom">Atom TD-KS Cloud↔Photon</button>
        <button class="action${o?` active-toggle`:``}" data-cview="spin-llg" title="3D WebGPU Stochastic LLG Spin-Lattice: ferromagnetism, Curie T_C, hysteresis M(B) & Neel AFM!">3D Spin Lattice (LLG)</button>
        <button class="action${s?` active-toggle`:``}" data-cview="transport" title="3D WebGPU Drude-Boltzmann electron-phonon scattering, semiconductor activation & BCS T_c!">e⁻ Conduction / T_c</button>
      </div>
      ${a?`
      <div class="ctrl-group">
        <button id="ctrl-ps-rgb" class="action${X.photonModeMono?``:` active-toggle`}">White Light (RGB)</button>
        <button id="ctrl-ps-mono" class="action${X.photonModeMono?` active-toggle`:``}">Single λ</button>
        <label>λ=<b id="lbl-lambda">${X.probeWavelengthNm}</b>nm</label>
        <input id="ctrl-lambda" type="range" min="380" max="780" step="10" value="${X.probeWavelengthNm}" style="width:72px;" />
      </div>
      <div class="ctrl-group">
        <button id="ctrl-ps-fire" class="action gold-btn">Fire Pulse</button>
        <button id="ctrl-ps-play" class="action">${X.photonPlaying?`Pause`:`Play`}</button>
        ${e?`<label><input id="ctrl-ps-rel" type="checkbox" ${X.relativisticSpinOrbit?`checked`:``} /> Relativistic (Au Color!)</label>`:``}
      </div>`:``}
      ${o?`
      <div class="ctrl-group">
        <label>T=<b id="lbl-spin-t">${Math.round(X.spinTempK)}</b>K${n>0&&t?.curieOrNeelTempK>0?` (T_c=${Math.round(t.curieOrNeelTempK)}K)`:``}</label>
        <input id="ctrl-spin-t" type="range" min="10" max="${r}" step="10" value="${Math.min(r,Math.round(X.spinTempK))}" style="width:88px;" />
        <label>B_z=<b id="lbl-spin-b">${X.spinFieldBTesla.toFixed(1)}</b>T</label>
        <input id="ctrl-spin-b" type="range" min="-5" max="5" step="0.2" value="${X.spinFieldBTesla}" style="width:82px;" />
      </div>
      <div class="ctrl-group">
        <button id="ctrl-spin-sweep" class="action${X.spinSweepB?` active-toggle`:` gold-btn`}">${X.spinSweepB?`Stop Sweep`:`Sweep Hysteresis B`}</button>
        <button id="ctrl-spin-hot" class="action">Heat &gt; T_c</button>
        <button id="ctrl-spin-reset" class="action">Randomize</button>
      </div>`:``}
      ${s?`
      <div class="ctrl-group">
        <label>T=<b id="lbl-tr-t">${X.transportTempK<20?X.transportTempK.toFixed(1):Math.round(X.transportTempK)}</b>K${i>.1?` (T_c=${i.toFixed(1)}K)`:``}</label>
        <input id="ctrl-tr-t" type="range" min="1" max="1200" step="1" value="${Math.min(1200,Math.round(X.transportTempK))}" style="width:90px;" />
        <label>E=<b id="lbl-tr-e">${(X.transportEFieldVPerM/1e3).toFixed(0)}</b> kV/m</label>
        <input id="ctrl-tr-e" type="range" min="-20000" max="20000" step="2000" value="${X.transportEFieldVPerM}" style="width:78px;" />
      </div>
      <div class="ctrl-group">
        ${i>.1?`<button id="ctrl-tr-cryo" class="action gold-btn">Cryo T&lt;T_c (${Math.max(1,i*.35).toFixed(1)}K)</button>`:``}
        <button class="action" data-tr-t="80">80K</button>
        <button class="action" data-tr-t="300">300K</button>
        <button class="action" data-tr-t="900">900K</button>
        <button id="ctrl-tr-play" class="action">${X.transportPlaying?`Pause`:`Play`}</button>
      </div>`:``}`;for(let e of nr.querySelectorAll(`[data-cview]`))e.addEventListener(`click`,()=>{X.crystalViewMode=e.dataset.cview,X.crystalViewMode===`spin-llg`&&!ui&&ma(),X.crystalViewMode===`transport`&&!mi&&ha(),Q(),$()});document.getElementById(`ctrl-spin-t`)?.addEventListener(`input`,e=>{X.spinTempK=Number(e.target.value),document.getElementById(`lbl-spin-t`).textContent=String(Math.round(X.spinTempK))}),document.getElementById(`ctrl-spin-b`)?.addEventListener(`input`,e=>{X.spinFieldBTesla=Number(e.target.value),X.spinSweepB=!1,document.getElementById(`lbl-spin-b`).textContent=X.spinFieldBTesla.toFixed(1)}),document.getElementById(`ctrl-spin-sweep`)?.addEventListener(`click`,()=>{X.spinSweepB=!X.spinSweepB,X.spinSweepB&&(fi=[]),Q()}),document.getElementById(`ctrl-spin-hot`)?.addEventListener(`click`,()=>{X.spinTempK=Math.min(r,Math.round(Math.max(600,n*1.55))),X.spinFieldBTesla=0,X.spinSweepB=!1,Q()}),document.getElementById(`ctrl-spin-reset`)?.addEventListener(`click`,()=>{ui?.resetDomains({orderedBias:0,initSeed:Math.floor(Math.random()*1e6)+1}),fi=[],$()}),document.getElementById(`ctrl-tr-t`)?.addEventListener(`input`,e=>{X.transportTempK=Number(e.target.value),document.getElementById(`lbl-tr-t`).textContent=String(Math.round(X.transportTempK))}),document.getElementById(`ctrl-tr-e`)?.addEventListener(`input`,e=>{X.transportEFieldVPerM=Number(e.target.value),document.getElementById(`lbl-tr-e`).textContent=(X.transportEFieldVPerM/1e3).toFixed(0)}),document.getElementById(`ctrl-tr-cryo`)?.addEventListener(`click`,()=>{X.transportTempK=Math.max(.5,Number((i*.35).toFixed(1))),Q()});for(let e of nr.querySelectorAll(`[data-tr-t]`))e.addEventListener(`click`,()=>{X.transportTempK=Number(e.dataset.trT),Q()});document.getElementById(`ctrl-tr-play`)?.addEventListener(`click`,()=>{X.transportPlaying=!X.transportPlaying,Q()}),document.getElementById(`ctrl-ps-rgb`)?.addEventListener(`click`,()=>{X.photonModeMono=!1,Q(),$()}),document.getElementById(`ctrl-ps-mono`)?.addEventListener(`click`,()=>{X.photonModeMono=!0,Q(),$()}),document.getElementById(`ctrl-lambda`)?.addEventListener(`input`,e=>{X.probeWavelengthNm=Number(e.target.value),document.getElementById(`lbl-lambda`).textContent=String(X.probeWavelengthNm),X.photonModeMono=!0,Zr?.reset(X.probeWavelengthNm);for(let e=0;e<35;e+=1)Zr?.stepFs(.08);Qr?.reset(null,{nextProbeWavelengthNm:X.probeWavelengthNm}),Qr?.stepSync(100),Q(),$()}),document.getElementById(`ctrl-ps-fire`)?.addEventListener(`click`,()=>{Zr?.reset(X.probeWavelengthNm),Qr?.reset(null,{nextProbeWavelengthNm:X.probeWavelengthNm}),Qr?.stepSync(60),X.photonPlaying=!0,Q(),$()}),document.getElementById(`ctrl-ps-play`)?.addEventListener(`click`,()=>{X.photonPlaying=!X.photonPlaying,Q()}),document.getElementById(`ctrl-ps-rel`)?.addEventListener(`change`,e=>{X.relativisticSpinOrbit=!!e.target.checked,Ca(Gr,Kr,{preserveQuantumNumbers:!0})})}else if(G===`md`){let t=Math.max(20,Math.round(li?.meltingPointK||e?.thermodynamic?.meltingPointK||600)),n=Math.max(1500,Math.min(8e3,Math.round(t*3))),r=X.mdMode;nr.innerHTML=`
      <div class="ctrl-group">
        <button class="action${r===`equilibrium`?` active-toggle`:``}" data-mdmode="equilibrium">Equil + Phonons</button>
        <button class="action${r===`strain`?` active-toggle`:``}" data-mdmode="strain">Stress–Strain (K,G,ν)</button>
        <button class="action${r===`acoustic`?` active-toggle`:``}" data-mdmode="acoustic">Acoustic (v_L,v_T)</button>
        <button class="action${r===`shear`?` active-toggle`:``}" data-mdmode="shear">Shear Viscosity (η)</button>
        <button class="action${r===`thermal`?` active-toggle`:``}" data-mdmode="thermal">Heat Flow (κ)</button>
        <button class="action${r===`surface`?` active-toggle`:``}" data-mdmode="surface">Free Surface (γ)</button>
      </div>
      <div class="ctrl-group">
        <label>T=<b id="lbl-md-t">${X.mdTargetTempK}</b>K (T_m=${t}K)</label>
        <input id="ctrl-md-t" type="range" min="15" max="${n}" step="10" value="${Math.min(n,X.mdTargetTempK)}" style="width:92px;" />
        ${r===`equilibrium`?`<label><input id="ctrl-md-npt" type="checkbox" ${X.mdNptBarostat?`checked`:``} /> NPT α_V</label>`:``}
      </div>
      ${r===`strain`?`
      <div class="ctrl-group">
        <button id="ctrl-md-comp" class="action gold-btn">Compress −3%</button>
        <button id="ctrl-md-stretch" class="action">Stretch +3%</button>
        <button id="ctrl-md-shear" class="action">Shear γ_xy +4%</button>
        <button id="ctrl-md-reset" class="action">Reset</button>
      </div>`:r===`acoustic`?`
      <div class="ctrl-group">
        <button id="ctrl-md-pwave" class="action gold-btn">Fire P-Wave (v_L)</button>
        <button id="ctrl-md-swave" class="action">Fire S-Wave (v_T)</button>
        <button id="ctrl-md-reset" class="action">Reset Bar</button>
      </div>`:`
      <div class="ctrl-group">
        <button class="action" data-md-frac="0.30">Solid</button>
        <button class="action gold-btn" data-md-frac="1.20">Melt</button>
        <button class="action" data-md-frac="2.40">Vapor</button>
        <button id="ctrl-md-play" class="action">${X.mdPlaying?`Pause`:`Play`}</button>
        <button id="ctrl-md-reset" class="action">Reset</button>
      </div>`}`;for(let e of nr.querySelectorAll(`[data-mdmode]`))e.addEventListener(`click`,()=>{ga(null,e.dataset.mdmode),Q(),$()});document.getElementById(`ctrl-md-t`)?.addEventListener(`input`,e=>{X.mdTargetTempK=Number(e.target.value),document.getElementById(`lbl-md-t`).textContent=String(X.mdTargetTempK)}),document.getElementById(`ctrl-md-npt`)?.addEventListener(`change`,e=>{X.mdNptBarostat=!!e.target.checked}),document.getElementById(`ctrl-md-comp`)?.addEventListener(`click`,()=>{Y?.applyStrain({strainX:-.03})}),document.getElementById(`ctrl-md-stretch`)?.addEventListener(`click`,()=>{Y?.applyStrain({strainX:.03})}),document.getElementById(`ctrl-md-shear`)?.addEventListener(`click`,()=>{Y?.applyStrain({shearXY:.04})}),document.getElementById(`ctrl-md-pwave`)?.addEventListener(`click`,()=>{Y?.injectAcousticPulse({polarization:`longitudinal`,amplitude:.36})}),document.getElementById(`ctrl-md-swave`)?.addEventListener(`click`,()=>{Y?.injectAcousticPulse({polarization:`transverse`,amplitude:.36})});for(let e of nr.querySelectorAll(`[data-md-frac]`))e.addEventListener(`click`,()=>{let r=Number(e.dataset.mdFrac);X.mdTargetTempK=Math.max(15,Math.min(n,Math.round(t*r))),document.getElementById(`lbl-md-t`).textContent=String(X.mdTargetTempK);let i=document.getElementById(`ctrl-md-t`);i&&(i.value=String(X.mdTargetTempK))});document.getElementById(`ctrl-md-play`)?.addEventListener(`click`,()=>{X.mdPlaying=!X.mdPlaying,Q()}),document.getElementById(`ctrl-md-reset`)?.addEventListener(`click`,()=>{ga(X.mdTargetTempK,X.mdMode),Q(),$()})}else if(G===`compound`){let e=Ur?.energiesEv?.length||0,t=J?.bundle?.materialKey||_r.value||`H2O`;nr.innerHTML=`
      ${e>=2?`<div class="ctrl-group">
        <label>CI-NEB ξ=<b id="lbl-neb-xi">${(X.nebImageIdx/Math.max(1,e-1)).toFixed(2)}</b> (Img #${X.nebImageIdx}/${e-1}${X.nebImageIdx===Ur.saddleImageIndex?` ‡ TS`:``})</label>
        <input id="ctrl-neb-xi" type="range" min="0" max="${e-1}" step="1" value="${X.nebImageIdx}" style="width:96px;" />
        <button id="ctrl-neb-play" class="action">${X.nebPlaying?`Pause MEP`:`Play Reaction Path`}</button>
      </div>`:``}
      <div class="ctrl-group">
        <label>Orbital</label>
        <button class="action${X.molOrbitalMode===0?` active-toggle`:``}" data-c-mol="0">Total ρ</button>
        <button class="action${X.molOrbitalMode===1?` active-toggle`:``}" data-c-mol="1">HOMO</button>
        <button class="action${X.molOrbitalMode===2?` active-toggle`:``}" data-c-mol="2">LUMO</button>
      </div>
      ${J?`<div class="ctrl-group">
        <button id="ctrl-backfeed-now" class="action gold-btn">Backfeed ${t} → All Property, Optics, MD &amp; Polytope Sims</button>
      </div>`:``}`,document.getElementById(`ctrl-neb-xi`)?.addEventListener(`input`,e=>{X.nebImageIdx=Number(e.target.value),X.nebPlaying=!1,Q(),$()}),document.getElementById(`ctrl-neb-play`)?.addEventListener(`click`,()=>{X.nebPlaying=!X.nebPlaying,Q()});for(let e of nr.querySelectorAll(`[data-c-mol]`))e.addEventListener(`click`,()=>{X.molOrbitalMode=Number(e.dataset.cMol),oa(),wa(),Q(),$()});document.getElementById(`ctrl-backfeed-now`)?.addEventListener(`click`,()=>{Da(J,`crystal`)})}else G===`polytope`&&(nr.innerHTML=`
      <div class="ctrl-group">
        <label>Pressure Domain</label>
        <button id="ctrl-poly-lab" class="action${X.polytopeRegime===`lab`?` active-toggle`:``}">Lab (10 GPa)</button>
        <button id="ctrl-poly-plan" class="action${X.polytopeRegime===`planetary`?` active-toggle`:``}">Planetary Core (1 TPa)</button>
      </div>
      <div class="ctrl-group">
        <label>Hover or click anywhere on the GPU phase diagram to run live <code>eval_polytope_atlas_2d</code> (incl. hatched fail-closed outer border!)</label>
      </div>`,document.getElementById(`ctrl-poly-lab`)?.addEventListener(`click`,()=>Sa(`lab`)),document.getElementById(`ctrl-poly-plan`)?.addEventListener(`click`,()=>Sa(`planetary`)))}function _a(){if(W)if(G===`nuclear`){if(K===`compound`&&zr)W.renderVolume3D({gpuVec4Buffer:zr.buffer,dim:zr.dim,channels:4,yaw:Ci,pitch:wi,tint:[1,.58,.3]});else if(X.nuclearViewMode===`fission`&&vi)W.renderVolume3D({gpuVec4Buffer:vi.buffer,dim:vi.dim,channels:4,yaw:Ci,pitch:wi,tint:[1,.62,.34]});else if(q?.visualData?.nuclear){let e=q.visualData.nuclear;W.renderVolume3D({vec4Data:e.volumeData,dim:e.volDim,channels:4,yaw:Ci,pitch:wi,tint:[1,.62,.34]})}}else if(G===`atomic`)if(K===`compound`&&J?.visualData?.molQm)if(X.atomicViewMode===`cloud`&&Yr)W.renderOrbitalPointCloud({pointsBuffer:Yr.pointsBuffer,pointCount:Yr.pointCount,yaw:Ci,pitch:wi,camDist:Ti,pointSize:X.pointSize*1.15,opacity:Math.min(.65,X.opacity*1.4),alternateShellColors:!0,colorA:[1,.65,.32],colorB:[.36,.72,1],showGuides:X.showGuides,showNucleus:!1});else{let e=J.visualData.molQm;W.renderVolume3D({vec4Data:e.volumeData,dim:e.volDim,channels:4,yaw:Ci,pitch:wi,tint:[.75,.52,.99]})}else K===`compound`&&Br?W.renderStaticCrystalLattice({...Br,yaw:Ci,pitch:wi,tint:J?.bundle?.electromagnetic?.opticalSrgb||[.75,.82,.95]}):X.atomicViewMode===`cloud`&&Jr?W.renderOrbitalPointCloud({pointsBuffer:Jr.pointsBuffer,pointCount:Jr.pointCount,yaw:Ci,pitch:wi,camDist:Ti,pointSize:X.pointSize,opacity:X.opacity,alternateShellColors:X.alternateShellColors,colorA:Ni(X.shellColorA),colorB:Ni(X.shellColorB),showGuides:X.showGuides,showNucleus:!0,starkMixLambda:Si?.starkMixLambda??0,eFieldNorm:(X.starkFieldVPerA||0)/5}):Rr&&W.renderVolume3D({gpuVec4Buffer:Rr.buffer,dim:Rr.dim,channels:4,yaw:Ci,pitch:wi,tint:[.34,.76,1]});else if(G===`crystal`){let e=Li();if(X.crystalViewMode===`tdks-atom`&&Xr&&Zr)W.renderTdksPhotonCloudScene({pairCloud:Xr,blochSession:Zr,yaw:(Ci-.42)*.8+.14,pitch:Math.max(-.85,Math.min(.85,(wi-.28)*.8+.12)),camDist:Ti,modeMono:X.photonModeMono,probeRgb:Pi(X.probeWavelengthNm),emergentReflSrgb:$r?.emergentReflectedSrgb||e?.opticalSrgb||[.94,.86,.65],pointSize:X.pointSize});else if(X.crystalViewMode===`photon-shell`&&Qr){let t=sa(),n=Nr?700:1800;W.renderPhotonShellScene({photonSession:Qr,shellPointsBuffer:t?.pointsBuffer??null,shellPointCount:Math.min(n,t?.pointCount||n),yaw:(Ci-.42)*.45,pitch:Math.max(.25,Math.min(1.48,1.08+(wi-.28)*.6)),camDist:Math.max(2.2,Math.min(4.6,Ti+.3)),modeMono:X.photonModeMono,probeRgb:Pi(X.probeWavelengthNm),slabTint:e?.opticalSrgb||[.82,.86,.94],waveGain:1.05})}else if(X.crystalViewMode===`spin-llg`&&ui)W.renderSpinLatticeScene({spinsBuffer:ui.getActiveSpinsBuffer(),dims:ui.dims,yaw:Ci,pitch:wi,camDist:Math.max(2.1,Math.min(5,Ti+.25)),fieldBZTesla:X.spinFieldBTesla,isAntiferro:ui.params.magneticPhase===`antiferromagnetic`});else if(X.crystalViewMode===`transport`&&mi){let e=mi.getParams();W.renderElectronTransportScene({posBuffer:mi.posBuffer,velBuffer:mi.velBuffer,carrierCount:mi.carrierCount,yaw:Ci,pitch:wi,camDist:Ti,eFieldVPerM:X.transportEFieldVPerM,phononVibAmp:e.phononVibAmp,timeS:performance.now()*.001,isSuperconducting:e.isSuperconducting})}else if(X.crystalViewMode===`bloch`&&K===`element`&&q?.visualData?.bulk){let t=q.visualData.bulk;W.renderVolume3D({scalarData:t.blochDensity3d,dim:t.blochDensityGridN,channels:1,yaw:Ci,pitch:wi,tint:e?.opticalSrgb||[.34,.88,.65],showFermiIso:t.isMetal})}else Y&&W.renderLiveMd({positionsBuffer:Y.positionsBuffer,velocitiesBuffer:Y.velocitiesBuffer,atomCount:Y.atomCount,boxLengthsA:Y.boxLengthsA,yaw:Ci,pitch:wi,tint:e?.opticalSrgb||[.65,.82,.96],velocityColorScale:16})}else if(G===`md`&&Y){let e=Li();W.renderLiveMd({positionsBuffer:Y.positionsBuffer,velocitiesBuffer:Y.velocitiesBuffer,atomCount:Y.atomCount,boxLengthsA:Y.boxLengthsA,yaw:Ci,pitch:wi,tint:e?.opticalSrgb||[.65,.8,.96],velocityColorScale:32})}else if(G===`compound`&&J){let e=Wr[X.nebImageIdx]||null;e?.pointsBuffer?W.renderOrbitalPointCloud({pointsBuffer:e.pointsBuffer,pointCount:e.pointCount,yaw:Ci,pitch:wi,camDist:Ti,pointSize:.015,opacity:.34,alternateShellColors:!0,colorA:[1,.64,.3],colorB:[.46,.72,1],showGuides:X.showGuides,showNucleus:!1}):Yr?.pointsBuffer?W.renderOrbitalPointCloud({pointsBuffer:Yr.pointsBuffer,pointCount:Yr.pointCount,yaw:Ci,pitch:wi,camDist:Ti,pointSize:.015,opacity:.34,alternateShellColors:!0,colorA:[1,.64,.3],colorB:[.46,.72,1],showGuides:X.showGuides,showNucleus:!1}):Br&&W.renderStaticCrystalLattice({...Br,yaw:Ci,pitch:wi,tint:J.bundle.electromagnetic.opticalSrgb||[.75,.82,.95]})}else G===`polytope`&&Vr&&W.renderPolytopeAtlas(Vr,X.polytopeProbe)}function $(){if(W){if(_a(),Vi(``),G===`nuclear`){if(K===`compound`&&J){let e=J.bundle,t=e.nuclear.isotopologueSites||[];Bi(`WebGPU 3D Composite Nuclear Fermi Volume — ${e.materialKey} (Backfed Compound)`,`Total Z=${e.nuclear.totalProtonsZ} · A=${e.nuclear.totalNucleonsA} · Molar Mass=${Z(e.nuclear.molarMassU,3)} u · ΣB=${Z(e.nuclear.totalBindingEnergyMeV,1)} MeV`),q?.visualData?.nuclear&&(Sr.textContent=`GPU 118×200 Chart of Nuclides (Click Any Isotope)`,ea(ar,q.visualData.nuclear)),Cr.textContent=`Constituent Nuclei Binding Energy B/A (${e.materialKey})`;let n=t.map((e,t)=>t),r=t.map(e=>E(e.Z,e.A).bindingPerNucleonMeV);$i(or,n.length>=2?n:[0,1],r.length>=2?r:[r[0]||0,r[0]||0],{label:`Constituent sites: ${t.map(e=>`${u(e.Z)}-${e.A}`).join(`, `)}`,color:`#facc15`,yMin:0}),wr.textContent=`Constituent Nuclear Charge Radii R_rms (fm)`;let i=t.map(e=>E(e.Z,e.A).chargeRadiusFm);$i(sr,n.length>=2?n:[0,1],i.length>=2?i:[i[0]||0,i[0]||0],{label:`Fermi charge radius R_rms (fm) per atomic site`,color:`#ff9c54`,yMin:0})}else if(q?.visualData?.nuclear){let e=q.visualData.nuclear;if(X.nuclearViewMode===`fission`&&yi){let t=yi,n=X.fissionBeta2>=t.scissionBeta?`SCISSION (2 FRAGMENTS)`:X.fissionBeta2>=t.saddleBeta*.85?`NEAR SADDLE BARRIER`:`ELONGATING`;Bi(`WebGPU 3D Bohr–Wheeler Nuclear Fission — ${e.isotope} (β₂=${X.fissionBeta2.toFixed(2)} · ${n})`,`Fissility x=${Z(t.fissility,3)} · Barrier E_f=${Z(t.barrierMeV,2)} MeV (β*=${Z(t.saddleBeta,2)}) · E_surf0=${Z(t.eSurf0MeV,1)} MeV · E_coul0=${Z(t.eCoul0MeV,1)} MeV`),Vi(`<div class="live-meter">Live 3D Liquid-Drop Fission: β₂=${X.fissionBeta2.toFixed(2)} · Saddle β*=${Z(t.saddleBeta,2)} · E_f=${Z(t.barrierMeV,2)} MeV · ${n}</div>`),Sr.textContent=`GPU 118×200 Chart of Nuclides (Click to Pick Z, A)`,ea(ar,e),Cr.textContent=`Bohr–Wheeler Deformation Barrier ΔE(β₂) — ${e.isotope}`,$i(or,Array.from(t.betas),Array.from(t.deltaEMeV),{label:`ΔE(β₂) MeV · Barrier E_f=${Z(t.barrierMeV,1)} MeV`,color:`#fb923c`,hLine:{y:0,color:`#64748b`,label:`0 MeV`},vLine:{x:X.fissionBeta2,color:`#38bdf8`,label:`β=${X.fissionBeta2.toFixed(2)}`}})}else if(X.nuclearViewMode===`bateman`)if(Bi(`Exact Nucleon-Conserving Bateman Decay Kinetics — ${e.isotope}`,Hr?.steps?.length?`Chain: ${Hr.steps.slice(0,4).map(e=>`${e.isotope}→${e.daughterIsotope}(${e.mode})`).join(` → `)} · Total Q=${Z(Hr.totalEnergyMeV,2)} MeV`:`${e.isotope} is stable (zero decay flux; try U-235, Co-60, or C-14!)`),Sr.textContent=`GPU 118×200 Chart of Nuclides (Click to Pick Z, A)`,ea(ar,e),Cr.textContent=`Bateman Isotope Populations N_i(t)/N₀ — ${e.isotope}`,bi?.curves?.length){let e=[`#facc15`,`#38bdf8`,`#c084fc`,`#34d399`];Qi(or,bi.curves.map((t,n)=>({xs:bi.tHalfUnits,ys:t.frac,color:e[n%e.length],width:2})),{label:bi.curves.map(e=>e.name).join(` → `)+` vs t / t½`,yMin:0,yMax:1.05}),Vi(`<div class="live-meter">Bateman Ledger: ${bi.curves.map(e=>e.name).join(` → `)} (t½=${Z(bi.firstHalfLifeS,2)} s · ΣA_i N_i exact)</div>`)}else $i(or,[0,1,2,3],[1,1,1,1],{label:`${e.isotope} stable (N/N₀ = 1.0)`,color:`#34d399`,yMin:0,yMax:1.1});else Bi(`WebGPU 3D Volumetric Nuclear Fermi Density — ${e.isotope} (R_rms = ${Z(e.chargeRadiusFm,2)} fm)`,`B/A = ${Z(e.bindingPerNucleonMeV,3)} MeV · I^π = ${e.spinI}${e.parity} · μ_I = ${Z(e.magneticMomentMuN,2)} μ_N · Mode: ${e.dominantMode}`),ni&&Vi(`<div class="live-meter">Live GPU TDSE (step ${ni.stepCount}): P_well=${Z(ni.pInside*100,1)}% · P_barrier=${Z(ni.pBarrier*100,2)}% · P_tunneled=${Z(ni.pTunneled*100,3)}%</div>`),Sr.textContent=`GPU 118×200 Chart of Nuclides (Click to Pick Z, A)`,ea(ar,e),Cr.textContent=`Live GPU TDSE Tunneling vs WKB Gamow Barrier (Q_α = ${Z(e.qAlphaMeV,2)} MeV)`,ta(or,e,ni);wr.textContent=`Fermi Proton/Neutron Skin Profile ρ(r) — ${e.isotope}`;let t=Array.from({length:40},(t,n)=>n/39*Math.max(8,e.chargeRadiusFm*2.1)),n=t.map(t=>1/(1+Math.exp((t-e.chargeRadiusFm)/.54))),r=t.map(t=>e.N/Math.max(1,e.Z)/(1+Math.exp((t-e.chargeRadiusFm*1.03)/.55)));Qi(sr,[{xs:t,ys:n,color:`#ff9c54`,width:2},{xs:t,ys:r,color:`#38bdf8`,width:1.6}],{label:`Proton (orange) vs Neutron (blue) density vs r (fm)`,yMin:0})}}else if(G===`atomic`){if(K===`compound`&&J){let e=J.bundle,t=J.visualData.molQm;if(Bi(`WebGPU 3D Molecular RHF ${[`Total Electron Density ρ(r)`,`HOMO Signed Orbital ψ`,`LUMO Signed Orbital ψ`][X.molOrbitalMode]||`Total ρ`} — ${e.materialKey} (Backfed Compound)`,t?`GPU Löwdin RHF · ${Yr?.pointCount?.toLocaleString()||`0`} GPU samples · E = ${Z(t.totalEnergyHa,3)} Ha · μ = ${Z(t.dipoleDebye,2)} D · Gap = ${Z(t.homoLumoGapEv,2)} eV`:`Ionic/Covalent Crystal Prototype (${e.mechanical.crystalStructure}) · Pauling Ionicity = ${Z(e.atomic.paulingIonicity,2)}`),t?.orbitalEnergiesHa){Sr.textContent=`GPU Molecular Orbital Spectrum (${e.materialKey})`,$i(ar,t.orbitalEnergiesHa.map((e,t)=>t),t.orbitalEnergiesHa,{label:`MO Energy (Ha) · HOMO-LUMO Gap = ${Z(t.homoLumoGapEv,2)} eV`,color:`#c084fc`}),Cr.textContent=`Mulliken Atomic Charges q_i (${e.materialKey})`;let n=t.mullikenCharges||[0,0];$i(or,n.map((e,t)=>t),n,{label:`Atomic charges (e): ${n.map(e=>Z(e,2)).join(`, `)}`,color:`#34d399`,hLine:{y:0,color:`#64748b`,label:`0e`}})}wr.textContent=`Derived Optical Dispersion — ${e.materialKey}`,ra(sr,e.electromagnetic.spectralWavelengthsNm,e.electromagnetic.spectralReflectance,e.electromagnetic.spectralNRe,e.electromagnetic.opticalSrgb,e.materialKey)}else if(q?.visualData?.atom){let e=q.visualData.atom,t=e.radialGrid,n=q.bundle.atomic.unpairedElectrons||0,r=Jr?.sourceKind===`webgpu-kohn-sham-eigenstate`?`EXACT GPU Kohn–Sham Eigenstate u_nl(r)`:`Slater-KS Screened Associated Laguerre R_nl(r)`;Bi(`WebGPU 3D Schrödinger / Dirac–KS Orbital |ψ_${X.n}${ki[X.l]||X.l},${X.m}|² — ${e.symbol}${X.ionizedCation?`⁺ (ΔSCF Cation)`:``} (Z=${e.atomicNumberZ})`,`${Jr?.pointCount?.toLocaleString()||`0`} GPU samples · ${r} · ${e.relativisticMethod} · E = ${Z(e.totalEnergyHa,2)} Ha`);let i=Si?` · α₀=${Z(Si.alpha0Angstrom3,2)} Å³ (${Z(Si.alpha0Bohr3,1)} a₀³)${Math.abs(X.starkFieldVPerA)>.05?` · p=${Z(Si.inducedDipoleDebye,2)} D · ΔE=${Z(Si.starkShiftEv*1e3,1)} meV`:``}`:``,a=X.ionizedCation&&xi?` · ΔSCF I₁=${Z(xi.ionizationEnergyEv,2)} eV (−1e⁻ ${xi.removedShell})`:``;Vi(`<div class="live-meter">n=${X.n}, l=${X.l} (${ki[X.l]||X.l}), m=${X.m} · Nodes=${Jr?.radialNodeCount??X.n-X.l-1}${i}${a}</div>`),Sr.textContent=`Radial Probability 4πr²ρ(r) & Selected Subshell |u_nl(r)|²`;let o=t.r.map((e,n)=>4*Math.PI*e*e*t.rho[n]),s=t.r.findIndex(e=>e>Math.max(6,(Jr?.rExtentBohr||6)*1.1)),c=s>12?s:t.r.length,l=[{xs:t.r.slice(0,c),ys:o.slice(0,c),color:`#56c2ff`,width:1.8}],u=e.orbitals.findIndex(e=>e.n===X.n&&e.l===X.l);if(u>=0&&e.orbitalWavefunctions?.[u]){let n=e.orbitalWavefunctions[u],r=Math.max(1e-5,...o.slice(0,c)),i=Math.max(1e-8,...Array.from(n.slice(0,c),e=>e*e));l.push({xs:t.r.slice(0,c),ys:Array.from(n.slice(0,c),e=>e*e/i*r*.9),color:`#a78bfa`,width:2})}Qi(ar,l,{label:`Total 4πr²ρ (blue) & Active ${X.n}${ki[X.l]} |u|² (violet)`,yMin:0}),Cr.textContent=`Relativistic Orbital Eigenvalues ε_nl & Spin-Orbit j± (Ha)`;let d=e.orbitals.filter(e=>Number(e.occupancy??1)>0),f=d.map((e,t)=>t);Qi(or,[{xs:f,ys:d.map(e=>e.energyHa),color:`#34d399`,width:2},{xs:f,ys:d.map(e=>e.energyJPlusHa??e.energyHa),color:`#facc15`,width:1.3},{xs:f,ys:d.map(e=>e.energyJMinusHa??e.energyHa),color:`#f472b6`,width:1.3}],{label:`Subshell ε_nl (green), j+ (gold), j− (pink) · ${X.relativisticSpinOrbit?`Rel+SO ON`:`Non-Rel`}`}),wr.textContent=`Angular Spherical Harmonic |Y_${X.l},${X.m}(θ)| Cross-Section`,ia(sr,X.l,X.m,e.symbol,n)}}else if(G===`crystal`){let e=Ii(),t=Li(),n=$r;if(X.crystalViewMode===`spin-llg`&&e){let n=di,r=n?.magneticPhase||t?.magneticPhase||`diamagnetic`;if(Bi(`Live WebGPU 3D Stochastic LLG Spin-Lattice — ${e.materialKey} (${r.toUpperCase()})`,n?`${n.spinCount} GPU spins · J=${Z(n.exchangeJEv*1e3,2)} meV · T=${Math.round(n.temperatureK)} K${n.curieOrNeelTempK>0?` (T_c=${Math.round(n.curieOrNeelTempK)} K)`:``} · B_z=${n.fieldBZTesla.toFixed(1)} T · M_z=${Z(n.magnetizationZ,3)} · |M_stag|=${Z(n.staggeredOrderMag,3)}`:`Stepping 3D sLLG spin lattice on WebGPU…`),n&&Vi(`<div class="live-meter">Phase: <b>${r.toUpperCase()}</b> · M_z=<b>${Z(n.magnetizationZ,3)}</b> · |M|=<b>${Z(n.magnetizationMag,3)}</b> · Néel |M_stag|=<b>${Z(n.staggeredOrderMag,3)}</b> · ⟨s_i·s_j⟩=${Z(n.neighborAlign,3)}</div>`),Sr.textContent=`Live Spin Hysteresis / Field Response M_z(B_z) — ${e.materialKey}`,fi.length>=2){$i(ar,fi.map(e=>e.B),fi.map(e=>e.Mz),{label:`M_z vs B_z (T) · Sweep B to trace ferromagnetic hysteresis!`,color:`#facc15`,yMin:-1.05,yMax:1.05,hLine:{y:0,color:`#64748b`,label:`0`}}),Cr.textContent=`Ferro |M| (gold) vs Néel Antiferro |M_stag| (cyan)`;let e=fi.map((e,t)=>t);Qi(or,[{xs:e,ys:fi.map(e=>e.Mmag),color:`#facc15`,width:2},{xs:e,ys:fi.map(e=>e.Mstag),color:`#38bdf8`,width:2}],{label:`|M| vs |M_stag| order parameters (drops to ~0 above T_c!)`,yMin:0,yMax:1.05})}}else if(X.crystalViewMode===`transport`&&e){let n=hi,r=n?.isSuperconducting?`SUPERCONDUCTING BCS CONDENSATE (ρ = 0 Ω·m!)`:n?.isMetal?`DRUDE–BLOCH–GRÜNEISEN METAL`:`SEMICONDUCTOR / INSULATOR (E_g=${Z(t?.bandGapEv,2)} eV)`;if(Bi(`Live WebGPU 3D Electron–Phonon & BCS Transport — ${e.materialKey}`,n?`${r} · T=${n.temperatureK<20?n.temperatureK.toFixed(1):Math.round(n.temperatureK)} K · Mobile=${n.mobileCount}/${n.carrierCount}${n.cooperCount>0?` · Cooper=${n.cooperCount}`:``} · Scatters=${n.scatterEvents}/step`:`Stepping 3D Drude–Boltzmann electron transport on WebGPU…`),n&&Vi(`<div class="live-meter">GPU σ(T)=<b>${n.isSuperconducting?`∞ S/m (ZERO RESISTANCE!)`:`${Z(n.sigmaGpuSPerM,2)} S/m (ρ=${Z(n.resistivityGpuOhmM,2)} Ω·m)`}</b> · Drift ⟨J_x⟩=${Z(n.meanDriftNorm,3)} · Phonon Scatters=${n.scatterEvents}/step</div>`),Sr.textContent=`Live GPU Carrier Drift & Phonon Scattering — ${e.materialKey}`,gi.length>=2){let e=gi.map((e,t)=>t);Qi(ar,[{xs:e,ys:gi.map(e=>Math.abs(e.drift)*4),color:`#38bdf8`,width:2},{xs:e,ys:gi.map(e=>e.scatter),color:`#fb923c`,width:1.8}],{label:`Scaled Drift Current (cyan) vs Phonon Scatter Rate (orange)`,yMin:0})}Cr.textContent=`Conductivity Curve log10 σ(T) (1..1200 K) — ${e.materialKey}`;let i=Array.from({length:30},(e,t)=>1+t/29*1199);$i(or,i,i.map(n=>{let r=Number(t?.superconductingTcK)||0;if(t?.isMetal&&r>.1&&n<r)return 12;Math.max(25,e.mechanical?.debyeTemperatureK||250);let i=Math.max(1e-18,t?.electricalConductivitySPerM||1e6);if(t?.isMetal)return Math.log10(Math.max(1,300/Math.max(15,n)*i));let a=Math.max(.1,t?.bandGapEv||2);return Math.max(-18,Math.min(8,Math.log10(i)+a/(2*8617e-8)*(1/300-1/Math.max(10,n))/Math.LN10))}),{label:`log10 σ(T) S/m vs T(K)`,color:`#34d399`,vLine:{x:X.transportTempK,color:`#facc15`,label:`${Math.round(X.transportTempK)}K`}})}else if((X.crystalViewMode===`tdks-atom`||X.crystalViewMode===`photon-shell`)&&e){let r=n?.channels?.[0],i=n?.channels?.[1],a=n?.channels?.[2],o=n?.channels?.[3],s=i?.nMeasuredFdtd??o?.nMeasuredFdtd??r?.nMeasuredFdtd,c=Zr?.channels?.[X.photonModeMono?3:2];if(X.crystalViewMode===`tdks-atom`&&Xr&&Zr){let t=`${Xr.n0}${ki[Xr.l0]||``}`,n=`${Xr.n1}${ki[Xr.l1]||``}`;Bi(`Live WebGPU TD-KS Electron Cloud |ψ(r,t)|² ↔ Photon Wavepacket — ${e.materialKey} (${t} ↔ ${n})`,`${Xr.pointCount.toLocaleString()} GPU samples · ΔE=${Z(Zr.transEv,2)} eV (${Zr.transLabel}) · Excited |c_${n}|²=${Z((c?.rho11||0)*100,1)}% · Dipole d(t)=${Z(c?.dipole||0,2)} · t=${Z(Zr.getTimeFs(),2)} fs`)}else if(n){let t=n.oscillators.filter(e=>e.active).slice(0,2).map(e=>`${e.label} @ ${Z(e.energyEv,2)} eV`).join(` | `)||`Drude Free-Electron Gas`;Bi(`Live WebGPU 2D (128×128) Maxwell–ADE-FDTD Bulk Optical Cavity — ${e.materialKey}`,`${n.isMetal?`Drude ω_p=${Z(n.plasmaEv,2)} eV`:`Dielectric Gap=${Z(e.electromagnetic.bandGapEv,2)} eV`} · ${t} · t=${Z(n.simTimeFs,2)} fs`)}if(n&&r&&i&&a){let o=r.reflectance+i.reflectance+a.reflectance>.04,c=Fi(o?n.emergentReflectedSrgb:t?.opticalSrgb||n.analyticReflectedSrgb),l=i.refractAngleDeg==null?``:` · Snell θ_t=${Z(i.refractAngleDeg,1)}°`,u;if(X.crystalViewMode===`tdks-atom`&&Zr){let e=Zr.channels[0],t=Zr.channels[1],n=Zr.channels[2];u=`TD-KS Shell Excitation |c₁|²: <span style="color:#f87171">610nm=${Z(e.rho11*100,1)}%</span> · <span style="color:#4ade80">535nm=${Z(t.rho11*100,1)}%</span> · <span style="color:#60a5fa">440nm=${Z(n.rho11*100,1)}%</span> | Blue Abs=${Z(n.absorbedEnergy,2)}`}else u=n.isMetal?`2D FDTD Reflected R: <span style="color:#f87171">610nm=${Z(r.reflectance*100,1)}%</span> · <span style="color:#4ade80">535nm=${Z(i.reflectance*100,1)}%</span> · <span style="color:#60a5fa">440nm=${Z(a.reflectance*100,1)}%</span> | Blue Shell Abs=${Z(a.absorption*100,1)}%`:`Live 2D FDTD n(λ) = <b>${s?Z(s,3):`propagating…`}</b> (analytic ${Z(i.analyticNRe,2)})${l} · T=${Z(i.transmittance*100,1)}%`;Vi(`<div class="live-meter">${u}</div><div class="live-meter"><i class="swatch" style="background:${c};"></i> ${o?`Emergent FDTD Reflected Color`:`GPU Optical Reflected Color`} ${K===`element`?X.relativisticSpinOrbit?`(Relativistic ON)`:`(Relativistic OFF)`:`(Backfed Compound)`}</div>`),Sr.textContent=`Live 2D Maxwell–FDTD R(λ) vs Electron-Shell Absorption A(λ)`,na(ar,n,`${e.materialKey} · `)}}else if(K===`element`&&q?.visualData?.bulk){let e=q.visualData.bulk;Bi(`WebGPU 3D FFT Bloch Charge Density & Fermi Isosurface — ${e.symbol} (${e.crystalStructure})`,`a₀ = ${Z(e.latticeConstantA,2)} Å · ρ = ${Z(e.densityKgPerM3,0)} kg/m³ · E_F = ${Z(e.fermiEnergyEv,2)} eV · Gap = ${Z(e.bandGapEv,2)} eV · ${t.magneticPhase}`),Sr.textContent=`All Brillouin Bands E_n(k) & Fermi Level E_F`;let n=e.bandsEv[0]?.length||1,r=e.bandsEv.map((e,t)=>t),i=[`#56c2ff`,`#a78bfa`,`#34d399`,`#f472b6`,`#fb923c`,`#38bdf8`,`#c084fc`,`#94a3b8`],a=Array.from({length:n},(t,n)=>({xs:r,ys:e.bandsEv.map(e=>e[n]),color:i[n%i.length],width:n<4?1.7:1.15})),o=(e.kPathLabels||[]).map((e,t)=>e?{x:t,label:e}:null).filter(Boolean);Qi(ar,a,{label:`${n} Bloch Bands (eV) · E_F=${Z(e.fermiEnergyEv,1)} eV`,hLine:{y:e.fermiEnergyEv,color:`#facc15`,label:`E_F`},xTicks:o})}else e&&Bi(`WebGPU 3D Crystal Lattice — ${e.materialKey} (${e.mechanical.crystalStructure})`,`a₀ = ${Z(e.mechanical.latticeConstantA,2)} Å · ρ = ${Z(e.mechanical.densityKgPerM3,0)} kg/m³ · Gap = ${Z(e.electromagnetic.bandGapEv,2)} eV`);if(!(X.crystalViewMode===`spin-llg`||X.crystalViewMode===`transport`)){if(K===`element`&&q?.visualData?.bulk){let e=q.visualData.bulk;Cr.textContent=`Electronic DOS g(E) & Brillouin Fermi Level`,Qi(or,[{xs:Array.from(e.dosEnergyEv),ys:Array.from(e.dosValues),color:`#f472b6`,width:2}],{label:`g(E_F)=${Z(e.dosAtFermiStatesPerEvAtom,2)} · ${t.magneticPhase}`,yMin:0,vLine:{x:e.fermiEnergyEv,color:`#facc15`,label:`E_F`}})}else if(n){Cr.textContent=`FDTD Channel Energy Balance (R + T + A = 1.0)`;let e=n.channels.map(e=>e.wavelengthNm);Qi(or,[{xs:e,ys:n.channels.map(e=>e.reflectance*100),color:`#facc15`,width:2},{xs:e,ys:n.channels.map(e=>e.transmittance*100),color:`#38bdf8`,width:2},{xs:e,ys:n.channels.map(e=>e.absorption*100),color:`#c084fc`,width:1.8}],{label:`FDTD R% (gold), T% (cyan), Shell Abs% (violet)`,yMin:0,yMax:105})}}wr.textContent=`GPU Optical UV-Vis Reflectance R(λ) & n(λ) (380–780 nm)`,ra(sr,t?.spectralWavelengthsNm,t?.spectralReflectance,t?.spectralNRe,t?.opticalSrgb,`${e?.materialKey||``} (${X.relativisticSpinOrbit?`Rel`:`NonRel`})`)}else if(G===`md`){let e=Ii(),t=ii,n=li,r=X.mdMode;if(Bi(`Zero-Copy WebGPU MD [${{equilibrium:`Equilibrium + Phonon VDOS`,strain:`Uniaxial/Shear Stress–Strain (K, G, ν)`,acoustic:`Acoustic Phonon Wave (v_L, v_T)`,shear:`Couette Shear NEMD Viscosity (η)`,thermal:`Hot/Cold Slab NEMD Thermal Cond. (κ)`,surface:`Free-Surface Vacuum Slab (γ)`}[r]||r}] — ${n?.label||e?.materialKey||``} (${n?.crystalStructure||``})`,t?`Atoms: ${t.atomCount} | t=${Z(t.timeFs,1)} fs | T=${Z(t.temperatureK,1)} K | P=${Z(t.pressureGPa,2)} GPa | V/V₀=${Z(t.volumeRatio??1,3)} | MSD=${Z(t.msdA2,4)} Å²`:`Initializing live WebGPU MD buffers…`),t)if(r===`strain`){let e=t.diagPressureGPa?.[0]??t.pressureGPa,n=t.stressOffDiagGPa?.[0]??0,r=t.poissonMeasured==null?`compress to measure`:Z(t.poissonMeasured,3);Vi(`<div class="live-meter">Strain ε_x=${Z((t.strainX||0)*100,1)}% · γ_xy=${Z((t.shearXY||0)*100,1)}% · σ_xx=${Z(e,2)} GPa · σ_xy=${Z(n,2)} GPa · Live ν=${r}</div>`)}else if(r===`shear`){let n=t.nemdViscosityPaS==null?`equilibrating…`:`${Z(t.nemdViscosityPaS*1e3,2)} mPa·s`;Vi(`<div class="live-meter">Live Couette NEMD: σ_xy=${Z(t.stressOffDiagGPa?.[0]??0,3)} GPa · GPU η=<b>${n}</b> (closure ${Z((e?.thermodynamic?.dynamicViscosityLiquidPaS||0)*1e3,2)} mPa·s)</div>`)}else if(r===`thermal`){let e=t.nemdThermalCondWPerMK==null?`building dT/dx…`:`${Z(t.nemdThermalCondWPerMK,1)} W/m·K`;Vi(`<div class="live-meter">Live Thermal NEMD: T_hot=${Z(t.slabTempK?.[0]??t.temperatureK,0)} K → T_cold=${Z(t.slabTempK?.[4]??t.temperatureK,0)} K · GPU κ_ph=<b>${e}</b></div>`)}else r===`surface`?Vi(`<div class="live-meter">Free-Surface Vacuum Slab (L_z=${Z(t.boxLengthsA?.[2]??0,1)} Å): Kirkwood–Buff GPU γ=<b>${Z(t.surfaceTensionNPerM??0,3)} N/m</b> (closure ${Z(e?.thermodynamic?.surfaceTensionNPerM??0,3)} N/m)</div>`):r===`acoustic`?Vi(`<div class="live-meter">Acoustic Crystal Bar (L_x=${Z(t.boxLengthsA?.[0]??0,1)} Å): DFT v_L=${Z(e?.mechanical?.soundSpeedLongMPerS??0,0)} m/s · v_T=${Z(e?.mechanical?.soundSpeedTransMPerS??0,0)} m/s</div>`):X.mdNptBarostat&&Vi(`<div class="live-meter">NPT Barostat Active: V/V₀=<b>${Z(t.volumeRatio??1,4)}</b> (Thermal Expansion α_V=${Z((e?.thermodynamic?.thermalExpansionVolPerK||0)*1e6,1)} ppm/K)</div>`);if(t?.rdf&&(Sr.textContent=`GPU Radial Distribution Function g(r) (Order → Melting)`,$i(ar,Array.from(t.rdf).map((e,r)=>(r+.5)/t.rdf.length*(n?.rcutA||5.5)),Array.from(t.rdf),{label:`g(r) vs r (Å) — sharp peaks=solid, broad=liquid`,color:`#34d399`,yMin:0})),r===`shear`&&t?.slabVx?(Cr.textContent=`Live Couette Shear Velocity Profile v_x(y)`,$i(or,[0,1,2,3,4,5,6,7],Array.from(t.slabVx),{label:`8-slab Couette v_x(y) (Å/t₀) across Y`,color:`#38bdf8`,hLine:{y:0,color:`#64748b`,label:`0`}})):r===`thermal`&&t?.slabTempK?(Cr.textContent=`Live NEMD Spatial Temperature Gradient T(x)`,$i(or,[0,1,2,3,4,5,6,7],Array.from(t.slabTempK),{label:`8-slab T(x) K (Hot slab #0–1 → Cold slab #4–5)`,color:`#fb923c`,yMin:0})):r===`acoustic`&&t?.slabVx&&t?.slabVy?(Cr.textContent=`Live Acoustic Wavefront Profile v_x (P) & v_y (S)`,Qi(or,[{xs:[0,1,2,3,4,5,6,7],ys:Array.from(t.slabVx),color:`#facc15`,width:2},{xs:[0,1,2,3,4,5,6,7],ys:Array.from(t.slabVy),color:`#38bdf8`,width:2}],{label:`P-wave v_x (gold) & S-wave v_y (cyan) across crystal bar`,hLine:{y:0,color:`#64748b`,label:`0`}})):r===`strain`&&si.length>=2?(Cr.textContent=`Live GPU Virial Stress vs Strain σ_xx(ε_x)`,$i(or,si.map(e=>e.eps*100),si.map(e=>e.pxx),{label:`σ_xx (GPa) vs ε_x (%) · slope = elastic stiffness`,color:`#facc15`,hLine:{y:0,color:`#64748b`,label:`0`}})):(Cr.textContent=`Live MD Temperature T(t) (${n?.label||``})`,ai.length>=2&&Qi(or,[{xs:ai.map(e=>e.t),ys:ai.map(e=>e.T),color:`#ff9c54`,width:2}],{label:`T(t) K · T_m=${Z(n?.meltingPointK||600,0)} K`,yMin:0,hLine:{y:n?.meltingPointK||600,color:`#facc15`,label:`T_m`}})),oi.length>=8&&(r===`equilibrium`||r===`acoustic`)){let e=Pe(oi,(n?.dtFs||1)*4,32);wr.textContent=`GPU Phonon Vibrational DOS g(ω) (Peak ${Z(e.peakThz,1)} THz)`,$i(sr,Array.from(e.freqsThz),Array.from(e.vdos),{label:`VACF FFT g(f) vs THz · Θ_D,eff≈${Math.round(e.effectiveDebyeK)} K`,color:`#c084fc`,yMin:0,yMax:1.08})}else ai.length>=2&&(wr.textContent=`Live MD Mean-Squared Displacement MSD(t) (Å²)`,$i(sr,ai.map(e=>e.t),ai.map(e=>e.msd),{label:`MSD(t) Å² · Diffusion slope spikes above T_m!`,color:`#38bdf8`,yMin:0}))}else if(G===`compound`&&J){let e=J.visualData.molQm,t=J.bundle,n=Ur,r=n?` · CI-NEB Image #${X.nebImageIdx}/${n.energiesEv.length-1} (ΔE=${Z(n.energiesEv[X.nebImageIdx],2)} eV${X.nebImageIdx===n.saddleImageIndex?` ‡ TS`:``})`:``;if(Bi(e?`WebGPU 3D Reactive RHF Orbitals — ${t.materialKey}${r}`:`WebGPU 3D Ionic/Covalent Crystal — ${t.materialKey} (${t.mechanical.crystalStructure})`,e?`E = ${Z(e.totalEnergyHa,3)} Ha · μ = ${Z(e.dipoleDebye,2)} D · HOMO-LUMO Gap = ${Z(e.homoLumoGapEv,2)} eV · GPU RHF calls=${n?.gpuRhfCalls??1}`:`a₀ = ${Z(t.mechanical.latticeConstantA,2)} Å · ρ = ${Z(t.mechanical.densityKgPerM3,0)} kg/m³ · Gap = ${Z(t.electromagnetic.bandGapEv,2)} eV`),e?.orbitalEnergiesHa?(Sr.textContent=`Molecular Orbital Spectrum (${t.materialKey} GPU RHF)`,$i(ar,e.orbitalEnergiesHa.map((e,t)=>t),e.orbitalEnergiesHa,{label:`MO Energy (Ha) | HOMO-LUMO Gap = ${Z(e.homoLumoGapEv,2)} eV`,color:`#c084fc`})):(Sr.textContent=`Ionic/Covalent Crystal Summary (${t.materialKey})`,$i(ar,[0,1,2],[t.mechanical.bulkModulusPa*1e-9,t.mechanical.shearModulusPa*1e-9,t.electromagnetic.bandGapEv*10],{label:`K=${Z(t.mechanical.bulkModulusPa*1e-9,1)} GPa · G=${Z(t.mechanical.shearModulusPa*1e-9,1)} GPa`,color:`#c084fc`,yMin:0})),n?.energiesEv?.length>=3){Cr.textContent=`WebGPU CI-NEB Barrier (${t.materialKey}: E_a = ${Z(n.forwardBarrierEv,2)} eV)`,$i(or,n.energiesEv.map((e,t)=>t/(n.energiesEv.length-1)),n.energiesEv,{label:`GPU MEP ΔE (eV) · TS‡ #${n.saddleImageIndex} (${n.pathwayLabel})`,color:`#ff9c54`,yMin:Math.min(0,...n.energiesEv)});let e=Zi(or),r=n.energiesEv,i=Math.min(0,...r),a=Math.max(1e-6,...r),o=(t,n,o)=>{let s=26+t/Math.max(1,r.length-1)*(or.width-36),c=or.height-18-(r[t]-i)/Math.max(1e-9,a-i)*(or.height-37);e.fillStyle=n,e.beginPath(),e.arc(s,c,4.5,0,Math.PI*2),e.fill(),o&&e.fillText(o,Math.min(or.width-36,s+6),Math.max(22,c-4))};o(n.saddleImageIndex,`#facc15`,`‡ TS`),o(X.nebImageIdx,`#38bdf8`,``)}else Cr.textContent=`Compound Phase Transitions (${t.materialKey})`,$i(or,[0,1,2],[0,t.thermodynamic.meltingPointK,t.thermodynamic.boilingPointK],{label:`T_m = ${Z(t.thermodynamic.meltingPointK,0)} K · T_b = ${Z(t.thermodynamic.boilingPointK,0)} K`,color:`#38bdf8`,yMin:0});wr.textContent=`Compound GPU Optical UV-Vis Spectrum (${t.materialKey})`,ra(sr,t.electromagnetic.spectralWavelengthsNm,t.electromagnetic.spectralReflectance,t.electromagnetic.spectralNRe,t.electromagnetic.opticalSrgb,t.materialKey)}else if(G===`polytope`&&Vr){let e=X.polytopeProbe;Bi(`Live WebGPU eval_polytope_atlas_2d — ${Vr.materialKey} (${Vr.polytopeCount} Convex Cells · ${X.polytopeRegime===`planetary`?`1 TPa Planetary`:`10 GPa Lab`})`,`Slanted Clausius–Clapeyron A x <= b · Clenshaw Chebyshev log10(ρ) contours · Hover/Click to probe GPU`),e&&(e.hit?Vi(`<div class="live-meter">GPU Probe (${Z(e.temperatureK,1)} K, ${Z(e.pressurePa*1e-5,2)} bar): Phase=<b>${e.phase.toUpperCase()}</b> · ρ_GPU=<b>${Z(e.densityKgPerM3,2)} kg/m³</b>${e.eosRho?` (EOS ${Z(e.eosRho,2)}, err ${Z(e.relErrPct,2)}%)`:``} · margin=${Z(e.margin,3)}</div>`):Vi(`<div class="live-meter fail-closed">GPU Probe (${Z(e.temperatureK,1)} K, ${Z(e.pressurePa*1e-5,2)} bar): <b>OUT OF DOMAIN (FAIL-CLOSED · hitFlag=0)</b> — triggers Tier-2/3 synthesis, never silent extrapolation!</div>`)),Sr.textContent=`Convex Polytopes (${Vr.materialKey}): ${Vr.polytopeCount} Cells`,aa(ar,Vr,e),Cr.textContent=`GPU Chebyshev Max Relative Residuals (%)`;let t=Vr.polytopes.map(e=>(e.fit?.maxRelativeError??0)*100);$i(or,t.map((e,t)=>t),t,{label:`Max Rel Error (%) per Polytope`,color:`#38bdf8`,yMin:0}),wr.textContent=`1 atm Multi-Phase Density Curve log10 ρ(T)`;let n=Ii();if(n){let e=n.thermodynamic.meltingPointK,t=n.thermodynamic.boilingPointK,r=Array.from({length:32},(n,r)=>10**(Math.log10(Math.max(5,e*.25))+r/31*(Math.log10(Math.max(t*3,5e3))-Math.log10(Math.max(5,e*.25))))),i=r.map(r=>Math.log10(Math.max(1e-5,v(n,r<e?`solid`:r<t?`liquid`:`gas`,r,101325))));$i(sr,r.map(e=>Math.log10(e)),i,{label:`log10 ρ(kg/m³) vs log10 T(K) at 1 atm (solid→liquid→gas)`,color:`#34d399`})}}}}var va=0,ya=null;function ba(){document.hidden||ya!=null||(ya=requestAnimationFrame(xa))}function xa(e){if(ya=null,!document.hidden){if(va+=1,X.autoRotate&&(G===`atomic`||G===`compound`)&&(Ci+=.008),G===`crystal`&&(X.crystalViewMode===`tdks-atom`||X.crystalViewMode===`photon-shell`)&&X.photonPlaying&&(Zr&&Zr.stepFs(.065),Qr&&(Qr.getStepIndex()>=380?(Qr.reset(null,{nextProbeWavelengthNm:X.probeWavelengthNm}),Qr.stepSync(24)):Qr.stepSync(3),!ei&&va%8==0&&(ei=!0,Qr.readTelemetry({nonBlocking:!0}).then(e=>{if(!e)return;$r=e,window.__ulgElementsLabState&&(window.__ulgElementsLabState.photonTelemetry=e);let t=Ii();t&&Xi(t,K===`element`?q?.g7Advisory:{hasReference:!1,note:`Backfed compound live Maxwell–FDTD optics.`}),G===`crystal`&&$()}).catch(()=>{}).finally(()=>{ei=!1})))),G===`crystal`&&X.crystalViewMode===`spin-llg`&&ui&&X.spinPlaying&&!pi&&va%2==0){if(X.spinSweepB){X.spinFieldBTesla+=X.spinSweepDir*.16,X.spinFieldBTesla>=4.8&&(X.spinFieldBTesla=4.8,X.spinSweepDir=-1),X.spinFieldBTesla<=-4.8&&(X.spinFieldBTesla=-4.8,X.spinSweepDir=1);let e=document.getElementById(`lbl-spin-b`);e&&(e.textContent=X.spinFieldBTesla.toFixed(1))}pi=!0,ui.stepBatch(8,{temperatureK:X.spinTempK,fieldBZTesla:X.spinFieldBTesla,readObs:!0,nonBlocking:!0}).then(e=>{e&&(di=e,fi.push({B:e.fieldBZTesla,Mz:e.magnetizationZ,Mmag:e.magnetizationMag,Mstag:e.staggeredOrderMag,T:e.temperatureK}),fi.length>90&&fi.shift(),window.__ulgElementsLabState&&(window.__ulgElementsLabState.spinTelemetry=e),G===`crystal`&&X.crystalViewMode===`spin-llg`&&$())}).catch(()=>{}).finally(()=>{pi=!1})}if(G===`crystal`&&X.crystalViewMode===`transport`&&mi&&X.transportPlaying&&!_i&&va%2==0&&(_i=!0,mi.stepBatch(3,{temperatureK:X.transportTempK,eFieldVPerM:X.transportEFieldVPerM,readObs:!0,nonBlocking:!0}).then(e=>{e&&(hi=e,gi.push({T:e.temperatureK,drift:e.meanDriftNorm,scatter:e.measuredScatterRateFrac,sigma:e.sigmaGpuSPerM}),gi.length>70&&gi.shift(),window.__ulgElementsLabState&&(window.__ulgElementsLabState.transportTelemetry=e),G===`crystal`&&X.crystalViewMode===`transport`&&$())}).catch(()=>{}).finally(()=>{_i=!1})),G===`nuclear`&&K===`element`&&X.nuclearViewMode===`fission`&&X.fissionPlaying&&va%3==0){X.fissionBeta2+=.025,X.fissionBeta2>1.35&&(X.fissionBeta2=0);let e=document.getElementById(`ctrl-fiss-b2`),t=document.getElementById(`lbl-fiss-b2`);e&&(e.value=String(X.fissionBeta2)),t&&(t.textContent=X.fissionBeta2.toFixed(2)),da(),$()}if(G===`nuclear`&&K===`element`&&X.nuclearViewMode===`tdse`&&ti&&X.tdsePlaying&&!ri&&va%3==0&&(ri=!0,ti.stepBatch(14,{nonBlocking:!0}).then(e=>{e&&(ni=e,e.stepCount>=1400&&ti.resetWavepacket(),window.__ulgElementsLabState&&(window.__ulgElementsLabState.tdseTelemetry={stepCount:e.stepCount,pInside:e.pInside,pBarrier:e.pBarrier,pTunneled:e.pTunneled}),G===`nuclear`&&$())}).catch(()=>{}).finally(()=>{ri=!1})),G===`compound`&&X.nebPlaying&&Ur?.energiesEv?.length>=2&&e-X.nebLastTickMs>=520&&(X.nebLastTickMs=e,X.nebImageIdx=(X.nebImageIdx+1)%Ur.energiesEv.length,Q(),$()),_a(),G===`md`&&Y&&X.mdPlaying&&!ci){ci=!0;let e=X.mdMode===`strain`||X.mdMode===`equilibrium`&&X.mdNptBarostat?0:null;Y.stepBatch(4,{readTelemetry:!0,temperatureK:X.mdTargetTempK,nptBarostatGPa:e,nonBlocking:!0}).then(e=>{!e||!Y||(ii=e,ai.push({t:e.timeFs,T:e.temperatureK,msd:e.msdA2}),ai.length>80&&ai.shift(),oi.push(e.vacf??0),oi.length>64&&oi.shift(),X.mdMode===`strain`&&(si.push({eps:e.strainX||0,pxx:e.diagPressureGPa?.[0]??e.pressureGPa}),si.length>60&&si.shift()),window.__ulgElementsLabState&&(window.__ulgElementsLabState.mdTelemetry=e),G===`md`&&$())}).catch(()=>{}).finally(()=>{ci=!1})}ba()}}async function Sa(e){let t=Ii();if(!(!U||!t)){X.polytopeRegime=e,X.polytopeProbe=null,yr.textContent=`Fitting ${t.materialKey} ${e} Atlas…`;try{Vr=await y(U,t,{degrees:[4,3],relativeTolerance:.05,maxBisectDepth:2,pressureRangePa:[100,e===`planetary`?0xe8d4a51000:1e10],materialIndex:t.atomicNumber||0}),window.__ulgElementsLabState&&(window.__ulgElementsLabState.atlasPolytopeCount=Vr.polytopeCount),yr.textContent=`${t.materialKey} · ${e} Atlas OK`,Q(),$()}catch(e){yr.textContent=`Atlas err: ${e.message}`}}}async function Ca(e,t=null,{preserveQuantumNumbers:n=!1,switchToTab:r=null}={}){if(!U)return;let i=t!=null&&Number.isFinite(Number(t))?Math.max(e,Math.min(310,Math.trunc(Number(t)))):null;yr.textContent=`Solving ${i==null?`${u(e)} (Z=${e})`:`${u(e)}-${i}`}…`,K=`element`,Ji();try{q=await Ye(U,e,{massNumberA:i,runNuclearGpuVolume:!0,runLiveMd:!0,mdSteps:16,atomicMaxScf:50,nuclearVolDim:24,blochGridN:16,functional:X.functional,scalarRelativistic:X.relativisticSpinOrbit,spinOrbit:X.relativisticSpinOrbit,returnOrbitalWavefunctions:!0});let t=q.visualData.atom,a=q.bundle.atomic.unpairedElectrons||0;if(!n){let t=Ri(e);X.n=t.n,X.l=t.l,X.m=t.m}Rr=W.buildAtomicVolumeOnGpu({rGrid:t.radialGrid.r,rhoGrid:t.radialGrid.rho,valenceL:X.l,unpairedCount:a,totalElectrons:t.electronCount,dim:32}),X.ionizedCation=!1,xi=null,fa(),oa(),ca(),ma(),ha(),la();let o=q.bundle.nuclear.A;ur&&(ur.value=String(o)),Hr=A(e,o,{maxDepth:12}),bi=ua(Hr),da();let s=X.polytopeRegime===`planetary`?0xe8d4a51000:1e10;Vr=await y(U,q.bundle,{degrees:[4,3],relativeTolerance:.05,maxBisectDepth:2,pressureRangePa:[100,s],materialIndex:e}),X.polytopeProbe=null,ga(),Yi(q.bundle,Hr),Xi(q.bundle,q.g7Advisory),Hi({kind:`element`,Z:e,A:o,label:q.bundle.nuclear.isotope}),r?Aa(r):(Q(),$()),yr.textContent=`${q.bundle.nuclear.isotope} · WebGPU OK`,ja()}catch(e){yr.textContent=`Error: ${e.message}`,console.error(e)}}async function wa(){for(let e of Wr)if(e?.pointsBuffer)try{e.pointsBuffer.destroy()}catch{}if(Wr=[],!(!U||!Ur?.imageOrbitalParams?.length))for(let e of Ur.imageOrbitalParams){let t=kt(U,{posZeta:e.posZeta,weights:e.weights,boxHalfBohr:e.boxHalfBohr,mode:X.molOrbitalMode,pointCount:Nr?5e4:11e4,seed:1});Wr.push(t)}}async function Ta(e){let t=e?.visualData?.molQm?.atoms;if(!U||!Array.isArray(t)||t.length<2||t.length>5||t.some(e=>e.Z>10))return null;let n=t.map(e=>({Z:e.Z,position:[e.x,e.y,e.z]})),r,i;t.length>=3?(r=t.map((e,t)=>t===0?{Z:e.Z,position:[e.x,e.y,e.z]}:{Z:e.Z,position:[e.x,-e.y,e.z]}),i=`molecular inversion TS (WebGPU)`):(r=t.map((e,t)=>t===0?{Z:e.Z,position:[e.x,e.y,e.z]}:{Z:e.Z,position:[e.x*1.85,e.y*1.85,e.z*1.85]}),i=`bond stretch MEP (WebGPU)`);try{let e=await P(U,n,r,{nImages:5,maxSteps:4,stepSize:.14,climbStartStep:1,basisName:`sto-3g`}),t=e.energiesHa[0],a=27.211386245988,o=e.energiesHa.map(e=>(e-t)*a),s=[];for(let t of e.images){let e=await M(U,t,{maxScf:22,volDim:16,sampleVolume:!0});e?.atomOrbitalParams&&s.push(e.atomOrbitalParams)}return{backend:e.backend,gpuRhfCalls:e.gpuRhfCalls+s.length,pathwayLabel:i,saddleImageIndex:e.saddleImageIndex,forwardBarrierEv:e.forwardBarrierHa*a,reverseBarrierEv:e.reverseBarrierHa*a,energiesHa:e.energiesHa,energiesEv:o,steps:e.steps,imageOrbitalParams:s}}catch{return null}}function Ea(e){if(!W||!e)return null;let t=e.visualData?.molQm?.atoms,n=e.bundle.nuclear.isotopologueSites||[],r=[];if(Array.isArray(t)&&t.length>0)r=t.map((e,t)=>{let r=n[t]||{Z:e.Z,A:C(e.Z)},i=E(r.Z,r.A);return{x:e.x,y:e.y,z:e.z,Z:i.Z,N:i.N,chargeRadiusFm:i.chargeRadiusFm}});else{let e=[];for(let t of n){let n=E(t.Z,t.A);for(let r=0;r<Math.min(4,t.count||1);r+=1)e.push(n)}let t=Math.max(1,e.length);r=e.map((e,n)=>{let r=n/t*Math.PI*2;return{x:t===1?0:Math.cos(r),y:t===1?0:Math.sin(r)*.5,z:t===1?0:Math.sin(r)*.7,Z:e.Z,N:e.N,chargeRadiusFm:e.chargeRadiusFm}})}return W.buildCompositeNuclearVolumeOnGpu(r,24)}async function Da(e,t=`crystal`){if(!U||!e)return;J=e,K=`compound`,Ji(),zr=Ea(e),Br=Ie({crystalStructure:e.bundle.mechanical.crystalStructure,cellsPerSide:2,latticeConstantA:Math.max(2.6,Number(e.bundle.mechanical.latticeConstantA||4.2)),massU:Math.max(2,Number(e.bundle.nuclear.molarMassU||28)),temperatureK:300}),oa(),ca(),ma(),ha(),ga();let n=X.polytopeRegime===`planetary`?0xe8d4a51000:1e10;Vr=await y(U,e.bundle,{degrees:[4,3],relativeTolerance:.05,maxBisectDepth:2,pressureRangePa:[100,n]}),X.polytopeProbe=null,Yi(e.bundle),Xi(e.bundle,{hasReference:!1,note:`Backfed compound running live across Nuclear, RHF QM, Maxwell Photon–Shell Optics, WebGPU MD & Polytope Atlas.`}),Hi({kind:`compound`,formula:e.bundle.materialKey,label:e.bundle.materialKey}),Aa(t),yr.textContent=`${e.bundle.materialKey} · Backfed OK`,ja()}async function Oa(e,{backfeedAllTabs:t=!1,switchToTab:n=`compound`}={}){if(U){yr.textContent=`Deriving ${e}…`;try{J=await lt(U,e,{runLiveMd:!0,mdSteps:10,mdCellsPerSide:2,reactionContext:{source:`elements-lab-interactive`}}),zr=Ea(J),Br=Ie({crystalStructure:J.bundle.mechanical.crystalStructure,cellsPerSide:2,latticeConstantA:Math.max(2.6,Number(J.bundle.mechanical.latticeConstantA||4.2)),massU:Math.max(2,Number(J.bundle.nuclear.molarMassU||28)),temperatureK:300}),Ur=await Ta(J),X.nebImageIdx=Ur?Ur.saddleImageIndex:0,await wa(),K=`compound`,Ji(),oa(),ca(),ma(),ha(),ga();let r=X.polytopeRegime===`planetary`?0xe8d4a51000:1e10;Vr=await y(U,J.bundle,{degrees:[4,3],relativeTolerance:.05,maxBisectDepth:2,pressureRangePa:[100,r]}),X.polytopeProbe=null,Yi(J.bundle),Xi(J.bundle,{hasReference:!1,note:`Recursive compound feedback bundle (zero hardcoded compound table).`}),Hi({kind:`compound`,formula:J.bundle.materialKey,label:J.bundle.materialKey}),Aa(t?n:`compound`),yr.textContent=`${e} · Compound OK`,ja()}catch(e){yr.textContent=`Error: ${e.message}`,console.error(e)}}}async function ka(e,t){if(!U)return;let n=String(e||``).trim(),r=String(t||``).trim();if(!(!n||!r)){yr.textContent=`Reacting ${n} + ${r}…`;try{let e=await dt(U,[n,r],{runLiveMd:!0,mdSteps:10,mdCellsPerSide:2});if(!e.derivedProducts.length){gr.innerHTML=`<div class="product-card" style="border-color:rgba(248,113,113,0.45);">No balanced reaction candidate found for <b>${n} + ${r}</b>. Try e.g. Na+H2O, H2+O2, Na+Cl2, Fe+O2, Cs+F2.</div>`,yr.textContent=`No reaction candidate`;return}let t=e.candidates?.[0],i=t?.energetics?.reactionEnthalpyJPerBalancedEquation==null?`derived`:`${Z(t.energetics.reactionEnthalpyJPerBalancedEquation*.001,1)} kJ/mol`,a=`<div class="product-card">
      <div style="font-weight:700;color:#e9d5ff;margin-bottom:3px;">${t?.equation||`${n} + ${r} → ${e.productFormulas.join(` + `)}`}</div>
      <div style="font-size:10px;color:var(--muted);margin-bottom:4px;">${t?.familyLabel||`Stoichiometric discovery`} · ΔH = ${i}</div>`;e.derivedProducts.forEach((e,t)=>{let n=e.bundle;a+=`<button class="action backfeed-btn" data-bf-idx="${t}">Backfeed ${n.materialKey} (ρ=${Z(n.mechanical.densityKgPerM3,0)} · T_m=${Z(n.thermodynamic.meltingPointK,0)}K · n=${Z(n.electromagnetic.refractiveIndex550Nm,2)}) → All Sims</button>`}),a+=`</div>`,gr.innerHTML=a;for(let t of gr.querySelectorAll(`[data-bf-idx]`))t.addEventListener(`click`,()=>{let n=e.derivedProducts[Number(t.dataset.bfIdx)];Fr(!1),n&&Da(n,`crystal`)});let o=e.derivedProducts[0];_r.value=o.bundle.materialKey,J=o,zr=Ea(o),Br=Ie({crystalStructure:o.bundle.mechanical.crystalStructure,cellsPerSide:2,latticeConstantA:Math.max(2.6,Number(o.bundle.mechanical.latticeConstantA||4.2)),massU:Math.max(2,Number(o.bundle.nuclear.molarMassU||28)),temperatureK:300}),Ur=await Ta(o),X.nebImageIdx=Ur?Ur.saddleImageIndex:0,await wa(),K=`compound`,Ji(),oa(),ca(),ma(),ha(),ga(),Vr=await y(U,o.bundle,{degrees:[4,3],relativeTolerance:.05,maxBisectDepth:2}),Yi(o.bundle),Xi(o.bundle,{hasReference:!1,note:`Discovered from ${n} + ${r}; click Backfeed to run across all tabs.`}),Hi({kind:`compound`,formula:o.bundle.materialKey,label:o.bundle.materialKey}),Aa(`compound`),yr.textContent=`${n}+${r} → ${e.productFormulas.join(`+`)} OK`,ja()}catch(e){yr.textContent=`Reaction err: ${e.message}`,console.error(e)}}}function Aa(e){G=e;for(let t of document.querySelectorAll(`.tab-btn`)){let n=t.dataset.tab===e;t.classList.toggle(`active`,n),n&&Pr()&&t.scrollIntoView?.({behavior:`smooth`,inline:`nearest`,block:`nearest`})}Q(),$(),ja()}function ja(){let e=Ii(),t=K===`compound`;window.__ulgElementsLabState={mode:t?`compound`:`element`,activeSpecimenKind:K,currentTab:G,rendererBackend:`webgpu`,isMobileProfile:Nr,camera:{yaw:Ci,pitch:wi,dist:Ti},cameraAutoSpin:!1,mdPerFrameCpuPositionReadback:!1,Z:t?null:Gr,A:t?null:q?.bundle?.nuclear?.A??Kr,isotope:t?null:q?.bundle?.nuclear?.isotope??null,formula:t?J?.bundle?.materialKey??null:null,backfedFormula:t?J?.bundle?.materialKey??null:null,relativisticSpinOrbit:X.relativisticSpinOrbit,functional:X.functional,bundle:e,decayChain:Hr,nebBackend:Ur?.backend??null,nebBarrier:Ur,atlasPolytopeCount:Vr?.polytopeCount??0,polytopeProbe:X.polytopeProbe,photonTelemetry:$r,spinTelemetry:di,transportTelemetry:hi,mdTelemetry:ii,starkState:Si,deltaScfResult:xi?{ionizationEnergyEv:xi.ionizationEnergyEv,removedShell:xi.removedShell}:null,fissionCurve:yi?{fissility:yi.fissility,barrierMeV:yi.barrierMeV,saddleBeta:yi.saddleBeta}:null,batemanCurves:bi?.curves?.length??0,tdseTelemetry:ni?{stepCount:ni.stepCount,pInside:ni.pInside,pTunneled:ni.pTunneled}:null,orbitalCloudStats:Jr?{pointCount:Jr.pointCount,n:Jr.n,l:Jr.l,m:Jr.m,sourceKind:Jr.sourceKind}:null,registeredModules:ee.listModules().map(e=>e.methodKey),closureCount:Yn.size,g7Advisory:t?null:q?.g7Advisory},window.__ulgElementsLabApi={setTab:e=>Aa(e),solveElement:(e,t=null,n={})=>(Gr=e,Kr=t,lr.value=String(e),ur&&(ur.value=String(t??C(e))),Ca(e,t,n)),setRelativistic:e=>(X.relativisticSpinOrbit=!!e,Ca(Gr,Kr,{preserveQuantumNumbers:!0})),setOrbital:(e,t,n)=>{X.n=e,X.l=t,X.m=n,oa(),Q(),$()},setCrystalViewMode:e=>{X.crystalViewMode=e,Q(),$()},stepTdks:(e=40)=>{if(!Zr)return null;for(let t=0;t<e;t+=1)Zr.stepFs(.065);return $(),Zr.channels.map(e=>({nm:e.wavelengthNm,rho11:e.rho11,dipole:e.dipole,absorbed:e.absorbedEnergy}))},stepPhotonFdtd:async(e=220)=>{if(!Qr)return null;let t=await Qr.stepBatch(e,{readObs:!0});return t&&($r=t),$(),ja(),t},stepTdse:async(e=120)=>{if(!ti)return null;let t=await ti.stepBatch(e);return t&&(ni=t),$(),ja(),t},runReaction:(e,t)=>ka(e,t),backfeedCompound:(e,t=`crystal`)=>Oa(e,{backfeedAllTabs:!0,switchToTab:t}),probePolytope:async(e,t)=>{if(!Vr||!W)return null;let n=await W.probePolytopeAtlasOnGpu(Vr,e,t),r=W.getPolytopeAxisBounds(Vr),i=(Math.log10(Math.max(1,e))-r.minLt)/Math.max(1e-6,r.maxLt-r.minLt),a=(Math.log10(Math.max(1e-6,t))-r.minLp)/Math.max(1e-6,r.maxLp-r.minLp);return X.polytopeProbe={...n,fx:i,fy:a},$(),ja(),n},captureCanvasDataUrl:()=>new Promise(e=>{requestAnimationFrame(()=>{_a(),e(Qn.toDataURL(`image/png`))})}),getCamera:()=>({yaw:Ci,pitch:wi,dist:Ti}),setNuclearMode:(e,t=null)=>{X.nuclearViewMode=e,t!=null&&(X.fissionBeta2=Number(t)),e===`fission`&&da(),Q(),$(),ja()},setStarkField:e=>(X.starkFieldVPerA=Number(e)||0,fa(),Q(),$(),ja(),Si),triggerDeltaScfIonize:async(e=!0)=>(await pa(e),xi?{ionizationEnergyEv:xi.ionizationEnergyEv,removedShell:xi.removedShell}:null),stepSpinLattice:async(e=48,{temperatureK:t=null,fieldBZTesla:n=null}={})=>{if(ui||ma(),!ui)return null;t!=null&&(X.spinTempK=t),n!=null&&(X.spinFieldBTesla=n);let r=await ui.stepBatch(e,{temperatureK:X.spinTempK,fieldBZTesla:X.spinFieldBTesla,readObs:!0});return r&&(di=r,fi.push({B:r.fieldBZTesla,Mz:r.magnetizationZ,Mmag:r.magnetizationMag,Mstag:r.staggeredOrderMag,T:r.temperatureK})),$(),ja(),r},stepElectronTransport:async(e=32,{temperatureK:t=null,eFieldVPerM:n=null}={})=>{if(mi||ha(t),!mi)return null;t!=null&&(X.transportTempK=t),n!=null&&(X.transportEFieldVPerM=n);let r=await mi.stepBatch(e,{temperatureK:X.transportTempK,eFieldVPerM:X.transportEFieldVPerM,readObs:!0});return r&&(hi=r,gi.push({T:r.temperatureK,drift:r.meanDriftNorm,scatter:r.measuredScatterRateFrac,sigma:r.sigmaGpuSPerM})),$(),ja(),r},setMdMode:(e,t=null)=>{ga(t,e),Q(),$(),ja()},stepMd:async(e=16,{strainX:t=0,shearXY:n=0,pulse:r=null,npt:i=!1}={})=>{if(!Y)return null;(t||n)&&Y.applyStrain({strainX:t,shearXY:n}),r&&Y.injectAcousticPulse({polarization:r,amplitude:.36});let a=await Y.stepBatch(e,{readTelemetry:!0,temperatureK:X.mdTargetTempK,nptBarostatGPa:i?0:null});return a&&(ii=a,ai.push({t:a.timeFs,T:a.temperatureK,msd:a.msdA2}),oi.push(a.vacf??0),X.mdMode===`strain`&&si.push({eps:a.strainX||0,pxx:a.diagPressureGPa?.[0]??a.pressureGPa})),$(),ja(),a}}}async function Ma(){qi(),Ki(),Tr?.addEventListener(`click`,()=>Fr(!document.body.classList.contains(`drawer-open`))),Er?.addEventListener(`click`,()=>Fr(!1)),Dr?.addEventListener(`click`,()=>Fr(!1)),window.addEventListener(`keydown`,e=>{e.key===`Escape`&&Fr(!1)}),Mr?.addEventListener(`click`,()=>window.location.reload());for(let e of document.querySelectorAll(`.tab-btn`))e.addEventListener(`click`,()=>Aa(e.dataset.tab));for(let e of document.querySelectorAll(`#hero-presets [data-hero-z], #mobile-quick-presets [data-hero-z]`))e.addEventListener(`click`,()=>{let t=Number(e.dataset.heroZ),n=e.dataset.heroA?Number(e.dataset.heroA):null,r=e.dataset.heroTab||null,i=e.dataset.heroCview||null;Gr=t,Kr=n,lr.value=String(t),ur&&(ur.value=String(n??C(t))),r===`crystal`&&(X.crystalViewMode=i||`photon-shell`),r===`nuclear`&&t>=90&&(X.nuclearViewMode=`fission`,X.fissionBeta2=.72),Fr(!1),Ca(t,n,{switchToTab:r})});for(let e of document.querySelectorAll(`#hero-presets [data-hero-compound], #mobile-quick-presets [data-hero-compound]`))e.addEventListener(`click`,()=>{let t=e.dataset.heroCompound,n=e.dataset.heroTab||`crystal`;_r.value=t,n===`crystal`&&(X.crystalViewMode=`photon-shell`),Fr(!1),Oa(t,{backfeedAllTabs:!0,switchToTab:n})});for(let e of document.querySelectorAll(`#hero-presets [data-hero-react], #mobile-quick-presets [data-hero-react]`))e.addEventListener(`click`,()=>{let[t,n]=e.dataset.heroReact.split(`|`);pr&&(pr.value=t),mr&&(mr.value=n),Fr(!1),ka(t,n)});for(let e of document.querySelectorAll(`#reaction-presets [data-rxn]`))e.addEventListener(`click`,()=>{let[t,n]=e.dataset.rxn.split(`|`);pr&&(pr.value=t),mr&&(mr.value=n),Fr(!1),ka(t,n)});fr.addEventListener(`click`,()=>{let e=Math.max(1,Math.min(118,Math.trunc(Number(lr.value)||26))),t=ur?.value?.trim(),n=t?Math.trunc(Number(t)):null;Gr=e,Kr=n&&n>=e&&n<=310?n:null,Fr(!1),Ca(e,Kr)}),dr?.addEventListener(`click`,()=>{let e=Math.max(1,Math.min(118,Math.trunc(Number(lr.value)||Gr)));Gr=e,Kr=null,ur&&(ur.value=String(C(e))),Fr(!1),Ca(e,null)}),hr?.addEventListener(`click`,()=>{Fr(!1),ka(pr?.value,mr?.value)}),vr.addEventListener(`click`,()=>{Fr(!1),Oa(_r.value||`H2O`)}),ar.style.cursor=`crosshair`,ar.addEventListener(`click`,e=>{if(G!==`nuclear`||!q?.visualData?.nuclear?.chartDims)return;let t=ar.getBoundingClientRect(),n=(e.clientX-t.left)/Math.max(1,t.width)*ar.width,r=(e.clientY-t.top)/Math.max(1,t.height)*ar.height,{maxZ:i,maxN:a}=q.visualData.nuclear.chartDims,o=Math.round((n-12)/Math.max(1,ar.width-24)*a),s=Math.round((ar.height-12-r)/Math.max(1,ar.height-24)*i);s>=1&&s<=i&&o>=0&&o<a&&(Gr=s,Kr=s+o,lr.value=String(Gr),ur&&(ur.value=String(Kr)),Ca(Gr,Kr))});let e=null;if(!navigator.gpu){yr.textContent=`WebGPU unavailable (fail-closed)`,Ir(`WebGPU Not Supported in This Browser`,`ULG Material Physics Lab runs live Dirac–KS, TD-KS, 2D Maxwell–FDTD, MD, and Polytope compute shaders on WebGPU. Use Chrome 121+ on Android/Desktop or Safari 26+ on iOS/macOS over HTTPS.`);return}for(let t=0;t<8&&!e;t+=1){try{e=await navigator.gpu.requestAdapter(t<4?{powerPreference:`high-performance`}:void 0)}catch{e=null}e||await new Promise(e=>setTimeout(e,200))}if(!e){yr.textContent=`WebGPU adapter unavailable`,Ir(`WebGPU GPU Adapter Unavailable`,`Your browser exposes navigator.gpu, but no compatible WebGPU hardware adapter was returned. Ensure hardware acceleration / WebGPU is enabled in browser settings and retry.`);return}try{U=await e.requestDevice()}catch(e){yr.textContent=`WebGPU device error`,Ir(`WebGPU Device Initialization Failed`,e?.message||String(e));return}Lr(),U.addEventListener(`uncapturederror`,e=>console.error(`WebGPU error:`,e.error?.message||String(e.error))),U.lost?.then(e=>{yr.textContent=`WebGPU context lost`,Ir(`WebGPU Context Paused / Lost`,`Mobile OS or GPU driver reclaimed the WebGPU device (${e?.reason||`unknown`}). Tap below to restore live GPU simulations.`)}),W=Jn(U,Qn);let t=null,n=()=>{Pr()||Fr(!1),t&&clearTimeout(t),t=setTimeout(()=>{t=null,$()},60)};typeof ResizeObserver==`function`&&Qn.parentElement&&new ResizeObserver(n).observe(Qn.parentElement),window.addEventListener(`resize`,n,{passive:!0}),window.addEventListener(`orientationchange`,n,{passive:!0}),document.addEventListener(`visibilitychange`,()=>{document.hidden||($(),ba())});let r=new URLSearchParams(window.location.search),i=Math.max(1,Math.min(118,Math.trunc(Number(r.get(`z`))||26))),a=r.get(`a`),o=a&&Number.isFinite(Number(a))?Math.max(i,Math.min(310,Math.trunc(Number(a)))):null,s=r.get(`tab`);Gr=i,Kr=o,lr.value=String(i),ur&&(ur.value=String(o??C(i))),await Ca(i,o,{switchToTab:s||null}),ba()}Ma();