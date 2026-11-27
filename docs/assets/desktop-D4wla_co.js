const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./ulgRetroTheme-Dk5mCkbO.css"])))=>i.map(i=>d[i]);
import{t as e}from"./preload-helper-CwQZjUKM.js";function t(e,t){let n=!0,r=[];t.key&&r.push(e.onKey(e=>t.key(e))),t.pointer&&r.push(e.onPointer(e=>t.pointer(e))),t.wheel&&r.push(e.onWheel(e=>t.wheel(e))),t.resize&&r.push(e.onResize(e=>t.resize(e)));let i=r=>{n&&(e.present(t.frame(r,e.size())),e.requestFrame(i))};return Promise.resolve(t.init?.(e)).then(()=>{n&&e.requestFrame(i)}),{stop(){if(n){n=!1;for(let e of r)e();e.dispose()}}}}function n(e){let t=``,n=``;for(let r of e){let e=`${r.foreground?.join(`,`)??``}|${r.background?.join(`,`)??``}|${r.bold?`b`:``}`;e!==n&&(n=e,t+=`\x1B[0m`,r.bold&&(t+=`\x1B[1m`),r.foreground&&(t+=`\x1b[38;2;${r.foreground.join(`;`)}m`),r.background&&(t+=`\x1b[48;2;${r.background.join(`;`)}m`)),t+=r.char}return`${t}\x1b[0m`}var r,i=0;async function a(e,t,n){for(;i!==0;)await Promise.resolve();++i,r=e;try{n.call(t)}catch(e){throw i=0,e}r=void 0,--i}function o(e,t=e){for(let n of t)`dependencies`in n?(e.delete(n),o(e,n.dependencies)):e.add(n)}var s=Symbol(`reactive`),c=Symbol(`original_ref`),l=Symbol(`connected_signal`);function u(e){return e instanceof Object&&s in e}function d(e,t,n=!1){Object.defineProperties(e,{[s]:{value:!0},[c]:{value:e},[l]:{value:t}});let r=e.set.bind(e),i;i=n?function(n,i){let a=e.get(n);return r(n,i),i!==a&&t.propagate(),e}:function(n,i){let{size:a}=e;return r(n,i),e.size>a&&t.propagate(),e};let a=e.delete.bind(e);function o(e){let n=a(e);return n&&t.propagate(),n}let u=e.clear.bind(e);function d(){let{size:n}=e;u(),n>0&&t.propagate()}return Object.defineProperties(e,{set:{value:i},delete:{value:o},clear:{value:d}}),e}function f(e,t){Object.defineProperties(e,{[s]:{value:!0},[c]:{value:e},[l]:{value:t}});let n=e.add.bind(e);function r(r){let{size:i}=e;return n(r),e.size>i&&t.propagate(),e}let i=e.delete.bind(e);function a(e){let n=i(e);return n&&t.propagate(),n}let o=e.clear.bind(e);function u(){let{size:n}=e;o(),n>0&&t.propagate()}return Object.defineProperties(e,{add:{value:r},delete:{value:a},clear:{value:u}}),e}function p(e,t,n=!1){if(Object.defineProperties(e,{[s]:{value:!0},[c]:{value:e},[l]:{value:t}}),n)return m(e,t,!0);let r=e.push.bind(e);function i(...e){let n=r(...e);return n>0&&t.propagate(),n}let a=e.pop.bind(e);function o(){let{length:n}=e,r=a();return n>0&&t.propagate(),r}let u=e.splice.bind(e);function d(e,n,...r){let i=u(e,n,...r);return(i.length>0||r.length>0)&&t.propagate(),i}let f=Array.prototype.sort.bind(e);function p(e){let n=f(e);return t.propagate(),n}let h=Array.prototype.reverse.bind(e);function g(){let e=h();return t.propagate(),e}return Object.defineProperties(e,{push:{value:i},pop:{value:o},splice:{value:d},sort:{value:p},reverse:{value:g}}),e}function m(e,t,n=!1){if(typeof e!=`object`)throw Error(`parameter object needs to be typeof 'object'`);if(Array.isArray(e)){if(p(e,t),!n)return e}else u(e)||Object.defineProperties(e,{[s]:{value:!0},[c]:{value:e},[l]:{value:t}});if(n)return new Proxy(e,{set(e,n,r){return e[n]!==(e[n]=r)&&t.propagate(),!0}});let r={};Object.defineProperties(r,{[s]:{value:!0},[c]:{value:e},[l]:{value:t}});for(let n in e)Object.defineProperty(r,n,{enumerable:!0,get(){return e[n]},set(r){e[n]!==(e[n]=r)&&t.propagate()}});return r}var h=class extends Error{constructor(){super(`You can only deeply observe value with typeof 'object'`)}},g=class extends Error{path;constructor(e){super(`Recursive signal propagation detected: ${e.join(` -> `)}`),this.name=`SignalRecursiveUpdateError`,this.path=[...e]}},_=32,v=new Map,y=[],b=0,x=!1,S=new Set,C=class{$value;dependants;subscriptions;whenSubscriptions;forceUpdateValue;disposed=!1;constructor(e,t){if(t?.deepObserve){if(typeof e!=`object`)throw new h;e=e instanceof Set?f(e,this):e instanceof Map?d(e,this,t.watchMapUpdates):m(e,this,t.watchObjectIndex)}this.$value=e}when(e,t,n){this.whenSubscriptions??=new Map;let{whenSubscriptions:r}=this,i=r.get(e);i?i.add(t):(i=new Set().add(t),r.set(e,i)),n?.addEventListener(`abort`,()=>{i?.delete(t)})}drop(e,t){(this.whenSubscriptions?.get(e))?.delete(t)}subscribe(e,t){this.subscriptions??=new Set,this.subscriptions.add(e),t?.addEventListener(`abort`,()=>{this.subscriptions?.delete(e)})}unsubscribe(e){this.subscriptions?.delete(e)}inspect(){return{disposed:this.disposed,subscriptions:this.subscriptions?.size??0,whenSubscriptions:[...this.whenSubscriptions?.values()??[]].reduce((e,t)=>e+t.size,0),dependants:this.dependants?.size??0,reactive:typeof this.$value==`object`&&this.$value!==null&&s in this.$value}}depend(e){this.dependants??=new Set,this.dependants.add(e)}propagate(e){if(b>0&&!x){S.add(this);return}let t=w(this),{subscriptions:n,whenSubscriptions:r,dependants:i}=this;try{let t=this.$value;if(n?.size)for(let e of n)e(t);let a=r?.get(t);if(a)for(let e of a)e(t);if(!i?.size)return;for(let t of i)`forceUpdateValue`in t&&(t.forceUpdateValue=!0),t.update(e??this)}finally{t()}}dispose(){let{$value:e}=this;this.disposed=!0,typeof e==`object`&&e&&(e=e?.[c]??e),this.$value=e,Object.defineProperty(this,"value",{value:e});let{dependants:t,subscriptions:n,whenSubscriptions:r}=this;if(n?.clear(),r?.clear(),t)for(let e of[...t])t.delete(e),e.dependencies.delete(this),e.dependencies||e.dispose()}get value(){return r?.add(this),this.$value}set value(e){r?.add(this),(this.$value!==(this.$value=e)||this.forceUpdateValue)&&this.propagate()}peek(){return this.$value}jink(e){this.$value=e}valueOf(){return this.$value}toString(){return`${this.$value}`}};function w(e){let t=v.get(e)??0;if(t>=_)throw new g([...y,e].map(T));return v.set(e,t+1),y.push(e),()=>{y.pop();let t=(v.get(e)??1)-1;t<=0?v.delete(e):v.set(e,t)}}function T(e){return e.constructor?.name||`unknown`}var E=class extends Error{constructor(){super(`Computed is read-only, you can't (and shouldn't!) directly modify its value`)}},ee=class extends C{computable;dependencies;constructor(e){super(void 0);let t=e(this);super.value=t,this.computable=e,this.dependencies=new Set,a(this.dependencies,this,e).then(()=>{for(let e of this.dependencies)e.depend(this)})}get value(){return r?.add(this),this.$value}set value(e){throw new E}jink(e){throw new E}update(e){r?.add(this),(this.$value!==(this.$value=this.computable(e))||this.forceUpdateValue)&&this.propagate(e)}dispose(){super.dispose();let{dependencies:e}=this;for(let t of[...e])t.dependants?.delete(this),e.delete(t)}},te=class extends Error{constructor(){super(`Cannot update an effect while it is paused.`),this.name=`EffectPausedUpdateError`}},ne=class{$effectable;dependencies;paused;constructor(e){this.$effectable=e,this.dependencies=new Set,this.paused=!1,a(this.dependencies,this,e).then(()=>{for(let e of this.dependencies)e.dependants?.delete(this);if(o(this.dependencies),!this.paused)for(let e of this.dependencies)e.depend(this)})}update(e){if(this.paused)throw new te;this.$effectable(e)}dispose(){let{dependencies:e}=this;for(let t of e)t.dependants?.delete(this);e.clear()}pause(){this.paused=!0;for(let e of this.dependencies)e.dependants?.delete(this)}resume(){this.paused=!1;for(let e of this.dependencies)e.depend(this)}};function re(e,t,n){return n.width!==0&&n.height!==0&&e>=n.column&&e<n.column+n.width&&t>=n.row&&t<n.row+n.height}function ie(e,t){return e===t||e.column===t.column&&e.row===t.row&&e.width===t.width&&e.height===t.height}var ae={column:0,row:0,width:0,height:0};function D(e,t,n){let{column:r,row:i,width:a,height:o}=e,{column:s,row:c,width:l,height:u}=t;if(r>=s+l||s>=r+a||i>=c+u||c>=i+o)return!1;if(!n)return!0;let d=Math.min(r+a,s+l),f=Math.min(i+o,c+u),p=Math.max(0,d-Math.max(r,s));if(p===0)return!1;let m=Math.max(0,f-Math.max(i,c));return m===0?!1:(ae.column=d-p,ae.row=f-m,ae.width=p,ae.height=m,ae)}function oe(e,t,n,r,i,a){let o=ce(t,n,r,i,a);if(!o)return se(t);let s=e[o.row]??=new Set,c=s.size;for(let e=o.startColumn;e<o.endColumn;e+=1)s.add(e);return{row:o.row,startColumn:o.startColumn,endColumn:o.endColumn,queuedCells:s.size-c}}function se(e){return{row:e,startColumn:0,endColumn:0,queuedCells:0}}function ce(e,t,n,r,i){if(e<0||e>=r.rows)return;let a=Math.max(0,Math.floor(t)),o=Math.min(r.columns,Math.ceil(n));if(i){if(e<i.row||e>=i.row+i.height)return;a=Math.max(a,i.column),o=Math.min(o,i.column+i.width)}if(!(o<=a))return{row:e,startColumn:a,endColumn:o}}function O(e,t){return e instanceof C?e:new C(e,t)}var le=0,ue=class{id;type;canvas;style;zIndex;view;viewOffset;rectangle;previousRectangle;objectsUnder;omitCells;rerenderCells;rendered;outOfBounds;updated;moved;#e;#t;#n;#r;#i;#a;#o;constructor(e,t){this.id=le++,this.type=e,this.canvas=t.canvas,this.viewOffset={columns:0,rows:0},this.omitCells=[],this.rerenderCells=[],this.objectsUnder=new Set,this.rendered=!1,this.outOfBounds=!1,this.canvas.updateObjects.push(this),this.updated=!0,this.moved=!0,this.view=O(t.view),this.zIndex=O(t.zIndex),this.style=O(t.style);let{updateObjects:n}=this.canvas;this.#e=()=>{this.rendered=!1,this.updated=!1,n.push(this);for(let e of this.objectsUnder)e.updated=!1,n.push(e)},this.#t=()=>{this.canvas.resortDrawnObjects(),this.previousRectangle=void 0,this.moved=!0,this.updated=!1,n.push(this)},this.#n=e=>this.#s(e),this.#r=()=>this.#c(),this.#i=()=>this.#c(),this.#a=()=>this.#l(),this.view.subscribe(this.#n),queueMicrotask(()=>this.#s(this.view.peek()))}draw(){this.style.subscribe(this.#e),this.zIndex.subscribe(this.#t),this.rendered=!1;let{objectsUnder:e}=this,{updateObjects:t}=this.canvas;this.moved=!0,this.updated=!1,t.push(this);for(let n of e)n.moved=!0,n.updated=!1,t.push(n);this.canvas.drawnObjects.includes(this)||this.canvas.drawnObjects.push(this),this.canvas.drawnOrderVersion+=1}erase(){this.style.unsubscribe(this.#e),this.zIndex.unsubscribe(this.#t);let{drawnObjects:e}=this.canvas;e.remove(this),this.canvas.drawnOrderVersion+=1;for(let t of e)t.objectsUnder.delete(this);let{objectsUnder:t}=this,{updateObjects:n}=this.canvas;this.moved=!0,this.updated=!1,n.push(this);for(let e of t)e.moved=!0,e.updated=!1,n.push(e);let{column:r,row:i,width:a,height:o}=this.rectangle.peek(),s=i+o,c=r+a;for(let e=i;e<s;++e)for(let n of t)n.queueRerenderRange(e,r,c)}queueRerender(e,t){this.queueRerenderRange(e,t,t+1)}queueRerenderRange(e,t,n){let r=this.view.peek()?.rectangle?.peek();oe(this.rerenderCells,e,t,n,this.canvas.size.peek(),r)}queueRerenderRectangle(e){let t=e.row+e.height,n=e.column+e.width;for(let r=e.row;r<t;r+=1)this.queueRerenderRange(r,e.column,n)}updatePreviousRectangle(){let{previousRectangle:e}=this,{column:t,row:n,width:r,height:i}=this.rectangle.peek();e?(e.column=t,e.row=n,e.width=r,e.height=i):this.previousRectangle={column:t,row:n,width:r,height:i}}updateMovement(){let{previousRectangle:e,objectsUnder:t}=this,n=this.rectangle.peek();if(!e||ie(n,e))return;let r=D(n,e,!0),i=e.row+e.height,a=e.column+e.width;for(let n=e.row;n<i;++n){if(r&&n>=r.row&&n<r.row+r.height){for(let i of t)i.queueRerenderRange(n,e.column,r.column),i.queueRerenderRange(n,r.column+r.width,a);continue}for(let r of t)r.queueRerenderRange(n,e.column,a)}let o=n.row+n.height,s=n.column+n.width;for(let e=n.row;e<o;++e){if(r&&e>=r.row&&e<r.row+r.height){this.queueRerenderRange(e,n.column,r.column),this.queueRerenderRange(e,r.column+r.width,s);continue}this.queueRerenderRange(e,n.column,s)}}updateOutOfBounds(){let{columns:e,rows:t}=this.canvas.size.peek(),{column:n,row:r,width:i,height:a}=this.rectangle.peek();if(this.outOfBounds=i===0||a===0||n>=e||r>=t||n+i<0||r+a<0,!this.outOfBounds){let e=this.view.peek()?.rectangle?.peek();if(!e)return;(n>e.column+e.width||r>e.row+e.height||n+i<e.column||r+a<e.row)&&(this.outOfBounds=!0)}}update(){}render(){let{column:e,row:t,width:n,height:r}=this.rectangle.peek();this.queueRerenderRectangle({column:e,row:t,width:n,height:r}),this.rerender()}rerender(){}#s(e){if(this.#o===e){this.#c();return}this.#o&&(this.#o.rectangle.unsubscribe(this.#r),this.#o.offset.unsubscribe(this.#i),this.#o.maxOffset.unsubscribe(this.#a)),this.#o=e,e&&(e.rectangle.subscribe(this.#r),e.offset.subscribe(this.#i),e.maxOffset.subscribe(this.#a)),this.#c()}#c(){let e=this.#o;if(!e){this.#l();return}let t=this.rectangle?.peek();if(!t)return;let n=e.rectangle.peek(),r=e.offset.peek(),i=n.column-r.columns,a=n.row-r.rows,o=i-this.viewOffset.columns,s=a-this.viewOffset.rows;if(o!==0||s!==0){t.column+=o,t.row+=s,this.moved=!0;for(let e of this.objectsUnder)e.moved=!0}this.viewOffset.columns=i,this.viewOffset.rows=a,this.#l()}#l(){let{updateObjects:e}=this.canvas;this.updated=!1,e.push(this);for(let t of this.objectsUnder)t.updated=!1,e.push(t)}},de=`\x1B`;RegExp(`${de}(?:\\[[0-?]*[ -/]*[@-~]|\\][^\\x07${de}]*(?:\\x07|${de}\\\\))`,`g`);function fe(e){return e===0?0:55+e*40}function pe(e,t){if(e.charCodeAt(t)!==27||e[t+1]!==`[`)return;let n=t+2;for(;n<e.length;){let t=e.charCodeAt(n);if(t>=48&&t<=63){n+=1;continue}break}for(;n<e.length;){let t=e.charCodeAt(n);if(t>=32&&t<=47){n+=1;continue}break}let r=e.charCodeAt(n);if(r>=64&&r<=126)return e.slice(t,n+1)}function me(e,t){if(e.charCodeAt(t)!==27||e[t+1]!==`]`||e[t+2]!==`8`||e[t+3]!==`;`)return;let n=-1,r=-1;for(let i=t+4;i<e.length;i+=1){let t=e.charCodeAt(i);if(t===7){n=i,r=i+1;break}if(t===27&&e[i+1]===`\\`){n=i,r=i+2;break}}if(n<0)return;let i=e.indexOf(`;`,t+4);if(!(i<0||i>=n))return{length:r-t,uri:e.slice(i+1,n)}}function k(e){return e.split(`;`)}function he(e,t){let n=e[t].split(`:`),r=n.length>1,i=Number(r?n[1]:e[t+1]),a=r?1:Math.min(e.length-t,i===2?5:i===5?3:2),o=r?n.slice(2):e.slice(t+2,t+a);if(i===2&&r&&o.length===4){if(o[0]!==``&&o[0]!==`0`)return{consumed:a};o.shift()}let s=o.every(e=>/^\d+$/.test(e)&&Number.isSafeInteger(Number(e))),c=e=>Math.max(0,Math.min(255,Number(e)));return s&&i===2&&o.length===3?{consumed:a,rgb:o.map(c)}:s&&i===5&&o.length===1?{consumed:a,palette:c(o[0])}:{consumed:a}}function ge(e,t){let n={bold:!1,italic:!1,underline:``,underlineColor:[],overline:!1,inverse:!1,foreground:[],background:[],extra:[]};return ve(n,e),ye(n,t),be(n)}function _e(e){return k(e.slice(2,-1)).every(e=>e===``||/^0+$/.test(e))}function ve(e,t){for(let n=0;n<t.length;){let r=pe(t,n);if(!r||!r.endsWith(`m`)){n+=1;continue}ye(e,r),n+=r.length}}function ye(e,t){let n=k(t.slice(2,-1));for(let t=0;t<n.length;t+=1){let r=n[t],i=r.split(`:`),a=Number(i[0]);if(i.length>1&&a===4){i.length===2&&/^[0-5]$/.test(i[1])&&(e.underline=i[1]===`0`?``:i[1]===`1`?`4`:r);continue}if(a===38||a===48||a===58){let r=he(n,t),i=a===38?e.foreground:a===48?e.background:e.underlineColor;(r.rgb||r.palette!==void 0)&&(i.length=0,i.push(String(a),r.rgb?`2`:`5`,...(r.rgb??[r.palette]).map(String))),t+=r.consumed-1;continue}if(i.length>1){e.extra.includes(r)||e.extra.push(r);continue}if(a===0){A(e);continue}a===1?e.bold=!0:a===22?(e.bold=!1,e.extra=e.extra.filter(e=>e!==`2`)):a===3?e.italic=!0:a===23?e.italic=!1:a===4?e.underline=`4`:a===21?e.underline=`4:2`:a===24?e.underline=``:a===29?e.extra=e.extra.filter(e=>e!==`9`):a===53?e.overline=!0:a===55?e.overline=!1:a===59?e.underlineColor=[]:a===7?e.inverse=!0:a===27?e.inverse=!1:a>=30&&a<=37||a>=90&&a<=97?e.foreground=[String(a)]:a>=40&&a<=47||a>=100&&a<=107?e.background=[String(a)]:a===39?e.foreground=[]:a===49?e.background=[]:Number.isSafeInteger(a)&&a>=0&&!e.extra.includes(r)&&e.extra.push(r)}}function A(e){e.bold=!1,e.italic=!1,e.underline=``,e.underlineColor=[],e.overline=!1,e.inverse=!1,e.foreground=[],e.background=[],e.extra=[]}function be(e){let t=[];return e.bold&&t.push(`1`),e.italic&&t.push(`3`),e.underline&&t.push(e.underline),e.overline&&t.push(`53`),e.inverse&&t.push(`7`),t.push(...e.foreground,...e.background,...e.underlineColor,...e.extra),t.length?`\x1b[${t.join(`;`)}m`:``}var xe=`deno-tui.unicode-data-pack`,Se=Object.freeze({maxPacks:32,maxSources:16,maxEmojiProperties:64,maxRangesPerTable:1e5,maxTotalRanges:25e4,maxDepth:8,maxStringLength:256,maxUrlLength:2048}),Ce=class extends TypeError{path;code=`UNICODE_DATA_PACK_INVALID`;constructor(e,t){super(`Invalid Unicode data pack at ${e}: ${t}`),this.path=e,this.name=`UnicodeDataPackValidationError`}},we=class extends Error{code=`UNICODE_DATA_PACK_NOT_FOUND`;constructor(){super(`No Unicode data pack matches the requested selector.`),this.name=`UnicodeDataPackNotFoundError`}},Te=1114111,Ee=/^[A-Za-z][A-Za-z0-9_-]{0,63}$/,De=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/,Oe=/^[0-9a-f]{64}$/,ke=new Set([`A`,`F`,`H`,`N`,`Na`,`W`]);function j(e,t){throw new Ce(e,t)}function Ae(e,t,n,r,i=n){r>Se.maxDepth&&j(t,`maximum nesting depth exceeded`),(typeof e!=`object`||!e)&&j(t,`expected an object`);let a,o;try{a=Object.getPrototypeOf(e),o=Object.getOwnPropertyDescriptors(e)}catch{return j(t,`object descriptors could not be inspected safely`)}a!==Object.prototype&&a!==null&&j(t,`expected a plain object`);let s=new Set(n),c=Object.create(null);for(let e of Reflect.ownKeys(o)){typeof e!=`string`&&j(t,`symbol keys are not allowed`),s.has(e)||j(`${t}.${e}`,`unknown property`);let n=o[e];(n===void 0||!(`value`in n)||n.get!==void 0||n.set!==void 0)&&j(`${t}.${e}`,`accessors are not allowed`),n.enumerable!==!0&&j(`${t}.${e}`,`properties must be enumerable`),c[e]=n.value}for(let e of i)Object.hasOwn(c,e)||j(`${t}.${e}`,`required property is missing`);return c}function je(e,t,n,r){r>Se.maxDepth&&j(t,`maximum nesting depth exceeded`);let i=!1;try{i=Array.isArray(e)}catch{return j(t,`array identity could not be inspected safely`)}i||j(t,`expected an array`);let a,o;try{a=Object.getPrototypeOf(e),o=Object.getOwnPropertyDescriptors(e)}catch{return j(t,`array descriptors could not be inspected safely`)}a!==Array.prototype&&a!==null&&j(t,`expected a plain array`);let s=o.length;(s===void 0||!(`value`in s))&&j(`${t}.length`,`missing length`);let c=s.value;(!Number.isSafeInteger(c)||c<0||c>n)&&j(`${t}.length`,`must be an integer from 0 through ${n}`);let l=Array(c);for(let e of Reflect.ownKeys(o)){if(typeof e!=`string`&&j(t,`symbol keys are not allowed`),e===`length`)continue;/^(0|[1-9]\d*)$/.test(e)||j(`${t}.${e}`,`custom array properties are not allowed`);let n=Number(e);(!Number.isSafeInteger(n)||n<0||n>=c||String(n)!==e)&&j(`${t}.${e}`,`invalid array index`);let r=o[e];(r===void 0||!(`value`in r)||r.get!==void 0||r.set!==void 0)&&j(`${t}[${n}]`,`accessors are not allowed`),r.enumerable!==!0&&j(`${t}[${n}]`,`items must be enumerable`),l[n]=r.value}for(let e=0;e<c;e++)Object.hasOwn(l,e)||j(`${t}[${e}]`,`sparse arrays are not allowed`);return l}function Me(e,t,n=Se.maxStringLength){return typeof e!=`string`&&j(t,`expected a string`),(e.length===0||e.length>n)&&j(t,`length must be from 1 through ${n}`),e}function Ne(e,t,n,r){return(!Number.isSafeInteger(e)||e<n||e>r)&&j(t,`must be an integer from ${n} through ${r}`),e}function Pe(e,t){return Object.freeze({start:e,end:t})}function Fe(e,t,n){let r=Ae(e,t,[`start`,`end`],n),i=Ne(r.start,`${t}.start`,0,Te),a=Ne(r.end,`${t}.end`,0,Te);return a<i&&j(t,`range end precedes its start`),Pe(i,a)}function Ie(e,t,n,r){let i=je(e,t,Se.maxRangesPerTable,n),a=[],o=-1;for(let e=0;e<i.length;e++){let s=`${t}[${e}]`,c=Ae(i[e],s,[`start`,`end`,`value`],n+1),l=Ne(c.start,`${s}.start`,0,Te),u=Ne(c.end,`${s}.end`,0,Te);u<l&&j(s,`range end precedes its start`),l<=o&&j(s,`ranges must be sorted and non-overlapping`);let d=Me(c.value,`${s}.value`,64);Ee.test(d)||j(`${s}.value`,`expected a Unicode property token`),r!==void 0&&!r.has(d)&&j(`${s}.value`,`unsupported property value`),a.push(Object.freeze({start:l,end:u,value:d})),o=u}return Object.freeze(a)}function Le(e,t,n){let r=je(e,t,Se.maxRangesPerTable,n),i=[],a=-1;for(let e=0;e<r.length;e++){let o=Fe(r[e],`${t}[${e}]`,n+1);o.start<=a&&j(`${t}[${e}]`,`ranges must be sorted and non-overlapping`),i.push(o),a=o.end}return Object.freeze(i)}function Re(e,t,n){let r=je(e,t,Se.maxSources,n);r.length===0&&j(t,`at least one source is required`);let i=[],a=``,o=new Set;for(let e=0;e<r.length;e++){let s=`${t}[${e}]`,c=Ae(r[e],s,[`name`,`url`,`sha256`],n+1),l=Me(c.name,`${s}.name`,64);Ee.test(l)||j(`${s}.name`,`expected a source token`),l<=a&&j(`${s}.name`,`sources must be uniquely sorted by name`);let u=Me(c.url,`${s}.url`,Se.maxUrlLength);/^https:\/\/[^\s]+$/.test(u)||j(`${s}.url`,`expected an HTTPS URL`),o.has(u)&&j(`${s}.url`,`source URLs must be unique`);let d=Me(c.sha256,`${s}.sha256`,64);Oe.test(d)||j(`${s}.sha256`,`expected a lowercase SHA-256 digest`),i.push(Object.freeze({name:l,url:u,sha256:d})),a=l,o.add(u)}return Object.freeze(i)}function ze(e,t,n){let r=je(e,t,Se.maxEmojiProperties,n);r.length===0&&j(t,`at least one emoji property is required`);let i=[],a=``,o=0;for(let e=0;e<r.length;e++){let s=`${t}[${e}]`,c=Ae(r[e],s,[`property`,`ranges`],n+1),l=Me(c.property,`${s}.property`,64);Ee.test(l)||j(`${s}.property`,`expected a Unicode property token`),l<=a&&j(`${s}.property`,`properties must be uniquely sorted by name`);let u=Le(c.ranges,`${s}.ranges`,n+1);o+=u.length,o>Se.maxTotalRanges&&j(t,`total range limit exceeded`),i.push(Object.freeze({property:l,ranges:u})),a=l}return Object.freeze(i)}function Be(e,t=`$`,n=0){let r=Ae(e,t,[`schema`,`schemaVersion`,`unicodeVersion`,`sources`,`tables`],n);r.schema!==`deno-tui.unicode-data-pack`&&j(`${t}.schema`,`unsupported schema identifier`),r.schemaVersion!==1&&j(`${t}.schemaVersion`,`unsupported schema version`);let i=Me(r.unicodeVersion,`${t}.unicodeVersion`,32),a=De.exec(i);(a===null||a.slice(1).some(e=>Number(e)>999))&&j(`${t}.unicodeVersion`,`expected a bounded major.minor.patch version`);let o=Re(r.sources,`${t}.sources`,n+1),s=Ae(r.tables,`${t}.tables`,[`graphemeBreak`,`eastAsianWidth`,`emoji`],n+1),c=Ie(s.graphemeBreak,`${t}.tables.graphemeBreak`,n+2),l=Ie(s.eastAsianWidth,`${t}.tables.eastAsianWidth`,n+2,ke),u=ze(s.emoji,`${t}.tables.emoji`,n+2);c.length+l.length+u.reduce((e,t)=>e+t.ranges.length,0)>Se.maxTotalRanges&&j(`${t}.tables`,`total range limit exceeded`);let d=Object.freeze({graphemeBreak:c,eastAsianWidth:l,emoji:u});return Object.freeze({schema:xe,schemaVersion:1,unicodeVersion:i,sources:o,tables:d})}var Ve=new Uint32Array([1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298]);function He(e,t){return e>>>t|e<<32-t}function Ue(e){let t=typeof e==`string`?new TextEncoder().encode(e):e,n=Math.ceil((t.length+9)/64)*64,r=new Uint8Array(n);r.set(t),r[t.length]=128;let i=t.length*8,a=new DataView(r.buffer);a.setUint32(n-8,Math.floor(i/4294967296),!1),a.setUint32(n-4,i>>>0,!1);let o=new Uint32Array([1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225]),s=new Uint32Array(64);for(let e=0;e<n;e+=64){for(let t=0;t<16;t++)s[t]=a.getUint32(e+t*4,!1);for(let e=16;e<64;e++){let t=s[e-15],n=s[e-2],r=He(t,7)^He(t,18)^t>>>3,i=He(n,17)^He(n,19)^n>>>10;s[e]=s[e-16]+r+s[e-7]+i>>>0}let[t,n,r,i,c,l,u,d]=o;for(let e=0;e<64;e++){let a=He(c,6)^He(c,11)^He(c,25),o=c&l^~c&u,f=d+a+o+Ve[e]+s[e]>>>0,p=(He(t,2)^He(t,13)^He(t,22))+(t&n^t&r^n&r)>>>0;d=u,u=l,l=c,c=i+f>>>0,i=r,r=n,n=t,t=f+p>>>0}o[0]=o[0]+t>>>0,o[1]=o[1]+n>>>0,o[2]=o[2]+r>>>0,o[3]=o[3]+i>>>0,o[4]=o[4]+c>>>0,o[5]=o[5]+l>>>0,o[6]=o[6]+u>>>0,o[7]=o[7]+d>>>0}return Array.from(o,e=>e.toString(16).padStart(8,`0`)).join(``)}function We(e){let t=Ae(e,`$`,[`schema`,`schemaVersion`,`unicodeVersion`,`fingerprint`,`sources`,`tables`],0),n=Be({schema:t.schema,schemaVersion:t.schemaVersion,unicodeVersion:t.unicodeVersion,sources:t.sources,tables:t.tables}),r=Me(t.fingerprint,`$.fingerprint`,64);return Oe.test(r)||j(`$.fingerprint`,`expected a lowercase SHA-256 digest`),r!==Ue(JSON.stringify(n))&&j(`$.fingerprint`,`does not match normalized pack content`),Object.freeze({schema:n.schema,schemaVersion:n.schemaVersion,unicodeVersion:n.unicodeVersion,fingerprint:r,sources:n.sources,tables:n.tables})}function Ge(e){let t=We(e),n=Object.freeze(t.sources.map(e=>Object.freeze({...e}))),r=Object.freeze(t.tables.emoji.map(e=>e.property));return Object.freeze({schema:t.schema,schemaVersion:t.schemaVersion,unicodeVersion:t.unicodeVersion,fingerprint:t.fingerprint,sources:n,graphemeBreakRanges:t.tables.graphemeBreak.length,eastAsianWidthRanges:t.tables.eastAsianWidth.length,emojiProperties:r,emojiRanges:t.tables.emoji.reduce((e,t)=>e+t.ranges.length,0)})}function Ke(e,t){let n=e.split(`.`).map(Number),r=t.split(`.`).map(Number);for(let e=0;e<3;e++)if(n[e]!==r[e])return n[e]-r[e];return 0}function qe(e){if(e===void 0)return Object.freeze({});if(typeof e==`string`)return De.test(e)||j(`$.selector`,`expected a major.minor.patch version`),Object.freeze({unicodeVersion:e});let t=Ae(e,`$.selector`,[`unicodeVersion`,`fingerprint`],0,[]);!Object.hasOwn(t,`unicodeVersion`)&&!Object.hasOwn(t,`fingerprint`)&&j(`$.selector`,`at least one selector field is required`);let n,r;return Object.hasOwn(t,`unicodeVersion`)&&(n=Me(t.unicodeVersion,`$.selector.unicodeVersion`,32),De.test(n)||j(`$.selector.unicodeVersion`,`invalid version`)),Object.hasOwn(t,`fingerprint`)&&(r=Me(t.fingerprint,`$.selector.fingerprint`,64),Oe.test(r)||j(`$.selector.fingerprint`,`invalid fingerprint`)),Object.freeze({unicodeVersion:n,fingerprint:r})}var Je=class e{#e;#t;constructor(e,t={}){let n=je(e,`$.packs`,Se.maxPacks,0);n.length===0&&j(`$.packs`,`at least one pack is required`);let r=n.map(e=>We(e));r.sort((e,t)=>Ke(e.unicodeVersion,t.unicodeVersion));for(let e=1;e<r.length;e++)r[e-1].unicodeVersion===r[e].unicodeVersion&&j(`$.packs`,`Unicode versions must be unique`),r[e-1].fingerprint===r[e].fingerprint&&j(`$.packs`,`pack fingerprints must be unique`);let i=Ae(t,`$.options`,[`defaultUnicodeVersion`],0,[]).defaultUnicodeVersion??r.at(-1).unicodeVersion;(typeof i!=`string`||!De.test(i))&&j(`$.options.defaultUnicodeVersion`,`expected a registered major.minor.patch version`),r.some(e=>e.unicodeVersion===i)||j(`$.options.defaultUnicodeVersion`,`version is not registered`),this.#e=Object.freeze(r),this.#t=i,Object.freeze(this)}get defaultUnicodeVersion(){return this.#t}get versions(){return Object.freeze(this.#e.map(e=>e.unicodeVersion))}select(e){let t=qe(e),n=t.unicodeVersion??(t.fingerprint===void 0?this.#t:void 0),r=this.#e.find(e=>(n===void 0||e.unicodeVersion===n)&&(t.fingerprint===void 0||e.fingerprint===t.fingerprint));if(r===void 0)throw new we;return r}withPack(t,n={}){return new e([...this.#e,t],{defaultUnicodeVersion:n.defaultUnicodeVersion??this.#t})}inspect(){let e=Object.freeze(this.#e.map(e=>Ge(e)));return Object.freeze({defaultUnicodeVersion:this.#t,versions:Object.freeze(this.#e.map(e=>e.unicodeVersion)),packs:e})}},Ye=JSON.parse(String.raw`{"schema":"deno-tui.unicode-grapheme-data","schemaVersion":1,"unicodeVersion":"17.0.0","dataPackFingerprint":"4c885bc9201552e99c0797a4b8ea72db55fc2c315af3347ad53a9743c65bbfc2","indicConjunctBreakFingerprint":"bfa679b9dd050b8de3a16881433fc28d48ec81cb01d46dd44c1f5bc4888f49e3","graphemeBreakValues":["CR","Control","Extend","L","LF","LV","LVT","Other","Prepend","Regional_Indicator","SpacingMark","T","V","ZWJ"],"indicConjunctBreakValues":["Consonant","Extend","Linker"],"graphemeBreakRanges":[0,9,1,0,0,4,0,1,1,0,0,0,0,17,1,95,32,1,13,0,1,594,111,2,275,6,2,263,44,2,1,0,2,1,1,2,1,1,2,1,0,2,56,5,8,10,10,2,1,0,1,46,20,2,16,0,2,101,6,2,0,0,8,1,5,2,2,1,2,1,3,2,33,0,8,1,0,2,30,26,2,91,10,2,58,8,2,9,0,2,24,3,2,1,8,2,1,2,2,1,4,2,43,2,2,52,1,8,5,8,2,42,23,2,0,0,8,0,31,2,0,0,10,54,0,2,0,0,10,0,0,2,1,2,10,0,7,2,0,3,10,0,0,2,0,1,10,1,6,2,10,1,2,29,0,2,0,1,10,56,0,2,1,0,2,0,1,10,0,3,2,2,1,10,2,1,10,0,0,2,9,0,2,10,1,2,26,0,2,2,1,2,0,0,10,56,0,2,1,2,10,0,1,2,4,1,2,2,2,2,3,0,2,30,1,2,3,0,2,11,1,2,0,0,10,56,0,2,1,2,10,0,4,2,1,1,2,0,0,10,1,1,10,0,0,2,20,1,2,22,5,2,1,0,2,0,1,10,56,0,2,1,1,2,0,0,10,0,3,2,2,1,10,2,1,10,0,0,2,7,2,2,10,1,2,30,0,2,59,0,2,0,0,10,0,0,2,0,1,10,3,2,10,1,2,10,0,0,2,9,0,2,40,0,2,0,2,10,0,0,2,55,0,2,1,2,2,0,3,10,1,2,2,1,3,2,7,1,2,11,1,2,29,0,2,0,1,10,56,0,2,1,0,10,0,1,2,0,0,10,0,0,2,0,1,10,1,2,2,1,3,2,7,1,2,11,1,2,15,0,10,12,1,2,0,1,10,55,1,2,1,0,2,0,1,10,0,3,2,1,2,10,1,2,10,0,0,2,0,0,8,8,0,2,10,1,2,29,0,2,0,1,10,70,0,2,4,0,2,0,1,10,0,2,2,1,0,2,1,6,10,0,0,2,18,1,10,61,0,2,1,0,10,0,6,2,12,7,2,98,0,2,1,0,10,0,8,2,11,6,2,73,1,2,27,0,2,1,0,2,1,0,2,4,1,10,49,13,2,0,0,10,0,4,2,1,1,2,5,10,2,1,35,2,9,0,2,102,3,2,0,0,10,0,5,2,1,1,2,0,1,10,0,1,2,23,1,10,0,1,2,4,2,2,16,3,2,13,0,2,1,0,10,0,1,2,6,0,2,15,0,2,98,95,3,0,71,12,0,87,11,349,2,2,946,3,2,28,2,2,29,1,2,30,1,2,64,1,2,0,0,10,0,6,2,0,7,10,0,0,2,0,1,10,0,10,2,9,0,2,45,2,2,0,0,1,0,0,2,117,1,2,34,0,2,118,2,2,0,3,10,0,1,2,0,2,10,4,1,10,0,0,2,0,5,10,0,2,2,219,1,2,0,1,10,0,0,2,57,0,10,0,0,2,0,0,10,0,6,2,1,0,2,1,0,2,2,7,2,0,5,10,0,9,2,2,0,2,48,45,2,2,11,2,20,3,2,0,0,10,47,9,2,0,3,10,0,2,2,38,8,2,12,1,2,0,0,10,30,0,10,0,3,2,0,1,10,0,5,2,56,0,2,0,0,10,0,1,2,0,2,10,0,0,2,0,0,10,0,4,2,48,7,10,0,7,2,0,1,10,0,1,2,152,2,2,1,12,2,0,0,10,0,6,2,4,0,2,6,0,2,2,0,10,0,1,2,198,63,2,523,0,1,0,0,2,0,0,13,0,1,1,24,6,1,49,15,1,96,32,2,3070,2,2,141,0,2,96,31,2,554,5,2,105,1,2,30164,3,2,1,9,2,32,1,2,80,1,2,272,0,2,3,0,2,4,0,2,23,1,10,0,1,2,0,0,10,4,0,2,83,1,10,50,15,10,0,1,2,26,17,2,13,0,2,38,7,2,25,10,2,0,0,10,0,0,2,12,28,3,3,2,2,0,0,10,47,0,2,0,1,10,0,3,2,0,1,10,0,1,2,0,1,10,0,0,2,36,0,2,67,5,2,0,1,10,0,1,2,0,1,10,0,1,2,12,0,2,8,0,2,0,0,10,46,0,2,51,0,2,1,2,2,2,1,2,5,1,2,1,0,2,41,0,10,0,1,2,0,1,10,5,0,10,0,0,2,236,1,10,0,0,2,0,1,10,0,0,2,0,1,10,1,0,10,0,0,2,18,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,0,0,5,0,26,6,12,22,12,4,48,11,8994,0,2,737,15,2,16,15,2,207,0,1,158,1,2,80,11,1,513,0,2,226,0,2,149,4,2,1670,2,2,1,1,2,5,3,2,40,2,2,4,0,2,165,1,2,573,3,2,65,4,2,317,1,2,77,5,2,70,10,2,49,3,2,122,0,10,0,0,2,0,0,10,53,14,2,41,0,2,2,1,2,10,2,2,0,0,10,45,2,10,0,3,2,0,1,10,0,1,2,2,0,8,4,0,2,10,0,8,50,2,2,36,4,2,0,0,10,0,7,2,16,1,10,44,0,2,12,1,2,0,0,10,48,2,10,0,8,2,0,0,10,0,0,2,1,1,8,5,3,2,1,0,10,0,0,2,92,2,10,0,2,2,0,1,10,0,3,2,6,0,2,2,0,2,157,0,2,0,2,10,0,7,2,21,1,2,0,1,10,55,1,2,1,0,2,0,0,10,0,0,2,0,3,10,2,1,10,2,1,10,0,0,2,9,0,2,10,1,10,2,6,2,3,4,2,67,0,2,0,1,10,0,5,2,1,0,2,2,0,2,1,2,2,0,0,10,1,1,10,0,2,2,0,0,8,0,0,2,14,1,2,82,2,10,0,7,2,0,1,10,0,2,2,0,0,10,0,0,2,23,0,2,81,0,2,0,1,10,0,5,2,0,0,10,0,0,2,0,1,10,0,0,2,0,0,10,0,1,2,0,0,10,0,1,2,235,0,2,0,1,10,0,3,2,2,3,10,0,1,2,0,0,10,0,1,2,27,1,2,82,2,10,0,7,2,0,1,10,0,0,2,0,0,10,0,1,2,106,0,2,0,0,10,0,0,2,0,1,10,0,7,2,101,0,2,0,0,10,0,0,2,2,3,2,0,0,10,0,4,2,256,2,10,0,8,2,0,0,10,0,1,2,245,0,2,0,4,10,1,1,10,2,3,2,0,0,8,0,0,10,0,0,8,0,0,10,0,0,2,141,2,10,0,3,2,2,1,2,0,3,10,0,0,2,3,0,10,28,9,2,40,5,2,0,0,10,1,3,2,8,0,2,9,5,2,0,1,10,0,2,2,40,5,8,0,12,2,0,0,10,0,1,2,198,0,2,0,0,10,0,2,2,0,0,10,0,0,2,0,0,10,199,0,10,0,6,2,1,5,2,0,0,10,0,0,2,82,21,2,1,0,10,0,6,2,0,0,10,0,1,2,0,0,10,0,1,2,122,5,2,3,0,2,1,1,2,1,6,2,0,0,8,0,0,2,66,4,10,1,1,2,1,1,10,0,0,2,0,0,10,0,0,2,347,1,2,0,1,10,9,1,2,0,0,8,0,0,10,48,1,10,0,4,2,3,1,10,0,2,2,23,0,2,5333,15,1,0,0,2,6,14,2,11464,11,2,0,2,10,0,2,2,2496,4,2,59,6,2,556,0,12,3,3,12,484,0,2,1,54,10,7,3,2,81,0,2,11,1,2,19627,1,2,1,3,1,4700,45,2,2,22,2,542,4,2,3,5,2,0,7,1,0,7,2,2,6,2,30,3,2,148,2,2,1979,54,2,4,49,2,8,0,2,14,0,2,22,4,2,1,14,2,1360,6,2,1,16,2,2,6,2,1,1,2,1,4,2,100,0,2,160,6,2,375,0,2,61,3,2,508,3,2,254,1,2,243,0,2,2,0,2,7,1,2,5,0,2,474,6,2,109,6,2,2203,25,9,507,4,2,789504,31,1,0,95,2,0,127,1,0,239,2,0,3599,1],"extendedPictographicRanges":[169,0,4,0,8077,0,12,0,216,0,22,0,90,5,15,1,367,1,12,0,166,0,25,10,4,2,199,0,231,1,10,0,9,0,58,3,1,4,9,0,2,0,2,1,2,0,4,0,2,0,1,1,2,0,3,0,3,1,8,2,5,0,1,0,5,11,11,1,2,0,1,1,1,0,18,0,2,1,18,5,1,0,1,1,3,1,5,0,2,1,4,1,11,1,5,1,2,0,5,1,1,0,1,1,20,1,5,5,1,3,2,0,4,0,2,0,2,5,1,0,2,0,1,0,1,0,6,0,3,0,6,0,10,1,15,0,2,0,4,0,1,0,4,2,1,0,11,1,48,2,9,0,14,0,14,0,372,1,463,2,19,1,51,0,4,0,1242,0,12,0,601,0,1,0,114026,0,39,3,100,11,15,1,15,0,14,1,37,9,112,1,12,1,14,0,2,9,19,55,27,14,10,0,20,0,2,8,1,3,9,22,6,187,2,111,2,1,1,2,2,82,2,2,1,3,5,253,1,62,11,5,1,23,7,1,2,7,12,0,2,3,2,0,4,1,13,1,2,0,8,1,9,0,5,2,12,2,8,2,2,0,1,0,4,0,6,0,3,0,6,85,48,69,5,7,2,16,3,0,1,5,2,12,218,37,12,3,56,7,10,5,40,7,30,1,12,3,2,13,9,38,12,46,1,9,1,184,88,7,14,145,256,1021],"indicConjunctBreakRanges":[768,111,1,275,6,1,263,44,1,1,0,1,1,1,1,1,1,1,1,0,1,72,10,1,48,20,1,16,0,1,101,6,1,2,5,1,2,1,1,1,3,1,35,0,1,30,26,1,91,10,1,58,8,1,9,0,1,24,3,1,1,8,1,1,2,1,1,4,1,43,2,1,59,8,1,42,23,1,1,31,1,18,36,0,0,0,1,1,0,1,4,7,1,4,0,2,3,6,1,0,7,0,2,1,1,20,7,0,1,0,1,19,19,0,1,6,0,1,0,0,3,3,0,2,0,1,1,0,1,2,3,1,8,0,2,9,0,1,4,1,0,1,0,0,2,1,1,12,1,0,12,0,1,2,1,1,57,0,1,4,1,1,4,1,1,2,2,1,3,0,1,30,1,1,3,0,1,11,1,1,18,19,0,1,6,0,1,1,0,1,4,0,2,0,1,4,4,1,1,1,1,4,0,2,20,1,1,21,0,0,0,5,1,1,0,1,19,19,0,1,6,0,1,1,0,1,4,0,2,0,1,1,1,1,1,3,1,8,0,2,7,2,1,4,1,0,1,0,0,2,1,1,13,0,0,16,0,1,59,0,1,1,0,1,12,0,1,9,0,1,40,0,1,3,0,1,16,19,0,1,15,0,2,0,1,1,2,1,5,2,1,1,2,1,0,0,2,7,1,1,1,2,0,7,1,1,29,0,1,58,0,1,2,1,1,1,0,1,3,2,1,1,3,1,7,1,1,11,1,1,28,1,1,19,37,0,0,1,1,1,0,1,2,3,1,8,0,2,9,0,1,10,1,1,29,0,1,72,0,1,4,0,1,2,2,1,1,0,1,8,0,1,81,0,1,2,6,1,12,7,1,98,0,1,2,8,1,11,6,1,73,1,1,27,0,1,1,0,1,1,0,1,55,13,1,1,4,1,1,1,1,5,10,1,1,35,1,9,0,1,57,42,0,2,3,1,1,5,1,1,0,2,0,0,1,2,1,1,0,0,0,16,5,0,2,1,1,0,3,0,0,2,1,0,0,0,3,1,0,7,2,0,0,3,1,0,12,0,0,0,1,2,1,1,6,0,1,0,0,0,14,0,1,703,2,1,946,3,1,28,2,1,29,1,1,30,1,1,12,51,0,0,1,1,1,6,1,8,0,1,2,8,1,0,0,2,0,0,1,9,0,1,45,2,1,1,0,1,117,1,1,34,0,1,118,2,1,4,1,1,9,0,1,6,2,1,219,1,1,2,0,1,4,52,0,1,0,1,1,6,1,1,0,2,1,0,1,2,7,1,6,9,1,2,0,1,48,45,1,2,11,1,20,3,1,7,1,0,6,32,0,0,9,1,4,1,1,0,0,2,0,7,0,30,8,1,12,1,1,1,29,0,1,3,1,2,2,1,0,0,2,0,1,1,0,1,0,11,2,0,40,0,1,1,1,1,3,0,1,1,4,1,56,7,1,2,1,1,152,2,1,1,12,1,1,6,1,4,0,1,6,0,1,3,1,1,198,63,1,525,0,1,194,32,1,3070,2,1,141,0,1,96,31,1,554,5,1,105,1,1,30164,3,1,1,9,1,32,1,1,80,1,1,272,0,1,3,0,1,4,0,1,25,1,1,5,0,1,151,1,1,26,17,1,13,0,1,38,7,1,25,10,1,1,0,1,44,2,1,6,2,0,3,35,0,0,0,1,2,3,1,2,1,1,2,0,2,31,4,0,0,0,1,1,8,0,10,4,0,42,5,1,2,1,1,2,1,1,12,0,1,8,0,1,19,15,0,1,2,0,6,0,0,1,0,1,1,1,0,48,0,1,1,2,1,2,1,1,5,1,1,1,0,1,30,10,0,1,1,1,8,0,2,201,26,0,10,0,1,2,0,1,4,0,1,20272,0,1,737,15,1,16,15,1,366,1,1,605,0,1,226,0,1,149,4,1,1669,0,0,0,2,1,1,1,1,5,3,1,0,3,0,1,2,0,1,28,0,2,2,1,4,0,2,165,1,1,573,3,1,65,4,1,317,1,1,77,5,1,70,10,1,49,3,1,123,0,1,54,14,1,41,0,1,2,1,1,10,2,1,49,3,1,2,1,1,7,0,1,61,2,1,0,35,0,0,4,1,1,5,1,0,0,2,0,0,1,15,0,0,2,0,0,43,0,1,12,1,1,52,8,1,1,0,1,8,3,1,2,0,1,95,2,1,2,3,1,6,0,1,2,0,1,157,0,1,3,7,1,21,1,1,57,1,1,1,0,1,1,0,1,12,0,1,9,0,1,14,6,1,3,4,1,11,9,0,1,0,0,2,0,0,1,37,0,2,0,1,2,5,1,1,0,1,2,0,1,1,2,1,4,1,1,0,0,2,1,0,1,14,1,1,85,7,1,2,2,1,1,0,1,23,0,1,81,0,1,2,5,1,1,0,1,2,0,1,1,1,1,1,1,1,235,0,1,2,3,1,6,1,1,1,1,1,27,1,1,85,7,1,2,0,1,1,1,1,106,0,1,1,0,1,2,7,1,101,0,1,1,0,1,2,3,1,1,4,1,259,8,1,1,1,1,197,6,0,2,0,0,2,7,0,1,1,0,1,23,0,0,0,1,10,2,1,0,0,2,4,0,1,144,3,1,2,1,1,4,0,1,31,0,0,0,9,1,0,39,0,0,5,1,2,3,1,8,0,2,8,0,0,0,5,1,2,2,1,0,39,0,6,12,1,1,0,1,0,0,2,198,0,1,1,2,1,1,0,1,201,6,1,1,5,1,1,0,1,82,21,1,2,6,1,1,1,1,1,1,1,122,5,1,3,0,1,1,1,1,1,6,1,1,0,1,72,1,1,3,0,1,1,0,1,347,1,1,11,1,1,2,12,0,1,33,0,2,4,1,5,1,1,0,0,2,23,0,1,5349,0,1,6,14,1,11464,11,1,3,2,1,2496,4,1,59,6,1,1048,0,1,63,3,1,81,0,1,11,1,1,19627,1,1,4705,45,1,2,22,1,542,4,1,3,5,1,8,7,1,2,6,1,30,3,1,148,2,1,1979,54,1,4,49,1,8,0,1,14,0,1,22,4,1,1,14,1,1360,6,1,1,16,1,2,6,1,1,1,1,1,4,1,100,0,1,160,6,1,375,0,1,61,3,1,508,3,1,254,1,1,243,0,1,2,0,1,7,1,1,5,0,1,474,6,1,109,6,1,2736,4,1,789536,95,1,128,239,1],"fingerprint":"bc25cd592433e9c0ee1835efcdf7e8b5f9edb462bbb971ae07c20fb16e479dc6"}`),Xe=class extends TypeError{code=`UNICODE_GRAPHEME_DATA_INVALID`;constructor(e){super(`Invalid Unicode grapheme data: ${e}`),this.name=`UnicodeGraphemeDataError`}},Ze=new Set([`CR`,`Control`,`Extend`,`L`,`LF`,`LV`,`LVT`,`Other`,`Prepend`,`Regional_Indicator`,`SpacingMark`,`T`,`V`,`ZWJ`]),Qe=new Set([`Control`,`CR`,`LF`]),$e=`17.0.0`,et=`4c885bc9201552e99c0797a4b8ea72db55fc2c315af3347ad53a9743c65bbfc2`,tt=`bfa679b9dd050b8de3a16881433fc28d48ec81cb01d46dd44c1f5bc4888f49e3`,nt=`bc25cd592433e9c0ee1835efcdf7e8b5f9edb462bbb971ae07c20fb16e479dc6`,rt=Object.freeze([`CR`,`Control`,`Extend`,`L`,`LF`,`LV`,`LVT`,`Other`,`Prepend`,`Regional_Indicator`,`SpacingMark`,`T`,`V`,`ZWJ`]),it=Object.freeze([`Consonant`,`Extend`,`Linker`]);function M(e){throw new Xe(e)}function at(e,t,n){(typeof e!=`object`||!e||Array.isArray(e))&&M(`${t} must be a plain object`);let r,i;try{r=Object.getPrototypeOf(e),i=Object.getOwnPropertyDescriptors(e)}catch{return M(`${t} could not be inspected safely`)}r!==Object.prototype&&r!==null&&M(`${t} must be a plain object`);let a=new Set(n),o=Object.create(null);for(let e of Reflect.ownKeys(i)){(typeof e!=`string`||!a.has(e))&&M(`${t} has an unknown property`);let n=i[e];(n===void 0||!(`value`in n)||n.get!==void 0||n.set!==void 0)&&M(`${t}.${e} must be a data property`),o[e]=n.value}for(let e of n)Object.hasOwn(o,e)||M(`${t}.${e} is required`);return o}function ot(e,t){Array.isArray(e)||M(`${t} must be an array`);let n,r;try{n=Object.getPrototypeOf(e),r=Object.getOwnPropertyDescriptors(e)}catch{return M(`${t} could not be inspected safely`)}n!==Array.prototype&&n!==null&&M(`${t} must be a plain array`);let i=r.length?.value;(!Number.isSafeInteger(i)||i<1||i>1e5)&&M(`${t}.length is outside the supported range`);let a=Array(i);for(let e of Reflect.ownKeys(r)){if(e===`length`)continue;(typeof e!=`string`||!/^(0|[1-9]\d*)$/.test(e))&&M(`${t} has a custom property`);let n=Number(e),o=r[e];(!Number.isSafeInteger(n)||n<0||n>=i||o===void 0||!(`value`in o)||o.get!==void 0||o.set!==void 0)&&M(`${t}[${e}] must be a dense data property`),a[n]=o.value}for(let e=0;e<i;e++)Object.hasOwn(a,e)||M(`${t} must not be sparse`);return a}function st(e,t,n){let r=ot(e,n);r.length!==t.length&&M(`${n} does not match the pinned property codec`);for(let e=0;e<r.length;e++)r[e]!==t[e]&&M(`${n} does not match the pinned property codec`);return t}function ct(e,t,n){let r=ot(e,t);r.length%n!==0&&M(`${t} length must be divisible by ${n}`);let i=[];for(let e=0;e<r.length;e++){let n=r[e];(!Number.isSafeInteger(n)||n<0)&&M(`${t}[${e}] must be a non-negative safe integer`),i.push(n)}return Object.freeze(i)}function lt(e,t,n){let r=[],i=-1;for(let a=0;a<e.length;a+=3){let o=i+1+e[a],s=o+e[a+1],c=t[e[a+2]];(!Number.isSafeInteger(o)||!Number.isSafeInteger(s)||o<0||s>1114111)&&M(`${n}[${a/3}] is outside the Unicode code-point range`),c===void 0&&M(`${n}[${a/3}] has an unsupported property code`),r.push(Object.freeze({start:o,end:s,value:c})),i=s}return Object.freeze(r)}function ut(e,t){let n=[],r=-1;for(let i=0;i<e.length;i+=2){let a=r+1+e[i],o=a+e[i+1];(!Number.isSafeInteger(a)||!Number.isSafeInteger(o)||a<0||o>1114111)&&M(`${t}[${i/2}] is outside the Unicode code-point range`),n.push(Object.freeze({start:a,end:o})),r=o}return Object.freeze(n)}function dt(e){let t=at(e,`$.graphemeData`,[`schema`,`schemaVersion`,`unicodeVersion`,`dataPackFingerprint`,`indicConjunctBreakFingerprint`,`graphemeBreakValues`,`indicConjunctBreakValues`,`graphemeBreakRanges`,`extendedPictographicRanges`,`indicConjunctBreakRanges`,`fingerprint`]);(t.schema!==`deno-tui.unicode-grapheme-data`||t.schemaVersion!==1)&&M(`compact grapheme schema must be deno-tui.unicode-grapheme-data version 1`),t.unicodeVersion!==$e&&M(`compact grapheme Unicode version must be ${$e}`),t.dataPackFingerprint!==et&&M(`compact grapheme data-pack fingerprint is not pinned`),t.indicConjunctBreakFingerprint!==tt&&M(`compact Indic_Conjunct_Break fingerprint is not pinned`),t.fingerprint!==nt&&M(`compact grapheme content fingerprint is not pinned`);let n=st(t.graphemeBreakValues,rt,`$.graphemeData.graphemeBreakValues`),r=st(t.indicConjunctBreakValues,it,`$.graphemeData.indicConjunctBreakValues`),i=ct(t.graphemeBreakRanges,`$.graphemeData.graphemeBreakRanges`,3),a=ct(t.extendedPictographicRanges,`$.graphemeData.extendedPictographicRanges`,2),o=ct(t.indicConjunctBreakRanges,`$.graphemeData.indicConjunctBreakRanges`,3),s={schema:t.schema,schemaVersion:t.schemaVersion,unicodeVersion:t.unicodeVersion,dataPackFingerprint:t.dataPackFingerprint,indicConjunctBreakFingerprint:t.indicConjunctBreakFingerprint,graphemeBreakValues:n,indicConjunctBreakValues:r,graphemeBreakRanges:i,extendedPictographicRanges:a,indicConjunctBreakRanges:o};return Ue(JSON.stringify(s))!==t.fingerprint&&M(`compact grapheme fingerprint does not match its encoded content`),Object.freeze({unicodeVersion:t.unicodeVersion,dataPackFingerprint:t.dataPackFingerprint,indicConjunctBreakFingerprint:t.indicConjunctBreakFingerprint,graphemeBreak:lt(i,n,`$.graphemeData.graphemeBreakRanges`),extendedPictographic:ut(a,`$.graphemeData.extendedPictographicRanges`),indicConjunctBreak:lt(o,r,`$.graphemeData.indicConjunctBreakRanges`)})}var ft=dt(Ye);function pt(e){if(!Number.isInteger(e)||e<0||e>1114111)throw RangeError(`Unicode code point must be an integer from 0 through 1114111.`)}function mt(e,t){let n=0,r=e.length-1;for(;n<=r;){let i=n+(r-n>>>1),a=e[i];if(t<a.start)r=i-1;else if(t>a.end)n=i+1;else return a}}function ht(e){return pt(e),mt(ft.indicConjunctBreak,e)?.value??`None`}function gt(e){let t=e.length;for(let n=0;n<t;n+=1)if(e.charCodeAt(n)>127)return;let n=[];for(let r=0;r<t;r+=1)r>0&&e.charCodeAt(r-1)===13&&e.charCodeAt(r)===10||n.push(r);return n.push(t),Object.freeze(n)}function _t(e){if(typeof e!=`string`)throw TypeError(`Grapheme input must be a primitive string.`)}function vt(e,t,n=`offset`){if(!Number.isSafeInteger(t)||t<0||t>e.length)throw RangeError(`${n} must be an integer from 0 through the input's UTF-16 length (${e.length}).`)}function yt(e,t){if(!Number.isSafeInteger(e)||e<0)throw RangeError(`${t} must be a non-negative safe integer.`)}function bt(e){if(e!==`backward`&&e!==`forward`&&e!==`nearest`)throw TypeError(`Grapheme boundary bias must be "backward", "forward", or "nearest".`);return e}function xt(e,t){return mt(e.graphemeBreak,t)?.value??`Other`}function St(e,t){return mt(e.extendedPictographic,t)!==void 0}function Ct(e,t,n,r,i,a,o,s){return e===`CR`&&t===`LF`?!1:Qe.has(e)||Qe.has(t)?!0:e===`L`&&(t===`L`||t===`V`||t===`LV`||t===`LVT`)||(e===`LV`||e===`V`)&&(t===`V`||t===`T`)||(e===`LVT`||e===`T`)&&t===`T`||t===`Extend`||t===`ZWJ`||t===`SpacingMark`||e===`Prepend`||s===`Consonant`&&a&&o||n&&i?!1:e===`Regional_Indicator`&&t===`Regional_Indicator`?r%2==0:!0}var wt=class{#e;#t;#n=0;#r=!1;#i=!1;#a=!1;#o=!1;constructor(e){this.#e=e}consume(e){let t=xt(this.#e,e),n=ht(e),r=St(this.#e,e),i=this.#t!==void 0&&Ct(this.#t,t,r,this.#n,this.#i,this.#a,this.#o,n),a=t===`ZWJ`&&this.#r;return r?this.#r=!0:t!==`Extend`&&(this.#r=!1),n===`Consonant`?(this.#a=!0,this.#o=!1):n===`Extend`||n===`Linker`?this.#a&&n===`Linker`&&(this.#o=!0):(this.#a=!1,this.#o=!1),this.#n=t===`Regional_Indicator`?(this.#n+1)%2:0,this.#t=t,this.#i=a,i}};function Tt(e,t){if(e.length!==t.length)return!1;for(let n=0;n<e.length;n++)if(e[n].start!==t[n].start||e[n].end!==t[n].end)return!1;return!0}function Et(e,t){if(e.length!==t.length)return!1;for(let n=0;n<e.length;n++)if(e[n].start!==t[n].start||e[n].end!==t[n].end||e[n].value!==t[n].value)return!1;return!0}function Dt(e){Et(e.tables.graphemeBreak,ft.graphemeBreak)||M(`pack Grapheme_Cluster_Break table does not match the pinned Unicode 17.0.0 algorithm data`);let t=e.tables.emoji.find(e=>e.property===`Extended_Pictographic`);(t===void 0||!Tt(t.ranges,ft.extendedPictographic))&&M(`pack Extended_Pictographic table does not match the pinned Unicode 17.0.0 algorithm data`)}var Ot=new WeakMap;function kt(e,t){let n=0,r=e.length;for(;n<r;){let i=n+(r-n>>>1);e[i]<t?n=i+1:r=i}return{found:e[n]===t,index:n}}var At=new class{#e;#t;constructor(e){let t,n;if(e===void 0)t=ft,n=ft.dataPackFingerprint;else{let r=We(e);r.unicodeVersion!==ft.unicodeVersion&&M(`pack version ${r.unicodeVersion} has no matching Indic_Conjunct_Break table; expected ${ft.unicodeVersion}`);for(let e=0;e<r.tables.graphemeBreak.length;e++){let t=r.tables.graphemeBreak[e].value;Ze.has(t)||M(`pack Grapheme_Cluster_Break range ${e} has unsupported value ${JSON.stringify(t)}`)}Dt(r);let i=r.tables.emoji.find(e=>e.property===`Extended_Pictographic`);t=Object.freeze({graphemeBreak:r.tables.graphemeBreak,extendedPictographic:i.ranges}),n=r.fingerprint}this.#e=t,this.#t=Object.freeze({unicodeVersion:ft.unicodeVersion,dataPackFingerprint:n,indicConjunctBreakFingerprint:ft.indicConjunctBreakFingerprint,indicConjunctBreakRanges:ft.indicConjunctBreak.length}),Ot.set(this,t),Object.freeze(this)}inspect(){return this.#t}boundaries(e){_t(e);let t=gt(e);if(t)return t;let n=[0],r=0,i=new wt(this.#e);for(let t of e){let e=t.codePointAt(0),a=r;i.consume(e)&&n.push(a),r+=t.length}return n[n.length-1]!==e.length&&n.push(e.length),Object.freeze(n)}*iterate(e){let t=this.boundaries(e);for(let n=0;n+1<t.length;n++){let r=t[n],i=t[n+1];yield Object.freeze({segment:e.slice(r,i),start:r,end:i,index:n})}}segments(e){return Object.freeze(Array.from(this.iterate(e)))}count(e){return this.boundaries(e).length-1}isBoundary(e,t){return _t(e),vt(e,t),kt(this.boundaries(e),t).found}previousBoundary(e,t){_t(e),vt(e,t);let n=this.boundaries(e),r=kt(n,t).index-1;return n[Math.max(0,r)]}nextBoundary(e,t){_t(e),vt(e,t);let n=this.boundaries(e),r=kt(n,t),i=r.found?r.index+1:r.index;return n[Math.min(n.length-1,i)]}resolveBoundary(e,t,n){_t(e),vt(e,t);let r=bt(n),i=this.boundaries(e),a=kt(i,t);if(a.found)return t;let o=i[a.index-1],s=i[a.index];return r===`backward`?o:r===`forward`?s:t-o<=s-t?o:s}coveringRange(e,t,n){if(_t(e),vt(e,t,`start`),vt(e,n,`end`),n<t)throw RangeError(`Grapheme range end must not precede start.`);return Object.freeze({start:this.resolveBoundary(e,t,`backward`),end:this.resolveBoundary(e,n,`forward`)})}truncateClusters(e,t){_t(e),yt(t,`maximumClusters`);let n=this.boundaries(e);return t>=n.length-1?e:e.slice(0,n[t])}truncateUtf16(e,t){return _t(e),yt(t,`maximumCodeUnits`),t>=e.length?e:e.slice(0,this.resolveBoundary(e,t,`backward`))}},jt=Object.freeze([0,31,95,32,13,0,594,111,275,6,263,44,1,0,1,1,1,1,1,0,72,10,1,0,46,20,16,0,101,6,2,5,2,1,1,3,35,0,30,26,91,10,58,8,9,0,24,3,1,8,1,2,1,4,43,2,59,8,42,23,1,31,55,0,1,0,4,7,4,0,3,6,10,1,29,0,58,0,4,3,8,0,20,1,26,0,2,1,57,0,4,1,4,1,2,2,3,0,30,1,3,0,11,1,57,0,4,4,1,1,4,0,20,1,22,5,1,0,58,0,2,0,1,3,8,0,7,1,11,1,30,0,61,0,12,0,50,0,3,0,55,0,1,2,5,2,1,3,7,1,11,1,29,0,58,0,2,0,6,0,5,1,20,1,28,1,57,1,4,3,8,0,20,1,29,0,72,0,7,2,1,0,90,0,2,6,12,7,98,0,2,8,11,6,73,1,27,0,1,0,1,0,55,13,1,4,1,1,5,10,1,35,9,0,102,3,1,5,1,1,2,1,25,1,4,2,16,3,13,0,2,1,6,0,15,0,194,159,349,2,946,2,29,1,30,1,30,1,64,1,1,6,8,0,2,10,9,0,45,4,117,1,34,0,118,2,4,1,9,0,6,2,219,1,2,0,58,0,1,6,1,0,1,0,2,7,6,9,2,0,48,45,2,11,20,3,48,0,1,4,1,0,5,0,40,8,12,1,32,3,2,1,1,2,56,0,1,1,3,0,1,2,58,7,2,1,152,2,1,12,1,6,4,0,6,0,3,1,198,63,523,4,24,6,49,4,1,9,96,32,3070,2,141,0,96,31,554,3,107,1,30164,3,1,9,32,1,80,1,272,0,3,0,4,0,25,1,5,0,151,1,26,17,13,0,38,7,25,10,46,2,48,0,2,3,2,1,39,0,67,5,2,1,2,1,12,0,8,0,47,0,51,0,1,2,2,1,5,1,1,0,42,1,8,0,238,0,2,0,4,0,11202,22,4,48,8994,0,737,15,16,15,207,0,249,2,513,0,226,0,149,4,1670,2,1,1,5,3,40,2,4,0,165,1,573,3,65,4,317,1,77,5,70,10,49,3,123,0,54,14,41,0,2,1,10,2,49,3,2,1,7,0,61,2,36,4,1,7,62,0,12,1,52,8,10,3,2,0,95,2,2,0,1,1,6,0,2,0,157,0,3,7,21,1,57,1,3,0,37,6,3,4,70,5,13,0,1,0,1,0,14,1,85,7,2,2,1,0,23,0,84,5,1,0,4,1,1,1,238,3,6,1,1,1,27,1,85,7,2,0,1,1,106,0,1,0,2,5,1,0,101,0,1,0,2,3,1,4,259,8,1,1,256,1,1,0,4,0,144,3,2,1,4,0,32,9,40,5,2,3,8,0,9,5,2,2,46,12,1,1,198,0,1,2,1,0,201,6,1,5,1,0,82,21,2,6,1,1,1,1,122,5,3,0,1,1,1,6,1,0,72,1,3,0,1,0,347,1,11,1,52,4,5,0,1,0,23,0,5333,16,6,14,11464,11,3,2,2496,4,59,6,556,0,3,3,484,0,63,3,81,0,19640,1,1,3,4700,45,2,22,544,2,9,15,2,6,30,3,148,2,1979,54,4,49,8,0,14,0,22,4,1,14,1360,6,1,16,2,6,1,1,1,4,100,0,160,6,375,0,61,3,508,3,254,1,243,0,2,0,7,1,5,0,474,6,109,6,792246,0,30,95,128,239]),Mt=Object.freeze([4352,95,4538,1,13,1,190,3,3,0,2,0,521,1,21,1,26,7,16,11,43,0,10,5,3,0,13,0,8,1,17,1,5,1,8,0,5,0,21,0,7,1,1,0,4,0,2,0,7,0,4,1,28,0,35,0,1,0,4,2,1,0,61,2,24,0,14,0,859,1,51,0,4,0,810,25,1,88,12,213,26,78,2,85,2,102,5,42,1,93,1,85,9,47,1,39,8,29244,3,54,1177,28,643,11171,8540,365,2,105,822,9,22,34,1,18,1,3,149,95,127,6,28665,4,11,6,9,7381,41,31,97,114,8701,3,1,6,1,1,1,290,15,0,29,2,2,0,14,3,8,395,8196,86,9,22,7309,0,202,0,190,0,2,9,101,2,13,43,4,8,7,1,14,5,154,32,12,8,1,69,1,21,12,42,4,4,12,16,3,0,3,70,1,0,1,186,2,62,13,3,1,23,18,0,26,1,13,0,86,84,48,69,6,0,3,2,2,3,3,3,11,1,7,8,227,11,4,0,283,46,1,9,1,184,112,12,3,10,3,56,1,0,4,15,2,11,4,9,1287,42719,32,4381,2,5773,2,7472,15,621,2466,541,1506,4938,5,8489]),Nt=Ft(jt),Pt=Ft(Mt);function Ft(e){let t=new Uint32Array(e.length),n=-1;for(let r=0;r<t.length;r+=2)t[r]=n+1+e[r],n=t[r]+e[r+1],t[r+1]=n;return t}function It(e){return Rt(Nt,e)}function Lt(e){return Rt(Pt,e)}function Rt(e,t){let n=0,r=e.length/2;for(;n<r;){let i=n+r>>>1,a=i*2;if(t<e[a])r=i;else if(t>e[a+1])n=i+1;else return!0}return!1}var zt=class{#e=0;#t=0;#n=0;#r=!0;#i=!1;#a=!1;#o=!1;#s=!1;reset(){this.#e=this.#n=0,this.#t=0,this.#r=!0,this.#i=this.#a=this.#o=this.#s=!1}push(e){return this.#n===0&&(this.#e=e),this.#n=Math.min(3,this.#n+1),this.#t||=Vt(e),e===8205&&(this.#i=!0),e===65039&&(this.#a=!0),Ht(e)&&(this.#o=!0),(e<127462||e>127487)&&(this.#r=!1),e===8419&&(this.#e>=48&&this.#e<=57||this.#e===35||this.#e===42)&&(this.#s=!0),this.#i&&this.#o||this.#s||this.#r&&this.#n===2||this.#a&&this.#o?2:this.#t}};function Bt(e){if(!e)return 0;let t=e.codePointAt(0);if(e.length===(t>65535?2:1))return Vt(t);let n=new zt,r=0;for(let t of e)r=n.push(t.codePointAt(0));return r}function Vt(e){return e<128?+(e>=32&&e<127):It(e)||e>=127995&&e<=127999?0:Lt(e)||e>=127462&&e<=127487?2:1}function Ht(e){return 9728<=e&&e<=10175||126976<=e&&e<=129791}var Ut=[],Wt=`\\x1b`,Gt=`\\x07`,Kt=RegExp(`${Wt}\\[[0-?]*[ -/]*[@-~]`,`g`),qt=RegExp(`${Wt}\\][^${Gt}${Wt}]*(?:${Gt}|${Wt}\\\\)`,`g`);function Jt(e){return e?e.includes(`\x1B`)?Xt(e):Yt(e)||Array.from(At.iterate(e),e=>e.segment):Ut}function Yt(e){let t=Array(e.length);for(let n=0;n<e.length;n+=1){let r=e.charCodeAt(n);if(r>=128||r===13)return;t[n]=e[n]??``}return t}function Xt(e){let t=Zt(e);if(t)return t;if(rn(e))return sn(e);let n=[],r=``,i=``,a=``,o=``;for(let t=0;t<e.length;){if(e.charCodeAt(t)===27){let n=pe(e,t);if(n){n.endsWith(`m`)&&(r=ge(r,n)),t+=n.length;continue}}let s=e[t];r===i&&s===a?n.push(o):(i=r,a=s,o=r?`${r}${s}\x1b[0m`:s,n.push(o)),t+=s.length}return n}function Zt(e){if(e.charCodeAt(0)!==27)return;let t=``,n=0;for(let r=0;r<e.length;){let i=pe(e,r);if(!i||!i.endsWith(`m`))break;t=ge(t,i),r+=i.length,n=r}if(n<=0||n>=e.length)return;let r=e.length;for(;r>n;){let t=ln(e,r);if(t===void 0||t<n)break;let i=e.slice(t,r);if(!i.endsWith(`m`)||!_e(i))break;r=t}if(r<=n)return;for(let t=n;t<r;t+=1){let n=e.charCodeAt(t);if(n<32||n===127||n>=128)return}let i=r-n,a=Array(i);if(!t){for(let t=0;t<i;t+=1)a[t]=e[n+t]??``;return a}let o=``,s=``;for(let r=0;r<i;r+=1){let i=e[n+r]??``;if(i===o){a[r]=s;continue}o=i,s=`${t}${i}\x1b[0m`,a[r]=s}return a}function Qt(e){return e.replace(Kt,``).replace(qt,``)}function $t(e,t=0){if(!e)return 0;let n=en(e,t);if(n!==void 0)return n;let r=tn(e,t);if(r!==void 0)return r;let i=0;for(let{char:n}of an(e,Math.max(0,Math.floor(t)))){if(n.includes(`
`))break;i+=dn(n)}return i}function en(e,t=0){let n=Math.max(0,Math.floor(t));for(let t=n;t<e.length;t+=1){let r=e.charCodeAt(t);if(r===10)return t-n;if(r<32||r===127||r>=128)return}return Math.max(0,e.length-n)}function tn(e,t=0){let n=0;for(let r=Math.max(0,Math.floor(t));r<e.length;){let t=e.charCodeAt(r);if(t===10)return n;if(t===27){let t=cn(e,r);if(!t)return;r+=t.length;continue}if(nn(t)){n+=1,r+=1;continue}return}return n}function nn(e){return e>=32&&e<127||e===9608||e===9607}function rn(e){for(let t=0;t<e.length;t++)if(e.charCodeAt(t)>=128||e.charCodeAt(t)===13)return!0;return!1}function*an(e,t=0){let n=[],r=``;for(let i=t;i<e.length;){let t=cn(e,i);if(t){i+=t.length;continue}let a=i;for(i++;i<e.length&&e.charCodeAt(i)!==27;)i++;let o=e.slice(a,i),s=r.length;r+=o,n.push({start:s,end:r.length,rawStart:a})}let i=0,a=0,o=t;for(let t of At.iterate(r)){for(;t.start>=n[i].end;)i++;for(;t.end>n[a].end;)a++;let r=n[i],s=n[a],c=r.rawStart+t.start-r.start,l=s.rawStart+t.end-s.start;yield{char:t.segment,prefix:e.slice(o,c),raw:e.slice(c,l),rawEnd:l},o=l}}function on(e,t){for(let n=t.indexOf(`\x1B`);n!==-1;n=t.indexOf(`\x1B`,n+1)){let r=pe(t,n);r?.endsWith(`m`)&&(e=ge(e,r))}return e}function sn(e){let t=[],n=``;for(let{char:r,prefix:i,raw:a}of an(e))n=on(n,i),t.push(n?`${n}${r}\x1b[0m`:r),n=on(n,a);return t}function cn(e,t){return pe(e,t)??un(e,t)}function ln(e,t){let n=e.lastIndexOf(`\x1B[`,t-1);if(n<0)return;let r=pe(e,n);return r&&n+r.length===t?n:void 0}function un(e,t){if(!e.startsWith(`\x1B]`,t))return;let n=t+2,r=e.indexOf(`\x07`,n),i=e.indexOf(`\x1B\\`,n),a=r>=0&&i>=0?Math.min(r,i):r>=0?r:i;if(!(a<0))return e.slice(t,a+(a===i?2:1))}function dn(e){return Bt(e.includes(`\x1B`)?Qt(e):e)}var fn=class e{#e=new Map;#t=0;static fromRectangles(t){let n=new e;return n.resetFromRectangles(t),n}resetFromRectangles(e){this.clearRetainingRows();for(let t of e)this.addRectangleUnmerged(t);this.mergeRows()}addRectangleUnmerged(e){let t=Math.floor(e.row),n=t+Math.max(0,Math.floor(e.height)),r=Math.floor(e.column),i=r+Math.max(0,Math.floor(e.width));if(!(n<=t||i<=r))for(let e=t;e<n;e+=1){let t=this.#e.get(e),n={row:e,startColumn:r,endColumn:i};t?t.push(n):this.#e.set(e,[n])}}addRectangle(e){let t=Math.floor(e.row),n=t+Math.max(0,Math.floor(e.height)),r=Math.floor(e.column),i=r+Math.max(0,Math.floor(e.width));for(let e=t;e<n;e+=1)this.addSegment(e,r,i)}addSegment(e,t,n){let r=Math.floor(e),i=Math.floor(Math.min(t,n)),a=Math.floor(Math.max(t,n));if(a<=i)return;let o=this.#e.get(r);if(o){let e=o.length;o.push({row:r,startColumn:i,endColumn:a}),pn(o),this.#t+=o.length-e}else this.#e.set(r,[{row:r,startColumn:i,endColumn:a}]),this.#t+=1}clear(){this.#e.clear(),this.#t=0}isEmpty(){return this.#t===0}inspect(){let e=[];for(let t of this.#e.keys())e.push(t);e.sort((e,t)=>e-t);let t=[];for(let n of e){let e=this.#e.get(n);if(e)for(let n of e)t.push({...n})}return t}forEachSegment(e){for(let t of this.#e.values())for(let n of t)e(n)}intersects(e){let t=Math.floor(e.row),n=t+Math.max(0,Math.floor(e.height)),r=Math.floor(e.column),i=r+Math.max(0,Math.floor(e.width));if(n<=t||i<=r)return!1;for(let e=t;e<n;e+=1)for(let t of this.#e.get(e)??[])if(Math.min(i,t.endColumn)>Math.max(r,t.startColumn))return!0;return!1}intersections(e){let t=[];return this.forEachIntersection(e,e=>{t.push({...e})}),t}forEachIntersection(e,t){this.forEachIntersectionValue(e,(e,n,r)=>{t({row:e,startColumn:n,endColumn:r})})}forEachIntersectionValue(e,t){let n=Math.floor(e.row),r=n+Math.max(0,Math.floor(e.height)),i=Math.floor(e.column),a=i+Math.max(0,Math.floor(e.width));if(!(r<=n||a<=i))for(let e=n;e<r;e+=1)for(let n of this.#e.get(e)??[]){let r=Math.max(i,n.startColumn),o=Math.min(a,n.endColumn);o>r&&t(e,r,o)}}mergeRows(){let e=0;for(let t of this.#e.values())pn(t),e+=t.length;this.#t=e}clearRetainingRows(){for(let e of this.#e.values())e.length=0;this.#t=0}};function pn(e){if(e.length<2)return;e.sort((e,t)=>e.startColumn-t.startColumn||e.endColumn-t.endColumn);let t=0;for(let n=1;n<e.length;n+=1){let r=e[t],i=e[n];if(i.startColumn<=r.endColumn){r.endColumn=Math.max(r.endColumn,i.endColumn);continue}t+=1,e[t]=i}e.length=t+1}var mn=class extends ue{text;valueChars;overwriteRectangle;multiCodePointSupport;rerenderRanges;#e;#t;constructor(e){super(`text`,e),this.text=O(e.value),this.rectangle=O(e.rectangle),this.overwriteRectangle=O(e.overwriteRectangle??!1),this.multiCodePointSupport=O(e.multiCodePointSupport??!1),this.valueChars=this.multiCodePointSupport.value?hn(this.text.value):this.text.value,this.rerenderRanges=[];let{updateObjects:t}=this.canvas,n=(e,t,n,r)=>{if(!r){let n=t.width;if(t.width=$t(e),t.width!==n){this.moved=!0;for(let e of this.objectsUnder)e.moved=!0}}t.height=1;let{valueChars:i}=this,a=this.valueChars=n?hn(e):e,{row:o,column:s,width:c}=t,l=r?c<i.length?c:-1:a.length<i.length?a.length:-1,u=Math.max(a.length,i.length);if(r&&c!==void 0&&a.length>=c){gn(this,i,a,o,s,c);return}if(l!==-1)for(let e=0;e<u;++e)if(e>=l)for(let t of this.objectsUnder)t.queueRerender(o,s+e);else a[e]!==i[e]&&this.queueRerender(o,s+e);else for(let e=0;e<u;++e)a[e]!==i[e]&&this.queueRerender(o,s+e)};this.#e=e=>{let r=this.text.peek(),i=this.multiCodePointSupport.peek(),a=this.overwriteRectangle.peek();this.moved=!0,this.updated=!1,t.push(this);for(let e of this.objectsUnder)e.moved=!0,e.updated=!1,t.push(e);n(r,e,i,a)},this.#t=new ne(()=>{let e=this.text.value,r=this.rectangle.peek(),i=this.overwriteRectangle.value,a=this.multiCodePointSupport.value;this.updated=!1,t.push(this);for(let e of this.objectsUnder)e.updated=!1,t.push(e);n(e,r,a,i)})}draw(){this.#t.resume(),this.rectangle.subscribe(this.#e),super.draw()}erase(){this.#t.pause(),this.rectangle.unsubscribe(this.#e),super.erase()}queueRerender(e,t){this.queueRerenderRange(e,t,t+1)}queueRerenderRange(e,t,n){let r=this.view.peek()?.rectangle?.peek();if(e<0)return;let{columns:i,rows:a}=this.canvas.size.peek();if(e>=a)return;let o=Math.max(0,Math.floor(t)),s=Math.min(i,Math.ceil(n));if(r){if(e<r.row||e>=r.row+r.height)return;o=Math.max(o,r.column),s=Math.min(s,r.column+r.width)}if(s<=o)return;let c=Math.floor(e);(this.rerenderRanges[c]??=[]).push({row:c,startColumn:o,endColumn:s})}updateMovement(){let{objectsUnder:e,previousRectangle:t}=this,n=this.rectangle.peek();if(!t||ie(n,t))return;let r=D(n,t,!0),i=t.row,a=t.column+t.width;for(let n=t.column;n<a;++n)if(!(r&&re(n,i,r)))for(let t of e)t.queueRerender(i,n);let o=n.column!==t.column||n.row!==t.row,{row:s}=n,c=n.column+n.width;for(let t=n.column;t<c;++t)if(o&&this.queueRerender(s,t),!(r&&re(t,s,r)))for(let n of e)n.queueRerender(s,t)}rerender(){let{canvas:e,valueChars:t,omitCells:n,rerenderCells:r,rerenderRanges:i}=this,{frameBuffer:a,rerenderQueue:o}=e,{columns:s,rows:c}=e.size.peek(),l=this.rectangle.peek(),u=this.style.peek(),{row:d}=l,f=this.overwriteRectangle.peek()?l.width??t.length:t.length,p=Math.min(d,c),m=Math.min(l.column+f,s),h=this.view.peek()?.rectangle?.peek();if(h&&(p=Math.min(d,h.row+h.height),m=Math.min(m,h.column+h.width)),d>p)return;let g=r[d],_=i[d];if(!g?.size&&!_?.length)return;let v=n[d];if(v?.size===t.length){g?.clear(),_&&(_.length=0);return}let y=a[d]??=[],b=Math.max(0,l.column,h?.column??0),x=e=>{let n=e-l.column,r=t[n]??` `;return(r===``&&(e===b||v?.has(e-1))||t[n+1]===``&&(e+1>=m||v?.has(e+1)))&&(r=` `),u(r)};if(_?.length){pn(_);let t=v?.size?void 0:e.rerenderRanges[d]??=[],n;for(let e of _){let r=Math.max(e.startColumn,l.column),i=Math.min(e.endColumn,m);if(!(i<=r)){for(let e=r;e<i;e+=1)v?.has(e)||(y[e]=x(e),t||(n??=o[d]??=new Set,n.add(e)));t&&t.push({row:d,startColumn:r,endColumn:i})}}_.length=0}if(g?.size){let e=o[d]??=new Set;for(let t of g)t>=m||t<l.column||v?.has(t)||(y[t]=x(t),e.add(t));g.clear()}}};function hn(e){let t=Jt(e);return $t(e)===t.length?t:t.flatMap(e=>{let t=$t(e);return t===2?[e,``]:t?[e]:[]})}function gn(e,t,n,r,i,a){let o=-1;for(let s=0;s<a;s+=1){if((n[s]??` `)===(t[s]??` `)){o!==-1&&(e.queueRerenderRange(r,i+o,i+s),o=-1);continue}o===-1&&(o=s)}o!==-1&&e.queueRerenderRange(r,i+o,i+a)}var _n=globalThis,vn=`./bun_host.ts`;_n.__exotuiRuntimeHost??(_n.Deno&&!_n.Bun?new Proxy(_n.Deno,{get(e,t){return t===`runtime`?`deno`:Reflect.get(e,t)},set(e,t,n){return Reflect.set(e,t,n)}}):_n.Bun&&(await e(async()=>{let{createBunHost:e}=await import(vn);return{createBunHost:e}},[],import.meta.url)).createBunHost());function yn(e){return e instanceof Error?e.message:String(e)}function bn(e){return e===` `||e===`
`||e===`	`||e===`\r`||e===`\f`}var xn=class{values=new Map;get(e){return Promise.resolve(this.values.get(e))}set(e,t){return this.values.set(e,t),Promise.resolve()}delete(e){return this.values.delete(e),Promise.resolve()}},Sn=class{storeName;databasePromise;diagnostics;constructor(e){this.storeName=e.storeName??`values`,this.diagnostics=e.diagnostics,this.databasePromise=Cn(e.databaseName,this.storeName,e.version??1,e.scope).catch(t=>{throw this.diagnostics?.report({source:`storage`,code:`indexeddb-open-failed`,severity:`warning`,message:`IndexedDB open failed.`,detail:yn(t),context:{databaseName:e.databaseName,storeName:this.storeName,version:e.version??1}}),t})}async get(e){return await wn((await this.databasePromise).transaction(this.storeName,`readonly`).objectStore(this.storeName).get(e),this.diagnostics,`get`,this.storeName,e)}async set(e,t){await wn((await this.databasePromise).transaction(this.storeName,`readwrite`).objectStore(this.storeName).put(t,e),this.diagnostics,`set`,this.storeName,e)}async delete(e){await wn((await this.databasePromise).transaction(this.storeName,`readwrite`).objectStore(this.storeName).delete(e),this.diagnostics,`delete`,this.storeName,e)}};function Cn(e,t,n,r=globalThis){return`indexedDB`in r?new Promise((i,a)=>{let o=r.indexedDB.open(e,n);o.onerror=()=>a(o.error??Error(`Failed to open IndexedDB database.`)),o.onsuccess=()=>i(o.result),o.onupgradeneeded=()=>{o.result.objectStoreNames.contains(t)||o.result.createObjectStore(t)}}):Promise.reject(Error(`IndexedDB is not available in this runtime.`))}function wn(e,t,n,r,i){return new Promise((a,o)=>{e.onerror=()=>{let a=e.error??Error(`IndexedDB request failed.`);t?.report({source:`storage`,code:`indexeddb-request-failed`,severity:`warning`,message:`IndexedDB request failed.`,detail:yn(a),context:{operation:n,storeName:r,key:i}}),o(a)},e.onsuccess=()=>a(e.result)})}var Tn=class{listeners={};on(e,t,n){let r=this.listeners[e];if(r||(r=[],this.listeners[e]=r),n){let n=t;t=(...r)=>{n.apply(this,r),this.off(e,t)}}return r.includes(t)||r.splice(r.length,0,t),()=>this.off(e,t)}once(e,t){return this.on(e,t,!0)}off(e,t){if(!e){this.listeners={};return}if(!t){this.listeners[e]=[];return}let n=this.listeners[e];if(!n)return;let r=n.indexOf(t);r<0||n.splice(r,1)}emit(e,...t){let n=this.listeners[e];if(n?.length)for(let e of n)e.apply(this,t)}listenerCount(e){if(e!==void 0)return this.listeners[e]?.length??0;let t=0;for(let e in this.listeners)t+=this.listeners[e]?.length??0;return t}eventNames(){let e=[];for(let t in this.listeners)(this.listeners[t]?.length??0)>0&&e.push(t);return e}inspect(){let e=[],t=0;for(let n in this.listeners){let r=this.listeners[n]?.length??0;r<=0||(t+=r,e.push({type:n,listenerCount:r}))}return e.sort((e,t)=>e.type.localeCompare(t.type)),{eventCount:e.length,listenerCount:t,events:e}}},En=class extends Array{compareFn;constructor(e,...t){super(...t),this.compareFn=e}push(...e){return super.push(...e),this.sort(this.compareFn),this.length}remove(...e){for(let t of e){let e=this.indexOf(t);e>=0&&this.splice(e,1)}return this.length}},Dn=class e{#e=new Map;#t=new Set;#n=new Set;#r=0;#i=0;static fromObjects(t){return new e().resetFromObjects(t)}resetFromObjects(e){this.clearRetainingRows();for(let t of e)this.add(t);return this}add(e){if(e.outOfBounds)return;let t=e.rectangle.peek(),n=Math.floor(t.row),r=n+Math.max(0,Math.floor(t.height)),i=Math.floor(t.column),a=i+Math.max(0,Math.floor(t.width));if(!(r<=n||a<=i)){this.#t.add(e);for(let t=n;t<r;t+=1){let n=this.#e.get(t);n?(n.length===0&&(this.#i+=1),n.push(e)):(this.#e.set(t,[e]),this.#i+=1),this.#r+=1}}}query(e){return this.queryInto([],e)}queryInto(e,t){e.length=0;let n=Math.floor(t.row),r=n+Math.max(0,Math.floor(t.height)),i=Math.floor(t.column),a=i+Math.max(0,Math.floor(t.width));if(r<=n||a<=i)return e;let o=this.#n;o.clear();for(let e=n;e<r;e+=1)for(let t of this.#e.get(e)??[]){let e=t.rectangle.peek(),n=Math.floor(e.column);n+Math.max(0,Math.floor(e.width))<=i||n>=a||o.add(t)}for(let t of o)e.push(t);return o.clear(),e}queryDirtyRegion(e){return this.queryDirtyRegionInto([],e)}queryDirtyRegionInto(e,t){if(e.length=0,t.isEmpty())return e;let n=this.#n;n.clear(),t.forEachSegment(e=>{let t=e.startColumn,r=e.endColumn;for(let i of this.#e.get(e.row)??[]){let e=i.rectangle.peek(),a=Math.floor(e.column);a+Math.max(0,Math.floor(e.width))<=t||a>=r||n.add(i)}});for(let t of n)e.push(t);return n.clear(),e}inspect(){return{objects:this.#t.size,rows:this.#i,rowEntries:this.#r}}clear(){this.#e.clear(),this.#t.clear(),this.#n.clear(),this.#r=0,this.#i=0}clearRetainingRows(){for(let e of this.#e.values())e.length=0;this.#t.clear(),this.#n.clear(),this.#r=0,this.#i=0}};function On(e,t){return`\x1b[${e+1};${t+1}H`}var kn=`\x1B[2J`,An=`\x1B[?2026h`,jn=`\x1B[?2026l`,Mn=new TextEncoder,Nn=new TextDecoder,Pn=32768,Fn=8192,In=new Map,Ln={foreground:!1,background:!1,other:!1},Rn=new Map,zn=new Map,Bn=[0,95,135,175,215,255];function Vn(){return{frames:0,bytes:0,writes:0,wouldBlocks:0,shortWrites:0,stallMs:0,maxStallMs:0,degradedFlushes:0,droppedBytes:0}}var Hn=40,Un=2;function Wn(e){return e instanceof Error?e.name===`WouldBlock`||e.code===`EAGAIN`:!1}var Gn=class{requiresCellUpdates=!1;#e;#t;#n;#r;#i;#a=!1;#o=Vn();constructor(e){this.#e=e.stdout,this.#t=e.flushLimit??cr(),this.#n=e.synchronizedOutput??!1,this.#r=e.colorDepth??`truecolor`,this.#i=e.repeatCompression??!1}configure(e){e.colorDepth!==void 0&&(this.#r=e.colorDepth),e.repeatCompression!==void 0&&(this.#i=e.repeatCompression)}inspectEncoding(){return{colorDepth:this.#r,repeatCompression:this.#i}}takeFlushDegraded(){let e=this.#a;return this.#a=!1,e}takeFlushTelemetry(){let e=this.#o;return this.#o=Vn(),e}#s(e){if(e.length===0)return;let t=Mn.encode(e),n=this.#o;n.bytes+=t.length;let r=0,i,a=e=>{if(i===void 0)return;let t=e-i;n.stallMs+=t,t>n.maxStallMs&&(n.maxStallMs=t),i=void 0};for(;r<t.length;){let e=t.length-r,o=0;n.writes+=1;try{o=this.#e.writeSync(r===0?t:t.subarray(r))}catch(e){if(!Wn(e))throw e;n.wouldBlocks+=1}if(o>0){o<e&&(n.shortWrites+=1),r+=o,i!==void 0&&a(performance.now());continue}let s=performance.now();if(i??=s,s-i>Hn){a(s),n.degradedFlushes+=1,n.droppedBytes+=t.length-r,this.#a=!0;return}let c=s+Un;for(;performance.now()<c;);}}resize(e,t){this.#s(`${On(0,0)}${kn}`)}flush(e,t){if(this.#o.frames+=1,e.length===0)return;let n={quantize256:this.#r===`256`,repeatCompression:this.#i},r=this.#n?An:``;for(let t=0;t<e.length;){let i=Kn(e,t,n),a=On(i.row,i.column);if(r.length>0&&r.length+a.length+i.text.length>this.#t&&(this.#s(r),r=``,this.#a))break;r+=a+i.text,t+=i.cells}this.#n&&(r+=jn),this.#s(r)}flushRanges(e,t){if(this.#o.frames+=1,e.length===0)return;let n={quantize256:this.#r===`256`,repeatCompression:this.#i},r={activePrefix:``,activeState:Ln,needsReset:!1},i=this.#n?An:``;for(let t of e){let e=On(t.row,t.startColumn),a=Jn(t,r,n);if(i.length>0&&i.length+e.length+a.length>this.#t&&(this.#s(i),i=``,this.#a))break;i+=e+a}this.#a||(r.needsReset&&(i+=`\x1B[0m`),this.#n&&(i+=jn),this.#s(i))}};function Kn(e,t,n){let r=e[t],i=rr(r.value),a=n.quantize256?$n(i.prefix):i.prefix,o=i.text,s=t+1,c=r.column;for(;er(i.text)&&s<e.length;){let t=e[s];if(t.row!==r.row||t.column!==c+1)break;let l=rr(t.value);if(!er(l.text)||(n.quantize256?$n(l.prefix):l.prefix)!==a||l.suffix!==i.suffix||l.hyperlink!==i.hyperlink)break;o+=l.text,c=t.column,s+=1}let l=n.repeatCompression&&er(o)?Xn(o):o,u=i.hyperlink?`\x1b]8;;${i.hyperlink}\x1b\\`:``,d=i.hyperlink?`\x1B]8;;\x1B\\`:``;return{row:r.row,column:r.column,text:`${u}${a}${l}${i.suffix}${d}`,cells:s-t}}function qn(e,t,n){let r=e[t],i=rr(r),a=n.quantize256?$n(i.prefix):i.prefix;if(!er(i.text))return{text:i.text,cells:1,first:i,prefix:a};let o=1;for(;t+o<e.length&&e[t+o]===r;)o+=1;if(o>1&&!n.quantize256){let e=i.text.repeat(o);return{text:n.repeatCompression?Xn(e):e,cells:o,first:i,prefix:a}}let s=o>1?i.text.repeat(o):i.text,c=t+o;for(;c<e.length;){let t=rr(e[c]);if(!er(t.text)||(n.quantize256?$n(t.prefix):t.prefix)!==a||t.suffix!==i.suffix||t.hyperlink!==i.hyperlink)break;s+=t.text,c+=1}return{text:n.repeatCompression?Xn(s):s,cells:c-t,first:i,prefix:a}}function Jn(e,t,n){let{values:r}=e,i=``,a=``,o=!1;for(let s=0;s<r.length;){let c=qn(r,s,n),{first:l,prefix:u}=c;if(!l.text){o=!0,s+=c.cells;continue}let d=!er(l.text);if((d||o)&&(i+=On(e.row,e.startColumn+s)),o=d,l.hyperlink!==a&&(i+=`\x1b]8;;${l.hyperlink}\x1b\\`,a=l.hyperlink),u!==t.activePrefix){let e=tr(u);t.needsReset&&!nr(t.activeState,e)?(i+=`\x1B[0m`,t.needsReset=!1,i+=u):i+=Yn(t.activeState,e,u),t.activePrefix=u,t.activeState=e}i+=c.text,l.text.includes(`\x1B`)?(t.activePrefix=``,t.activeState=Ln,t.needsReset=!0):(u||l.suffix)&&(t.needsReset=!0),s+=c.cells}return a&&(i+=`\x1B]8;;\x1B\\`),i}function Yn(e,t,n){if(e.other||t.other||!t.foreground&&!t.background)return n;let r=t.foreground&&t.fgParam!==e.fgParam,i=t.background&&t.bgParam!==e.bgParam;return!r&&!i?``:r&&i?`\x1b[${t.fgParam};${t.bgParam}m`:r?`\x1b[${t.fgParam}m`:`\x1b[${t.bgParam}m`}function Xn(e){if(e.length<7)return e;let t=``,n=0;for(;n<e.length;){let r=e[n],i=n+1;for(;i<e.length&&e[i]===r;)i+=1;let a=i-n;a>=7?t+=`${r}\x1b[${a-1}b`:t+=e.slice(n,i),n=i}return t}function Zn(e,t,n){let r=Math.max(0,Math.min(255,Math.round(e))),i=Math.max(0,Math.min(255,Math.round(t))),a=Math.max(0,Math.min(255,Math.round(n))),o=Qn(r),s=Qn(i),c=Qn(a),l=Bn[o],u=Bn[s],d=Bn[c],f=(r-l)**2+(i-u)**2+(a-d)**2,p=16+36*o+6*s+c,m=(r+i+a)/3,h=Math.max(0,Math.min(23,Math.round((m-8)/10))),g=8+h*10;return(r-g)**2+(i-g)**2+(a-g)**2<f?232+h:p}function Qn(e){return e<48?0:e<115?1:Math.min(5,Math.floor((e-35)/40))}function $n(e){if(!e||!e.includes(`;2;`)&&!e.includes(`:2:`))return e;let t=zn.get(e);if(t!==void 0)return t;let n=``;for(let t=0;t<e.length;){let r=pe(e,t);if(!r){n+=e[t],t+=1;continue}if(!r.endsWith(`m`)||!/^[\d;:]*$/.test(r.slice(2,-1))){n+=r,t+=r.length;continue}let i=k(r.slice(2,-1)),a=[];for(let e=0;e<i.length;){let t=Number(i[e].split(`:`)[0]);if(t===38||t===48||t===58){let n=he(i,e);if(n.rgb){let[r,i,o]=n.rgb;a.push(`${t};5;${Zn(r,i,o)}`),e+=n.consumed;continue}for(let t=0;t<n.consumed;t+=1)a.push(i[e+t]);e+=n.consumed}else a.push(i[e]),e+=1}n+=`\x1b[${a.join(`;`)}m`,t+=r.length}return zn.size>Fn&&zn.clear(),zn.set(e,n),n}function er(e){if(!e)return!1;for(let t=0;t<e.length;t++){let n=e.charCodeAt(t);if(n<32||n>126)return!1}return!0}function tr(e){if(!e)return Ln;let t=Rn.get(e);if(t)return t;let n={foreground:!1,background:!1,other:!1};for(let t=0;t<e.length;){let r=pe(e,t);if(!r?.endsWith(`m`)||!/^[\d;:]*$/.test(r.slice(2,-1))){n.other=!0;break}let i=k(r.slice(2,-1));for(let e=0;e<i.length;){let t=Number(i[e].split(`:`)[0]);if(t===38||t===48){let r=he(i,e);if(r.rgb||r.palette!==void 0){let a=i.slice(e,e+r.consumed).join(`;`);t===38?(n.foreground=!0,n.fgParam=a):(n.background=!0,n.bgParam=a)}else n.other=!0;e+=r.consumed}else n.other=!0,e++}t+=r.length}return Rn.size>Fn&&Rn.clear(),Rn.set(e,n),n}function nr(e,t){return!(e.other||e.foreground&&!t.foreground||e.background&&!t.background)}function rr(e){let t=typeof e==`string`?e:Nn.decode(e);if(!t.includes(`\x1B`))return{prefix:``,text:t,suffix:``,hyperlink:``};let n=In.get(t);if(n)return n;let r=0,i=``,a=``;for(;r<t.length;){let e=pe(t,r);if(e){i+=e,r+=e.length;continue}let n=me(t,r);if(n){a=n.uri,r+=n.length;continue}break}let o=t.indexOf(`\x1B`,r),s=t.slice(r,o<0?t.length:o);if(!s||s.charCodeAt(0)===27)return{prefix:``,text:t,suffix:``,hyperlink:``};let c=ir(t.slice(r+s.length));if(c===void 0)return{prefix:``,text:t,suffix:``,hyperlink:``};let l={prefix:i,text:s,suffix:c,hyperlink:a};return In.size>Pn&&In.clear(),In.set(t,l),l}function ir(e){if(!e)return``;let t=``,n=0;for(;n<e.length;){let r=pe(e,n);if(r){t+=r,n+=r.length;continue}let i=me(e,n);if(i&&i.uri===``){n+=i.length;continue}return}return t}function ar(e,t=[]){let n,r=0;for(let i of e){if(!n||i.row!==n.row||i.column!==n.nextColumn){n&&(t[r]=sr(t[r],n.row,n.startColumn,n.values),r+=1);let e=or(t[r]);e.length=0,n={row:i.row,startColumn:i.column,nextColumn:i.column,values:e}}n.values.push(i.value),n.nextColumn=i.column+1}return n&&(t[r]=sr(t[r],n.row,n.startColumn,n.values),r+=1),t.length=r,t}function or(e){return Array.isArray(e?.values)&&!Object.isFrozen(e.values)?e.values:[]}function sr(e,t,n,r){return e?(e.row=t,e.startColumn=n,e.values=r,e):{row:t,startColumn:n,values:r}}function cr(){let e=globalThis;return e.Deno?.build?.os===`windows`||e.process?.platform===`win32`?1024:16384}var lr=class extends Tn{stdout;sink;size;rerenderedObjects;frameBuffer;rerenderQueue;rerenderRanges;drawnObjects;updateObjects;resizeNeeded;lastRenderStats;lastFlushDegraded=!1;drawnOrderVersion;cellUpdatesBuffer;rowRangesBuffer;directRowRangesBuffer;objectsToUpdateBuffer;seenObjectsBuffer;dirtyRowsSeenBuffer;dirtyRectanglesBuffer;movedOwnObjectsBuffer;nonMovingUpdatedObjectsBuffer;affectedObjectsBuffer;requiredObjectsBuffer;dirtyCandidatesBuffer;intersectionCandidatesBuffer;dirtyRegionBuffer;spatialIndexBuffer;constructor(e){if(super(),this.frameBuffer=[],this.rerenderQueue=[],this.rerenderRanges=[],this.stdout=e.stdout,e.sink)this.sink=e.sink;else if(e.stdout)this.sink=new Gn({stdout:e.stdout});else throw Error(`Canvas requires either stdout or sink.`);this.drawnObjects=new En((e,t)=>e.zIndex.peek()-t.zIndex.peek()||e.id-t.id),this.updateObjects=[],this.resizeNeeded=!1,this.lastRenderStats=ur(),this.drawnOrderVersion=0,this.cellUpdatesBuffer=[],this.rowRangesBuffer=[],this.directRowRangesBuffer=[],this.objectsToUpdateBuffer=[],this.seenObjectsBuffer=new Set,this.dirtyRowsSeenBuffer=new Set,this.dirtyRectanglesBuffer=[],this.movedOwnObjectsBuffer=new Set,this.nonMovingUpdatedObjectsBuffer=[],this.affectedObjectsBuffer=[],this.requiredObjectsBuffer=new Set,this.dirtyCandidatesBuffer=[],this.intersectionCandidatesBuffer=[],this.dirtyRegionBuffer=new fn,this.spatialIndexBuffer=new Dn,this.size=O(e.size,{deepObserve:!0}),this.size.subscribe(()=>{this.resizeNeeded=!0;let{columns:e,rows:t}=this.size.peek();this.sink.resize?.(e,t)});let{columns:t,rows:n}=this.size.peek();this.sink.resize?.(t,n)}resortDrawnObjects(){this.drawnObjects.sort(this.drawnObjects.compareFn),this.drawnOrderVersion+=1}resize(){this.rerenderAll()}rerenderAll(){let{columns:e,rows:t}=this.size.peek();this.clearRetainedResizeState();for(let n of this.drawnObjects){let{column:r,row:i}=n.rectangle.peek();r>=e||i>=t||(n.rendered=!1,n.updated=!1,this.updateObjects.push(n))}}clearRetainedResizeState(){this.frameBuffer.length=0,this.rerenderQueue.length=0,this.rerenderRanges.length=0,this.cellUpdatesBuffer.length=0,this.rowRangesBuffer.length=0,this.directRowRangesBuffer.length=0,this.dirtyRowsSeenBuffer.clear(),this.dirtyRegionBuffer.clear();for(let e of this.drawnObjects){for(let t of e.rerenderCells)t?.clear();e.rerenderCells.length=0;let t=e;if(t.rerenderRanges){for(let e of t.rerenderRanges)e&&(e.length=0);t.rerenderRanges.length=0}}}updateIntersections(e,t){let{omitCells:n,objectsUnder:r}=e,i=0,a=e.zIndex.peek(),o=e.rectangle.peek();for(let e of n)e?.clear();r.clear();for(let s of t??this.drawnObjects){if(e===s||s.outOfBounds)continue;i+=1;let t=s.zIndex.peek();if(t<a||t===a&&s.id<e.id){D(o,s.rectangle.peek(),!1)&&r.add(s);continue}let c=D(o,s.rectangle.peek(),!0);if(!c)continue;let l=c.row+c.height,u=c.column+c.width;for(let e=c.row;e<l;++e){let t=n[e]??=new Set;for(let e=c.column;e<u;++e)t.add(e)}}return i}inspectRender(){return{...this.lastRenderStats}}render(){let{frameBuffer:e,updateObjects:t}=this;if(this.resizeNeeded&&=(this.resize(),!1),!t.length){this.lastRenderStats=ur();return}let n=this.objectsToUpdateBuffer,r=this.seenObjectsBuffer;for(n.length=0,r.clear();t.length;){let e=t.pop();r.has(e)||(r.add(e),n.push(e))}n.sort((e,t)=>t.zIndex.peek()-e.zIndex.peek()||t.id-e.id);let i=0,a=!1,o=this.dirtyRectanglesBuffer,s=this.movedOwnObjectsBuffer,c=this.nonMovingUpdatedObjectsBuffer;o.length=0,s.clear(),c.length=0;for(let e of n){e.updated=!0,++i,e.update();let t=e.previousRectangle?dr(e.previousRectangle):void 0;if(e.updateMovement(),e.moved){a=!0;let n=e.rectangle.peek(),r=!t||!ie(n,t),i=this.drawnObjects.includes(e);r||!i?(o.push(dr(n)),t&&o.push(t),s.add(e)):c.push(e)}else c.push(e);e.updatePreviousRectangle(),e.updateOutOfBounds(),e.outOfBounds&&(e.rendered=!1)}let l=this.dirtyRegionBuffer;l.resetFromRectangles(o);let u=a?this.spatialIndexBuffer.resetFromObjects(this.drawnObjects):void 0,d=a?fr(this.drawnObjects,l,c,s,u,this.affectedObjectsBuffer,this.requiredObjectsBuffer,this.dirtyCandidatesBuffer):n,f=0;if(a){d.sort((e,t)=>t.zIndex.peek()-e.zIndex.peek()||t.id-e.id);let e=this.intersectionCandidatesBuffer;for(let t of d)f+=this.updateIntersections(t,u.queryInto(e,t.rectangle.peek())),t.moved=!1,t.outOfBounds||(s.has(t)||!t.rendered?t.rendered=!1:pr(t,l))}else for(let e of d)e.moved=!1;let p=0,m=0;for(let e of d)e.outOfBounds||(e.rendered?(e.rerender(),m+=1):(e.render(),e.rendered=!0,p+=1));this.rerenderedObjects=i;let{rerenderQueue:h,rerenderRanges:g}=this,_=this.size.peek(),v=0,y=0,b=0,x=this.cellUpdatesBuffer,S=this.directRowRangesBuffer,C=this.dirtyRowsSeenBuffer;x.length=0,S.length=0,C.clear();let w=!this.sink.flushRanges||this.sink.requiresCellUpdates!==!1;for(let t=0;t<_.rows;++t){let n=g[t];if(n?.length){pn(n),C.add(t);let r=e[t]??=[];for(let e of n)b+=Math.max(0,e.endColumn-e.startColumn),v+=mr(t,e.startColumn,e.endColumn,r,S,w?x:void 0);n.length=0}let r=h[t];if(!r?.size)continue;C.add(t),b+=r.size;let i=e[t]??=[];for(let e of r){let n=i[e];n!==void 0&&(x.push({row:t,column:e,value:n}),v+=1)}r.clear()}let T=this.sink.flushRanges?S:ar(x,this.rowRangesBuffer);if(this.sink.flushRanges&&x.length>0){ar(x,this.rowRangesBuffer);for(let e of this.rowRangesBuffer)S.push(e)}y=C.size,this.lastRenderStats={updatedObjects:i,renderedObjects:p,rerenderedObjects:m,intersectionUpdates:a?d.length:0,intersectionCandidateChecks:f,intersectionsDirty:a,dirtyRectangles:o.length,dirtyRowRanges:T.length,dirtyRows:y,dirtyCells:b,fullRedraws:p,flushedCells:v},this.lastFlushDegraded=!1,(x.length>0||this.sink.flushRanges&&T.length>0)&&(this.sink.flushRanges?this.sink.flushRanges(T,this.lastRenderStats,x):this.sink.flush(x,this.lastRenderStats),this.sink.takeFlushDegraded?.()&&(this.lastFlushDegraded=!0,this.rerenderAll())),this.emit(`render`)}};function ur(){return{updatedObjects:0,renderedObjects:0,rerenderedObjects:0,intersectionUpdates:0,intersectionCandidateChecks:0,intersectionsDirty:!1,dirtyRectangles:0,dirtyRowRanges:0,dirtyRows:0,dirtyCells:0,fullRedraws:0,flushedCells:0}}function dr(e){return{column:e.column,row:e.row,width:e.width,height:e.height}}function fr(e,t,n,r,i,a,o,s){if(a.length=0,o.clear(),t.isEmpty()){for(let t of e)a.push(t);return a}for(let e of r)o.add(e);for(let e of n)o.add(e);for(let e of i.queryDirtyRegionInto(s,t))o.add(e);for(let t of e)o.has(t)&&a.push(t);return a}function pr(e,t){t.forEachIntersectionValue(e.rectangle.peek(),(t,n,r)=>{e.queueRerenderRange(t,n,r)})}function mr(e,t,n,r,i,a){if(!a){let a=hr(r,t,n);if(a)return i.push({row:e,startColumn:t,values:a}),a.length}let o=0,s,c=t;for(let l=t;l<n;l+=1){let t=r[l];if(t===void 0){s?.length&&(a||i.push({row:e,startColumn:c,values:s})),s=void 0;continue}s||(s=[],c=l),s.push(t),a?.push({row:e,column:l,value:t}),o+=1}return s?.length&&(a||i.push({row:e,startColumn:c,values:s})),o}function hr(e,t,n){for(let r=t;r<n;r+=1)if(e[r]===void 0)return;return e.slice(t,n)}function gr(e,t,n){let r=Math.max(0,e),i=Math.max(0,n-t);return Math.max(0,r-i)}var _r=class{#e;#t;#n;#r;#i;#a;#o;#s=0;#c=!1;#l=0;#u;#d;#f=0;#p=0;#m=0;#h;constructor(e){this.#e=e.tick,this.#t=e.timer??vr,this.#i=Math.max(0,e.intervalMs??1e3/60),this.#n=e.immediate??!0,this.#r=e.onError}get running(){return this.#c}get frame(){return this.#l}get intervalMs(){return this.#i}set intervalMs(e){this.#i=Math.max(0,e)}start(){this.#c||(this.#c=!0,this.#n?this.#g():this.#v())}stop(){this.#a!==void 0&&(this.#t.clearTimeout(this.#a),this.#a=void 0),this.#o=void 0,this.#s=0,this.#c=!1}requestSoon(e=16){if(!this.#c||this.#a===void 0||this.#o===void 0)return!1;let t=this.#t.now(),n=Math.max(0,e),r=t+n;return this.#o<=r?!1:(this.#t.clearTimeout(this.#a),this.#a=void 0,this.#v(n),!0)}deferNext(e){let t=Math.max(0,e);t>this.#s&&(this.#s=t)}step(){this.#_()}inspect(){return{running:this.#c,frame:this.#l,intervalMs:this.#i,frameBudgetMs:this.#i,lastStartedAt:this.#u,lastDurationMs:this.#d,averageDurationMs:this.#l===0?0:this.#f/this.#l,maxDurationMs:this.#p,overBudgetFrames:this.#m,lastError:this.#h}}#g(){if(this.#c){this.#a=void 0,this.#o=void 0;try{this.#_();let e=this.#u??this.#t.now(),t=gr(this.#i,e,this.#t.now()),n=Math.max(t,this.#s);this.#s=0,this.#v(n)}catch(e){this.#h=e,this.#r?.(e),this.stop()}}}#_(){let e=this.#t.now(),t=this.#u===void 0?0:e-this.#u;this.#u=e,this.#l+=1,this.#e({frame:this.#l,startedAt:e,deltaMs:t});let n=Math.max(0,this.#t.now()-e);this.#d=n,this.#f+=n,this.#p=Math.max(this.#p,n),n>this.#i&&(this.#m+=1)}#v(e=this.#i){if(!this.#c)return;let t=Math.max(0,e);this.#o=this.#t.now()+t,this.#a=this.#t.setTimeout(()=>this.#g(),t)}},vr={setTimeout:(e,t)=>setTimeout(e,t),clearTimeout:e=>clearTimeout(e),now:()=>performance.now()};function yr(e){return[`#0f172a`,`#ef4444`,`#22c55e`,`#eab308`,`#3b82f6`,`#d946ef`,`#06b6d4`,`#e5e7eb`,`#475569`,`#fb7185`,`#86efac`,`#fde047`,`#93c5fd`,`#f0abfc`,`#67e8f9`,`#f8fafc`][e]??`#dbeafe`}function br(e){if(!Number.isFinite(e)||e<0)return`#dbeafe`;if(e<16)return yr(e);if(e>=232){let t=8+(Math.min(e,255)-232)*10;return`rgb(${t},${t},${t})`}let t=Math.min(e,231)-16,n=Math.floor(t/36),r=Math.floor(t%36/6),i=t%6;return`rgb(${fe(n)},${fe(r)},${fe(i)})`}var xr=new TextDecoder,Sr=new Map([[9472,5],[9474,10],[9484,6],[9488,3],[9492,12],[9496,9],[9500,14],[9508,11],[9516,7],[9524,13],[9532,15],[9581,6],[9582,3],[9583,9],[9584,12],[9588,1],[9589,8],[9590,4],[9591,2]]),Cr=RegExp(`\x1B\\[([0-9;:]*)m`,`g`),wr=class{requiresCellUpdates=!1;#e;#t;#n;#r;#i;#a;#o=0;#s=0;#c;#l;#u;#d=[];#f=new Set;constructor(e){let t=e.canvas.getContext(`2d`);if(!t)throw Error(`BrowserCellCanvasSink requires a 2D canvas context.`);this.#e=e.canvas,this.#t=t,this.#n=e.font??`16px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`,this.#r=e.foreground??`#dbeafe`,this.#i=e.background??`#070b12`,this.#a=Math.max(1,e.devicePixelRatio??globalThis.devicePixelRatio??1),this.#c=Math.max(1,e.cellWidth??10),this.#l=Math.max(1,e.cellHeight??20),this.#t.font=this.#n,this.#t.textBaseline=`top`}resize(e,t){if(e=Math.max(1,Math.floor(e)),t=Math.max(1,Math.floor(t)),!Number.isSafeInteger(e*t)||e*t>2e6)throw RangeError(`Browser cell surfaces support at most 2,000,000 finite cells.`);this.#o=e,this.#s=t,this.#d=Array(e*t),this.#f.clear(),this.#e.width=Math.ceil(this.#o*this.#c*this.#a),this.#e.height=Math.ceil(this.#s*this.#l*this.#a),this.#t.setTransform?.(1,0,0,1,0,0),this.#t.scale(this.#a,this.#a),this.#t.font=this.#n,this.#t.textBaseline=`top`,this.#t.fillStyle=this.#i,this.#t.fillRect(0,0,this.#e.width/this.#a,this.#e.height/this.#a)}flush(e,t){let n=new Set;for(let t of e)this.#p(t.row,t.column,t.value,n);this.#m(n),this.#u={...t}}flushRanges(e,t,n=[]){let r=new Set;for(let t of e){let e=t.startColumn;for(let n of t.values)this.#p(t.row,e,n,r),e+=1}this.#m(r),this.#u={...t}}inspectSink(){return{columns:this.#o,rows:this.#s,cellWidth:this.#c,cellHeight:this.#l,foreground:this.#r,background:this.#i,lastStats:this.#u?{...this.#u}:void 0}}#p(e,t,n,r){if(!Number.isInteger(e)||!Number.isInteger(t)||e<0||e>=this.#s||t<0||t>=this.#o)return;let i=e*this.#o+t;r.add(i),this.#f.has(i)&&r.add(i+1),t>0&&this.#f.has(i-1)&&r.add(i-1),this.#d[i]=typeof n==`string`?n:xr.decode(n)}#m(e){let t=new Map,n=e=>{let n=t.get(e);return n||(n=Tr(this.#d[e]??``),t.set(e,n)),n},r=e=>this.#d[e]!==void 0&&n(e).text===``,i=e=>dn(n(e).text)===2?e%this.#o+1<this.#o&&r(e+1)?2:0:1;for(let t of e)i(t)===2&&e.add(t+1),t%this.#o>0&&r(t)&&i(t-1)===2&&e.add(t-1);for(let t of e){if(this.#f.delete(t),t%this.#o>0&&r(t)&&i(t-1)===2)continue;let e=n(t),a=i(t);this.#h(Math.floor(t/this.#o),t%this.#o,e,a),a===2&&this.#f.add(t)}}#h(e,t,n,r){let i=t*this.#c,a=e*this.#l,o=Math.max(1,r)*this.#c,s=Math.round(i*this.#a)/this.#a,c=Math.round(a*this.#a)/this.#a,l=(t+Math.max(1,r)===this.#o?this.#e.width:Math.round((i+o)*this.#a))/this.#a,u=(e+1===this.#s?this.#e.height:Math.round((a+this.#l)*this.#a))/this.#a;this.#t.fillStyle=n.inverse?n.foreground??this.#r:n.background??this.#i,this.#t.fillRect(s,c,l-s,u-c);let d=r===0?` `:n.text||` `,f=n.inverse?n.background??this.#i:n.foreground??this.#r,p=n.dim?Dr(f):f;if(!(d.trim().length===0&&!n.underline&&!n.overline&&!n.strikethrough))if(this.#t.save&&this.#t.restore&&this.#t.beginPath&&this.#t.rect&&this.#t.clip){this.#t.save();try{this.#t.beginPath(),this.#t.rect(s,c,l-s,u-c),this.#t.clip(),this.#g(n,r,d,i,a,p,s,c,l-s,u-c)}finally{this.#t.restore()}}else this.#g(n,r,d,i,a,p,s,c,l-s,u-c)}#g(e,t,n,r,i,a,o,s,c,l){if(n.trim().length===0){this.#_(e,r,i,a);return}if(n.length===1){let t=n.codePointAt(0);if(t>=9472&&t<=9599&&this.#v(t,o,s,a,c,l)||this.#y(t,o,s,a,c,l)){this.#_(e,r,i,a);return}}this.#t.font=`${e.italic?`italic `:``}${e.bold?`700 `:``}${this.#n}`,this.#t.fillStyle=a,this.#t.fillText(n,r,i),this.#_(e,r,i,a),t===2&&this.#_(e,r+this.#c,i,a)}#_(e,t,n,r){if(!e.underline&&!e.strikethrough&&!e.overline)return;let i=Math.min(this.#l,Math.max(1,Math.round(this.#l/16)));if(this.#t.fillStyle=r,e.overline&&this.#t.fillRect(t,n,this.#c,i),e.strikethrough&&this.#t.fillRect(t,n+Math.floor((this.#l-i)/2),this.#c,i),!e.underline)return;this.#t.fillStyle=e.underlineColor??r;let a=n+this.#l-i,o=e.underlineStyle??`solid`;if(o===`solid`||o===`double`)this.#t.fillRect(t,a,this.#c,i),o===`double`&&this.#l>i*2&&this.#t.fillRect(t,Math.max(n,a-i*2),this.#c,i);else{let e=o===`dotted`?i*2:o===`dashed`?i*6:i*8,r=Math.max(1,this.#c/512);for(let s=0;s<this.#c;s+=r){let c=(t+s)%e;if(o===`dotted`&&c>=i||o===`dashed`&&c>=i*4)continue;let l=o===`wavy`?Math.max(n,a-Math.min(this.#l-i,i*2)*(1+Math.sin((t+s)*Math.PI*2/e))/2):a;this.#t.fillRect(t+s,l,Math.min(r,this.#c-s),i)}}}#v(e,t,n,r,i,a){let o=this.#t,s=Math.max(1,Math.round(Math.min(i,a)/8)),c=Math.max(2,s*2),l=t+Math.floor((i-s)/2),u=n+Math.floor((a-s)/2),d=(e,t,n,r=s)=>o.fillRect(t,e,Math.max(0,n-t),r),f=(e,t,n,r=s)=>o.fillRect(e,t,r,Math.max(0,n-t)),p=e===9473?5:e===9475?10:Sr.get(e);if(p!==void 0){o.fillStyle=r;let l=e===9473||e===9475?c:s,u=t+Math.floor((i-l)/2),m=n+Math.floor((a-l)/2);return p&8&&f(u,n,m+l,l),p&2&&f(u,m,n+a,l),p&1&&d(m,t,u+l,l),p&4&&d(m,u,t+i,l),!0}let m=Math.max(s+1,Math.round(Math.min(i,a)/5)),h=u-m,g=u+m,_=l-m,v=l+m;switch(o.fillStyle=r,e){case 9552:return d(h,t,t+i),d(g,t,t+i),!0;case 9553:return f(_,n,n+a),f(v,n,n+a),!0;case 9556:return d(h,_,t+i),d(g,v,t+i),f(_,h,n+a),f(v,g,n+a),!0;case 9559:return d(h,t,v+s),d(g,t,_+s),f(v,h,n+a),f(_,g,n+a),!0;case 9562:return d(g,_,t+i),d(h,v,t+i),f(_,n,g+s),f(v,n,h+s),!0;case 9565:return d(g,t,v+s),d(h,t,_+s),f(v,n,g+s),f(_,n,h+s),!0;case 9568:return f(_,n,n+a),f(v,n,h+s),f(v,g,n+a),d(h,v,t+i),d(g,v,t+i),!0;case 9571:return f(v,n,n+a),f(_,n,h+s),f(_,g,n+a),d(h,t,_+s),d(g,t,_+s),!0;case 9574:return d(h,t,t+i),d(g,t,_+s),d(g,v,t+i),f(_,g,n+a),f(v,g,n+a),!0;case 9577:return d(g,t,t+i),d(h,t,_+s),d(h,v,t+i),f(_,n,h+s),f(v,n,h+s),!0;case 9580:return f(_,n,h+s),f(v,n,h+s),f(_,g,n+a),f(v,g,n+a),d(h,t,_+s),d(g,t,_+s),d(h,v,t+i),d(g,v,t+i),!0;case 9578:return d(h,t,t+i),d(g,t,t+i),f(l,n,n+a),!0;case 9579:return f(_,n,n+a),f(v,n,n+a),d(u,t,t+i),!0;default:return!1}}#y(e,t,n,r,i,a){if(e<9600||e>9631)return!1;let o=this.#t;if(o.fillStyle=r,e===9600)o.fillRect(t,n,i,a/2);else if(e>=9601&&e<=9608){let r=a*(e-9600)/8;o.fillRect(t,n+a-r,i,r)}else if(e>=9609&&e<=9615)o.fillRect(t,n,i*(9616-e)/8,a);else if(e===9616)o.fillRect(t+i/2,n,i/2,a);else if(e>=9617&&e<=9619){let r=[.25,.5,.75][e-9617],s=o.globalAlpha??1;o.globalAlpha=s*r,o.fillRect(t,n,i,a),o.globalAlpha=s}else if(e===9620)o.fillRect(t,n,i,a/8);else if(e===9621)o.fillRect(t+i*7/8,n,i/8,a);else{let r=[4,8,1,13,9,7,11,2,6,14][e-9622];r&1&&o.fillRect(t,n,i/2,a/2),r&2&&o.fillRect(t+i/2,n,i/2,a/2),r&4&&o.fillRect(t,n+a/2,i/2,a/2),r&8&&o.fillRect(t+i/2,n+a/2,i/2,a/2)}return!0}};function Tr(e){let t={text:Qt(e),bold:!1,dim:!1},n=Er(e);n.hyperlink&&(t.hyperlink=n.hyperlink);let r=n.textIndex,i=e.matchAll(Cr);for(let e of i){if(e.index!==void 0&&e.index>r)break;let n=k(e[1]??``);for(let e=0;e<n.length;e+=1){let r=n[e].split(`:`),i=Number(r[0]);if(r.length>1&&i===4){r.length===2&&/^[0-5]$/.test(r[1])&&(r[1]===`0`?(delete t.underline,delete t.underlineStyle):(t.underline=!0,t.underlineStyle=[`solid`,`double`,`wavy`,`dotted`,`dashed`][Number(r[1])-1]));continue}if(i===38||i===48||i===58){let r=he(n,e),a=r.rgb?`rgb(${r.rgb.join(`,`)})`:r.palette===void 0?void 0:br(r.palette);a!==void 0&&(i===38?t.foreground=a:i===48?t.background=a:t.underlineColor=a),e+=r.consumed-1;continue}r.length>1||(i===0?(t.foreground=void 0,t.background=void 0,t.bold=!1,t.dim=!1,delete t.italic,delete t.underline,delete t.strikethrough,delete t.underlineColor,delete t.underlineStyle,delete t.overline,delete t.inverse):i===1?t.bold=!0:i===2?t.dim=!0:i===3?t.italic=!0:i===4?(t.underline=!0,delete t.underlineStyle):i===21?(t.underline=!0,t.underlineStyle=`double`):i===53?t.overline=!0:i===55?delete t.overline:i===59?delete t.underlineColor:i===9?t.strikethrough=!0:i===7?t.inverse=!0:i===27?delete t.inverse:i===23?delete t.italic:i===24?(delete t.underline,delete t.underlineStyle):i===29?delete t.strikethrough:i===22?(t.bold=!1,t.dim=!1):i===39?t.foreground=void 0:i===49?t.background=void 0:i>=30&&i<=37?t.foreground=yr(i-30):i>=90&&i<=97?t.foreground=yr(i-90+8):i>=40&&i<=47?t.background=yr(i-40):i>=100&&i<=107&&(t.background=yr(i-100+8)))}}return t}function Er(e){let t=0,n;for(;t<e.length;){if(e[t]!==`\x1B`)return{textIndex:t,hyperlink:n};let r=pe(e,t);if(r){t+=r.length;continue}let i=me(e,t);if(i){n=i.uri||void 0,t+=i.length;continue}for(t+=1;t<e.length&&e[t]!==`m`&&e[t]!==`\x07`&&e[t]!==`\\`;)t+=1;t+=1}return{textIndex:e.length,hyperlink:n}}function Dr(e){return e.startsWith(`#`)?`${e}aa`:e}var Or=class{kind;#e=!1;constructor(e=`noop`){this.kind=e}start(){this.#e=!0}stop(){this.#e=!1}inspect(){return{running:this.#e,kind:this.kind}}},N=class extends Error{code;path;cause;constructor(e,t,n=`$`,r){super(`${t} at ${n}`,{cause:r}),this.code=e,this.path=n,this.cause=r,this.name=`InputEnvelopeError`}},kr=[`terminal`,`browser`,`remote`,`test`],Ar=[`keyboard`,`mouse`,`touch`,`pen`,`clipboard`,`window`,`unknown`],jr=[`trusted`,`untrusted`,`synthetic`],Mr=[`key`,`text`,`pointer`,`scroll`,`paste`,`focus`,`resize`,`composition`,`drop`],Nr=[`alt`,`ctrl`,`meta`,`shift`],Pr=[`schemaVersion`,`sequence`,`timestamp`,`source`,`device`,`trust`,`modifiers`,`kind`],Fr=[`data`,`raw`],Ir=[`encoding`,`data`],Lr=[`__proto__`,`constructor`,`prototype`],Rr=`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/`,zr=Object.freeze({maxBytes:64*1024,maxDepth:16,maxNodes:4096,maxRawBytes:4*1024}),Br=class{#e;#t;#n;#r;#i;#a;#o=0;constructor(e){if(!e||typeof e.now!=`function`)throw new N(`invalid-value`,`factory now must be a function`,`$.now`);let t=e.initialSequence??1;ui(t,`$.initialSequence`);let n=e.sequenceOverflowPolicy??`throw`;if(n!==`throw`)throw new N(`invalid-value`,`sequenceOverflowPolicy must be throw`,`$.sequenceOverflowPolicy`);this.#e=e.now,this.#r=t,this.#n=n,this.#t=fi(e.limits)}create(e,t,n={}){di(e,kr,`source`,`$.source`);let r=n.trust??mi(e),i=n.device??t.device,a=Qr(t.modifiers,n.modifiers),o={schemaVersion:1,sequence:this.#s(),timestamp:0,source:e,device:i,trust:r,modifiers:a,kind:t.kind};t.data!==void 0&&(o.data=t.data),n.includeRaw===!0&&t.raw!==void 0&&(o.raw=ti(t.raw,this.#t.maxRawBytes));let s=this.#c();o.timestamp=s;let c=Kr(o,this.#t);return this.#l(c.sequence,s),c}terminal(e,t={}){return this.create(`terminal`,Vr(e,{includeRaw:t.includeRaw}),t)}browser(e,t={}){return this.create(`browser`,Hr(e,{includeRaw:t.includeRaw}),t)}remote(e,t={}){return this.create(`remote`,Ur(e,{includeRaw:t.includeRaw}),t)}test(e,t={}){return this.create(`test`,Wr(e,{includeRaw:t.includeRaw}),t)}inspect(){let e=Object.freeze({...this.#t}),t={schemaVersion:1,emitted:this.#o,exhausted:this.#r===void 0,nextSequence:this.#r,lastSequence:this.#i,lastTimestamp:this.#a,sequenceOverflowPolicy:this.#n,limits:e};return Object.freeze(t)}#s(){if(this.#r===void 0)throw new N(`sequence-overflow`,`input sequence exhausted at Number.MAX_SAFE_INTEGER`,`$.sequence`);return this.#r}#c(){let e;try{e=this.#e()}catch(e){throw new N(`clock-failed`,`input clock threw`,`$.timestamp`,e)}if(!Number.isFinite(e))throw new N(`clock-failed`,`input clock must return a finite number`,`$.timestamp`);return Object.is(e,-0)&&(e=0),this.#a===void 0?e:Math.max(this.#a,e)}#l(e,t){this.#i=e,this.#a=t,this.#r=e===2**53-1?void 0:e+1,this.#o+=1}};function Vr(e,t={}){return qr(e,t.includeRaw===!0)}function Hr(e,t={}){return qr(e,t.includeRaw===!0)}function Ur(e,t={}){if(!e||typeof e!=`object`)throw new N(`invalid-shape`,`remote input must be an object`,`$.input`);let n=qr(e.event,t.includeRaw===!0);if(!(e.kind===`keyPress`&&n.kind===`key`||e.kind===`mousePress`&&n.kind===`pointer`||e.kind===`mouseScroll`&&n.kind===`scroll`||e.kind===`paste`&&n.kind===`paste`||e.kind===`terminalFocus`&&n.kind===`focus`))throw new N(`invalid-value`,`remote kind ${String(e.kind)} does not match its event`,`$.input.kind`);return n}function Wr(e,t={}){return qr(e,t.includeRaw===!0)}function Gr(e,t){return Kr(e,fi(t))}function Kr(e,t){let n=ai(e,`$`,`input envelope`);if(li(n,Pr,Fr,`$`,`input envelope`),n.schemaVersion!==1)throw new N(`unsupported-version`,`unsupported input envelope schema version ${String(n.schemaVersion)}`,`$.schemaVersion`);if(ui(n.sequence,`$.sequence`),typeof n.timestamp!=`number`||!Number.isFinite(n.timestamp))throw new N(`invalid-value`,`timestamp must be finite`,`$.timestamp`);let r=Object.is(n.timestamp,-0)?0:n.timestamp,i=di(n.source,kr,`source`,`$.source`),a=di(n.device,Ar,`device`,`$.device`),o=di(n.trust,jr,`trust`,`$.trust`),s=di(n.kind,Mr,`kind`,`$.kind`),c=$r(n.modifiers,`$.modifiers`,!1),l={nodes:0,ancestors:new WeakSet,limits:t},u=n.data===void 0?void 0:ni(n.data,`$.data`,0,l),d=n.raw===void 0?void 0:ei(n.raw,t),f={schemaVersion:1,sequence:n.sequence,timestamp:r,source:i,device:a,trust:o,modifiers:c,kind:s};u!==void 0&&(f.data=u),d!==void 0&&(f.raw=d);let p=Object.freeze(f);return hi(JSON.stringify(p),t.maxBytes,`$`,`canonical envelope`),p}function qr(e,t){if(!e||typeof e!=`object`)throw new N(`invalid-shape`,`input event must be an object`,`$.event`);let n=t?Yr(e):void 0;if(e.key===`paste`)return Jr({kind:`paste`,device:`clipboard`,modifiers:Zr(),data:{text:e.text}},n);if(e.key===`focus`)return Jr({kind:`focus`,device:`window`,modifiers:Zr(),data:{focused:e.focused}},n);if(e.key===`apc`)throw new N(`invalid-shape`,`terminal APC replies are not semantic input; subscribe to terminalApc instead`,`$.event`);if(e.key!==`mouse`)return Jr({kind:`key`,device:`keyboard`,modifiers:Xr(e),data:{key:e.key}},n);let r={x:e.x,y:e.y,movementX:e.movementX,movementY:e.movementY};if(`scroll`in e)return Jr({kind:`scroll`,device:`mouse`,modifiers:Xr(e),data:{...r,direction:e.scroll,drag:e.drag}},n);let i=`release`in e;return Jr({kind:`pointer`,device:`mouse`,modifiers:Xr(e),data:{...r,phase:i?e.release?`up`:e.drag?`move`:`down`:`move`,button:i?e.button??null:null,drag:i?e.drag:!1}},n)}function Jr(e,t){return t===void 0?e:{...e,raw:t}}function Yr(e){if(!(e.buffer instanceof Uint8Array))throw new N(`invalid-value`,`input event buffer must be Uint8Array`,`$.event.buffer`);return new Uint8Array(e.buffer)}function Xr(e){return{alt:!1,ctrl:e.ctrl,meta:e.meta,shift:e.shift}}function Zr(){return{alt:!1,ctrl:!1,meta:!1,shift:!1}}function Qr(e,t){let n=$r(e??{},`$.event.modifiers`,!0),r=$r(t??{},`$.options.modifiers`,!0);return{alt:t?.alt===void 0?n.alt:r.alt,ctrl:t?.ctrl===void 0?n.ctrl:r.ctrl,meta:t?.meta===void 0?n.meta:r.meta,shift:t?.shift===void 0?n.shift:r.shift}}function $r(e,t,n){let r=ai(e,t,`modifiers`);li(r,n?[]:Nr,n?Nr:[],t,`modifiers`);let i={alt:!1,ctrl:!1,meta:!1,shift:!1};for(let e of Nr){let a=r[e];if(!(a===void 0&&n)){if(typeof a!=`boolean`)throw new N(`invalid-value`,`${e} modifier must be boolean`,`${t}.${e}`);i[e]=a}}return Object.freeze(i)}function ei(e,t){let n=ai(e,`$.raw`,`raw payload`);if(li(n,Ir,[],`$.raw`,`raw payload`),n.encoding!==`base64`)throw new N(`invalid-value`,`raw encoding must be base64`,`$.raw.encoding`);if(typeof n.data!=`string`)throw new N(`invalid-value`,`raw data must be a string`,`$.raw.data`);return gi(n.data,t.maxRawBytes,`$.raw.data`),Object.freeze({encoding:`base64`,data:n.data})}function ti(e,t){if(!(e instanceof Uint8Array))throw new N(`invalid-value`,`raw input must be Uint8Array`,`$.event.raw`);if(e.byteLength>t)throw new N(`limit-exceeded`,`raw payload exceeds ${t} bytes`,`$.raw.data`);return Object.freeze({encoding:`base64`,data:_i(e)})}function ni(e,t,n,r){let i=ri(e,t,n,r);if(i===null||Array.isArray(i)||typeof i!=`object`)throw new N(`invalid-shape`,`semantic data must be a plain JSON object`,t);return i}function ri(e,t,n,r){if(n>r.limits.maxDepth)throw new N(`limit-exceeded`,`semantic data exceeds depth ${r.limits.maxDepth}`,t);if(r.nodes+=1,r.nodes>r.limits.maxNodes)throw new N(`limit-exceeded`,`semantic data exceeds ${r.limits.maxNodes} nodes`,t);if(e===null||typeof e==`boolean`||typeof e==`string`)return e;if(typeof e==`number`){if(!Number.isFinite(e))throw new N(`invalid-value`,`JSON numbers must be finite`,t);return Object.is(e,-0)?0:e}if(typeof e!=`object`)throw new N(`invalid-value`,`unsupported JSON value ${typeof e}`,t);if(r.ancestors.has(e))throw new N(`invalid-value`,`cyclic JSON value`,t);r.ancestors.add(e);try{if(Array.isArray(e))return ii(e,t,n,r);let i=ai(e,t,`JSON object`),a={};for(let e of Object.keys(i).sort()){if(bi(e))throw new N(`invalid-value`,`reserved object key ${e}`,`${t}.${e}`);a[e]=ri(i[e],xi(t,e),n+1,r)}return Object.freeze(a)}finally{r.ancestors.delete(e)}}function ii(e,t,n,r){if(Object.getPrototypeOf(e)!==Array.prototype)throw new N(`invalid-shape`,`JSON arrays must use Array.prototype`,t);if(e.length>r.limits.maxNodes)throw new N(`limit-exceeded`,`JSON array exceeds ${r.limits.maxNodes} entries`,t);let i=si(e,t);for(let n of i){if(typeof n!=`string`)throw new N(`invalid-shape`,`JSON arrays cannot contain symbol properties`,t);if(n!==`length`&&!yi(n,e.length))throw new N(`invalid-shape`,`unexpected array property ${n}`,xi(t,n))}let a=[];for(let i=0;i<e.length;i+=1){let o=ci(e,String(i),`${t}[${i}]`);if(!o)throw new N(`invalid-shape`,`sparse JSON arrays are not allowed`,`${t}[${i}]`);oi(o,`${t}[${i}]`),a.push(ri(o.value,`${t}[${i}]`,n+1,r))}return Object.freeze(a)}function ai(e,t,n){if(typeof e!=`object`||!e||Array.isArray(e))throw new N(`invalid-shape`,`${n} must be a plain object`,t);let r;try{r=Object.getPrototypeOf(e)}catch(e){throw new N(`invalid-shape`,`${n} prototype is not inspectable`,t,e)}if(r!==Object.prototype&&r!==null)throw new N(`invalid-shape`,`${n} cannot be an exotic or class instance`,t);for(let r of si(e,t)){if(typeof r!=`string`)throw new N(`invalid-shape`,`${n} cannot contain symbol properties`,t);let i=ci(e,r,xi(t,r));if(!i)throw new N(`invalid-shape`,`${n} property disappeared`,xi(t,r));oi(i,xi(t,r))}return e}function oi(e,t){if(!(`value`in e)||!e.enumerable)throw new N(`invalid-shape`,`JSON properties must be enumerable data properties without accessors`,t)}function si(e,t){try{return Reflect.ownKeys(e)}catch(e){throw new N(`invalid-shape`,`object keys are not inspectable`,t,e)}}function ci(e,t,n){try{return Object.getOwnPropertyDescriptor(e,t)}catch(e){throw new N(`invalid-shape`,`property descriptor is not inspectable`,n,e)}}function li(e,t,n,r,i){let a=[...t,...n];for(let t of Object.keys(e))if(!a.includes(t))throw new N(`unknown-field`,`${i} contains unknown field ${t}`,xi(r,t));for(let n of t)if(!Object.hasOwn(e,n))throw new N(`invalid-shape`,`${i} is missing ${n}`,xi(r,n))}function ui(e,t){if(typeof e!=`number`||!Number.isSafeInteger(e)||e<0||Object.is(e,-0))throw new N(`invalid-value`,`sequence must be a non-negative safe integer`,t)}function di(e,t,n,r){if(typeof e!=`string`||!t.includes(e))throw new N(`invalid-value`,`${n} is not supported`,r);return e}function fi(e){let t={maxBytes:pi(e?.maxBytes,zr.maxBytes,`$.limits.maxBytes`,1),maxDepth:pi(e?.maxDepth,zr.maxDepth,`$.limits.maxDepth`,0),maxNodes:pi(e?.maxNodes,zr.maxNodes,`$.limits.maxNodes`,1),maxRawBytes:pi(e?.maxRawBytes,zr.maxRawBytes,`$.limits.maxRawBytes`,0)};return Object.freeze(t)}function pi(e,t,n,r){if(e===void 0)return t;if(!Number.isSafeInteger(e)||e<r)throw new N(`invalid-value`,`limit must be a safe integer >= ${r}`,n);return e}function mi(e){return e===`remote`?`untrusted`:e===`test`?`synthetic`:`trusted`}function hi(e,t,n,r){if(new TextEncoder().encode(e).byteLength>t)throw new N(`limit-exceeded`,`${r} exceeds ${t} UTF-8 bytes`,n)}function gi(e,t,n){if(e.length%4!=0||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(e))throw new N(`invalid-value`,`raw data must be canonical base64`,n);let r=e.endsWith(`==`)?2:+!!e.endsWith(`=`),i=e.length===0?0:e.length/4*3-r;if(i>t)throw new N(`limit-exceeded`,`raw payload exceeds ${t} bytes`,n);if(_i(vi(e,i))!==e)throw new N(`invalid-value`,`raw data must use canonical base64 padding bits`,n)}function _i(e){let t=``;for(let n=0;n<e.length;n+=3){let r=e[n],i=e[n+1],a=e[n+2],o=r<<16|(i??0)<<8|(a??0);t+=Rr[o>>>18&63],t+=Rr[o>>>12&63],t+=i===void 0?`=`:Rr[o>>>6&63],t+=a===void 0?`=`:Rr[o&63]}return t}function vi(e,t){let n=new Uint8Array(t),r=0;for(let i=0;i<e.length;i+=4){let a=Rr.indexOf(e[i]),o=Rr.indexOf(e[i+1]),s=e[i+2]===`=`?0:Rr.indexOf(e[i+2]),c=e[i+3]===`=`?0:Rr.indexOf(e[i+3]),l=a<<18|o<<12|s<<6|c;r<t&&(n[r++]=l>>>16&255),r<t&&(n[r++]=l>>>8&255),r<t&&(n[r++]=l&255)}return n}function yi(e,t){if(!/^(?:0|[1-9][0-9]*)$/.test(e))return!1;let n=Number(e);return Number.isSafeInteger(n)&&n>=0&&n<t&&String(n)===e}function bi(e){return Lr.includes(e)}function xi(e,t){return/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(t)?`${e}.${t}`:`${e}[${JSON.stringify(t)}]`}var P=class extends Error{code;path;cause;constructor(e,t,n=`$`,r){super(`${t} at ${n}`,{cause:r}),this.code=e,this.path=n,this.cause=r,this.name=`PointerInputError`}},Si=[`mouse`,`touch`,`pen`],Ci=[`down`,`move`,`up`,`cancel`,`enter`,`leave`,`wheel`],wi=[`screen`,`cell`,`local`],Ti=[`pixel`,`line`,`page`,`cell`],Ei=[`schemaVersion`,`sequence`,`timestamp`,`source`,`trust`,`modifiers`,`pointerId`,`device`,`kind`,`coordinates`,`primary`,`button`,`buttons`],Di=[`raw`,`pressure`,`tangentialPressure`,`tiltX`,`tiltY`,`twist`,`contact`,`wheel`],Oi=[`pointerId`,`kind`,`coordinates`,`primary`,`button`,`buttons`],ki=[`pressure`,`tangentialPressure`,`tiltX`,`tiltY`,`twist`,`contact`,`wheel`],Ai=[`key`,`buffer`,`x`,`y`,`movementX`,`movementY`,`meta`,`ctrl`,`shift`],ji=128,Mi=80,Ni=512;function Pi(e,t){let n=ca(e,`$`,`pointer event`);if(la(n,Ei,Di,`$`,`pointer event`),n.schemaVersion!==1)throw new P(`invalid-value`,`unsupported pointer schema version ${String(n.schemaVersion)}`,`$.schemaVersion`);let r=ua(n.device,Si,`pointer device`,`$.device`),i=ua(n.kind,Ci,`pointer kind`,`$.kind`),a={schemaVersion:1,sequence:n.sequence,timestamp:n.timestamp,source:n.source,device:r,trust:n.trust,modifiers:n.modifiers,kind:qi(i)};n.raw!==void 0&&(a.raw=n.raw);let o=Gr(a,t),s=Yi(n.pointerId,`$.pointerId`),c=Hi(n.coordinates,`$.coordinates`);if(typeof n.primary!=`boolean`)throw new P(`invalid-value`,`primary must be boolean`,`$.primary`);let l=Xi(n.button,`$.button`),u=Zi(n.buttons,0,63,`buttons`,`$.buttons`),d=ea(n.pressure,0,1,`pressure`,`$.pressure`),f=ea(n.tangentialPressure,-1,1,`tangentialPressure`,`$.tangentialPressure`),p=ea(n.tiltX,-90,90,`tiltX`,`$.tiltX`),m=ea(n.tiltY,-90,90,`tiltY`,`$.tiltY`),h=n.twist===void 0?void 0:Zi(n.twist,0,359,`twist`,`$.twist`);if(r!==`pen`&&(f!==void 0||p!==void 0||m!==void 0||h!==void 0))throw new P(`invalid-value`,`tangential pressure, tilt, and twist are only valid for pen input`,`$.device`);let g=n.contact===void 0?void 0:Wi(n.contact,`$.contact`),_=n.wheel===void 0?void 0:Gi(n.wheel,`$.wheel`);if(i===`wheel`&&_===void 0)throw new P(`invalid-shape`,`wheel events require a wheel delta`,`$.wheel`);if(i!==`wheel`&&_!==void 0)throw new P(`invalid-value`,`wheel delta is only valid for wheel events`,`$.wheel`);let v={schemaVersion:1,sequence:o.sequence,timestamp:o.timestamp,source:o.source,trust:o.trust,modifiers:o.modifiers,pointerId:s,device:r,kind:i,coordinates:c,primary:n.primary,button:l,buttons:u};return o.raw!==void 0&&(v.raw=o.raw),d!==void 0&&(v.pressure=d),f!==void 0&&(v.tangentialPressure=f),p!==void 0&&(v.tiltX=p),m!==void 0&&(v.tiltY=m),h!==void 0&&(v.twist=h),g!==void 0&&(v.contact=g),_!==void 0&&(v.wheel=_),Object.freeze(v)}function Fi(e,t){return Ri(e,`mouse`,t)}function Ii(e,t){return Ri(e,`touch`,t)}function Li(e,t){return Ri(e,`pen`,t)}function Ri(e,t,n){let r=ua(t,Si,`pointer device`,`$.device`),i=ca(n,`$.input`,`pointer adapter input`);la(i,Oi,ki,`$.input`,`pointer adapter input`);let a=Gr(e);if(a.device!==r)throw new P(`invalid-value`,`envelope device ${a.device} does not match ${r} adapter`,`$.envelope.device`);let o={schemaVersion:1,sequence:a.sequence,timestamp:a.timestamp,source:a.source,trust:a.trust,modifiers:a.modifiers,pointerId:i.pointerId,device:r,kind:i.kind,coordinates:i.coordinates,primary:i.primary,button:i.button,buttons:i.buttons};a.raw!==void 0&&(o.raw=a.raw);for(let e of ki)i[e]!==void 0&&(o[e]=i[e]);let s=Pi(o),c=qi(s.kind);if(a.kind!==c)throw new P(`invalid-value`,`envelope kind ${a.kind} does not match pointer kind ${s.kind}`,`$.envelope.kind`);return s}function zi(e,t,n={}){let r=Ki(t),i=ca(n,`$.options`,`terminal mouse pointer options`);la(i,[],[`pointerId`,`screen`,`local`],`$.options`,`terminal mouse pointer options`);let a={cell:Object.freeze({space:`cell`,x:r.x,y:r.y})};i.screen!==void 0&&(a.screen=i.screen),i.local!==void 0&&(a.local=i.local);let o,s=null,c=0,l;return`scroll`in r?(o=`wheel`,l=Object.freeze({deltaX:0,deltaY:r.scroll,unit:`line`})):`release`in r?(o=r.release?`up`:r.drag?`move`:`down`,(o===`down`||o===`up`)&&(s=r.button??null),(o===`down`||o===`move`)&&(c=Ji(r.button))):o=`move`,Fi(e,{pointerId:i.pointerId===void 0?1:Yi(i.pointerId,`$.options.pointerId`),kind:o,coordinates:a,primary:!0,button:s,buttons:c,...l===void 0?{}:{wheel:l}})}var Bi=Object.freeze({maxOwners:256,maxCaptures:256,maxListeners:256,maxDiagnostics:64}),Vi=class{#e;#t=new Map;#n=new Map;#r=new Set;#i=[];#a=new Set;#o=0;#s=0;#c=!1;#l=!1;#u=!1;constructor(e={}){this.#e=ra(e)}get disposed(){return this.#c}registerOwner(e){this.#v(`registerOwner`);let t=ca(e,`$.owner`,`pointer capture owner`);la(t,[`id`,`onPointer`],[],`$.owner`,`pointer capture owner`);let n=ta(t.id,`$.owner.id`);if(typeof t.onPointer!=`function`)throw new P(`invalid-value`,`owner onPointer must be a function`,`$.owner.onPointer`);if(this.#t.has(n))throw new P(`duplicate`,`pointer owner ${n} is already registered`,`$.owner.id`);if(this.#t.size>=this.#e.maxOwners)throw new P(`limit-exceeded`,`pointer owners exceed ${this.#e.maxOwners}`,`$.owner`);let r={id:n,onPointer:t.onPointer,active:!0};return this.#t.set(n,r),Object.freeze({id:n,dispose:()=>{r.active&&this.#f(r)},isDisposed:()=>!r.active})}disposeOwner(e){this.#v(`disposeOwner`);let t=ta(e,`$.ownerId`),n=this.#t.get(t);return n?(this.#f(n),!0):!1}subscribe(e){if(this.#v(`subscribe`),typeof e!=`function`)throw new P(`invalid-value`,`capture listener must be a function`,`$.listener`);if(this.#r.has(e))throw new P(`duplicate`,`capture listener is already registered`,`$.listener`);if(this.#r.size>=this.#e.maxListeners)throw new P(`limit-exceeded`,`capture listeners exceed ${this.#e.maxListeners}`,`$.listener`);this.#r.add(e);let t=!0;return()=>{t&&(t=!1,this.#r.delete(e))}}capture(e,t){this.#v(`capture`);let n=Yi(e,`$.pointerId`),r=ta(t,`$.ownerId`);this.#h(n,`capture`);let i=this.#d(r),a=this.#n.get(n);if(a)throw new P(a===i?`duplicate`:`capture-conflict`,`pointer ${n} is already captured by ${a.id}`,`$.pointerId`);if(this.#n.size>=this.#e.maxCaptures)throw new P(`limit-exceeded`,`pointer captures exceed ${this.#e.maxCaptures}`,`$.pointerId`);this.#n.set(n,i),this.#g(`captured`,n,void 0,i.id)}transfer(e,t,n){this.#v(`transfer`);let r=Yi(e,`$.pointerId`),i=ta(t,`$.fromOwnerId`),a=ta(n,`$.toOwnerId`);if(this.#h(r,`transfer`),i===a)throw new P(`duplicate`,`capture transfer owners must differ`,`$.toOwnerId`);let o=this.#d(i),s=this.#d(a),c=this.#n.get(r);if(!c)throw new P(`not-found`,`pointer ${r} is not captured`,`$.pointerId`);if(c!==o)throw new P(`capture-conflict`,`pointer ${r} is captured by ${c.id}, not ${i}`,`$.fromOwnerId`);this.#n.set(r,s),this.#g(`transferred`,r,o.id,s.id)}release(e,t){this.#v(`release`);let n=Yi(e,`$.pointerId`),r=ta(t,`$.ownerId`),i=this.#n.get(n);if(!i)return!1;if(i.id!==r)throw new P(`capture-conflict`,`pointer ${n} is captured by ${i.id}, not ${r}`,`$.ownerId`);return this.#n.delete(n),this.#g(`released`,n,i.id,void 0),!0}cancelAll(){return this.#v(`cancelAll`),this.#m()}captureOwner(e){let t=Yi(e,`$.pointerId`);return this.#n.get(t)?.id}route(e,t){this.#v(`route`);let n=Pi(e),r=t===void 0?void 0:ta(t,`$.hitOwnerId`),i=this.#n.get(n.pointerId),a=i!==void 0&&i.active,o=a?i:r===void 0?void 0:this.#t.get(r),s=n.kind===`up`||n.kind===`cancel`,c=s&&!this.#a.has(n.pointerId);c&&this.#a.add(n.pointerId);let l,u=!1;try{if(o?.active){u=!0;let e=Object.freeze({ownerId:o.id,...r===void 0?{}:{hitOwnerId:r},captured:a});try{o.onPointer(n,e)}catch(e){l=oa(e),this.#_(`owner-handler`,e,n.pointerId,o.id)}}}finally{s&&this.#p(n.pointerId,`auto-released`),c&&this.#a.delete(n.pointerId)}let d={pointerId:n.pointerId,kind:n.kind,delivered:u,captured:a};return r!==void 0&&(d.hitOwnerId=r),o!==void 0&&(d.ownerId=o.id),l!==void 0&&(d.error=l),Object.freeze(d)}inspect(){let e=[...this.#n.entries()].sort(([e],[t])=>e-t),t=Object.freeze(e.map(([e,t])=>Object.freeze({pointerId:e,ownerId:t.id}))),n=Object.freeze([...this.#t.values()].sort((e,t)=>e.id.localeCompare(t.id)).map(t=>{let n=Object.freeze(e.filter(([,e])=>e===t).map(([e])=>e));return Object.freeze({id:t.id,capturedPointerIds:n})})),r=Object.freeze(this.#i.map(sa));return Object.freeze({disposed:this.#c,revision:this.#o,listenerCount:this.#r.size,owners:n,captures:t,diagnostics:r})}clearDiagnostics(){this.#v(`clearDiagnostics`),this.#i.length=0}dispose(){if(!(this.#c||this.#l)){this.#l=!0;try{this.#u||this.#m()}finally{for(let e of this.#t.values())e.active=!1;this.#t.clear(),this.#n.clear(),this.#r.clear(),this.#a.clear(),this.#c=!0,this.#l=!1}}}#d(e){let t=this.#t.get(e);if(!t?.active)throw new P(`not-found`,`pointer owner ${e} is not registered`,`$.ownerId`);return t}#f(e){if(!e.active)return;e.active=!1,this.#t.get(e.id)===e&&this.#t.delete(e.id);let t=[...this.#n.entries()].filter(([,t])=>t===e).sort(([e],[t])=>e-t),n=[];for(let[e]of t)this.#n.delete(e),this.#a.has(e)||(this.#a.add(e),n.push(e));try{for(let[n]of t)this.#g(`owner-disposed`,n,e.id,void 0)}finally{for(let e of n)this.#a.delete(e)}}#p(e,t){let n=this.#n.get(e);n&&(this.#n.delete(e),this.#g(t,e,n.id,void 0))}#m(){if(this.#u)throw new P(`invalid-state`,`capture cancellation is already in progress`,`$.controller`);let e=[...this.#n.entries()].sort(([e],[t])=>e-t);this.#u=!0,this.#n.clear();try{for(let[t,n]of e)this.#g(`cancelled`,t,n.id,void 0)}finally{this.#u=!1}return e.length}#h(e,t){if(this.#u||this.#a.has(e))throw new P(`invalid-state`,`cannot ${t} pointer ${e} during terminal capture cleanup`,`$.pointerId`)}#g(e,t,n,r){this.#o=aa(this.#o,`capture revision`);let i=Object.freeze({revision:this.#o,kind:e,pointerId:t,...n===void 0?{}:{previousOwnerId:n},...r===void 0?{}:{nextOwnerId:r}}),a=[...this.#r];for(let e of a)try{e(i)}catch(e){this.#_(`capture-listener`,e,t,r??n)}}#_(e,t,n,r){if(this.#e.maxDiagnostics===0)return;this.#s=aa(this.#s,`diagnostic sequence`);let i=Object.freeze({sequence:this.#s,phase:e,...n===void 0?{}:{pointerId:n},...r===void 0?{}:{ownerId:r},error:oa(t)});this.#i.length===this.#e.maxDiagnostics&&this.#i.shift(),this.#i.push(i)}#v(e){if(this.#c||this.#l)throw new P(`disposed`,`cannot ${e} a disposed capture controller`,`$.controller`)}};function Hi(e,t){let n=ca(e,t,`pointer coordinates`);la(n,[],[`screen`,`cell`,`local`],t,`pointer coordinates`);let r={};for(let e of wi)n[e]!==void 0&&(r[e]=Ui(n[e],e,`${t}.${e}`));if(r.screen===void 0&&r.cell===void 0&&r.local===void 0)throw new P(`invalid-shape`,`at least one coordinate space is required`,t);return Object.freeze(r)}function Ui(e,t,n){let r=ca(e,n,`${t} coordinate`);if(la(r,[`space`,`x`,`y`],[],n,`${t} coordinate`),r.space!==t)throw new P(`invalid-value`,`${t} coordinate must declare space ${t}`,`${n}.space`);return Object.freeze({space:t,x:Qi(r.x,`x`,`${n}.x`),y:Qi(r.y,`y`,`${n}.y`)})}function Wi(e,t){let n=ca(e,t,`pointer contact`);return la(n,[`width`,`height`],[],t,`pointer contact`),Object.freeze({width:$i(n.width,0,Number.MAX_VALUE,`contact width`,`${t}.width`),height:$i(n.height,0,Number.MAX_VALUE,`contact height`,`${t}.height`)})}function Gi(e,t){let n=ca(e,t,`pointer wheel delta`);return la(n,[`deltaX`,`deltaY`,`unit`],[],t,`pointer wheel delta`),Object.freeze({deltaX:Qi(n.deltaX,`wheel deltaX`,`${t}.deltaX`),deltaY:Qi(n.deltaY,`wheel deltaY`,`${t}.deltaY`),unit:ua(n.unit,Ti,`wheel unit`,`${t}.unit`)})}function Ki(e){let t=ca(e,`$.event`,`terminal mouse event`);if(Object.hasOwn(t,`scroll`)?la(t,[...Ai,`drag`,`scroll`],[],`$.event`,`mouse scroll event`):Object.hasOwn(t,`release`)||Object.hasOwn(t,`button`)?la(t,[...Ai,`drag`,`release`,`button`],[],`$.event`,`mouse press event`):la(t,Ai,[],`$.event`,`mouse move event`),t.key!==`mouse`)throw new P(`invalid-value`,`terminal mouse key must be mouse`,`$.event.key`);if(!(t.buffer instanceof Uint8Array))throw new P(`invalid-value`,`terminal mouse buffer must be Uint8Array`,`$.event.buffer`);for(let e of[`x`,`y`,`movementX`,`movementY`])Qi(t[e],e,`$.event.${e}`);for(let e of[`meta`,`ctrl`,`shift`])if(typeof t[e]!=`boolean`)throw new P(`invalid-value`,`${e} must be boolean`,`$.event.${e}`);if(Object.hasOwn(t,`scroll`)){if(typeof t.drag!=`boolean`)throw new P(`invalid-value`,`drag must be boolean`,`$.event.drag`);if(t.scroll!==-1&&t.scroll!==0&&t.scroll!==1)throw new P(`invalid-value`,`scroll must be -1, 0, or 1`,`$.event.scroll`)}else if(Object.hasOwn(t,`release`)){if(typeof t.drag!=`boolean`||typeof t.release!=`boolean`)throw new P(`invalid-value`,`drag and release must be boolean`,`$.event`);if(t.button!==void 0&&t.button!==0&&t.button!==1&&t.button!==2)throw new P(`invalid-value`,`terminal mouse button must be 0, 1, 2, or undefined`,`$.event.button`);if(!t.release&&t.button===void 0)throw new P(`invalid-value`,`non-release mouse events require a button`,`$.event.button`)}return t}function qi(e){return e===`wheel`?`scroll`:`pointer`}function Ji(e){return e===0?1:e===1?4:e===2?2:0}function Yi(e,t){if(typeof e!=`number`||!Number.isSafeInteger(e)||e<0||Object.is(e,-0))throw new P(`invalid-value`,`pointerId must be a non-negative safe integer`,t);return e}function Xi(e,t){return e===null?null:Zi(e,0,5,`button`,t)}function Zi(e,t,n,r,i){if(typeof e!=`number`||!Number.isSafeInteger(e)||e<t||e>n)throw new P(`invalid-value`,`${r} must be an integer from ${t} through ${n}`,i);return e}function Qi(e,t,n){if(typeof e!=`number`||!Number.isFinite(e))throw new P(`invalid-value`,`${t} must be finite`,n);return Object.is(e,-0)?0:e}function $i(e,t,n,r,i){let a=Qi(e,r,i);if(a<t||a>n)throw new P(`invalid-value`,`${r} must be from ${t} through ${n}`,i);return a}function ea(e,t,n,r,i){return e===void 0?void 0:$i(e,t,n,r,i)}function ta(e,t){if(typeof e!=`string`||e.length===0||e.length>ji||na(e))throw new P(`invalid-value`,`owner id must be 1-${ji} printable characters`,t);return e}function na(e){for(let t=0;t<e.length;t+=1)if(e.charCodeAt(t)<=31)return!0;return!1}function ra(e){let t=ca(e,`$.options`,`pointer capture options`);return la(t,[],[`maxOwners`,`maxCaptures`,`maxListeners`,`maxDiagnostics`],`$.options`,`pointer capture options`),Object.freeze({maxOwners:ia(t.maxOwners,Bi.maxOwners,1,`$.options.maxOwners`),maxCaptures:ia(t.maxCaptures,Bi.maxCaptures,1,`$.options.maxCaptures`),maxListeners:ia(t.maxListeners,Bi.maxListeners,1,`$.options.maxListeners`),maxDiagnostics:ia(t.maxDiagnostics,Bi.maxDiagnostics,0,`$.options.maxDiagnostics`)})}function ia(e,t,n,r){if(e===void 0)return t;if(typeof e!=`number`||!Number.isSafeInteger(e)||e<n||e>1e5)throw new P(`invalid-value`,`controller limit must be an integer from ${n} through 100000`,r);return e}function aa(e,t){if(e===2**53-1)throw new P(`limit-exceeded`,`${t} exhausted`,`$.controller`);return e+1}function oa(e){let t=`Error`,n=`pointer callback failed`;try{e instanceof Error?(t=typeof e.name==`string`&&e.name.length>0?e.name:t,n=typeof e.message==`string`?e.message:n):n=String(e)}catch{}return Object.freeze({name:t.slice(0,Mi),message:n.slice(0,Ni)})}function sa(e){return Object.freeze({sequence:e.sequence,phase:e.phase,...e.pointerId===void 0?{}:{pointerId:e.pointerId},...e.ownerId===void 0?{}:{ownerId:e.ownerId},error:Object.freeze({...e.error})})}function ca(e,t,n){if(typeof e!=`object`||!e||Array.isArray(e))throw new P(`invalid-shape`,`${n} must be a plain object`,t);let r;try{r=Object.getPrototypeOf(e)}catch(e){throw new P(`invalid-shape`,`${n} prototype is not inspectable`,t,e)}if(r!==Object.prototype&&r!==null)throw new P(`invalid-shape`,`${n} cannot be an exotic or class instance`,t);let i;try{i=Reflect.ownKeys(e)}catch(e){throw new P(`invalid-shape`,`${n} keys are not inspectable`,t,e)}let a=Object.create(null);for(let r of i){if(typeof r!=`string`)throw new P(`invalid-shape`,`${n} cannot contain symbol properties`,t);let i;try{i=Object.getOwnPropertyDescriptor(e,r)}catch(e){throw new P(`invalid-shape`,`${n} property is not inspectable`,da(t,r),e)}if(!i||!(`value`in i)||!i.enumerable)throw new P(`invalid-shape`,`${n} properties must be enumerable data properties without accessors`,da(t,r));a[r]=i.value}return a}function la(e,t,n,r,i){let a=[...t,...n];for(let t of Object.keys(e))if(!a.includes(t))throw new P(`unknown-field`,`${i} contains unknown field ${t}`,da(r,t));for(let n of t)if(!Object.hasOwn(e,n))throw new P(`invalid-shape`,`${i} is missing ${n}`,da(r,n))}function ua(e,t,n,r){if(typeof e!=`string`||!t.includes(e))throw new P(`invalid-value`,`${n} is not supported`,r);return e}function da(e,t){return/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(t)?`${e}.${t}`:`${e}[${JSON.stringify(t)}]`}var fa=class{kind=`browser`;size;input;lifecycle;#e;#t;constructor(e){let t=e.cellWidth??10,n=e.cellHeight??20;this.size=new C(e.columns&&e.rows?{columns:e.columns,rows:e.rows}:ma(e.root,t,n),{deepObserve:!0}),this.input=e.input??new pa(e.root,{cellWidth:t,cellHeight:n,touchAction:e.touchAction,userSelect:e.userSelect,textInput:e.textInput}),this.lifecycle=e.lifecycle??new Or(`browser`),this.#e=e.scheduler??Ea(),`ResizeObserver`in globalThis&&(this.#t=new ResizeObserver(()=>{let r=ma(e.root,t,n),i=this.size.peek();(r.columns!==i.columns||r.rows!==i.rows)&&(i.columns=r.columns,i.rows=r.rows)}),this.#t.observe(e.root))}now(){return this.#e.now()}scheduleFrame(e){let t=this.#e.request(()=>e());return{dispose:()=>this.#e.cancel(t)}}dispose(){this.#t?.disconnect(),this.input.dispose(),this.lifecycle.stop()}},pa=class{#e;#t;#n;#r;#i;#a;#o;#s;#c=!1;#l=[];#u;#d;#f;constructor(e,t={}){this.#e=e,this.#t=Math.max(1,t.cellWidth??10),this.#n=Math.max(1,t.cellHeight??20),this.#r=t.touchAction??`none`,this.#i=t.userSelect??`none`,this.#a=t.textInput??`auto`,this.#o=new Br({now:t.now??(()=>performance.now())})}attach(e){this.detach(),this.#s=e,this.#e.tabIndex=this.#e.tabIndex<0?0:this.#e.tabIndex,this.#u=ga(this.#e,this.#r,this.#i);let t=this.#S();this.#l=[ha(t,`keydown`,e=>this.#p(e)),ha(this.#e,`pointerdown`,e=>this.#m(e,`down`),{passive:!1}),ha(this.#e,`pointermove`,e=>this.#h(e),{passive:!1}),ha(this.#e,`pointerup`,e=>this.#m(e,`up`),{passive:!1}),ha(this.#e,`pointercancel`,e=>this.#m(e,`cancel`),{passive:!1}),ha(this.#e,`wheel`,e=>this.#_(e),{passive:!1}),ha(t,`input`,e=>this.#y(e),{passive:!1}),ha(t,`paste`,e=>this.#v(e),{passive:!1}),ha(t,`focus`,()=>this.#b(!0)),ha(t,`blur`,()=>this.#b(!1))],this.#c=!0}detach(){for(let e of this.#l)e();this.#l=[],this.#u?.(),this.#u=void 0,this.#f?.(),this.#f=void 0,this.#d=void 0,this.#s=void 0,this.#c=!1}dispose(){this.detach()}inspect(){return{attached:this.#c,kind:`browser`}}#p(e){let t=Ta(e);t&&(this.#s?.emit(`keyPress`,{key:t,meta:e.metaKey||e.altKey,ctrl:e.ctrlKey,shift:e.shiftKey,buffer:new TextEncoder().encode(e.key.length===1?e.key:e.code)}),e.preventDefault())}#m(e,t){let n=t!==`down`,r=va(e);try{t===`down`&&!r?(e.button===0&&this.#e.ownerDocument?.getSelection()?.removeAllRanges(),(this.#d??this.#e).focus({preventScroll:!0}),this.#e.setPointerCapture?.(e.pointerId)):this.#e.hasPointerCapture?.(e.pointerId)&&this.#e.releasePointerCapture?.(e.pointerId)}catch{}let i=this.#x(e);this.#g(e,t,i),this.#s?.emit(`mousePress`,{key:`mouse`,x:i.x,y:i.y,movementX:e.movementX,movementY:e.movementY,meta:e.metaKey||e.altKey,ctrl:e.ctrlKey,shift:e.shiftKey,buffer:new Uint8Array,drag:!1,release:n,button:n?void 0:ya(e.button)}),r||e.preventDefault()}#h(e){let t=this.#x(e);this.#g(e,`move`,t),e.buttons!==0&&(this.#s?.emit(`mousePress`,{key:`mouse`,x:t.x,y:t.y,movementX:e.movementX,movementY:e.movementY,meta:e.metaKey||e.altKey,ctrl:e.ctrlKey,shift:e.shiftKey,buffer:new Uint8Array,drag:!0,release:!1,button:ya(e.button)}),va(e)||e.preventDefault())}#g(e,t,n){let r=ba(e.pointerType),i=this.#e.getBoundingClientRect(),a=this.#o.create(`browser`,{kind:`pointer`,device:r,modifiers:{alt:e.altKey===!0,ctrl:e.ctrlKey===!0,meta:e.metaKey===!0,shift:e.shiftKey===!0},data:{phase:t,pointerId:xa(e.pointerId)}}),o={pointerId:xa(e.pointerId),kind:t,coordinates:{screen:{space:`screen`,x:Ca(e.screenX),y:Ca(e.screenY)},cell:{space:`cell`,x:n.x,y:n.y},local:{space:`local`,x:Ca(e.clientX-i.left),y:Ca(e.clientY-i.top)}},primary:e.isPrimary!==!1,button:t===`down`||t===`up`?ya(e.button)??null:null,buttons:t===`up`||t===`cancel`?0:Sa(e.buttons,t),...wa(e,r)},s;s=r===`touch`?Ii(a,o):r===`pen`?Li(a,o):Fi(a,o),this.#s?.emit(`pointerInput`,s)}#_(e){let t=this.#x(e);this.#s?.emit(`mouseScroll`,{key:`mouse`,x:t.x,y:t.y,movementX:0,movementY:e.deltaY,meta:e.metaKey||e.altKey,ctrl:e.ctrlKey,shift:e.shiftKey,buffer:new Uint8Array,drag:!1,scroll:e.deltaY>0?1:e.deltaY<0?-1:0}),e.preventDefault()}#v(e){let t=e.clipboardData?.getData(`text`)??``;this.#s?.emit(`paste`,{key:`paste`,text:t,buffer:new TextEncoder().encode(t)}),e.preventDefault()}#y(e){let t=e.target,n=typeof t.value==`string`?t.value:``;if(n){t.value=``;for(let e of n)this.#C(e);e.preventDefault()}}#b(e){this.#s?.emit(`terminalFocus`,{key:`focus`,focused:e,buffer:new Uint8Array})}#x(e){let t=this.#e.getBoundingClientRect();return{x:Math.max(0,Math.floor((e.clientX-t.left)/this.#t)),y:Math.max(0,Math.floor((e.clientY-t.top)/this.#n))}}focus(){(this.#d??this.#e).focus({preventScroll:!0})}#S(){let e=this.#a!==!1&&this.#a!==`target`?_a(this.#e):void 0;return e?(this.#d=e.element,this.#f=e.dispose,e.element):(this.#d=this.#e,this.#e)}#C(e){let t=e===`
`||e===`\r`?`return`:e===` `?`space`:e.toLowerCase();this.#s?.emit(`keyPress`,{key:t,meta:!1,ctrl:!1,shift:!1,buffer:new TextEncoder().encode(e)})}};function ma(e,t,n){let r=e.getBoundingClientRect();return{columns:Math.max(1,Math.floor(r.width/t)),rows:Math.max(1,Math.floor(r.height/n))}}function ha(e,t,n,r){return e.addEventListener(t,n,r),()=>e.removeEventListener(t,n,r)}function ga(e,t,n){let r=e.style;if(!r)return()=>void 0;let i=r.touchAction,a=r.userSelect,o=r.webkitUserSelect;return r.touchAction=t,r.userSelect=n,r.webkitUserSelect=n,()=>{r.touchAction=i,r.userSelect=a,r.webkitUserSelect=o}}function _a(e){let t=e.ownerDocument??globalThis.document;if(!t?.createElement)return;let n=t.createElement(`textarea`);return n.tabIndex=0,n.setAttribute(`aria-hidden`,`true`),n.setAttribute(`autocapitalize`,`off`),n.setAttribute(`autocomplete`,`off`),n.setAttribute(`autocorrect`,`off`),n.setAttribute(`spellcheck`,`false`),globalThis.matchMedia?.(`(pointer: coarse)`).matches&&(n.setAttribute(`inputmode`,`none`),n.setAttribute(`virtualkeyboardpolicy`,`manual`)),n.style.position=`fixed`,n.style.left=`0`,n.style.top=`0`,n.style.width=`1px`,n.style.height=`1px`,n.style.opacity=`0`,n.style.pointerEvents=`none`,n.style.zIndex=`-1`,n.style.resize=`none`,n.style.border=`0`,n.style.padding=`0`,n.style.margin=`0`,(t.body??e).appendChild(n),{element:n,dispose:()=>n.remove()}}function va(e){return typeof Element<`u`&&e.composedPath().some(e=>e instanceof Element&&e.hasAttribute(`data-exotui-selectable`))}function ya(e){return e===0||e===1||e===2?e:0}function ba(e){return e===`touch`||e===`pen`?e:`mouse`}function xa(e){return Number.isSafeInteger(e)&&e>=0?e:0}function Sa(e,t){return Number.isSafeInteger(e)&&e>=0&&e<=63?e:+(t===`down`||t===`move`)}function Ca(e){return Number.isFinite(e)?e:0}function wa(e,t){let n={};return Number.isFinite(e.pressure)&&e.pressure>=0&&e.pressure<=1&&(n.pressure=e.pressure),(t===`touch`||t===`pen`)&&Number.isFinite(e.width)&&e.width>=0&&Number.isFinite(e.height)&&e.height>=0&&(n.contact={width:e.width,height:e.height}),t===`pen`&&(Number.isFinite(e.tangentialPressure)&&e.tangentialPressure>=-1&&e.tangentialPressure<=1&&(n.tangentialPressure=e.tangentialPressure),Number.isFinite(e.tiltX)&&e.tiltX>=-90&&e.tiltX<=90&&(n.tiltX=e.tiltX),Number.isFinite(e.tiltY)&&e.tiltY>=-90&&e.tiltY<=90&&(n.tiltY=e.tiltY),Number.isSafeInteger(e.twist)&&e.twist>=0&&e.twist<=359&&(n.twist=e.twist)),n}function Ta(e){if(e.key.length===1)return e.key===` `?`space`:e.key.toLowerCase();let t={Enter:`return`,Tab:`tab`,Backspace:`backspace`,Escape:`escape`,ArrowUp:`up`,ArrowDown:`down`,ArrowLeft:`left`,ArrowRight:`right`,Delete:`delete`,Insert:`insert`,PageUp:`pageup`,PageDown:`pagedown`,Home:`home`,End:`end`};if(e.key in t)return t[e.key];if(/^F([1-9]|1[0-2])$/.test(e.key))return e.key.toLowerCase()}function Ea(){let e=globalThis.requestAnimationFrame??(e=>setTimeout(()=>e(performance.now()),1e3/60)),t=globalThis.cancelAnimationFrame??(e=>clearTimeout(e));return{request:t=>e(t),cancel:e=>t(e),now:()=>performance.now()}}var Da=class extends Tn{root;element;platform;sink;canvas;renderLoop;#e=!1;#t;#n;constructor(e){super(),this.root=e.root,this.element=e.canvas??document.createElement(`canvas`),e.canvas||this.root.appendChild(this.element),this.sink=e.sink??new wr({canvas:this.element,...e.sinkOptions}),this.platform=new fa({root:e.root,columns:e.columns,rows:e.rows,cellWidth:e.sinkOptions?.cellWidth,cellHeight:e.sinkOptions?.cellHeight,...e.platformOptions}),this.canvas=new lr({sink:this.sink,size:this.platform.size}),this.renderLoop=new _r({intervalMs:e.refreshRate??1e3/60,tick:()=>this.canvas.render()})}focus(){this.platform.input.focus?.()}start(){if(this.#e)return;this.#e=!0,this.platform.lifecycle.start(),this.platform.input.attach(this),this.#t=this.canvas.on(`render`,()=>this.emit(`render`));let e=()=>this.canvas.render();this.platform.size.subscribe(e),this.#n=()=>this.platform.size.unsubscribe(e),this.renderLoop.start()}stop(){this.#e&&(this.#e=!1,this.renderLoop.stop(),this.platform.input.detach(),this.platform.lifecycle.stop(),this.#t?.(),this.#t=void 0,this.#n?.(),this.#n=void 0)}destroy(){this.stop(),this.platform.dispose(),this.emit(`destroy`),this.off()}inspectHost(){return{running:this.#e,size:{...this.platform.size.peek()},renderLoop:this.renderLoop.inspect(),sink:this.sink.inspectSink()}}};function Oa(e){return new Da(e)}var F=[{id:`vhs`,label:`vhs — tape tremor, tracking, bleed`,options:[{key:`tracking`,label:`tracking`,min:0,max:1,step:.1,value:.3},{key:`noise`,label:`tape noise`,min:0,max:.5,step:.05,value:.1},{key:`bleed`,label:`chroma bleed`,min:0,max:3,step:.25,value:1}],body:`
      vec2 uv = fragCoord / iResolution.xy;
      float track = u_tracking * iMagnet * 2.0;
      float line = floor(fragCoord.y);
      // Per-line tremor, re-rolled at tape speed; the magnetized tube shakes
      // the transport harder.
      float wobble = (shaderHash(vec2(line, floor(iTime * 60.0))) - 0.5) * 0.0025 * (0.4 + track);
      // A tracking band rolls up the tube, shearing and lightening the tape.
      float band = fract(uv.y * 0.7 + iTime * 0.11);
      float inBand = smoothstep(0.0, 0.04, band) * (1.0 - smoothstep(0.05, 0.12, band));
      wobble += inBand * track * 0.03 * (shaderHash(vec2(line, floor(iTime * 24.0))) - 0.3);
      vec2 shifted = vec2(uv.x + wobble, uv.y);
      // Luma stays sharp; chroma smears sideways, the composite signature.
      float px = u_bleed * iMagnet * 2.0 / iResolution.x;
      vec3 color;
      color.r = sampleChannel(vec2(shifted.x + px * 1.5, shifted.y)).r;
      color.g = sampleChannel(shifted).g;
      color.b = sampleChannel(vec2(shifted.x - px * 1.5, shifted.y)).b;
      float sparkle = shaderHash(vec2(fragCoord.x * 0.37 + iTime * 91.0, line * 1.7 + iTime * 57.0));
      float grain = u_noise * iMagnet * 2.0 * (0.35 + inBand * 2.0);
      // The head-switch stripe lives at the bottom of the picture.
      if (uv.y < 0.025) grain += 0.5 * track;
      color += (sparkle - 0.5) * grain;
      fragColor = vec4(color, 1.0);
    `},{id:`crt`,label:`crt — curvature, vignette, fringe`,options:[{key:`curve`,label:`curvature`,min:0,max:.25,step:.02,value:.04},{key:`vignette`,label:`vignette`,min:0,max:.8,step:.05,value:.25},{key:`fringe`,label:`chroma fringe`,min:0,max:.004,step:4e-4,value:4e-4}],body:`
      vec2 uv = fragCoord / iResolution.xy;
      vec2 centered = uv * 2.0 - 1.0;
      // Tangent at the edge midpoints (r = 1): distortion vanishes there, so
      // the picture stays flush with its container where the eye lines up
      // rows, and only the corners pull in.
      centered *= 1.0 + u_curve * (dot(centered, centered) - 1.0);
      uv = (centered + 1.0) * 0.5;
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }
      vec3 color = sampleChannel(uv).rgb;
      float dim = max(0.0, 1.0 - u_vignette * iMagnet * 2.0 * pow(length(centered), 3.0));
      color *= dim;
      float fringe = u_fringe * iMagnet * 2.0;
      color.r = sampleChannel(uv + vec2(fringe, 0.0)).r * dim;
      color.b = sampleChannel(uv - vec2(fringe, 0.0)).b * dim;
      fragColor = vec4(color, 1.0);
    `},{id:`phosphor`,label:`phosphor — glow and persistence`,options:[{key:`glow`,label:`glow`,min:0,max:2,step:.15,value:.9}],body:`
      vec2 uv = fragCoord / iResolution.xy;
      vec3 color = sampleChannel(uv).rgb;
      vec3 glow = vec3(0.0);
      for (int x = -2; x <= 2; x++) {
        for (int y = -2; y <= 2; y++) {
          glow += sampleChannel(uv + vec2(float(x), float(y)) / iResolution.xy * 1.6).rgb;
        }
      }
      glow /= 25.0;
      color = color + glow * glow * u_glow * iMagnet * 2.0;
      color *= mix(vec3(1.0), vec3(0.94, 1.03, 0.96), min(1.0, iMagnet * 2.0));
      fragColor = vec4(color, 1.0);
    `},{id:`scanlines`,label:`scanlines — the raster's lines`,options:[{key:`strength`,label:`strength`,min:0,max:.5,step:.04,value:.14},{key:`period`,label:`spacing`,min:2,max:6,step:1,value:3}],body:`
      vec2 uv = fragCoord / iResolution.xy;
      vec3 color = sampleChannel(uv).rgb;
      float line = mod(fragCoord.y, u_period) < 1.0 ? max(0.0, 1.0 - u_strength * iMagnet * 2.0) : 1.0;
      fragColor = vec4(color * line, 1.0);
    `},{id:`degauss`,label:`degauss — the coil magnetizes`,options:[{key:`rate`,label:`drift rate`,min:.02,max:5,step:.02,value:.02}],body:`
      vec2 uv = fragCoord / iResolution.xy;
      float settle = exp(-2.6 * iThump);
      float wob = sin(iThump * 34.0 - uv.y * 9.0) * settle;
      vec2 centered = uv - 0.5;
      float radius = length(centered);
      float angle = wob * 0.10 * radius + iMagnet * 0.05 * sin(iTime * 0.4) * radius;
      mat2 rotate = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
      vec2 sheared = centered + vec2(iMagnet * 0.008 * sin(uv.y * 21.0 + iTime * 0.7), 0.0);
      vec2 shoved = clamp(0.5 + rotate * sheared * (1.0 + wob * 0.05), 0.0, 1.0);
      float fringe = settle * 0.010 * (0.3 + radius) + iMagnet * 0.004 * radius;
      vec3 color;
      color.r = sampleChannel(clamp(shoved + vec2(fringe * (0.4 + 0.6 * sin(iThump * 40.0)), 0.0), 0.0, 1.0)).r;
      color.g = sampleChannel(shoved).g;
      color.b = sampleChannel(clamp(shoved - vec2(fringe * (0.4 + 0.6 * sin(iThump * 47.0 + 1.0)), 0.0), 0.0, 1.0)).b;
      // The magnetized tube loses colour purity at the corners — the classic
      // green/purple stains, breathing slowly, gone the moment you degauss.
      float stain = iMagnet * smoothstep(0.32, 0.72, radius);
      float theta = atan(centered.y, centered.x) * 2.0 + iTime * 0.05;
      color *= 1.0 + stain * 0.45 * vec3(sin(theta), sin(theta + 2.1), sin(theta + 4.2));
      float sweep = 6.0 * radius - iThump * 20.0;
      color += 0.22 * settle * settle * vec3(sin(sweep), sin(sweep + 2.1), sin(sweep + 4.2));
      fragColor = vec4(color, 1.0);
    `}],ka=`#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;function Aa(e){return`#version 300 es
precision highp float;
uniform sampler2D iChannel0;
uniform vec2 iResolution;
uniform float iTime;
uniform float iFlip;
uniform float iMagnet;
uniform float iThump;
${(e.options??[]).map(e=>`uniform float u_${e.key};`).join(`
`)}
out vec4 outColor;
float shaderHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
vec4 sampleChannel(vec2 uv) {
  return texture(iChannel0, iFlip > 0.5 ? vec2(uv.x, 1.0 - uv.y) : uv);
}
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
${e.body}
}
void main() {
  mainImage(outColor, gl_FragCoord.xy);
}
`}function ja(e,t){let n=document.createElement(`canvas`);n.style.position=`absolute`,n.style.inset=`0`,n.style.width=`100%`,n.style.height=`100%`,n.style.pointerEvents=`none`,n.style.display=`none`,getComputedStyle(e).position===`static`&&(e.style.position=`relative`),e.appendChild(n);let r=null,i=null,a=new Map,o=[],s=``,c=new Set,l=new Map;for(let e of F)l.set(e.id,new Map((e.options??[]).map(e=>[e.key,e.value])));let u=0,d=-1/0,f=.02,p=0,m,h=performance.now(),g=()=>{u&&cancelAnimationFrame(u),u=0,n.style.display=`none`,t.style.visibility=`visible`},_=e=>{let t=e.createTexture();return e.bindTexture(e.TEXTURE_2D,t),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),t},v=()=>{if(r)return r;if(r=n.getContext(`webgl2`),!r)return null;let e=r,t=e.createBuffer();return e.bindBuffer(e.ARRAY_BUFFER,t),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),e.STATIC_DRAW),i=_(e),e},y=e=>{let t=a.get(e.id);if(t)return t;let n=v();if(!n)return;let r=(e,t)=>{let r=n.createShader(e);return r?(n.shaderSource(r,t),n.compileShader(r),n.getShaderParameter(r,n.COMPILE_STATUS)?r:null):null},i=r(n.VERTEX_SHADER,ka),o=r(n.FRAGMENT_SHADER,Aa(e));if(!i||!o)return;let s=n.createProgram();if(!s||(n.attachShader(s,i),n.attachShader(s,o),n.linkProgram(s),!n.getProgramParameter(s,n.LINK_STATUS)))return;let c=n.getAttribLocation(s,`position`);n.enableVertexAttribArray(c),n.vertexAttribPointer(c,2,n.FLOAT,!1,0,0);let l=new Map;for(let e of[`iChannel0`,`iResolution`,`iTime`,`iFlip`,`iMagnet`,`iThump`])l.set(e,n.getUniformLocation(s,e));for(let t of e.options??[])l.set(`u_${t.key}`,n.getUniformLocation(s,`u_${t.key}`));let u={program:s,uniforms:l};return a.set(e.id,u),u},b=(e,t,n)=>{let r=`${t}x${n}`;if(!(s===r&&o.length===2)){for(s=r;o.length<2;)o.push({texture:_(e),framebuffer:e.createFramebuffer()});for(let r of o)e.bindTexture(e.TEXTURE_2D,r.texture),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,t,n,0,e.RGBA,e.UNSIGNED_BYTE,null),e.bindFramebuffer(e.FRAMEBUFFER,r.framebuffer),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,r.texture,0);e.bindFramebuffer(e.FRAMEBUFFER,null)}},x=()=>{try{if(m??=new AudioContext,m.resume().catch(()=>{}),m.state!==`running`)return;let e=m.currentTime,t=m.createGain();t.gain.setValueAtTime(.5,e),t.gain.exponentialRampToValueAtTime(5e-4,e+1.2),t.connect(m.destination);let n=m.createOscillator();n.type=`sine`,n.frequency.setValueAtTime(130,e),n.frequency.exponentialRampToValueAtTime(32,e+.5),n.connect(t),n.start(e),n.stop(e+1.2);let r=m.createOscillator();r.type=`sawtooth`,r.frequency.value=50;let i=m.createGain();i.gain.setValueAtTime(.06,e),i.gain.exponentialRampToValueAtTime(5e-4,e+.9),r.connect(i),i.connect(t),r.start(e),r.stop(e+1);let a=m.createBufferSource(),o=m.createBuffer(1,Math.floor(m.sampleRate*.4),m.sampleRate),s=o.getChannelData(0);for(let e=0;e<s.length;e+=1)s[e]=(Math.random()*2-1)*(1-e/s.length);a.buffer=o;let c=m.createBiquadFilter();c.type=`lowpass`,c.frequency.value=900;let l=m.createGain();l.gain.value=.18,a.connect(c),c.connect(l),l.connect(t),a.start(e)}catch{}},S=()=>F.filter(e=>c.has(e.id)&&y(e)!==void 0),C=()=>{let e=S(),s=performance.now(),m=(s-d)/1e3,_=p?Math.min(.25,(s-p)/1e3):0;if(p=s,c.has(`degauss`)){let e=l.get(`degauss`)?.get(`rate`)??1;f=Math.min(1,f+_*e/300)}if(e.length===0){if(m>=1.3){g();return}let t=F.find(e=>e.id===`degauss`);t&&y(t)&&e.push(t)}if(!r||e.length===0)return;let v=r;(n.width!==t.width||n.height!==t.height)&&(n.width=t.width,n.height=t.height),v.viewport(0,0,n.width,n.height),b(v,n.width,n.height),v.activeTexture(v.TEXTURE0),v.bindTexture(v.TEXTURE_2D,i);try{v.texImage2D(v.TEXTURE_2D,0,v.RGBA,v.RGBA,v.UNSIGNED_BYTE,t)}catch{u=requestAnimationFrame(C);return}let x=(performance.now()-h)/1e3,w=i;for(let t=0;t<e.length;t+=1){let r=e[t],i=a.get(r.id),s=t===e.length-1?null:o[t%2];v.bindFramebuffer(v.FRAMEBUFFER,s?s.framebuffer:null),v.useProgram(i.program),v.bindTexture(v.TEXTURE_2D,w),v.uniform2f(i.uniforms.get(`iResolution`)??null,n.width,n.height),v.uniform1f(i.uniforms.get(`iTime`)??null,x),v.uniform1i(i.uniforms.get(`iChannel0`)??null,0),v.uniform1f(i.uniforms.get(`iFlip`)??null,+(t===0)),v.uniform1f(i.uniforms.get(`iMagnet`)??null,f),v.uniform1f(i.uniforms.get(`iThump`)??null,Math.min(m,60));let c=l.get(r.id);for(let e of r.options??[])v.uniform1f(i.uniforms.get(`u_${e.key}`)??null,c?.get(e.key)??e.value);v.drawArrays(v.TRIANGLES,0,3),s&&(w=s.texture)}u=requestAnimationFrame(C)},w=()=>{if(S().length===0){c.clear(),g();return}n.style.display=`block`,t.style.visibility=`hidden`,u||=requestAnimationFrame(C)};return{list:()=>F,enabled:()=>F.filter(e=>c.has(e.id)).map(e=>e.id),toggle(e){c.has(e)?c.delete(e):F.some(t=>t.id===e)&&c.add(e),w()},setEnabled(e){c.clear();for(let t of e)F.some(e=>e.id===t)&&c.add(t);w()},option:(e,t)=>l.get(e)?.get(t),magnetism:()=>f,warpPoint(e,t){if(!u)return{u:e,v:t};let n=e=>Math.min(1,Math.max(0,e)),r=n(e),i=1-n(t);if(c.has(`degauss`)){let e=(performance.now()-h)/1e3,t=Math.min((performance.now()-d)/1e3,60),a=Math.exp(-2.6*t),o=Math.sin(t*34-i*9)*a,s=r-.5,c=i-.5,l=Math.hypot(s,c),u=o*.1*l+f*.05*Math.sin(e*.4)*l,p=Math.cos(u),m=Math.sin(u),g=s+f*.008*Math.sin(i*21+e*.7),_=1+o*.05;r=n(.5+(p*g+m*c)*_),i=n(.5+(-m*g+p*c)*_)}let a=l.get(`crt`)?.get(`curve`)??0;if(c.has(`crt`)&&a!==0){let e=r*2-1,t=i*2-1,n=1+a*(e*e+t*t-1);r=(e*n+1)/2,i=(t*n+1)/2}return{u:r,v:1-i}},degauss(){f=.02;let e=F.find(e=>e.id===`degauss`);!e||!y(e)||(d=performance.now(),x(),n.style.display=`block`,t.style.visibility=`hidden`,u||=requestAnimationFrame(C))},setOption(e,t,n){let r=F.find(t=>t.id===e)?.options?.find(e=>e.key===t);r&&l.get(e)?.set(t,Math.min(r.max,Math.max(r.min,n)))},dispose(){g(),m?.close().catch(()=>{}),m=void 0,n.remove()}}}function Ma(e){let t=Oa({root:e.root,sinkOptions:{cellWidth:9,cellHeight:18,font:`14px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`,...e.host?.sinkOptions??{}},...e.host??{}}),r=()=>t.platform.size.peek().columns,i=()=>t.platform.size.peek().rows,a=[],o=()=>{for(let e=a.length;e<i();e+=1){let n=new C(``),r=e;a.push(n),new mn({canvas:t.canvas,rectangle:new ee(()=>({column:0,row:r,width:t.platform.size.value.columns})),value:n,overwriteRectangle:!0,multiCodePointSupport:!0,style:e=>e,zIndex:1}).draw()}};o();let s={gpu:typeof navigator<`u`&&navigator.gpu!==void 0,audioInput:typeof navigator<`u`&&navigator.mediaDevices!==void 0,extras:e.extras},c=new Map,l=!1,u=e=>e.preventDefault();e.root.addEventListener(`contextmenu`,u);let d=ja(e.root,t.element),f=(e,n)=>{let r=t.platform.size.peek(),i=d.warpPoint((e+.5)/r.columns,(n+.5)/r.rows);return{x:Math.min(r.columns-1,Math.max(0,Math.floor(i.u*r.columns))),y:Math.min(r.rows-1,Math.max(0,Math.floor(i.v*r.rows)))}},p=e=>{let t=e.coordinates.cell;if(!t)return e;let n=f(t.x,t.y);return n.x===t.x&&n.y===t.y?e:{...e,coordinates:{...e.coordinates,cell:{...t,x:n.x,y:n.y}}}};return t.start(),{host:t,shader:d,focus:()=>t.focus(),capabilities:s,size:()=>({columns:r(),rows:i()}),onResize(e){let n=()=>{o(),e({columns:r(),rows:i()})};return t.platform.size.subscribe(n),()=>t.platform.size.unsubscribe(n)},onKey(e){let n=t=>e(t);return t.on(`keyPress`,n),()=>t.off(`keyPress`,n)},onPointer(e){let n=t=>e(p(t));return t.on(`pointerInput`,n),()=>t.off(`pointerInput`,n)},onWheel(e){let n=t=>{let n=f(t.x,t.y);e(n.x===t.x&&n.y===t.y?t:{...t,x:n.x,y:n.y})};return t.on(`mouseScroll`,n),()=>t.off(`mouseScroll`,n)},present(e){o();let t=i();for(let r=0;r<t;r+=1){let t=e[r];a[r]&&(a[r].value=t?n(t):``)}for(let e=t;e<a.length;e+=1)a[e].value=``},requestFrame(e){requestAnimationFrame(e)},store(t){let n=c.get(t);if(!n){try{n=new Sn({databaseName:e.storeDatabase??`exotui`,storeName:t})}catch{n=new xn}c.set(t,n)}return n},now:()=>performance.now(),dispose(){l||(l=!0,e.root.removeEventListener(`contextmenu`,u),d.dispose(),t.destroy())}}}function Na(e){return{column:Math.floor(e.column),row:Math.floor(e.row),width:Math.max(0,Math.floor(e.width)),height:Math.max(0,Math.floor(e.height))}}function Pa(e,t,n,r,i){e.column=t,e.row=n,e.width=r,e.height=i}var Fa=class{state;gap;#e;#t;#n=1;#r=new Map;constructor(e={}){let t=Va(e.layout??{});this.#t=new Ia(jo(e.gap)),this.gap=this.#t;let n=e.windows===void 0?Ja(t,e.activeWindowId):Ha(t,e.windows,{activeWindowId:e.activeWindowId});this.#e=new La(n,(e,t)=>{this.#a(e,t)}),this.state=this.#e,this.#i(this.state.peek())}windowIds(){return uo(this.state.peek().root).map(e=>e.windowId)}windowRegistrationGeneration(e){return this.#r.get(e)}reconcile(e,t={}){let n=Ha(this.state.peek(),e,t);return this.#i(n),this.#o(n),this.inspect()}focus(e){let t=mo(this.state.peek().root,e);return!t||this.state.peek().activePaneId===t.id?t!==void 0:(this.#o({...this.state.peek(),activePaneId:t.id}),!0)}activatePane(e){let t=po(this.state.peek().root,e);return!t||this.state.peek().activePaneId===t.id?t!==void 0:(this.#o({...this.state.peek(),activePaneId:t.id}),!0)}remove(e){let t=this.state.peek(),n=mo(t.root,e);if(!n)return!1;let r=io(t.root,n.id),i={root:r,activePaneId:(t.activePaneId?po(r,t.activePaneId):void 0)?.id??_o(r)?.id};return this.#i(i),this.#o(i),!0}move(e,t){if(!Number.isFinite(t)||Math.trunc(t)===0)return!1;let n=this.state.peek(),r=uo(n.root),i=r.findIndex(t=>t.windowId===e);if(i<0||r.length<2)return!1;let a=Math.max(0,Math.min(r.length-1,i+Math.trunc(t)));if(a===i)return!1;let o=r[i],s=[...r];return s.splice(i,1),s.splice(a,0,o),this.#o({root:so(n.root,s,{value:0}),activePaneId:o.id}),!0}swap(e,t){if(e===t)return!1;let n=this.state.peek(),r=mo(n.root,e),i=mo(n.root,t);return!r||!i?!1:(this.#o({root:oo(n.root,r.id,i.id),activePaneId:r.id}),!0)}dock(e,t,n,r={}){if(e===t)return!1;let i=this.state.peek(),a=mo(i.root,e),o=mo(i.root,t);if(!a||!o)return!1;let s=io(i.root,a.id),c=po(s,o.id);if(!s||!c)return!1;let l=n===`left`||n===`top`,u=No(r.ratio??.5),d={kind:`split`,id:To(`split`,s),direction:n===`left`||n===`right`?`row`:`column`,ratio:l?u:1-u,first:So(l?a:c),second:So(l?c:a)};return this.#o({root:ao(s,c.id,d),activePaneId:a.id}),!0}setSplitRatio(e,t){let n=this.state.peek(),r=No(t),i=lo(n.root,e,r);return i.changed?(this.#o({...n,root:i.node}),!0):!1}resizeSplitRatio(e,t){let n=ho(this.state.peek().root,e);return!n||!Number.isFinite(t)||t===0?!1:this.setSplitRatio(e,n.ratio+t)}resizeSplit(e,t,n,r={}){if(!Number.isFinite(t)||Math.trunc(t)===0)return!1;let i=this.layout(n,r).separators.find(t=>t.splitId===e),a=ho(Ga(this.state.peek(),r.visibleWindowIds).root,e);if(!i||!a)return!1;let o=a.direction===`row`?i.firstRect.width+i.secondRect.width:i.firstRect.height+i.secondRect.height;if(o<=0)return!1;let s=a.direction===`row`?i.firstRect.width:i.firstRect.height,c=Ua(a.first,r.gap??this.gap.peek()),l=Ua(a.second,r.gap??this.gap.peek()),u=ro(o,s+Math.trunc(t),a.direction===`row`?c.width:c.height,a.direction===`row`?l.width:l.height);return u===s?!1:this.setSplitRatio(e,u/o)}layout(e,t={}){return Wa(this.state.peek(),e,{...t,gap:t.gap??this.gap.peek()})}inspect(){let e=bo(this.state.peek()),t=uo(e.root),n=e.activePaneId?po(e.root,e.activePaneId):void 0;return{layout:e,activePaneId:n?.id,activeWindowId:n?.windowId,windows:t.map(yo),count:t.length}}snapshot(){return Ba({version:1,gap:this.gap.peek(),layout:this.state.peek()})}restore(e,t){let n=Ba(e),r=t===void 0?n.layout:Ha(n.layout,t);this.#i(r);let i=this.gap.peek(),a=this.#t.externalMutationRevision;this.#t.jinkOwned(n.gap);try{this.#o(r)}finally{i!==n.gap&&this.#t.externalMutationRevision===a&&this.gap.peek()===n.gap&&this.gap.propagate()}return this.inspect()}dispose(){this.#r.clear(),this.state.dispose(),this.gap.dispose()}#i(e){let t=new Set(uo(e.root).map(e=>e.windowId));for(let e of[...this.#r.keys()])t.has(e)||this.#r.delete(e);for(let e of t)if(!this.#r.has(e)){if(!Number.isSafeInteger(this.#n))throw RangeError(`Tiled workspace registration generation space exhausted.`);this.#r.set(e,this.#n++)}}#a(e,t){let n=new Map(this.#r),r=this.#n;for(let e of[...n.keys()])t.byId.has(e)||n.delete(e);for(let[i,a]of t.byId)if(!(e.byId.get(i)===a&&n.has(i))){if(!Number.isSafeInteger(r))throw RangeError(`Tiled workspace registration generation space exhausted.`);n.set(i,r++)}this.#r=n,this.#n=r}#o(e){this.#e.publishOwned(e)}},Ia=class extends C{#e=0;get value(){return super.value}set value(e){this.#t(),super.value=e}jink(e){this.#t(),super.jink(e)}get externalMutationRevision(){return this.#e}jinkOwned(e){super.jink(e)}#t(){this.#e=this.#e===2**53-1?0:this.#e+1}},La=class extends C{#e;#t=new WeakMap;#n;constructor(e,t){super(e),this.#e=t,this.$value=this.#r(e),this.#n=Ra(this.peek())}get value(){return super.value}set value(e){let t=this.#r(e),n=Ra(t);this.#e(this.#n,n),this.#n=n;try{super.value=t}finally{this.#n=Ra(this.peek())}}jink(e){let t=this.#r(e),n=Ra(t);this.#e(this.#n,n),this.#n=n,super.jink(t)}propagate(){try{this.#i(this.peek());let e=Ra(this.peek());this.#e(this.#n,e),this.#n=e}catch(e){let t=this.#r(this.#n.rollback);throw super.jink(t),this.#n=Ra(t),e}super.propagate()}publishOwned(e){let t=this.#r(e);this.#n=Ra(t);try{super.value=t}finally{this.#n=Ra(this.peek())}}#r(e){if(this.#t.get(e))return this.#i(e),e;let t={...e};t.root&&=this.#a(t.root);let n=m(t,this,!0);return this.#t.set(n,t),n}#i(e){if(!e.root)return;let t=this.#t.get(e)??e;t.root=this.#a(e.root)}#a(e){let t=this.#t.get(e);if(t){if(e.kind===`split`){let n=t;n.first=this.#a(e.first),n.second=this.#a(e.second)}return e}let n={...e};n.kind===`split`&&(n.first=this.#a(n.first),n.second=this.#a(n.second));let r=m(n,this);return this.#t.set(r,n),r}};function Ra(e){let t=uo(e.root),n=new Map;for(let e of t){let t=Do(e.windowId);if(!t||t!==e.windowId)throw TypeError(`Tiled workspace pane window ids must be non-empty normalized strings.`);if(n.has(t))throw TypeError(`Tiled workspace contains duplicate window id ${JSON.stringify(t)}.`);n.set(t,e)}return{byId:n,rollback:bo(e)}}function za(e={}){return new Fa(e)}function Ba(e){return{version:1,gap:jo(e.gap),layout:Va(e.layout)}}function Va(e={},t,n={}){let r=new Set,i=new Set,a=Ya(e.root,r,i),o={root:a,activePaneId:e.activePaneId&&po(a,e.activePaneId)?e.activePaneId:_o(a)?.id};return t===void 0?Ja(o,n.activeWindowId):qa(o,t,n)}function Ha(e,t,n={}){return qa(Va(e),t,n)}function Ua(e,t=1){if(!e)return{width:0,height:0};if(e.kind===`pane`)return{width:Ao(e.minWidth),height:Ao(e.minHeight)};let n=Ua(e.first,t),r=Ua(e.second,t),i=jo(t);return e.direction===`row`?{width:n.width+i+r.width,height:Math.max(n.height,r.height)}:{width:Math.max(n.width,r.width),height:n.height+i+r.height}}function Wa(e,t,n={}){let r=Ga(e,n.visibleWindowIds),i=Na(t),a=jo(n.gap),o=Ua(r.root,a),s=r.activePaneId?po(r.root,r.activePaneId):void 0,c={bounds:Co(i),minimumSize:o,fitsMinimumSize:i.width>=o.width&&i.height>=o.height,activePaneId:s?.id,activeWindowId:s?.windowId,panes:[],separators:[]};return r.root&&eo(r.root,i,a,Mo(n.separatorHitSize),r.activePaneId,c),c}function Ga(e,t){let n=Va(e);if(t===void 0)return n;let r=new Set;for(let e of t){let t=Do(e);t&&r.add(t)}let i=Ka(n.root,r);return{root:i,activePaneId:(n.activePaneId?po(i,n.activePaneId):void 0)?.id??_o(i)?.id}}function Ka(e,t){if(!e)return;if(e.kind===`pane`)return t.has(e.windowId)?So(e):void 0;let n=Ka(e.first,t),r=Ka(e.second,t);return!n||!r?n??r:{...e,first:n,second:r}}function qa(e,t,n){let r=Xa(t),i=new Map(r.map(e=>[e.id,e])),a=Za(e.root,i,new Set),o=new Set(uo(a).map(e=>e.windowId)),s=r.filter(e=>!o.has(e.id));if(!a&&s.length>0)a=Qa(s,0,{value:1});else for(let e of s)a=$a(a,vo(e));a=Ya(a,new Set,new Set);let c=n.activeWindowId?mo(a,n.activeWindowId):void 0,l=e.activePaneId?po(a,e.activePaneId):void 0;return{root:a,activePaneId:c?.id??l?.id??_o(a)?.id}}function Ja(e,t){let n=t?mo(e.root,t):void 0,r=e.activePaneId?po(e.root,e.activePaneId):void 0;return{root:e.root?xo(e.root):void 0,activePaneId:n?.id??r?.id??_o(e.root)?.id}}function Ya(e,t,n){if(!e||e.kind!==`pane`&&e.kind!==`split`)return;if(e.kind===`pane`){let r=Do(e.windowId);return!r||n.has(r)?void 0:(n.add(r),{kind:`pane`,id:wo(Do(e.id)||`pane-${Oo(r)}`,t),windowId:r,minWidth:ko(e.minWidth),minHeight:ko(e.minHeight)})}let r=Ya(e.first,t,n),i=Ya(e.second,t,n);return!r||!i?r??i:{kind:`split`,id:wo(Do(e.id)||`split`,t),direction:e.direction===`column`?`column`:`row`,ratio:No(e.ratio),first:r,second:i}}function Xa(e){let t=[],n=new Set;for(let r of e){let e=Do(r.id);!e||n.has(e)||(n.add(e),t.push({id:e,minWidth:ko(r.minWidth),minHeight:ko(r.minHeight)}))}return t}function Za(e,t,n){if(!e)return;if(e.kind===`pane`){let r=t.get(e.windowId);return!r||n.has(r.id)?void 0:(n.add(r.id),{...So(e),minWidth:r.minWidth,minHeight:r.minHeight})}let r=Za(e.first,t,n),i=Za(e.second,t,n);return!r||!i?r??i:{...e,first:r,second:i}}function Qa(e,t,n){if(e.length===1)return vo(e[0]);let r=Math.ceil(e.length/2),i=Qa(e.slice(0,r),t+1,n),a=Qa(e.slice(r),t+1,n),o=`split-${n.value}`;return n.value+=1,{kind:`split`,id:o,direction:t%2==0?`row`:`column`,ratio:r/e.length,first:i,second:a}}function $a(e,t){if(!e)return t;let n=uo(e).at(-1),r=go(e,n.id),i={kind:`split`,id:To(`split`,e),direction:r?.direction===`row`?`column`:`row`,ratio:.5,first:So(n),second:t};return ao(e,n.id,i)}function eo(e,t,n,r,i,a){if(e.kind===`pane`){a.panes.push({pane:So(e),windowId:e.windowId,rect:Co(t),active:e.id===i});return}let o=to(e,t,n,r);a.separators.push(o),eo(e.first,o.firstRect,n,r,i,a),eo(e.second,o.secondRect,n,r,i,a)}function to(e,t,n,r){let i=e.direction===`row`?t.width:t.height,a=Math.min(n,Math.max(0,i-1)),o=Math.max(0,i-a),s=Ua(e.first,n),c=Ua(e.second,n),l=ro(o,Math.floor(o*e.ratio),e.direction===`row`?s.width:s.height,e.direction===`row`?c.width:c.height),u=Math.max(0,o-l),d,f,p;return e.direction===`row`?(d={...t,width:l},f={column:t.column+l,row:t.row,width:a,height:t.height},p={column:f.column+a,row:t.row,width:u,height:t.height}):(d={...t,height:l},f={column:t.column,row:t.row+l,width:t.width,height:a},p={column:t.column,row:f.row+a,width:t.width,height:u}),{splitId:e.id,direction:e.direction,axis:e.direction===`row`?`column`:`row`,ratio:o<=0?0:l/o,bounds:Co(t),firstRect:d,rect:f,hitRect:no(t,f,e.direction,r),secondRect:p}}function no(e,t,n,r){if(n===`row`){let n=Math.min(e.width,Math.max(t.width,r));if(n<=0)return{column:e.column,row:e.row,width:0,height:e.height};let i=t.column+t.width/2;return{column:Math.max(e.column,Math.min(e.column+e.width-n,Math.floor(i-n/2))),row:e.row,width:n,height:e.height}}let i=Math.min(e.height,Math.max(t.height,r));if(i<=0)return{column:e.column,row:e.row,width:e.width,height:0};let a=t.row+t.height/2,o=Math.max(e.row,Math.min(e.row+e.height-i,Math.floor(a-i/2)));return{column:e.column,row:o,width:e.width,height:i}}function ro(e,t,n,r){if(e<=0)return 0;let i=Math.max(0,Math.floor(n)),a=Math.max(0,Math.floor(r));if(i+a<=e)return Math.max(i,Math.min(e-a,Math.floor(t)));let o=i+a;return o<=0?Math.max(0,Math.min(e,Math.floor(t))):Math.max(0,Math.min(e,Math.round(e*i/o)))}function io(e,t){if(!e)return;if(e.kind===`pane`)return e.id===t?void 0:So(e);let n=io(e.first,t),r=io(e.second,t);return!n||!r?n??r:{...e,first:n,second:r}}function ao(e,t,n){return e.kind===`pane`?e.id===t?xo(n):So(e):{...e,first:ao(e.first,t,n),second:ao(e.second,t,n)}}function oo(e,t,n){if(!e)return;let r=po(e,t),i=po(e,n);return!r||!i?xo(e):co(e,r,i)}function so(e,t,n){if(e){if(e.kind===`pane`){let r=t[n.value];return n.value+=1,So(r||e)}return{...e,first:so(e.first,t,n)??xo(e.first),second:so(e.second,t,n)??xo(e.second)}}}function co(e,t,n){return e.kind===`pane`?e.id===t.id?So(n):e.id===n.id?So(t):So(e):{...e,first:co(e.first,t,n),second:co(e.second,t,n)}}function lo(e,t,n){if(!e||e.kind===`pane`)return{node:e,changed:!1};if(e.id===t)return e.ratio===n?{node:xo(e),changed:!1}:{node:{...e,ratio:n},changed:!0};let r=lo(e.first,t,n);if(r.changed)return{node:{...e,first:r.node??e.first},changed:!0};let i=lo(e.second,t,n);return i.changed?{node:{...e,second:i.node??e.second},changed:!0}:{node:xo(e),changed:!1}}function uo(e){let t=[];return fo(e,t),t}function fo(e,t){if(e){if(e.kind===`pane`){t.push(e);return}fo(e.first,t),fo(e.second,t)}}function po(e,t){if(e)return e.kind===`pane`?e.id===t?e:void 0:po(e.first,t)??po(e.second,t)}function mo(e,t){if(e)return e.kind===`pane`?e.windowId===t?e:void 0:mo(e.first,t)??mo(e.second,t)}function ho(e,t){if(!(!e||e.kind===`pane`))return e.id===t?e:ho(e.first,t)??ho(e.second,t)}function go(e,t){if(!(!e||e.kind===`pane`))return e.first.kind===`pane`&&e.first.id===t||e.second.kind===`pane`&&e.second.id===t?e:go(e.first,t)??go(e.second,t)}function _o(e){if(e)return e.kind===`pane`?e:_o(e.first)}function vo(e){return{kind:`pane`,id:`pane-${Oo(e.id)}`,windowId:e.id,minWidth:e.minWidth,minHeight:e.minHeight}}function yo(e){return{id:e.windowId,minWidth:e.minWidth,minHeight:e.minHeight}}function bo(e){return{root:e.root?xo(e.root):void 0,activePaneId:e.activePaneId}}function xo(e){return e.kind===`pane`?So(e):{kind:`split`,id:e.id,direction:e.direction,ratio:e.ratio,first:xo(e.first),second:xo(e.second)}}function So(e){return{kind:`pane`,id:e.id,windowId:e.windowId,minWidth:e.minWidth,minHeight:e.minHeight}}function Co(e){return{column:e.column,row:e.row,width:e.width,height:e.height}}function wo(e,t){let n=e,r=2;for(;t.has(n);)n=`${e}-${r}`,r+=1;return t.add(n),n}function To(e,t){let n=new Set;return Eo(t,n),wo(e,n)}function Eo(e,t){e&&(t.add(e.id),e.kind===`split`&&(Eo(e.first,t),Eo(e.second,t)))}function Do(e){return typeof e==`string`?e.trim():``}function Oo(e){return e.toLowerCase().replace(/[^a-z0-9]+/g,`-`).replace(/^-|-$/g,``)||`window`}function ko(e){return Number.isFinite(e)?Math.max(1,Math.floor(e)):void 0}function Ao(e){return ko(e)??1}function jo(e){return Number.isFinite(e)?Math.max(0,Math.floor(e)):1}function Mo(e){return Number.isFinite(e)?Math.max(1,Math.floor(e)):1}function No(e){return Number.isFinite(e)?Math.max(.05,Math.min(.95,e)):.5}var Po=class extends Error{code;cause;constructor(e,t,n){super(t),this.code=e,this.cause=n,this.name=`HistoryStackError`}},Fo=class extends Po{operation;activeOperation;constructor(e,t){super(`busy`,t?`History ${e} is blocked while ${t} is active.`:`History ${e} is blocked by an active transaction.`),this.operation=e,this.activeOperation=t,this.name=`HistoryBusyError`}},Io=class extends Po{constructor(e){super(`scope-closed`,e),this.name=`HistoryScopeError`}},Lo=class extends Po{failure;poisoned;constructor(e,t,n){super(t?`poisoned`:`operation-failed`,t?`History ${e.phase} failed and compensation could not restore a known state.`:`History ${e.phase} failed; compensation restored the prior state.`,n),this.failure=e,this.poisoned=t,this.name=`HistoryOperationError`}},Ro=class extends Po{entry;constructor(e,t){super(`transaction-aborted`,`History transaction "${e.label}" was rolled back.`,t),this.entry=e,this.name=`HistoryTransactionAbortedError`}},zo=class extends Po{poison;constructor(e,t){super(`poisoned`,`History is poisoned; call clear() or recoverPoison() before further mutation.`,t),this.poison=e,this.name=`HistoryPoisonedError`}},Bo=class extends Po{entry;constructor(e,t){super(`unsafe-replay`,`History entry "${e.label}" has an unsafe replay declaration: ${t}.`),this.entry=e,this.name=`HistoryReplaySafetyError`}},Vo=Symbol(`HistoryStack.composite`),Ho=Symbol(`HistoryStack.coalesced`),Uo=class{#e=[];#t=[];#n;#r;#i=new WeakMap;#a=[];#o;#s;#c=0;#l=0;#u;constructor(e={}){this.#n=Math.max(1,Math.floor(e.capacity??100)),this.#r=qo(e.coalescing)}get undoDepth(){return this.#e.length}get redoDepth(){return this.#t.length}canUndo(){return!this.#s&&!this.#o&&this.#a.length===0&&this.#e.length>0}canRedo(){return!this.#s&&!this.#o&&this.#a.length===0&&this.#t.length>0}push(e){this.#m(`push`),this.#d(Xo(e))}async apply(e){this.#m(`apply`);let t=Xo(e);this.#o=`apply`;try{await this.#M(t,`redo`,`apply`),this.#d(t)}finally{this.#o=void 0}}async undo(){this.#m(`undo`);let e=this.#e.at(-1);if(!e)return!1;this.#o=`undo`;try{await this.#M(e,`undo`,`undo`)}finally{this.#o=void 0}return this.#e.pop(),this.#t.push(e),this.#p(),!0}async redo(){this.#m(`redo`);let e=this.#t.at(-1);if(!e)return!1;this.#o=`redo`;try{await this.#M(e,`redo`,`redo`)}finally{this.#o=void 0}return this.#t.pop(),this.#e.push(e),this.#p(),!0}markCoalescingBoundary(){this.#m(`markCoalescingBoundary`),this.#p()}async transaction(e,t){return this.#m(`transaction`),await this.#v(void 0,e,t)}transactionSync(e,t){return this.#m(`transactionSync`),this.#b(void 0,e,t)}clear(){this.#h(`clear`),this.#e.length=0,this.#t.length=0,this.#s=void 0,this.#u=void 0,this.#p()}recoverPoison(e){if(this.#h(`recoverPoison`),e!==`clear-history`&&e!==`retain-history`)throw TypeError(`Unknown history poison recovery policy: ${String(e)}`);return this.#s?(e===`clear-history`&&(this.#e.length=0,this.#t.length=0,this.#u=void 0),this.#s=void 0,this.#p(),!0):!1}isPoisoned(){return this.#s!==void 0}inspect(){let e={canUndo:this.canUndo(),canRedo:this.canRedo(),undoDepth:this.undoDepth,redoDepth:this.redoDepth,nextUndo:Wo(this.#e.at(-1)),nextRedo:Wo(this.#t.at(-1))},t=this.#a.at(-1);if(t){let n={...Go(t.options),mode:t.mode,depth:this.#a.length,entryCount:t.entries.length};t.discardRequested&&(n.discardRequested=!0),e.transaction=n}return this.#o&&(e.operation=this.#o),this.#s&&(e.poisoned=ds(this.#s)),this.#u&&(e.replayBarrier=fs(this.#u)),e}#d(e){if(ns(e)){this.#f(e);return}let t=this.#t.length>0,n=e.coalesce,r=n&&this.#r?ps(this.#r.now):void 0,i=this.#e.at(-1),a=i?this.#i.get(i):void 0,o=e;for(!t&&n&&r!==void 0&&i&&a&&a.key===n.key&&a.boundary===n.boundary&&a.boundarySequence===this.#c&&i.group===e.group&&r>=a.committedAt&&r-a.committedAt<=this.#r.idleIntervalMs?(o=es(i,e),this.#e[this.#e.length-1]=o):this.#e.push(o),n&&r!==void 0&&this.#i.set(o,{...n,boundarySequence:this.#c,committedAt:r});this.#e.length>this.#n;)this.#e.shift();this.#t.length=0}#f(e){this.#e.length=0,this.#t.length=0;let t=Wo(e);t.replaySafety=`non-replayable`,this.#u={sequence:++this.#l,entry:t},this.#p()}#p(){this.#c+=1}#m(e){if(this.#s)throw new zo(ds(this.#s));if(this.#o)throw new Fo(e,this.#o);if(this.#a.length>0)throw new Fo(e)}#h(e){if(this.#o)throw new Fo(e,this.#o);if(this.#a.length>0)throw new Fo(e)}#g(e,t){if(this.#s)throw new zo(ds(this.#s));if(e.state!==`active`||this.#a.at(-1)!==e)throw new Io(`Cannot ${t}: the transaction scope is closed or not current.`);if(e.discardRequested)throw new Io(`Cannot ${t}: the transaction scope is marked for discard.`);if(this.#o)throw new Fo(t,this.#o)}#_(e){if(e.state!==`active`||this.#a.at(-1)!==e)throw new Io(`Cannot discard: the transaction scope is closed or not current.`);if(!e.discardRequested){if(this.#o)throw new Fo(`discard`,this.#o);e.discardRequested=!0}}async#v(e,t,n){e&&this.#g(e,`start a nested transaction`);let r=this.#x(e,t,`async`),i=this.#S(r),a,o;try{a=await n(i)}catch(e){o=e}let s=await this.#y(r);if(o===void 0&&s!==void 0&&(o=s),o===void 0&&this.#s&&(o=new zo(ds(this.#s))),o!==void 0&&await this.#E(r,o),r.discardRequested)return await this.#D(r),a;try{this.#T(r)}catch(e){throw r.state===`active`&&this.#a.at(-1)===r&&await this.#E(r,e),e}return a}async#y(e){let t,n=!1;for(;;){let r=[...e.pendingTasks];if(r.length===0){if(n)return t;n=!0,await Promise.resolve();continue}n=!1;let i=await Promise.allSettled(r.map(e=>e.promise));for(let n=0;n<r.length;n+=1){let a=r[n];e.pendingTasks.delete(a);let o=i[n];t===void 0&&o.status===`rejected`&&!a.observed&&(t=o.reason)}}}#b(e,t,n){e&&this.#g(e,`start a nested synchronous transaction`);let r=this.#x(e,t,`sync`),i=this.#w(r),a;try{if(a=n(i),ms(a))throw Promise.resolve(a).catch(gs),new Io(`transactionSync callback returned a promise; use transaction() instead.`)}catch(e){this.#O(r,e)}return this.#s&&this.#O(r,new zo(ds(this.#s))),r.discardRequested?(this.#k(r),a):(this.#T(r),a)}#x(e,t,n){let r={options:Ko(t),mode:n,parent:e,entries:[],pendingTasks:new Set,discardRequested:!1,state:`active`};return this.#a.push(r),r}#S(e){return Object.freeze({depth:this.#a.length,entry:Go(e.options),get discarded(){return e.discardRequested},push:t=>{this.#g(e,`push`),e.entries.push(Xo(t))},apply:t=>ss(e,this.#C(e,t)),discard:()=>{this.#_(e)},transaction:(t,n)=>(this.#g(e,`start a nested transaction`),ss(e,this.#v(e,t,n))),transactionSync:(t,n)=>this.#b(e,t,n)})}async#C(e,t){this.#g(e,`apply`);let n=Xo(t);this.#o=`transaction-apply`;try{await this.#M(n,`redo`,`transaction-apply`),e.entries.push(n)}finally{this.#o=void 0}}#w(e){return Object.freeze({depth:this.#a.length,entry:Go(e.options),get discarded(){return e.discardRequested},push:t=>{this.#g(e,`push`),e.entries.push(Xo(t))},apply:t=>{this.#g(e,`apply`);let n=Xo(t);this.#o=`transaction-apply`;try{this.#N(n,`redo`,`transaction-apply`),e.entries.push(n)}finally{this.#o=void 0}},discard:()=>{this.#_(e)},transaction:(t,n)=>this.#b(e,t,n)})}#T(e){if(this.#g(e,`commit`),e.entries.length===0&&e.options.replaySafety?.strategy!==`non-replayable`){this.#j(e);return}let t=Qo(e.options,e.entries);e.parent?e.parent.entries.push(t):this.#d(t),this.#j(e)}async#E(e,t){throw await this.#D(e,t),new Ro(Go(e.options),t)}async#D(e,t){this.#A(e);let n;if(e.entries.length>0){this.#o=`transaction-rollback`;try{await this.#M(Qo(e.options,e.entries),`undo`,`transaction-rollback`)}catch(e){n=e}finally{this.#o=void 0}}if(this.#j(e),n)throw this.#P(e.options,n),new zo(ds(this.#s),n);if(this.#s)throw new zo(ds(this.#s),t)}#O(e,t){throw this.#k(e,t),new Ro(Go(e.options),t)}#k(e,t){this.#A(e);let n;if(e.entries.length>0){this.#o=`transaction-rollback`;try{this.#N(Qo(e.options,e.entries),`undo`,`transaction-rollback`)}catch(e){n=e}finally{this.#o=void 0}}if(this.#j(e),n)throw this.#P(e.options,n),new zo(ds(this.#s),n);if(this.#s)throw new zo(ds(this.#s),t)}#A(e){if(e.state!==`active`||this.#a.at(-1)!==e)throw new Io(`Cannot abort a transaction while a nested scope is still active.`)}#j(e){if(this.#a.at(-1)!==e)throw new Io(`Transaction scopes must close in nesting order.`);this.#a.pop(),e.state=`closed`}async#M(e,t,n){let r=rs(e,t),i=[];for(let a of r)try{await is(a,t),i.push(a)}catch(r){let o=[],s=[a,...i.slice().reverse()];for(let e of s)try{await is(e,os(t))}catch(t){o.push({entry:Wo(e),error:us(t)})}let c=ls(n,t,e,a,r,o);throw o.length>0&&(this.#s=ds({...c,reason:`compensation-failed`})),new Lo(c,o.length>0,r)}}#N(e,t,n){let r=rs(e,t),i=[];for(let a of r)try{as(a,t),i.push(a)}catch(r){if(r instanceof hs){let i=ls(n,t,e,a,r,[{entry:Wo(a),error:us(r)}]);throw this.#s=ds({...i,reason:`async-in-sync-scope`}),new Lo(i,!0,r)}let o=[];for(let e of[a,...i.slice().reverse()])try{as(e,os(t))}catch(t){o.push({entry:Wo(e),error:us(t)})}let s=ls(n,t,e,a,r,o);throw o.length>0&&(this.#s=ds({...s,reason:`compensation-failed`})),new Lo(s,o.length>0,r)}}#P(e,t){if(this.#s)return;let n=Go(e),r=t instanceof Lo?t.failure:{phase:`transaction-rollback`,direction:`undo`,entry:n,failedEntry:n,error:us(t),compensationFailures:[]};this.#s=ds({...r,reason:`rollback-failed`})}};function Wo(e){if(!e)return;let t={id:e.id,label:e.label,group:e.group};return e.coalesce&&(t.coalesceKey=e.coalesce.key,e.coalesce.boundary!==void 0&&(t.coalesceBoundary=e.coalesce.boundary)),e.replaySafety&&(t.replaySafety=e.replaySafety.strategy),$o(e)&&(t.composite=!0,t.operationCount=rs(e,`redo`).length),ts(e)&&(t.coalesced=!0),t}function Go(e){let t={id:e.id,label:e.label,group:e.group};return e.coalesce&&(t.coalesceKey=e.coalesce.key,e.coalesce.boundary!==void 0&&(t.coalesceBoundary=e.coalesce.boundary)),e.replaySafety&&(t.replaySafety=e.replaySafety.strategy),t}function Ko(e){let t=e.label.trim();if(!t)throw TypeError(`History transaction label must not be empty.`);return{id:e.id?.trim()||void 0,label:t,group:e.group?.trim()||void 0,coalesce:Jo(e.coalesce),replaySafety:Yo(e.replaySafety,t)}}function qo(e){if(e!==void 0){if(!Number.isFinite(e.idleIntervalMs)||e.idleIntervalMs<0)throw TypeError(`History coalescing idleIntervalMs must be a non-negative finite number.`);if(e.now!==void 0&&typeof e.now!=`function`)throw TypeError(`History coalescing now must be a function.`);return{idleIntervalMs:e.idleIntervalMs,now:e.now??Date.now}}}function Jo(e){if(e===void 0)return;if(typeof e!=`object`||!e)throw TypeError(`History coalescing metadata must be an object.`);let t=typeof e.key==`string`?e.key.trim():``;if(!t)throw TypeError(`History coalescing key must not be empty.`);if(e.boundary!==void 0&&typeof e.boundary!=`string`)throw TypeError(`History coalescing boundary must be a string when provided.`);let n=e.boundary?.trim()||void 0;return n===void 0?{key:t}:{key:t,boundary:n}}function Yo(e,t){if(e===void 0)return;let n={label:t};if(typeof e!=`object`||!e)throw new Bo(n,`metadata must be an object`);if(e.sideEffectful!==!0)throw new Bo(n,`sideEffectful must be true`);if(!Zo(e.strategy))throw new Bo(n,`strategy must be idempotent, compensatable, or non-replayable`);return{sideEffectful:!0,strategy:e.strategy}}function Xo(e){let t=typeof e.label==`string`?e.label:String(e.label),n=Yo(e.replaySafety,t);if(n&&(typeof e.undo!=`function`||typeof e.redo!=`function`))throw new Bo({id:e.id,label:t,group:e.group,replaySafety:n.strategy},`side-effectful entries require both undo and redo callbacks`);return{...e,coalesce:Jo(e.coalesce),replaySafety:n,undo:()=>e.undo(),redo:()=>e.redo()}}function Zo(e){return e===`idempotent`||e===`compensatable`||e===`non-replayable`}function Qo(e,t){let n=t.slice();return{...e,[Vo]:n,async undo(){for(let e=n.length-1;e>=0;--e)await n[e].undo()},async redo(){for(let e of n)await e.redo()}}}function $o(e){return Vo in e}function es(e,t){let n=ts(e)?[...e[Vo],t]:[e,t];return{...Qo({id:t.id,label:t.label,group:t.group,coalesce:t.coalesce,replaySafety:t.replaySafety},n),[Ho]:!0}}function ts(e){return $o(e)&&Ho in e}function ns(e){return e.replaySafety?.strategy===`non-replayable`?!0:$o(e)&&e[Vo].some(ns)}function rs(e,t){if(!$o(e))return[e];let n=t===`redo`?e[Vo]:e[Vo].slice().reverse(),r=[];for(let e of n)r.push(...rs(e,t));return r}async function is(e,t){await e[t]()}function as(e,t){let n=e[t]();if(ms(n))throw Promise.resolve(n).catch(gs),new hs(Wo(e))}function os(e){return e===`redo`?`undo`:`redo`}function ss(e,t){let n={promise:t,observed:!1};e.pendingTasks.add(n);let r=new cs((e,n)=>{t.then(e,n)},e=>{e&&(n.observed=!0)});return r.silenceUnhandledRejection(),r}var cs=class extends Promise{#e;constructor(e,t){super(e),this.#e=t}then(e,t){return this.#e?.(typeof t==`function`),super.then(e,t)}silenceUnhandledRejection(){super.then(void 0,gs)}};function ls(e,t,n,r,i,a){return{phase:e,direction:t,entry:Wo(n),failedEntry:Wo(r),error:us(i),compensationFailures:a}}function us(e){if(e instanceof Error)return{name:e.name||`Error`,message:e.message};if(typeof e==`string`)return{name:`Error`,message:e};try{return{name:`Error`,message:JSON.stringify(e)??String(e)}}catch{return{name:`Error`,message:String(e)}}}function ds(e){return{...e,entry:{...e.entry},failedEntry:{...e.failedEntry},error:{...e.error},compensationFailures:e.compensationFailures.map(e=>({entry:{...e.entry},error:{...e.error}}))}}function fs(e){return{sequence:e.sequence,entry:{...e.entry}}}function ps(e){try{let t=e();return Number.isFinite(t)?t:void 0}catch{return}}function ms(e){return(typeof e==`object`&&!!e||typeof e==`function`)&&`then`in e&&typeof e.then==`function`}var hs=class extends Error{entry;constructor(e){super(`History step "${e.label}" returned a promise inside transactionSync.`),this.entry=e,this.name=`AsyncHistoryStepInSyncScopeError`}};function gs(){}function _s(e,t){let n=$t(e);return n===t?e:n<t?e+` `.repeat(Math.max(0,t-n)):`${Qt(e).slice(0,Math.max(0,t-1))}…`}function vs(e,t={}){let n=e.trim();return t.compact?`[${n}]`:`[ ${n} ]`}function ys(e,t,n,r,i={}){e.length=0;let a=Math.max(0,Math.floor(i.gap??1)),o=n.column+Math.max(0,Math.floor(n.width)),s=n.row+Math.max(0,Math.floor(n.height)),c=Math.max(n.row,Math.floor(r)),l=n.column;for(let r of t){if(c>=s||n.width<=0)break;let t=Math.min($t(vs(r.label)),Math.max(0,n.width));if(t<=0)continue;if(l>n.column&&l+t>o&&(c+=1,l=n.column),c>=s)break;let i=r.disabled?`disabled`:r.active?`active`:`base`;e.push({item:r,rect:{column:l,row:c,width:t,height:1},state:i,tone:r.tone}),l+=t+a}return Math.min(s,c+1)}function bs(e,t){return Ss(e,{row:t.row,column:t.column,width:t.width,prefix:t.prefix??`minimized `,entries:t.entries,mode:`shelf`})}function xs(){return{buttons:[],items:[],placements:[]}}function Ss(e,t){let n=t.column+Math.max(0,t.width),r=Math.min($t(t.prefix),Math.max(0,n-t.column)),i=e.items;i.length=t.entries.length;for(let e=0;e<t.entries.length;e+=1){let n=t.entries[e],r=n,a=t.mode===`tabs`&&r.selected===!0,o=t.mode===`shelf`||t.mode===`tabs`&&r.hidden===!0,s=t.mode===`tabs`?`${a?`●`:o?`○`:` `} ${n.title}`:n.title;i[e]={action:n.id,label:s,selected:a,hidden:o}}let a={column:t.column+r,row:t.row,width:Math.max(0,t.width-r),height:1};ys(e.placements,i,a,t.row);let o=e.placements,s=e.buttons;s.length=o.length;for(let e=0;e<o.length;e+=1){let t=o[e],n=t.item;s[e]={id:n.action,label:n.label,rect:t.rect,selected:n.selected,hidden:n.hidden}}return{prefix:t.prefix,prefixRect:{column:t.column,row:t.row,width:r,height:1},buttons:s}}var Cs={kind:`close`,label:`x`,accessibilityLabel:`Close window`,shortcut:`C`,tone:`danger`,compact:!0},ws={kind:`restore`,label:`R`,accessibilityLabel:`Restore window`,shortcut:`R`,tone:`muted`,compact:!0},Ts={kind:`maximize`,label:`M`,accessibilityLabel:`Maximize window`,shortcut:`F`,tone:`success`,compact:!0},Es={kind:`minimize`,label:`-`,accessibilityLabel:`Minimize window`,shortcut:`M`,tone:`warning`,compact:!0},Ds={kind:`always-on-top`,label:`^`,accessibilityLabel:`Keep window always on top`,shortcut:`P`,tone:`default`,compact:!0},Os={kind:`always-on-top`,label:`v`,accessibilityLabel:`Return window to normal stacking`,shortcut:`P`,tone:`success`,compact:!0},ks=[Cs,ws,Ts,Es],As=[Cs,Ts,Es],js=[Cs,ws,Es];function Ms(){return{buttons:[],hasWindowControls:!1}}function Ns(e,t){let n=t.maximized===void 0?ks:t.maximized?js:As,r=t.alwaysOnTop===void 0?n:[...n.slice(0,n.length-1),t.alwaysOnTop?Os:Ds,n[n.length-1]],i=t.controlsMinWidth??r.length*4,a=t.configLabel??`config`,o=e.buttons,s=0,c=t.rect.row,l=t.rect.column+t.rect.width-1,u=t.rect.width>=i;e.hasWindowControls=u;let d=l;if(u){let e=l;for(let t=0;t<r.length;t+=1){let n=r[t],i=$t(vs(n.label,{compact:n.compact})),a=e-i;Fs(o,r.length-t-1,n,a,c,i),d=a,e=a-1}s=r.length}let f=$t(vs(a)),p=d-f-1,m=t.rect.column+$t(t.title)+3;if(t.showConfig&&p>m)if(u){for(let e=s;e>0;--e)o[e]=o[e-1];o[0]=Is({kind:`config`,label:a,accessibilityLabel:t.configAccessibilityLabel??`Configure renderer`,shortcut:t.configShortcut??`G`,tone:`default`,compact:!1},p,c,f),s+=1}else Fs(o,0,{kind:`config`,label:a,accessibilityLabel:t.configAccessibilityLabel??`Configure renderer`,shortcut:t.configShortcut??`G`,tone:`default`,compact:!1},p,c,f),s=1;return o.length=s,e}function Ps(e,t){let n=0;for(let r=0;r<t.buttons.length;r+=1){let i=t.buttons[r],a=vs(i.label,{compact:i.compact}),o=Math.max(0,Math.min($t(a),i.rect.width));if(o<=0)continue;let s=e[n]??{button:i,kind:i.kind,label:``,accessibilityLabel:``,shortcut:void 0,text:``,rect:{column:0,row:0,width:0,height:1},hitRect:{column:0,row:0,width:0,height:1},tone:i.tone,compact:i.compact};s.button=i,s.kind=i.kind,s.label=i.label,s.accessibilityLabel=i.accessibilityLabel,s.shortcut=i.shortcut,s.text=_s(a,o),s.tone=i.tone,s.compact=i.compact,Pa(s.rect,i.rect.column,i.rect.row,o,1),Pa(s.hitRect,i.rect.column,i.rect.row,o,1),e[n]=s,n+=1}return e.length=n,e}function Fs(e,t,n,r,i,a){let o=e[t]??{kind:n.kind,label:n.label,tone:n.tone,compact:n.compact,rect:{column:r,row:i,width:a,height:1}};o.kind=n.kind,o.label=n.label,o.accessibilityLabel=n.accessibilityLabel,o.shortcut=n.shortcut,o.tone=n.tone,o.compact=n.compact,o.rect.column=r,o.rect.row=i,o.rect.width=a,o.rect.height=1,e[t]=o}function Is(e,t,n,r){return{kind:e.kind,label:e.label,accessibilityLabel:e.accessibilityLabel,shortcut:e.shortcut,tone:e.tone,compact:e.compact,rect:{column:t,row:n,width:r,height:1}}}var Ls=class extends C{#e=0;#t;get value(){return super.value}set value(e){this.#n(e),super.value=e}jink(e){this.#n(e),super.jink(e)}get externalMutationRevision(){return this.#e}get lastExternallyAssignedValue(){return this.#t}publishOwned(e,t){t?super.value=e:super.jink(e)}#n(e){this.#t=e,this.#e=zs(this.#e)}},Rs={workspace:0,window:1e3,chrome:2e3,popover:3e3,modal:4e3,system:5e3};function zs(e){return e===2**53-1?0:e+1}function Bs(e){return Rs[e]}function Vs(e,t){return e.column>=t.column&&e.column<t.column+t.width&&e.row>=t.row&&e.row<t.row+t.height}function Hs(e){let t=[];for(let n=0;n<e.length;n+=1)t.push(gc(e[n]));return t.sort((e,t)=>e.zIndex-t.zIndex||e.order-t.order||e.id.localeCompare(t.id)),t}var Us=class{surfaces;activeId;#e;#t;#n=0;#r=1;#i=new Map;#a=!1;#o;#s;#c;#l;constructor(e={}){let t=e.surfaces??[],n=[],r=new Set;for(let e=0;e<t.length;e+=1){let i=t[e],a=gc(i,i.order??e);if(Zs(a,`Overlay surface ${e}`),r.has(a.id))throw TypeError(`Overlay stack contains duplicate surface id ${JSON.stringify(a.id)}.`);r.add(a.id),this.#n=fc(this.#n,a.order,!1),n.push(a),this.#i.set(a.id,this.#d())}this.#e=new Ws(n,(e,t)=>{this.#p(e,t)},()=>{this.#_(),this.#m()}),this.surfaces=this.#e,this.#t=new Ls(e.activeId&&n.some(t=>t.id===e.activeId)?e.activeId:void 0),this.activeId=this.#t}register(e,t={}){let n=this.surfaces.peek(),r=Qs(n,e.id);r||pc(this.#n);let i=gc(e,r?.order??this.#n);Zs(i,`Registered overlay surface`);let a=fc(this.#n,i.order,!r),o=this.#d();this.#i.set(i.id,o),this.#n=a;let s=r?$s(n,e.id,i):ec(n,i);try{this.#g(s,t)}finally{i.visible&&this.#h(i.id,t.synchronizeFocus)}return i}update(e,t,n={}){let r=this.surfaces.peek(),i=Qs(r,e);if(!i)return;let a=gc({...i,...t,id:e},i.order);Zs(a,`Updated overlay surface`);let o=fc(this.#n,a.order,!1);return this.#n=o,this.#g($s(r,e,a),n),a}open(e,t={}){return this.update(e,{visible:!0},t)&&this.bringToFront(e,t),this.surface(e)}close(e,t={}){let n=this.surface(e);return this.#f(e,t),n}toggle(e,t={}){return this.surface(e)?.visible?this.close(e,t):this.open(e,t)}remove(e,t={}){let n=this.surface(e);if(!n)return;this.#i.delete(e);let r=tc(this.surfaces.peek(),e),i=this.activeId.peek()===e?Ys(r):this.activeId.peek();try{this.#g(r,t)}finally{this.#h(i,t.synchronizeFocus)}return n}bringToFront(e,t={}){let n=this.surface(e);if(!n)return;let r=this.#u(),i=gc({...n,order:r,zIndex:void 0},r);try{this.#g($s(this.surfaces.peek(),e,i),t)}finally{this.#h(e,t.synchronizeFocus)}return i}surface(e){return Qs(this.surfaces.peek(),e)}registrationGeneration(e){return this.#i.get(e)}activeMutationRevision(){return this.#t.externalMutationRevision}lastExternallyAssignedActiveId(){return this.#t.lastExternallyAssignedValue}synchronizeActiveId(e,t={}){let n=e===void 0?void 0:e&&this.surface(e)?e:Ys(this.surfaces.peek());this.#t.publishOwned(n,t.propagate??!0)}zOrder(){let e=this.#y(),t=[];for(let n=0;n<e.length;n+=1)t.push(e[n]);return t}top(){let e=this.#y();return e[e.length-1]}topModal(){return bc(this.#y())}hitTest(e,t={}){return Ks(this.#v(),e,t.respectModal)}handlePointerDown(e){let t=this.#y(),n=bc(t),r=n?Js(t,n.id):void 0,i=n&&r?t.some(t=>r.has(t.id)&&Vs(e,t.rect)):!1;if(n&&!i)return n.closeOnOutsideClick?{blockingModal:n,closedIds:this.#f(n.id)}:{blockingModal:n,closedIds:[]};let a=this.hitTest(e,{respectModal:!!n});return a&&this.bringToFront(a.surface.id),{hit:a,blockingModal:n,closedIds:[]}}inspect(){let e=this.surfaces.peek(),t=Array(e.length);for(let n=0;n<e.length;n+=1){let r=e[n];t[n]=nc(r)}let n=[];for(let t of e)t.visible&&n.push(nc(t));let r=this.#y(),i=Array(r.length);for(let e=0;e<r.length;e+=1){let t=r[e];i[e]=nc(t)}let a=i[i.length-1];return{activeId:this.activeId.peek(),surfaces:t,visible:n,zOrder:i,top:a?nc(a):void 0}}snapshot(){let e=this.surfaces.peek(),t=this.activeId.peek();return rc({activeId:t&&Qs(e,t)?t:void 0,nextOrder:this.#n,surfaces:e})}restoreSnapshot(e,t={}){let n=ic(e),r=this.surfaces.peek(),i=new Map;for(let e of n.surfaces){let t=Qs(r,e.id),n=this.#i.get(e.id);i.set(e.id,t&&n!==void 0&&_c(t,e)?n:this.#d())}this.#n=n.nextOrder,this.#i=i;try{this.#g(n.surfaces.map(nc),t)}finally{this.#h(n.activeId,t.synchronizeFocus)}}dispose(){this.#i.clear(),this.surfaces.dispose(),this.activeId.dispose()}#u(){pc(this.#n);let e=this.#n;return this.#n=e+1,e}#d(){if(!Number.isSafeInteger(this.#r))throw RangeError(`Overlay registration generation space exhausted.`);return this.#r++}#f(e,t={}){let n=this.surfaces.peek(),r=qs(n,e),i=new Set(r),a=Array(n.length);for(let e=0;e<n.length;e+=1){let t=n[e];a[e]=i.has(t.id)?gc({...t,visible:!1},t.order):t}let o=this.activeId.peek(),s=o&&i.has(o)?Ys(a):o;try{this.#g(a,t)}finally{this.#h(s,t.synchronizeFocus)}return r}#p(e,t){Xs(t.surfaces,`Externally assigned overlay surfaces`);let n=new Map(this.#i),r=this.#r,i=this.#n;for(let e of[...n.keys()])t.byId.has(e)||n.delete(e);for(let[a,o]of t.byId)if(i=fc(i,o.order,!1),!(e.byId.get(a)===o&&n.has(a))){if(!Number.isSafeInteger(r))throw RangeError(`Overlay registration generation space exhausted.`);n.set(a,r++)}this.#i=n,this.#r=r,this.#n=i}#m(){let e=this.activeId.peek();!e||this.surface(e)||this.#h(e,this.#a)}#h(e,t=!1){let n=e===void 0?void 0:e&&this.surface(e)?e:Ys(this.surfaces.peek());t?this.#t.publishOwned(n,!0):this.#t.value=n}#g(e,t={}){let n=this.#a;this.#a=t.synchronizeFocus??!1;try{this.#e.publishOwned(e)}finally{this.#a=n}}#_(){this.#o=void 0,this.#s=void 0,this.#c=void 0,this.#l=void 0}#v(){let e=this.surfaces.peek();return this.#o!==e&&(this.#o=e,this.#s=Hs(e),this.#c=void 0,this.#l=void 0),this.#s??[]}#y(){let e=this.surfaces.peek();if(this.#c!==e){let t=this.#v(),n=[];for(let e of t)e.visible&&n.push(e);this.#c=e,this.#l=n}return this.#l??[]}},Ws=class extends C{#e;#t;#n=new WeakMap;#r;constructor(e,t,n){super(e),this.#e=t,this.#t=n,this.$value=this.#i(e),this.#r=Gs(this.peek())}get value(){return super.value}set value(e){let t=this.#i(e),n=Gs(t);this.#e(this.#r,n),this.#r=n;try{super.value=t}finally{this.#r=Gs(this.peek()),this.#t()}}jink(e){let t=this.#i(e),n=Gs(t);this.#e(this.#r,n),this.#r=n,super.jink(t),this.#t()}propagate(){try{this.#a(this.peek());let e=Gs(this.peek());this.#e(this.#r,e),this.#r=e,this.#t()}catch(e){let t=this.#i(this.#r.rollback.map(nc));throw super.jink(t),this.#r=Gs(t),this.#t(),e}super.propagate()}publishOwned(e){let t=this.#i(e);this.#r=Gs(t);try{super.value=t}finally{this.#r=Gs(this.peek()),this.#t()}}#i(e){if(this.#n.get(e))return this.#a(e),e;let t=[...e];for(let e=0;e<t.length;e+=1)t[e]=this.#o(t[e]);let n=m(t,this);return this.#n.set(n,t),n}#a(e){let t=this.#n.get(e)??e;for(let n=0;n<e.length;n+=1)t[n]=this.#o(e[n])}#o(e){let t=this.#n.get(e);if(t)return t.rect=this.#s(e.rect),e;let n={...e};n.rect=this.#s(n.rect);let r=m(n,this);return this.#n.set(r,n),r}#s(e){if(this.#n.get(e))return e;let t={...e},n=m(t,this);return this.#n.set(n,t),n}};function Gs(e){return{surfaces:[...e],byId:new Map(e.map(e=>[e.id,e])),rollback:e.map(nc)}}function Ks(e,t,n){let r=n===!1?void 0:bc(e),i=r?Js(e,r.id):void 0;for(let n=e.length-1;n>=0;--n){let r=e[n];if(r.visible&&!(i&&!i.has(r.id))&&Vs(t,r.rect))return yc(r,t)}}function qs(e,t,n=!1){let r=new Map;for(let t of e){if(!t.ownerId||n&&!t.visible)continue;let e=r.get(t.ownerId);e?e.push(t.id):r.set(t.ownerId,[t.id])}let i=new Set([t]),a=[t];for(let e=0;e<a.length;e+=1)for(let t of r.get(a[e])??[])i.has(t)||(i.add(t),a.push(t));return a}function Js(e,t){return new Set(qs(e,t,!0))}function Ys(e){let t=Hs(e).filter(e=>e.visible);return t[t.length-1]?.id}function Xs(e,t){let n=new Set;for(let r=0;r<e.length;r+=1){let i=e[r];if(Zs(i,`${t} entry ${r}`),n.has(i.id))throw TypeError(`${t} contains duplicate id ${JSON.stringify(i.id)}.`);n.add(i.id)}}function Zs(e,t){if(typeof e.id!=`string`)throw TypeError(`${t} id must be a string.`);if(!mc(e.layer))throw TypeError(`${t} layer is invalid.`);if(!hc(e.kind))throw TypeError(`${t} kind is invalid.`);if(!Number.isSafeInteger(e.zIndex))throw TypeError(`${t} zIndex must be a safe integer.`);if(!Number.isSafeInteger(e.order)||e.order<0||e.order>=2**53-1)throw TypeError(`${t} order must be a bounded non-negative safe integer.`);for(let[n,r]of Object.entries(e.rect))if(typeof r!=`number`||!Number.isFinite(r))throw TypeError(`${t} rect ${n} must be finite.`);if(typeof e.visible!=`boolean`||typeof e.modal!=`boolean`)throw TypeError(`${t} visibility and modal flags must be boolean.`);if(typeof e.closeOnOutsideClick!=`boolean`)throw TypeError(`${t} closeOnOutsideClick must be boolean.`);if(e.ownerId!==void 0&&typeof e.ownerId!=`string`)throw TypeError(`${t} ownerId must be a string when present.`)}function Qs(e,t){for(let n=0;n<e.length;n+=1){let r=e[n];if(r.id===t)return r}}function $s(e,t,n){let r=Array(e.length);for(let i=0;i<e.length;i+=1){let a=e[i];r[i]=a.id===t?n:a}return r}function ec(e,t){let n=Array(e.length+1);for(let t=0;t<e.length;t+=1)n[t]=e[t];return n[e.length]=t,n}function tc(e,t){let n=0;for(let r=0;r<e.length;r+=1)e[r].id!==t&&(n+=1);let r=Array(n),i=0;for(let n=0;n<e.length;n+=1){let a=e[n];a.id!==t&&(r[i++]=a)}return r}function nc(e){return{...e,rect:{...e.rect}}}function rc(e){let t=e.surfaces.map(e=>Object.freeze({...e,rect:Object.freeze({...e.rect})}));return Object.freeze({activeId:e.activeId,nextOrder:e.nextOrder,surfaces:Object.freeze(t)})}function ic(e){let t=oc(e,[`activeId`,`nextOrder`,`surfaces`],[`nextOrder`,`surfaces`],`overlay stack snapshot`),n=uc(t.nextOrder,`overlay stack snapshot nextOrder`);if(!Array.isArray(t.surfaces))throw TypeError(`Overlay stack snapshot surfaces must be an array.`);sc(t.surfaces,`overlay stack snapshot surfaces`);let r=[],i=new Set,a=-1;for(let e=0;e<t.surfaces.length;e+=1){let n=ac(t.surfaces[e],e);if(i.has(n.id))throw TypeError(`Overlay stack snapshot contains duplicate surface id ${JSON.stringify(n.id)}.`);i.add(n.id),a=Math.max(a,n.order),r.push(n)}if(r.length>0&&n<=a)throw RangeError(`Overlay stack snapshot nextOrder must be greater than every surface order.`);let o=t.activeId;if(o!==void 0&&typeof o!=`string`)throw TypeError(`Overlay stack snapshot activeId must be a string when present.`);if(o!==void 0&&!i.has(o))throw TypeError(`Overlay stack snapshot activeId ${JSON.stringify(o)} is not registered.`);return rc({activeId:o,nextOrder:n,surfaces:r})}function ac(e,t){let n=`overlay stack snapshot surface ${t}`,r=oc(e,[`id`,`rect`,`layer`,`kind`,`zIndex`,`order`,`visible`,`modal`,`closeOnOutsideClick`,`ownerId`],[`id`,`rect`,`layer`,`kind`,`zIndex`,`order`,`visible`,`modal`,`closeOnOutsideClick`],n);if(typeof r.id!=`string`)throw TypeError(`${n} id must be a string.`);if(!mc(r.layer))throw TypeError(`${n} layer is invalid.`);if(!hc(r.kind))throw TypeError(`${n} kind is invalid.`);if(r.ownerId!==void 0&&typeof r.ownerId!=`string`)throw TypeError(`${n} ownerId must be a string when present.`);let i=oc(r.rect,[`column`,`row`,`width`,`height`],[`column`,`row`,`width`,`height`],`${n} rect`);return{id:r.id,rect:{column:cc(i.column,`${n} rect column`),row:cc(i.row,`${n} rect row`),width:cc(i.width,`${n} rect width`),height:cc(i.height,`${n} rect height`)},layer:r.layer,kind:r.kind,zIndex:lc(r.zIndex,`${n} zIndex`),order:uc(r.order,`${n} order`),visible:dc(r.visible,`${n} visible`),modal:dc(r.modal,`${n} modal`),closeOnOutsideClick:dc(r.closeOnOutsideClick,`${n} closeOnOutsideClick`),ownerId:r.ownerId}}function oc(e,t,n,r){if(!e||typeof e!=`object`||Object.getPrototypeOf(e)!==Object.prototype)throw TypeError(`${r} must be a plain object.`);let i=e,a=new Set(t),o=Reflect.ownKeys(i);for(let e of o){if(typeof e!=`string`||!a.has(e))throw TypeError(`${r} has an unexpected property.`);let t=Object.getOwnPropertyDescriptor(i,e);if(!t||!(`value`in t)||!t.enumerable)throw TypeError(`${r} properties must be enumerable data properties.`)}for(let e of n)if(!Object.hasOwn(i,e))throw TypeError(`${r} is missing property ${JSON.stringify(e)}.`);return i}function sc(e,t){if(Object.getPrototypeOf(e)!==Array.prototype)throw TypeError(`${t} must be a plain array.`);let n=Reflect.ownKeys(e);for(let n=0;n<e.length;n+=1){let r=String(n);if(!Object.hasOwn(e,r))throw TypeError(`${t} must not contain holes.`);let i=Object.getOwnPropertyDescriptor(e,r);if(!i||!(`value`in i)||!i.enumerable)throw TypeError(`${t} entries must be enumerable data properties.`)}for(let r of n)if(r!==`length`&&(typeof r!=`string`||!/^(0|[1-9]\d*)$/.test(r)||Number(r)>=e.length))throw TypeError(`${t} has an unexpected property.`)}function cc(e,t){if(typeof e!=`number`||!Number.isFinite(e))throw TypeError(`${t} must be finite.`);return e}function lc(e,t){let n=cc(e,t);if(!Number.isSafeInteger(n))throw TypeError(`${t} must be a safe integer.`);return n}function uc(e,t){let n=lc(e,t);if(n<0)throw TypeError(`${t} must be non-negative.`);return n}function dc(e,t){if(typeof e!=`boolean`)throw TypeError(`${t} must be a boolean.`);return e}function fc(e,t,n){if(!Number.isSafeInteger(e)||e<0)throw RangeError(`Overlay next-order allocator is outside the safe integer range.`);if(!Number.isSafeInteger(t)||t<0||t>=2**53-1)throw RangeError(`Overlay surface order cannot leave room for a safe next-order allocation.`);n&&pc(e);let r=n?e+1:e;return Math.max(r,t+1)}function pc(e){if(!Number.isSafeInteger(e)||e<0||e>=2**53-1)throw RangeError(`Overlay order allocator is exhausted.`)}function mc(e){return e===`workspace`||e===`window`||e===`chrome`||e===`popover`||e===`modal`||e===`system`}function hc(e){return e===`workspace`||e===`window`||e===`titlebar`||e===`shelf`||e===`tab`||e===`menu`||e===`popover`||e===`modal`||e===`toast`||e===`tooltip`||e===`custom`}function gc(e,t=e.order??0){let n=e.layer??vc(e.kind),r=Math.max(0,Math.floor(e.order??t)),i=Math.floor(e.zIndex??Bs(n)+r);return{id:e.id,rect:{...e.rect},layer:n,kind:e.kind??`custom`,zIndex:i,order:r,visible:e.visible??!0,modal:e.modal??e.kind===`modal`,closeOnOutsideClick:e.closeOnOutsideClick??!1,ownerId:e.ownerId}}function _c(e,t){return e.id===t.id&&e.layer===t.layer&&e.kind===t.kind&&e.modal===t.modal&&e.ownerId===t.ownerId}function vc(e){switch(e){case`workspace`:return`workspace`;case`window`:return`window`;case`titlebar`:case`shelf`:case`tab`:return`chrome`;case`menu`:case`popover`:case`tooltip`:return`popover`;case`modal`:return`modal`;case`toast`:return`system`;case`custom`:case void 0:return`window`}}function yc(e,t){return{surface:e,column:t.column,row:t.row,localColumn:t.column-e.rect.column,localRow:t.row-e.rect.row}}function bc(e){for(let t=e.length-1;t>=0;--t){let n=e[t];if(n.visible&&n.modal)return n}}Object.freeze({left:`╲`,right:`╱`,cross:`╳`,horizontal:`─`,vertical:`│`});var xc={unit:`auto`,value:0},Sc={top:0,right:0,bottom:0,left:0};function Cc(e){return{unit:`cell`,value:Math.max(0,Math.floor(kc(e,0)))}}function wc(){return{...xc}}function Tc(){return{display:`block`,position:`relative`,flexDirection:`row`,flexWrap:`nowrap`,flexGrow:0,flexShrink:1,flexBasis:wc(),order:0,alignItems:`stretch`,alignContent:`start`,justifyContent:`start`,alignSelf:`stretch`,justifySelf:`stretch`,gridTemplateColumns:[],gridTemplateRows:[],gridTemplateAreas:[],gridAutoColumns:wc(),gridAutoRows:wc(),direction:`ltr`,gridAutoFlow:`row`,gridAutoFlowDense:!1,gridColumn:{},gridRow:{},width:wc(),height:wc(),minWidth:Cc(0),minHeight:Cc(0),maxWidth:wc(),maxHeight:wc(),aspectRatio:void 0,boxSizing:`border-box`,inset:{top:wc(),right:wc(),bottom:wc(),left:wc()},offsetX:0,offsetY:0,margin:{...Sc},padding:{...Sc},border:{...Sc},gap:0,rowGap:0,columnGap:0,overflowX:`visible`,overflowY:`visible`,zIndex:0,opacity:1,visibility:`visible`,whiteSpace:`normal`,overflowWrap:`normal`,variables:{}}}function Ec(e){let t={...e,flexBasis:I(e.flexBasis),gridTemplateColumns:Ac(e.gridTemplateColumns),gridTemplateRows:Ac(e.gridTemplateRows),gridTemplateAreas:jc(e.gridTemplateAreas),...e.gridTemplateColumnsAutoRepeat?{gridTemplateColumnsAutoRepeat:{mode:e.gridTemplateColumnsAutoRepeat.mode,tracks:Ac(e.gridTemplateColumnsAutoRepeat.tracks),insertAt:e.gridTemplateColumnsAutoRepeat.insertAt}}:{},...e.gridTemplateColumnsLineNames?{gridTemplateColumnsLineNames:e.gridTemplateColumnsLineNames.map(e=>[...e])}:{},...e.gridTemplateRowsLineNames?{gridTemplateRowsLineNames:e.gridTemplateRowsLineNames.map(e=>[...e])}:{},...e.gridTemplateRowsAutoRepeat?{gridTemplateRowsAutoRepeat:{mode:e.gridTemplateRowsAutoRepeat.mode,tracks:Ac(e.gridTemplateRowsAutoRepeat.tracks),insertAt:e.gridTemplateRowsAutoRepeat.insertAt}}:{},direction:e.direction,...e.logicalEdges?{logicalEdges:{...e.logicalEdges}}:{},gridAutoFlowDense:e.gridAutoFlowDense,gridAutoColumns:I(e.gridAutoColumns),gridAutoRows:I(e.gridAutoRows),gridColumn:{...e.gridColumn},gridRow:{...e.gridRow},width:I(e.width),height:I(e.height),minWidth:I(e.minWidth),minHeight:I(e.minHeight),maxWidth:I(e.maxWidth),maxHeight:I(e.maxHeight),inset:Oc(e.inset),hatch:e.hatch?{...e.hatch}:void 0,layers:e.layers?[...e.layers]:void 0,margin:{...e.margin},padding:{...e.padding},border:{...e.border},variables:{...e.variables}},n=Dc(e);return n&&(t.__layoutLengths={margin:n.margin?Oc(n.margin):void 0,padding:n.padding?Oc(n.padding):void 0,rowGap:n.rowGap?{...n.rowGap}:void 0,columnGap:n.columnGap?{...n.columnGap}:void 0}),t}Object.freeze({visualOnly:!0,documentOrder:`source order, always`,focusOrder:`source order, always`,guidance:`Use dense only where visual position does not encode meaning; readers and keyboard users traverse the source order.`}),Object.freeze({cells:`visual, always`,resolution:`logical names map to physical edges at computed-value time from the final direction`,ordering:`document and focus order are source order; RTL flips flex row axes only`,hitTesting:`untouched — computed rects are physical`,bidiText:`text reordering is out of scope for cell ordering`});function Dc(e){return e.__layoutLengths}function I(e){let t=e.terms?{...e,terms:e.terms.map(e=>({...e}))}:{...e};return e.minTrack&&(t.minTrack=I(e.minTrack)),e.maxTrack&&(t.maxTrack=I(e.maxTrack)),e.limitTrack&&(t.limitTrack=I(e.limitTrack)),t}function Oc(e){return{top:I(e.top),right:I(e.right),bottom:I(e.bottom),left:I(e.left)}}function kc(e,t){return Number.isFinite(e)?e:t}function Ac(e){let t=Array(e.length);for(let n=0;n<e.length;n+=1)t[n]=I(e[n]);return t}function jc(e){let t=Array(e.length);for(let n=0;n<e.length;n+=1){let r=e[n],i=Array(r.length);for(let e=0;e<r.length;e+=1)i[e]=r[e];t[n]=i}return t}function Mc(e){let t={...e.attributes??{}},n=e.id??t.id??e.tag;t.id||=n;let r=e.classes??Nc(t.class);return{id:n,tag:e.tag,classes:r.slice(),attributes:t,text:e.text,style:e.style?Ec(e.style):Tc(),children:[...e.children??[]],intrinsic:e.intrinsic?{...e.intrinsic}:void 0}}function Nc(e){if(!e)return[];let t=[],n=-1;for(let r=0;r<=e.length;r+=1){let i=r<e.length?e[r]:` `;if(i!==void 0&&!bn(i)){n<0&&(n=r);continue}n>=0&&(t.push(e.slice(n,r)),n=-1)}return t}function Pc(e,t,n){return t>=e.column&&n>=e.row&&t<e.column+Math.max(0,e.width)&&n<e.row+Math.max(0,e.height)}var Fc=400;function Ic(){return{}}var Lc={kind:`none`};function Rc(e,t,n={}){let r=n.doubleClickMs??Fc;switch(t.kind){case`down`:{let n=t.id;if(n===void 0)return{state:{lastClick:e.lastClick},outcome:Lc};let r={id:n,column:t.column,row:t.row,moved:!1};return e.held?{state:{held:r,lastClick:e.lastClick},outcome:{kind:`recovered`,id:e.held.id}}:{state:{held:r,lastClick:e.lastClick},outcome:Lc}}case`move`:{let n=e.held;return!n||n.moved||t.column===n.column&&t.row===n.row?{state:e,outcome:Lc}:{state:{held:{...n,moved:!0},lastClick:void 0},outcome:{kind:`drag`,id:n.id}}}case`up`:{let n=e.held;if(!n)return{state:e,outcome:Lc};if(n.moved)return{state:{lastClick:void 0},outcome:Lc};let i=e.lastClick;return i!==void 0&&i.id===n.id&&t.timestamp>=i.at&&t.timestamp-i.at<=r?{state:{},outcome:{kind:`double-click`,id:n.id}}:{state:{lastClick:{id:n.id,at:t.timestamp}},outcome:{kind:`click`,id:n.id}}}case`cancel`:return{state:{lastClick:e.lastClick},outcome:Lc}}}var zc=class extends Error{code;result;cause;constructor(e,t,n,r){super(t),this.code=e,this.result=n,this.cause=r,this.name=`MarkupWindowHistoryRestoreError`}},Bc=class extends zc{constructor(e){super(`snapshot-mismatch`,e),this.name=`MarkupWindowHistoryReplayConflictError`}},Vc=128,Hc=512,Uc=32,Wc=256,Gc=Symbol(`MarkupWindowHistorySemanticId`),Kc=new WeakMap,qc=class{controller;history;#e;#t;#n;#r;#i;#a=!1;#o=0;#s=0;#c=0;#l=0;#u;#d;#f;#p;#m;constructor(e){this.controller=e.controller,this.history=e.history,this.#e=sl(e.idPrefix,`window`,Vc),this.#t=sl(e.group,`windows`,Vc),this.#n=e.label,this.#i=Yc(this.controller),this.#r=e.restoreSnapshot??(e=>this.controller.restoreSnapshot(e))}get disposed(){return this.#a}focus(e){let t=L(`focus`,e);return this.#h(t,()=>this.controller.focus(e))}move(e,t){let n=L(`move`,e,void 0,{delta:t});return this.#h(n,()=>this.controller.move(e,t))}swap(e,t){let n=L(`swap`,e,t);return this.#h(n,()=>this.controller.swap(e,t))}dock(e,t,n,r={}){let i={edge:n};r.ratio!==void 0&&(i.ratio=r.ratio);let a=L(`dock`,e,t,i);return this.#h(a,()=>this.controller.dock(e,t,n,r))}resize(e,t,n,r={}){let i={delta:t,column:n.column,row:n.row,width:n.width,height:n.height};r.gap!==void 0&&(i.gap=r.gap),r.separatorHitSize!==void 0&&(i.separatorHitSize=r.separatorHitSize),r.compactMode!==void 0&&(i.compactMode=r.compactMode);let a=L(`resize`,e,void 0,i);return this.#h(a,()=>this.controller.resize(e,t,n,r))}resizeRatio(e,t){let n=L(`resize-ratio`,e,void 0,{delta:t});return this.#h(n,()=>this.controller.resizeRatio(e,t))}minimize(e){let t=L(`minimize`,e);return this.#h(t,()=>this.controller.minimize(e))}maximize(e){let t=L(`maximize`,e);return this.#h(t,()=>this.controller.maximize(e))}restore(e){let t=L(`restore`,e);return this.#h(t,()=>this.controller.restore(e))}close(e){let t=L(`close`,e);return this.#h(t,()=>this.controller.close(e))}setPlacement(e,t,n={}){let r=L(`set-placement`,e,void 0,{placement:t,...rl(n.rect)});return this.#h(r,()=>this.controller.setPlacement(e,t,n))}setFloatingRect(e,t){let n=L(`set-floating-rect`,e,void 0,nl(t));return this.#h(n,()=>this.controller.setFloatingRect(e,t))}moveBy(e,t){let n=L(`move-by`,e,void 0,il(t));return this.#h(n,()=>this.controller.moveBy(e,t))}resizeWindow(e,t,n){let r=L(`resize-window`,e,void 0,{edge:t,...il(n)});return this.#h(r,()=>this.controller.resizeWindow(e,t,n))}snap(e,t,n){let r=t.kind===`dock`?t.targetId:void 0,i={targetKind:t.kind,...nl(n,`bounds`)};t.kind===`corner`?i.corner=t.corner:i.edge=t.edge,t.kind===`dock`&&t.ratio!==void 0&&(i.ratio=t.ratio);let a=L(`snap`,e,r,i);return this.#h(a,()=>this.controller.snap(e,t,n))}setAlwaysOnTop(e,t){let n=L(`set-always-on-top`,e,void 0,{value:+!!t});return this.#h(n,()=>this.controller.setAlwaysOnTop(e,t))}setGroup(e,t){let n=L(`set-group`,e,void 0,{groupId:t??``});return this.#h(n,()=>this.controller.setGroup(e,t))}recoverBounds(e,t,n={}){let r=nl(t,`bounds`);n.margin!==void 0&&(r.margin=n.margin),n.titleBarHeight!==void 0&&(r.titleBarHeight=n.titleBarHeight);let i=L(`recover-bounds`,e,void 0,r);return this.#h(i,()=>this.controller.recoverBounds(e,t,n))}beginGesture(e){let t=ul(e);if(this.#o+=1,this.#u=dl(t),this.#f=void 0,this.#a||this.controller.disposed||this.controller.mutationInProgress||this.#i.lease){let e=this.#a?`window-history-adapter-disposed`:this.controller.disposed?`window-controller-disposed`:this.controller.mutationInProgress?`window-controller-mutation-in-progress`:Xc(this.#i.lease.kind);return this.#c+=1,this.#d=$c(t,e,this.#a||this.controller.disposed?`disposed`:`blocked`),hl(t,e)}let n=Symbol(`MarkupWindowHistoryGesture`);this.#i.lease={token:n,kind:`gesture`},this.#p=n;let r;try{r=R(this.#_())}catch(e){throw this.#p===n&&(this.#p=void 0),this.#m=void 0,this.#i.lease?.token===n&&(this.#i.lease=void 0),this.#l+=1,e}let i=Zc(t,r),a=`active`,o,s,c,l=!1,u=e=>{a=e,this.#p===n&&(this.#p=void 0),this.#m=void 0,this.#i.lease?.token===n&&(this.#i.lease=void 0)},d=e=>{throw this.#l+=1,this.#f=void 0,s=Ll(e),u(`failed`),e},f=Object.freeze({commit:()=>{if(a!==`active`||c)return!1;c=`commit`;try{if(this.#a){try{let e=R(this.#_());this.#x(al(r,e,t),e,i)}catch(e){return d(e)}return o=!1,s=`window-history-adapter-disposed`,this.#c+=1,this.#d=Qc(t,s),u(`cancelled`),!1}let e;try{e=R(this.#_())}catch(e){return d(e)}if(o=!ol(r,e),!o)return this.#c+=1,this.#d=ml(t,`unchanged`,`gesture-produced-no-state-change`),u(`committed`),!1;let c;try{if(c=this.#g(t),a!==`active`||this.#i.lease?.token!==n)return!1;let d=R(this.#_());if(l)return this.#x(al(r,d,t),d,i),o=!1,s=`gesture-cancelled-during-commit`,this.#c+=1,this.#d=ml(t,`unchanged`,s),u(`cancelled`),!1;if(!ol(e,d))throw this.#x(r,d,i),Error(`window-history-metadata-mutated-managed-state`);let f=R(r),p=R(e),m=this.#b(f,p,i,n);this.history.push({...c,...m})}catch(t){if(a!==`active`)return!1;try{this.#x(r,e,i)}catch(e){return d(Il(t,e))}return d(t)}return this.#s+=1,this.#f={...c},this.#d=ml(t,`applied`),u(`committed`),!0}finally{c=void 0}},cancel:()=>{if(a!==`active`)return!1;if(c===`commit`)return l=!0,!1;if(c)return!1;c=`cancel`;try{let e=R(this.#_());ol(r,e)||this.#x(al(r,e,t),e,i)}catch(e){return d(e)}finally{c=void 0}return o=!1,s=`gesture-cancelled`,this.#c+=1,this.#d=ml(t,`unchanged`,s),u(`cancelled`),!0},inspect:()=>({state:a,operation:dl(t),...o===void 0?{}:{changed:o},...s===void 0?{}:{reason:s}})});return this.#m=f.cancel,f}inspect(){return{disposed:this.#a,idPrefix:this.#e,group:this.#t,attemptedActions:this.#o,recordedActions:this.#s,skippedActions:this.#c,failedActions:this.#l,lastOperation:this.#u?structuredClone(this.#u):void 0,lastResult:this.#d?{...this.#d}:void 0,lastEntry:this.#f?{...this.#f}:void 0,history:this.history.inspect()}}dispose(){this.#a||(this.#a=!0,this.#m?.())}#h(e,t){if(this.#o+=1,this.#u=structuredClone(e),this.#a){let t=Qc(e,`window-history-adapter-disposed`);return this.#c+=1,this.#d=t,this.#f=void 0,t}if(this.controller.disposed){let t=Qc(e,`window-controller-disposed`);return this.#c+=1,this.#d=t,this.#f=void 0,t}if(this.controller.mutationInProgress){let t=$c(e,`window-controller-mutation-in-progress`,`blocked`);return this.#c+=1,this.#d=t,this.#f=void 0,t}if(this.#i.lease){let t=$c(e,Xc(this.#i.lease.kind),`blocked`);return this.#c+=1,this.#d=t,this.#f=void 0,t}let n=Symbol(`MarkupWindowHistoryAction`);this.#i.lease={token:n,kind:`action`};let r,i,a=!1,o,s=!0;try{o=R(this.#_()),s=Zc(e,o),r=this.#g(e);let c=R(this.#_());if(!ol(o,c))throw this.#x(o,c,s),Error(`window-history-metadata-mutated-managed-state`);let l=o,u=r;this.history.transactionSync(u,r=>{let o=R(l),c=R(o),d=!0,f,p,m=!0,h,g;if(r.apply({...u,undo:()=>{if(h){let e=h;h=void 0,e===`restore`&&(c=this.#y(c,void 0,s,n));return}if(m)try{c=this.#y(o,p,s,n)}catch(e){throw g=e instanceof Bc?`noop`:`restore`,e}},redo:()=>{if(g){let e=g;g=void 0,e===`restore`&&p&&(p=this.#y(p,void 0,s,n));return}if(d){d=!1,i=t(),f=R(this.#_()),p=R(f),m=!ol(o,f);return}if(!f)throw Error(`Window action ${e.action} has no captured redo snapshot.`);try{p=this.#y(f,c,s,n)}catch(e){throw h=e instanceof Bc?`noop`:`restore`,e}}}),i?.status!==`applied`||!m){i?.status===`applied`&&(i={...i,status:`unchanged`,ok:!0}),r.discard();return}a=!0})}catch(e){let t=e;if(o&&!this.history.isPoisoned())try{let e=R(this.#_());ol(o,e)||this.#x(o,e,s)}catch(n){t=Il(e,n)}throw this.#l+=1,this.#d=i?{...i}:void 0,this.#f=void 0,t}finally{this.#i.lease?.token===n&&(this.#i.lease=void 0)}let c=i??Qc(e,`controller-returned-no-result`);return this.#d={...c},a?(this.#s+=1,this.#f={...r}):(this.#c+=1,this.#f=void 0),c}#g(e){let t=sl(this.#n?.(dl(e)),``,Hc);return{id:el(this.#e,e),label:t||fl(tl(e)),group:this.#t}}#_(){let e=structuredClone(this.controller.snapshot()),t=this.controller.inspect().modals.filter(e=>e.registered).map(e=>e.id);return{controller:e,workspaceRegistrations:e.windowIds.map(e=>({id:e,generation:this.controller.workspace.windowRegistrationGeneration(e)})),overlays:El(t,this.controller.overlays,this.controller.overlays.snapshot())}}#v(e,t,n=!1){let r=this.controller.overlays.activeMutationRevision(),i=this.controller.overlays.snapshot(),a=new Map(i.surfaces.map(e=>[e.id,this.controller.overlays.registrationGeneration(e.id)])),o=R(e);gl(o,t,this.controller.workspace),Dl(o.overlays,t?.overlays,i,this.controller.overlays),Ol(o.overlays,t?.overlays,i,n);let s;try{s=this.#r(structuredClone(o.controller))}catch(e){throw new zc(`controller-threw`,`Markup window controller threw while restoring a history snapshot.`,void 0,e)}if(!s.ok)throw new zc(`controller-rejected`,`Markup window controller rejected history restoration with status ${s.status}.`,{...s});gl(o,t,this.controller.workspace);let c=this.controller.overlays.snapshot();Dl(o.overlays,t?.overlays,c,this.controller.overlays),kl(o.overlays,i,a,c,this.controller.overlays);try{if(jl(this.controller.overlays,o.overlays,c),this.controller.overlays.activeMutationRevision()!==r){let e=this.controller.overlays.snapshot(),t=this.controller.overlays.lastExternallyAssignedActiveId(),n=t&&e.surfaces.some(e=>e.id===t)?t:void 0;this.controller.overlays.synchronizeActiveId(n);let r=this.controller.overlays.snapshot();Al(o.overlays,r.activeId,Ml(r.surfaces,o.overlays.rootIds))}}catch(e){throw new zc(`overlay-threw`,`Overlay stack threw while restoring managed window-history surfaces.`,void 0,e)}let l=this.#_();if(!ol(l,o))throw new zc(`snapshot-mismatch`,`Markup window history restoration did not reproduce the required exact snapshot.`);return R(l)}#y(e,t,n,r){if(this.#i.lease){if(this.#i.lease.token===r)return this.#v(e,t,n);throw new Bc(`Markup window replay is blocked by ${Xc(this.#i.lease.kind)}.`)}if(t){let e;try{e=this.controller.snapshot()}catch(e){throw new zc(`controller-threw`,`Markup window controller threw while checking replay ownership.`,void 0,e)}if(JSON.stringify(e)!==JSON.stringify(t.controller))throw new Bc(`Markup window replay was rejected because managed controller or shared workspace state diverged.`)}let i=Symbol(`MarkupWindowHistoryReplay`);this.#i.lease={token:i,kind:`replay`};try{return this.#v(e,t,n)}finally{this.#i.lease?.token===i&&(this.#i.lease=void 0)}}#b(e,t,n,r){let i=R(e),a=R(t),o,s;return{undo:()=>{if(o){let e=o;o=void 0,e===`restore`&&(i=this.#y(i,void 0,n,r));return}try{i=this.#y(e,a,n,r)}catch(e){throw s=e instanceof Bc?`noop`:`restore`,e}},redo:()=>{if(s){let e=s;s=void 0,e===`restore`&&(a=this.#y(a,void 0,n,r));return}try{a=this.#y(t,i,n,r)}catch(e){throw o=e instanceof Bc?`noop`:`restore`,e}}}}#x(e,t,n=!1){try{this.#v(e,t,n)}catch(r){try{this.#v(t,e,n)}catch(e){throw Il(r,e)}throw r}}};function Jc(e){return new qc(e)}function Yc(e){let t=Kc.get(e);return t||(t={},Kc.set(e,t)),t}function Xc(e){return e===`gesture`?`window-history-gesture-active`:e===`replay`?`window-history-replay-active`:`window-history-operation-active`}function Zc(e,t){let n=e[Gc]??e.id;return!(n!==void 0&&t.overlays.rootIds.includes(n))||e.action!==`focus`&&e.action!==`close`&&e.action!==`restore`}function L(e,t,n,r){return ul({action:e,id:t,targetId:n,parameters:r?{...r}:void 0})}function Qc(e,t){return{action:e.action,status:`disposed`,ok:!1,id:e.id,targetId:e.targetId,reason:t}}function $c(e,t,n){return{action:e.action,status:n,ok:!1,id:e.id,targetId:e.targetId,reason:t}}function el(e,t){let n=[e,t.action];return t.id&&n.push(cl(t.id)),t.targetId&&n.push(cl(t.targetId)),t.action===`dock`&&t.parameters?.edge&&n.push(cl(String(t.parameters.edge))),n.join(`.`)}function tl(e){let t=ll(e.id??`unknown`),n=ll(e.targetId??`unknown`);switch(e.action){case`focus`:return`Focus surface ${t}`;case`move`:return`Move window ${t}`;case`swap`:return`Swap windows ${t} and ${n}`;case`dock`:return`Dock window ${t} ${String(e.parameters?.edge??`beside`)} ${n}`;case`resize`:return`Resize split ${t}`;case`resize-ratio`:return`Resize split ratio ${t}`;case`minimize`:return`Minimize surface ${t}`;case`maximize`:return`Maximize window ${t}`;case`restore`:return`Restore surface ${t}`;case`close`:return`Close surface ${t}`;case`set-placement`:return`${e.parameters?.placement===`floating`?`Float`:`Tile`} window ${t}`;case`set-floating-rect`:return`Set floating rectangle ${t}`;case`move-by`:return`Move floating window ${t}`;case`resize-window`:return`Resize floating window ${t}`;case`snap`:return`Snap window ${t}`;case`set-always-on-top`:return`${e.parameters?.value===1?`Pin`:`Unpin`} window ${t}`;case`set-group`:return`${e.parameters?.groupId?`Group`:`Ungroup`} window ${t}`;case`recover-bounds`:return`Recover window bounds ${t}`;default:return`Update window ${t}`}}function nl(e,t=``){let n=e=>t?`${t}${e[0].toUpperCase()}${e.slice(1)}`:e;return{[n(`column`)]:e.column,[n(`row`)]:e.row,[n(`width`)]:e.width,[n(`height`)]:e.height}}function rl(e){return e?nl(e):{}}function il(e){return{columns:e.columns,rows:e.rows}}function R(e){return structuredClone(e)}function al(e,t,n){let r=R(e);return n.action!==`move-by`&&n.action!==`resize-window`?r:(r.controller.workspace=structuredClone(t.controller.workspace),r.controller.modals=t.controller.modals.map(e=>({...e})),r.overlays=structuredClone(t.overlays),r)}function ol(e,t){return JSON.stringify(e.controller)===JSON.stringify(t.controller)&&JSON.stringify(e.workspaceRegistrations)===JSON.stringify(t.workspaceRegistrations)&&JSON.stringify({activeId:e.overlays.activeId,externalActiveId:e.overlays.externalActiveId,rootIds:e.overlays.rootIds,registrations:e.overlays.registrations,surfaces:e.overlays.surfaces})===JSON.stringify({activeId:t.overlays.activeId,externalActiveId:t.overlays.externalActiveId,rootIds:t.overlays.rootIds,registrations:t.overlays.registrations,surfaces:t.overlays.surfaces})}function sl(e,t,n){return pl(e,n)||t}function cl(e){return encodeURIComponent(pl(e,Vc)).replaceAll(`.`,`%2E`)}function ll(e){return JSON.stringify(pl(e,Vc))}function ul(e){let t={},n=0,r=0,i=e.parameters??{};for(let e in i){if(r>=Uc)break;if(r+=1,!Object.hasOwn(i,e))continue;let a=i[e],o=pl(e,Vc);if(o){if(typeof a==`number`){if(!Number.isFinite(a))continue;t[o]=a}else t[o]=pl(String(a),Vc);n+=1}}let a=typeof e.id==`string`?e.id.trim().slice(0,Wc):void 0,o={action:e.action,id:a===void 0?void 0:pl(a,Vc),targetId:e.targetId===void 0?void 0:pl(e.targetId,Vc),...n===0?{}:{parameters:t}};return a!==void 0&&Object.defineProperty(o,Gc,{value:a}),o}function dl(e){return{...e,...e.parameters?{parameters:{...e.parameters}}:{}}}function fl(e){return pl(e,Hc)||`Update window`}function pl(e,t){if(typeof e!=`string`||t<=0)return``;let n=Math.min(e.length,t*4),r=``;for(let i=0;i<n&&r.length<t;i+=1){let a=e.charCodeAt(i);if(a>=55296&&a<=56319){let a=i+1<n?e.charCodeAt(i+1):-1;a>=56320&&a<=57343&&r.length+2<=t?(r+=e[i]+e[i+1],i+=1):r+=`�`;continue}r+=a>=56320&&a<=57343?`�`:e[i]}return r.trim()}function ml(e,t,n){return{action:e.action,status:t,ok:!0,id:e.id,targetId:e.targetId,...n===void 0?{}:{reason:n}}}function hl(e,t){let n={state:`unavailable`,operation:dl(e),changed:!1,reason:t};return Object.freeze({commit:()=>!1,cancel:()=>!1,inspect:()=>structuredClone(n)})}function gl(e,t,n){let r=new Map((t?.workspaceRegistrations??e.workspaceRegistrations).map(e=>[e.id,e.generation])),i=new Set;for(let t of e.workspaceRegistrations){let e=r.get(t.id)??t.generation;n.windowRegistrationGeneration(t.id)!==e&&i.add(t.id)}let a=n.snapshot(),o=new Map,s=[],c=a.layout.root?[a.layout.root]:[];for(;c.length>0;){let e=c.pop();e.kind===`pane`?(o.set(e.windowId,structuredClone(e)),s.push({id:e.windowId,minWidth:e.minWidth,minHeight:e.minHeight})):c.push(e.second,e.first)}let l=new Set(_l(e.controller.workspace.layout.root).map(({id:e})=>e)),u=new Set([...e.workspaceRegistrations.map(({id:e})=>e),...t?.workspaceRegistrations.map(({id:e})=>e)??[]]),d=s.filter(({id:e})=>!l.has(e)&&!u.has(e));if(i.size===0&&d.length===0)return;if(i.size>0){e.controller.workspace.layout.root=Sl(e.controller.workspace.layout.root,i,o);let n=new Set(e.controller.windowIds.filter(e=>!i.has(e)));if(e.controller.windowIds=e.controller.windowIds.filter(e=>n.has(e)),e.controller.minimizedWindowIds=e.controller.minimizedWindowIds.filter(e=>n.has(e)),e.controller.closedWindowIds=e.controller.closedWindowIds.filter(e=>n.has(e)),e.controller.focusOrderWindowIds=e.controller.focusOrderWindowIds.filter(e=>n.has(e)),e.controller.placements=e.controller.placements.filter(e=>n.has(e.id)).map(e=>e.snapTarget?.kind===`dock`&&i.has(e.snapTarget.targetId)?{...e,snapTarget:void 0}:e),e.workspaceRegistrations=e.workspaceRegistrations.filter(e=>n.has(e.id)),e.controller.maximizedWindowId&&i.has(e.controller.maximizedWindowId)&&(e.controller.maximizedWindowId=void 0),!e.controller.activeWindowId||i.has(e.controller.activeWindowId)){let r=t?.controller.activeWindowId;e.controller.activeWindowId=r&&n.has(r)?r:[...e.controller.focusOrderWindowIds].reverse().find(t=>!e.controller.minimizedWindowIds.includes(t)&&!e.controller.closedWindowIds.includes(t))}}let f=new Set(d.map(({id:e})=>e));d.length>0&&(e.controller.workspace.layout.root=vl(e.controller.workspace.layout.root,a.layout.root,f));let p=xl(a.layout.root,a.layout.activePaneId),m=p&&f.has(p)?p:void 0;if(d.length>0){let t=_l(e.controller.workspace.layout.root),n=new Set(t.map(({id:e})=>e));e.controller.workspace.layout=Ha(e.controller.workspace.layout,[...t,...d.filter(({id:e})=>!n.has(e))],{activeWindowId:m})}let h=e.controller.activeWindowId,g=e.controller.placements.find(e=>e.id===h)?.placement,_=m?Cl(e.controller.workspace.layout.root,m):h&&g===`tiled`?Cl(e.controller.workspace.layout.root,h):void 0,v=wl(e.controller.workspace.layout.root,e.controller.workspace.layout.activePaneId)?e.controller.workspace.layout.activePaneId:void 0,y=wl(e.controller.workspace.layout.root,a.layout.activePaneId)?a.layout.activePaneId:void 0;e.controller.workspace.layout.activePaneId=_??v??y??Tl(e.controller.workspace.layout.root)}function _l(e){let t=[],n=e?[e]:[];for(;n.length>0;){let e=n.pop();e.kind===`pane`?t.push({id:e.windowId,minWidth:e.minWidth,minHeight:e.minHeight}):n.push(e.second,e.first)}return t}function vl(e,t,n){if(!e||!t||n.size===0)return e;let r=new Map;for(let t of bl(e))r.set(t.windowId,t);let i=new Set,a=e,o=e=>{if(e.kind===`pane`)return;let t=yl(e,r,n);if(t.hasAddition&&!t.unsafe&&t.anchors.size===1){let n=t.anchors.values().next().value,o=r.get(n);if(o&&!i.has(n)){let t=new Set([n]),r=Sl(structuredClone(e),t,new Map([[n,o]]));r&&(a=Sl(a,t,new Map([[n,r]]))??a,i.add(n))}return}o(e.first),o(e.second)};return o(t),a}function yl(e,t,n){if(e.kind===`pane`)return n.has(e.windowId)?{hasAddition:!0,anchors:new Set,unsafe:!1}:t.has(e.windowId)?{hasAddition:!1,anchors:new Set([e.windowId]),unsafe:!1}:{hasAddition:!1,anchors:new Set,unsafe:!0};let r=yl(e.first,t,n),i=yl(e.second,t,n);return{hasAddition:r.hasAddition||i.hasAddition,anchors:new Set([...r.anchors,...i.anchors]),unsafe:r.unsafe||i.unsafe}}function bl(e){let t=[],n=e?[e]:[];for(;n.length>0;){let e=n.pop();e.kind===`pane`?t.push(e):n.push(e.second,e.first)}return t}function xl(e,t){if(!e||!t)return;let n=[e];for(;n.length>0;){let e=n.pop();if(e.kind===`pane`){if(e.id===t)return e.windowId}else n.push(e.second,e.first)}}function Sl(e,t,n){if(!e)return;if(e.kind===`pane`)return t.has(e.windowId)?structuredClone(n.get(e.windowId)):e;let r=Sl(e.first,t,n),i=Sl(e.second,t,n);return!r||!i?r??i:{...e,first:r,second:i}}function Cl(e,t){if(!e)return;let n=[e];for(;n.length>0;){let e=n.pop();if(e.kind===`pane`){if(e.windowId===t)return e.id}else n.push(e.second,e.first)}}function wl(e,t){if(!e||!t)return!1;let n=[e];for(;n.length>0;){let e=n.pop();if(e.kind===`pane`){if(e.id===t)return!0}else n.push(e.second,e.first)}return!1}function Tl(e){if(!e)return;let t=[e];for(;t.length>0;){let e=t.pop();if(e.kind===`pane`)return e.id;t.push(e.second,e.first)}}function El(e,t,n){let r=e.slice(),i=Ml(n.surfaces,r),a=n.activeId&&i.has(n.activeId)?n.activeId:void 0;return{activeId:a,externalActiveId:n.activeId!==void 0&&a===void 0?n.activeId:void 0,nextOrder:n.nextOrder,rootIds:r.slice(),registrations:n.surfaces.filter(e=>i.has(e.id)).map(e=>({id:e.id,generation:t.registrationGeneration(e.id)})),surfaces:n.surfaces.filter(e=>i.has(e.id)).map(Nl)}}function Dl(e,t,n,r){let i=e.activeId,a=new Map(e.registrations.map(e=>[e.id,e.generation])),o=t?new Map(t.surfaces.map(e=>[e.id,e])):void 0,s=new Map(n.surfaces.map(e=>[e.id,e])),c=new Map(e.surfaces.map(e=>[e.id,e])),l=new Set,u=new Set;for(let t of e.rootIds){let n=s.get(t),i=a.get(t),c=o?.get(t);if(!(n&&r.registrationGeneration(t)===i&&(!o||c&&Pl(c,n))))for(let n of Ml(e.surfaces,[t]))l.add(n),u.add(n)}l.size>0&&(e.rootIds=e.rootIds.filter(e=>!l.has(e)),e.surfaces=e.surfaces.filter(e=>!l.has(e.id)),e.registrations=e.registrations.filter(e=>!l.has(e.id)),e.activeId&&l.has(e.activeId)&&(e.activeId=void 0));let d=Ml(n.surfaces,e.rootIds),f=Ml(e.surfaces,e.rootIds);for(let t of f){if(e.rootIds.includes(t))continue;let n=s.get(t);if(!n){for(let n of Ml(e.surfaces,[t]))l.add(n),u.add(n);continue}let i=r.registrationGeneration(t),f=a.get(t),p=o?.get(t);if(!(i===f&&(!o||p&&Fl(p,n))))if(u.add(t),d.has(t)&&i!==void 0)c.set(t,Nl(n)),a.set(t,i);else for(let n of Ml(e.surfaces,[t]))l.add(n),u.add(n)}for(let t of n.surfaces){if(!d.has(t.id)||f.has(t.id))continue;let n=r.registrationGeneration(t.id);n!==void 0&&(u.add(t.id),e.surfaces.push(Nl(t)),e.registrations.push({id:t.id,generation:n}),c.set(t.id,Nl(t)),a.set(t.id,n))}l.size>0&&(e.surfaces=e.surfaces.filter(e=>!l.has(e.id)),e.registrations=e.registrations.filter(e=>!l.has(e.id))),e.surfaces=e.surfaces.map(e=>c.get(e.id)??e),e.registrations=e.registrations.map(e=>({id:e.id,generation:a.get(e.id)??e.generation}));let p=Ml(e.surfaces,e.rootIds),m=i!==void 0&&!p.has(i);e.activeId&&!p.has(e.activeId)&&(e.activeId=void 0),n.activeId&&u.has(n.activeId)?p.has(n.activeId)?(e.activeId=n.activeId,e.externalActiveId=void 0):(e.activeId=void 0,e.externalActiveId=n.activeId):m&&n.activeId&&p.has(n.activeId)&&(e.activeId=n.activeId,e.externalActiveId=void 0)}function Ol(e,t,n,r){let i=Ml(n.surfaces,e.rootIds),a=t?.externalActiveId??t?.activeId,o=t!==void 0&&n.activeId!==a;r||o?Al(e,n.activeId,i):e.externalActiveId&&!n.surfaces.some(t=>t.id===e.externalActiveId)&&(e.externalActiveId=void 0)}function kl(e,t,n,r,i){e.externalActiveId&&!r.surfaces.some(t=>t.id===e.externalActiveId)&&(e.externalActiveId=void 0);let a=r.activeId;if(!a||a===t.activeId)return;let o=t.surfaces.find(e=>e.id===a),s=r.surfaces.find(e=>e.id===a),c=i.registrationGeneration(a)!==n.get(a);o&&s&&!c&&Fl(o,s)||Al(e,a,Ml(r.surfaces,e.rootIds))}function Al(e,t,n){t&&n.has(t)?(e.activeId=t,e.externalActiveId=void 0):(e.activeId=void 0,e.externalActiveId=t)}function jl(e,t,n=e.snapshot()){let r=n,i=Ml(r.surfaces,t.rootIds),a=[],o=!1;for(let e of r.surfaces){if(i.has(e.id)){if(!o){for(let e of t.surfaces)a.push(Nl(e));o=!0}continue}a.push(Nl(e))}if(!o)for(let e of t.surfaces)a.push(Nl(e));let s=t.nextOrder;for(let e of a)s=Math.max(s,e.order+1);let c=new Set(t.surfaces.map(e=>e.id)),l=(t.externalActiveId&&a.some(e=>e.id===t.externalActiveId)?t.externalActiveId:void 0)??(t.activeId&&c.has(t.activeId)?t.activeId:void 0);e.restoreSnapshot({activeId:l,nextOrder:s,surfaces:a},{synchronizeFocus:!0})}function Ml(e,t){let n=new Set(t),r=new Map;for(let t of e){if(!t.ownerId)continue;let e=r.get(t.ownerId);e?e.push(t.id):r.set(t.ownerId,[t.id])}let i=[...n];for(let e=0;e<i.length;e+=1)for(let t of r.get(i[e])??[])n.has(t)||(n.add(t),i.push(t));return n}function Nl(e){return{...e,rect:{...e.rect}}}function Pl(e,t){return Fl(e,t)&&e.rect.column===t.rect.column&&e.rect.row===t.rect.row&&e.rect.width===t.rect.width&&e.rect.height===t.rect.height&&e.closeOnOutsideClick===t.closeOnOutsideClick}function Fl(e,t){return e.id===t.id&&e.layer===t.layer&&e.kind===t.kind&&e.modal===t.modal&&e.ownerId===t.ownerId}function Il(e,t){return new zc(`snapshot-mismatch`,`Window gesture restoration failed and compensation could not restore the prior snapshot.`,void 0,AggregateError([e,t],`Window gesture restoration and compensation both failed.`))}function Ll(e){return pl(e instanceof Error?e.message:String(e),Hc)||`window-history-gesture-failed`}var Rl=`markup-floating-windows`,zl=2,Bl=1,Vl=1,Hl=.2,Ul=4,Wl=1e9,Gl=128,Kl=64;function ql(e,t,n={}){let r=eu(t),i=Zl(n);if(!(!r||!i)&&!e.topModalId)for(let t=e.floatingZOrder.length-1;t>=0;--t){let n=e.floatingZOrder[t];if(!(!n.visible||!lu(n.rect,r)))return Object.freeze({id:n.id,region:Yl(n,r,i),rect:Object.freeze(hu(n.rect)),zIndex:n.zIndex,alwaysOnTop:n.alwaysOnTop})}}var Jl=class{controller;capture;history;#e;#t;#n;#r;#i;#a;#o=!1;#s;#c;#l=new Map;#u;#d=!1;#f=!1;constructor(e){if(!e||typeof e!=`object`)throw TypeError(`Window interaction options are required.`);if(this.controller=e.controller,this.capture=e.capture,this.history=e.history,this.history&&this.history.controller!==this.controller)throw TypeError(`Window interaction history must wrap the same window controller.`);this.#e=Xl(e);let t=this.capture.registerOwner({id:this.#e.ownerId,onPointer:e=>{let t=this.#i,n=this.#a;if(!(!t||!n||this.#o||e.pointerId!==n.pointerId||e.kind!==n.kind||e.sequence!==n.sequence)){this.#o=!0;try{this.#s=this.#h(e,t)}catch(t){this.#s=this.#D(e,t)}}}});this.#t=t;try{this.#n=this.capture.subscribe(e=>this.#m(e))}catch(e){throw t.dispose(),e}}hitTest(e,t){if(!this.#d){this.#d=!0;try{if(this.#k()||this.controller.overlays.topModal())return;let n=$l(t);if(!n)return;try{let t=ql(this.controller.project(n),e,this.#e);return this.#k()?void 0:t}catch{return}}finally{this.#d=!1}}}handlePointer(e,t){if(this.#d)return z({status:`blocked`,handled:!1,reason:`interaction-route-is-reentrant`});this.#d=!0;try{return this.#p(e,t)}finally{this.#d=!1}}#p(e,t){let n=this.#k(),r;try{r=Pi(e)}catch{return n?this.#F(z({status:`disposed`,handled:!1,reason:`interaction-dependency-disposed`})):this.#F(z({status:`ignored`,handled:!1,reason:`pointer-event-is-invalid`}))}n=this.#k()||n;let i=this.#l.get(r.pointerId);if(i?.pointerId===r.pointerId&&r.kind!==`down`)return this.#l.delete(r.pointerId),this.#F(z({...i,pointerKind:i.pointerKind??r.kind}));if(i?.pointerId===r.pointerId&&this.#l.delete(r.pointerId),r.kind===`down`&&this.#l.size>=Kl)return this.#F(z({status:`blocked`,handled:!1,pointerId:r.pointerId,pointerKind:r.kind,reason:`pending-lifecycle-settlement-capacity-exhausted`}));if(n)return this.#F(z({status:`disposed`,handled:!1,pointerId:r.pointerId,pointerKind:r.kind,reason:`interaction-dependency-disposed`}));if(this.#i)return this.#F(z({status:`blocked`,handled:!1,pointerId:r.pointerId,pointerKind:r.kind,reason:`interaction-route-is-reentrant`}));let a=$l(t);if(this.#k()){let e=this.#l.get(r.pointerId);return e&&r.kind!==`down`?(this.#l.delete(r.pointerId),this.#F(z({...e,pointerKind:e.pointerKind??r.kind}))):(e&&this.#l.delete(r.pointerId),this.#F(z({status:`disposed`,handled:!1,pointerId:r.pointerId,pointerKind:r.kind,reason:`interaction-dependency-disposed`})))}let o=this.capture.captureOwner(r.pointerId)===this.#e.ownerId;if(!a&&o&&this.#r?.pointerId===r.pointerId&&(r.kind===`up`||r.kind===`cancel`)&&(a=hu(this.#r.bounds)),!a)return this.#F(z({status:`ignored`,handled:!1,pointerId:r.pointerId,pointerKind:r.kind,reason:`bounds-are-invalid-or-empty`}));let s;if(r.kind===`down`){if(!uu(r))return this.#F(fu(r,`pointer-is-not-a-primary-activation`));let e=nu(r);if(!e)return this.#F(fu(r,`pointer-has-no-finite-cell-coordinate`));let t=this.controller.overlays.topModal();if(t)return this.#F(z({status:`blocked`,handled:!1,pointerId:r.pointerId,pointerKind:r.kind,reason:`pointer-blocked-by-modal-overlay:${t.id}`}));let n;try{n=this.controller.project(a)}catch(e){return this.#F(z({status:`failed`,handled:!1,pointerId:r.pointerId,pointerKind:r.kind,reason:`window-projection-failed:${_u(e)}`}))}let i=ql(n,e,this.#e);if(!i)return this.#F(fu(r,`pointer-did-not-hit-a-floating-window`));if(i.region===`client`)return this.#F(z({status:`ignored`,handled:!1,pointerId:r.pointerId,pointerKind:r.kind,windowId:i.id,region:i.region,reason:`client-hit-is-not-a-window-geometry-gesture`}));if(n.floatingZOrder.find(e=>e.id===i.id)?.state===`maximized`)return this.#F(z({status:`blocked`,handled:!1,pointerId:r.pointerId,pointerKind:r.kind,windowId:i.id,region:i.region,reason:`maximized-window-geometry-is-not-interactive`}));s=this.#e.ownerId}else if(!o)return this.#F(fu(r,`pointer-is-not-captured-by-this-controller`));this.#i=a,this.#a={kind:r.kind,pointerId:r.pointerId,sequence:r.sequence},this.#o=!1,this.#s=void 0;let c;try{c=this.capture.route(r,s).error?.message}catch(e){c=_u(e)}finally{this.#i=void 0,this.#a=void 0,this.#o=!1}let l=this.#s;return this.#s=void 0,l?this.#F(l):this.#F(z({status:c?`failed`:`ignored`,handled:!1,pointerId:r.pointerId,pointerKind:r.kind,reason:c?`pointer-route-failed:${c}`:`pointer-route-had-no-owner`}))}inspect(){return this.#k(),{disposed:this.#f,ownerId:this.#e.ownerId,titleBarHeight:this.#e.titleBarHeight,resizeMargin:this.#e.resizeMargin,snapDistance:this.#e.snapDistance,snapEdgeSpanRatio:this.#e.snapEdgeSpanRatio,snapCornerReach:this.#e.snapCornerReach,snapOnRelease:this.#e.snapOnRelease,active:this.#r?mu(this.#r):void 0,lastResult:this.#c?pu(this.#c):void 0}}dispose(){if(this.#f)return;let e=this.#u;if(e){this.#N(e,!0),this.#n(),this.#t.dispose(),this.#f=!0;return}let t=this.#r,n=t?this.#j(t,`lifecycle`,`rollback`):void 0;try{if(t){try{this.#E(t);let e=z({status:`cancelled`,handled:!0,pointerId:t.pointerId,windowId:t.windowId,mode:t.mode,region:t.region,updateCount:t.updateCount,historyRecorded:!1,reason:`controller-disposed`});this.#c=e,this.#P(e)}catch(e){let n=z({status:`failed`,handled:!0,pointerId:t.pointerId,windowId:t.windowId,mode:t.mode,region:t.region,updateCount:t.updateCount,reason:`dispose-cancellation-failed:${_u(e)}`});this.#c=n,this.#P(n)}this.#r=void 0}this.#n(),this.#t.dispose(),this.#f=!0}finally{n&&this.#M(n)}}#m(e){let t=this.#r,n=e.previousOwnerId===this.#e.ownerId&&e.nextOwnerId!==this.#e.ownerId;if(t&&n&&e.pointerId===t.pointerId)if(this.#u?.active===t)this.#N(this.#u,e.kind===`owner-disposed`);else{let n=this.#j(t,`lifecycle`,`rollback`),r=`pointer-capture-${e.kind}`,i=!1;try{try{this.#E(t)}catch(e){i=!0,r+=`;cancel:${_u(e)}`}this.#r=void 0;let n=z({status:i?`failed`:e.kind===`owner-disposed`?`disposed`:`cancelled`,handled:!0,pointerId:t.pointerId,windowId:t.windowId,mode:t.mode,region:t.region,updateCount:t.updateCount,historyRecorded:!1,reason:r});this.#c=n,this.#P(n)}finally{this.#M(n)}}e.kind===`owner-disposed`&&e.previousOwnerId===this.#e.ownerId&&(this.#n(),this.#f=!0)}#h(e,t){if(e.kind===`down`)return this.#g(e,t);let n=this.#r;if(!n||n.pointerId!==e.pointerId)return fu(e,`pointer-does-not-own-the-active-window-gesture`);n.bounds=hu(t);let r=n.historyGesture?.inspect();return r?.state===`cancelled`||r?.state===`unavailable`?(this.#r=void 0,this.#O(e.pointerId),z({status:`cancelled`,handled:!0,pointerId:e.pointerId,pointerKind:e.kind,windowId:n.windowId,mode:n.mode,region:n.region,updateCount:n.updateCount,historyRecorded:!1,reason:r.reason??`window-history-gesture-cancelled`})):r?.state===`failed`?this.#D(e,Error(r.reason??`window-history-gesture-failed`)):e.kind===`cancel`?this.#T(e,n):e.kind===`move`?this.#x(e,n,t):e.kind===`up`?this.#C(e,n,t):z({status:`ignored`,handled:!1,pointerId:e.pointerId,pointerKind:e.kind,windowId:n.windowId,mode:n.mode,region:n.region,updateCount:n.updateCount,reason:`pointer-kind-does-not-update-window-geometry`})}#g(e,t){if(this.#r)return z({status:`blocked`,handled:!1,pointerId:e.pointerId,pointerKind:e.kind,reason:`another-window-gesture-is-active`});let n=nu(e),r=this.#_(n,t);if(typeof r==`string`)return this.#b(e,r);try{this.capture.capture(e.pointerId,this.#e.ownerId)}catch(t){return z({status:`blocked`,handled:!1,pointerId:e.pointerId,pointerKind:e.kind,windowId:r.hit.id,mode:r.mode,region:r.hit.region,reason:`pointer-capture-failed:${_u(t)}`})}let i=this.#_(n,t,r);if(typeof i==`string`||this.capture.captureOwner(e.pointerId)!==this.#e.ownerId)return this.#O(e.pointerId),this.#b(e,typeof i==`string`?i:`pointer-capture-was-lost-during-gesture-start`,r);let a,o,s,c;try{if(this.history){if(a=this.history.beginGesture({action:i.mode===`move`?`move-by`:`resize-window`,id:i.hit.id,parameters:i.mode===`resize`?{edge:i.hit.region}:void 0}),a.inspect().state!==`active`)throw Error(a.inspect().reason??`window-history-gesture-unavailable`)}else o=this.controller.snapshot();let r=this.controller.focus(i.hit.id);if(!r.ok)throw Error(r.reason??`focus-${r.status}`);let l=this.#_(n,t,i);typeof l==`string`?c=l:s=l;let u=a?.inspect();u&&u.state!==`active`&&(c=u.reason??`window-history-gesture-${u.state}`),this.capture.captureOwner(e.pointerId)!==this.#e.ownerId&&(c=`pointer-capture-was-lost-during-gesture-start`)}catch(e){c=`gesture-start-failed:${_u(e)}`}if(c||!s){let t;try{this.#y(a,o)}catch(e){t=_u(e)}return this.#O(e.pointerId),z({status:t?`failed`:this.#v()?`disposed`:`blocked`,handled:!1,pointerId:e.pointerId,pointerKind:e.kind,windowId:i.hit.id,mode:i.mode,region:i.hit.region,historyRecorded:!1,reason:`${c??`gesture-start-invalidated`}${t?`;cancel:${t}`:``}`})}return this.#r={pointerId:e.pointerId,windowId:s.hit.id,mode:s.mode,region:s.hit.region,resizeEdge:s.mode===`resize`?s.hit.region:void 0,start:n,current:n,startRect:hu(s.hit.rect),bounds:hu(t),updateCount:0,geometryPrepared:!1,groupId:s.projectedWindow.groupId,before:o,historyGesture:a},z({status:`started`,handled:!0,pointerId:e.pointerId,pointerKind:e.kind,windowId:s.hit.id,mode:s.mode,region:s.hit.region,updateCount:0})}#_(e,t,n){if(this.#v())return`interaction-dependency-disposed-during-gesture-start`;let r=this.controller.overlays.topModal();if(r)return`pointer-blocked-by-modal-overlay:${r.id}`;let i;try{i=this.controller.project(t)}catch(e){return`window-projection-failed:${_u(e)}`}let a=ql(i,e,this.#e);if(!a||a.region===`client`)return`gesture-hit-is-no-longer-actionable`;let o=i.floatingZOrder.find(e=>e.id===a.id);if(!o)return`window-is-no-longer-visible`;let s=a.region===`title-bar`?`move`:`resize`;return n&&(a.id!==n.hit.id||a.region!==n.hit.region||s!==n.mode)?`gesture-target-changed-during-start`:o.state===`maximized`?`maximized-window-geometry-is-not-interactive`:s===`move`&&o.groupId&&i.floatingWindows.some(e=>e.groupId===o.groupId&&e.snapTarget!==void 0)?`snapped-window-group-move-is-ambiguous`:{hit:a,projectedWindow:o,mode:s}}#v(){return this.#f||this.capture.disposed||this.#t.isDisposed()||this.controller.disposed||!!this.history?.disposed}#y(e,t){if(e){let t=e.inspect();if(t.state===`active`){if(!e.cancel()&&e.inspect().state===`failed`)throw Error(e.inspect().reason??`history-gesture-cancel-failed`)}else if(t.state===`failed`)throw Error(t.reason??`history-gesture-failed`);return}if(!t)return;let n=this.controller.restoreSnapshot(t);if(!n.ok)throw Error(n.reason??`snapshot-${n.status}`)}#b(e,t,n){return z({status:this.#v()?`disposed`:`blocked`,handled:!1,pointerId:e.pointerId,pointerKind:e.kind,windowId:n?.hit.id,mode:n?.mode,region:n?.hit.region,reason:t})}#x(e,t,n){let{projection:r,projectedWindow:i}=this.#S(t,n),a=nu(e);if(!a)return z({status:`ignored`,handled:!1,pointerId:e.pointerId,pointerKind:e.kind,windowId:t.windowId,mode:t.mode,region:t.region,updateCount:t.updateCount,reason:`pointer-has-no-finite-cell-coordinate`});let o=ru(t.current,a);if(o.columns===0&&o.rows===0)return z({status:`ignored`,handled:!1,pointerId:e.pointerId,pointerKind:e.kind,windowId:t.windowId,mode:t.mode,region:t.region,updateCount:t.updateCount,reason:`pointer-cell-did-not-change`});let s,c=hu(i.floatingRect);if(!t.geometryPrepared){let e=t.mode===`move`&&t.groupId?r.floatingWindows.filter(e=>e.visible&&e.groupId===t.groupId):[i];for(let n of e){let e=n.id===t.windowId&&t.mode===`move`&&n.snapTarget&&n.restoreRect?iu(n.restoreRect,t.startRect,t.start):n.rect,r=this.controller.setFloatingRect(n.id,e);if(!r.ok)throw Error(r.reason??`window-${r.status}`);n.id===t.windowId&&(s=r,c=hu(e))}t.geometryPrepared=!0}let l=t.mode===`move`?this.controller.moveBy(t.windowId,o):this.controller.resizeWindow(t.windowId,t.resizeEdge,o);if(!l.ok)throw Error(l.reason??`window-${l.status}`);if(t.mode===`move`)t.current=a;else{let e=this.controller.project(n).floatingWindows.find(e=>e.id===t.windowId)?.floatingRect??c,r=au(t.resizeEdge),i=ou(t.resizeEdge);t.current.column=r?t.current.column+su(t.resizeEdge,c,e):a.column,t.current.row=i?t.current.row+cu(t.resizeEdge,c,e):a.row}t.bounds=hu(n);let u=s?.status===`applied`||l.status===`applied`;return u&&(t.updateCount+=1),z({status:u?`updated`:`ignored`,handled:u,pointerId:e.pointerId,pointerKind:e.kind,windowId:t.windowId,mode:t.mode,region:t.region,updateCount:t.updateCount,action:l,reason:!u&&l.status===`unchanged`?`window-geometry-was-clamped-or-unchanged`:void 0})}#S(e,t){let n=e.historyGesture?.inspect().state;if(n&&n!==`active`)throw Error(`window-history-gesture-${n}`);let r=this.controller.project(t),i=this.controller.overlays.topModal();if(i)throw Error(`window-gesture-blocked-by-modal:${i.id}`);let a=r.floatingZOrder.find(t=>t.id===e.windowId);if(!a||a.state===`maximized`)throw Error(a?`maximized-window-geometry-is-not-interactive`:`window-is-no-longer-visible`);if(e.mode===`move`&&e.groupId&&r.floatingWindows.some(t=>t.groupId===e.groupId&&t.snapTarget!==void 0))throw Error(`snapped-window-group-move-is-ambiguous`);return{projection:r,projectedWindow:a}}#C(e,t,n){let r=this.#j(t,`return`,`commit`);try{return this.#w(e,t,n,r)}finally{this.#M(r)}}#w(e,t,n,r){let i=nu(e);i||this.#S(t,n);let a=i?this.#x(e,t,n):void 0;if(a?.status===`failed`||a?.status===`blocked`)return this.#D(e,Error(a.reason??`final-window-update-failed`));let o,s;if(t.mode===`move`&&t.updateCount>0&&!t.groupId&&this.#e.snapOnRelease&&(o=du(nu(e)??t.current,n,this.#e.snapDistance,this.#e.snapEdgeSpanRatio,this.#e.snapCornerReach),o&&(s=this.controller.snap(t.windowId,o,n),!s.ok)))return this.#D(e,Error(s.reason??`snap-${s.status}`));let c=!1;try{c=t.historyGesture?.commit()??!1}catch(t){return this.#D(e,t)}if(r.cancellationError)return this.#D(e,Error(`settlement-cancellation-failed:${r.cancellationError}`));let l=t.historyGesture?.inspect();if(r.cancellationRequested&&!t.historyGesture){try{this.#E(t)}catch(t){return this.#D(e,t)}return this.#r=void 0,z({status:`cancelled`,handled:!0,pointerId:e.pointerId,pointerKind:e.kind,windowId:t.windowId,mode:t.mode,region:t.region,updateCount:t.updateCount,historyRecorded:!1,reason:r.disposalRequested?`controller-disposed-during-commit`:`interaction-cancelled-during-commit`})}return this.#r=void 0,l?.state===`cancelled`||l?.state===`unavailable`?z({status:`cancelled`,handled:!0,pointerId:e.pointerId,pointerKind:e.kind,windowId:t.windowId,mode:t.mode,region:t.region,updateCount:t.updateCount,historyRecorded:!1,reason:l.reason??`window-history-gesture-cancelled`}):z({status:`committed`,handled:!0,pointerId:e.pointerId,pointerKind:e.kind,windowId:t.windowId,mode:t.mode,region:t.region,updateCount:t.updateCount,historyRecorded:c,snapTarget:o,action:s??a?.action})}#T(e,t){let n=this.#j(t,`return`,`rollback`);try{try{this.#E(t)}catch(t){return this.#D(e,t)}return this.#r=void 0,z({status:`cancelled`,handled:!0,pointerId:e.pointerId,pointerKind:e.kind,windowId:t.windowId,mode:t.mode,region:t.region,updateCount:t.updateCount,historyRecorded:!1,reason:`pointer-cancelled`})}finally{this.#M(n)}}#E(e){let t,n;if(!this.controller.disposed)try{t=this.controller.snapshot()}catch(e){n=e}let r;try{if(e.historyGesture){if(!e.historyGesture.cancel()&&e.historyGesture.inspect().state===`failed`)throw Error(e.historyGesture.inspect().reason??`history-gesture-cancel-failed`)}else if(e.before){let t=this.controller.restoreSnapshot(e.before);if(!t.ok)throw Error(t.reason??`snapshot-${t.status}`)}}catch(e){r=e}if(r&&n)throw AggregateError([n,r],`Gesture dependency capture and cancellation both failed.`);if(r)throw r;if(n)throw n;if(!t||this.controller.disposed)return;let i=this.controller.snapshot();if(JSON.stringify(i.workspace)===JSON.stringify(t.workspace)&&JSON.stringify(i.modals)===JSON.stringify(t.modals))return;let a={...i,workspace:structuredClone(t.workspace),modals:t.modals.map(e=>({...e}))},o=this.controller.restoreSnapshot(a);if(!o.ok)throw Error(o.reason??`dependency-snapshot-${o.status}`)}#D(e,t){let n=this.#r,r=n?this.#j(n,`return`,`rollback`):void 0;r&&(r.phase=`rollback`);let i;try{if(n){try{this.#E(n)}catch(e){i=_u(e)}this.#r=void 0}return this.#O(e.pointerId),z({status:`failed`,handled:!!n,pointerId:e.pointerId,pointerKind:e.kind,windowId:n?.windowId,mode:n?.mode,region:n?.region,updateCount:n?.updateCount,reason:`${_u(t)}${i?`;cancel:${i}`:``}`})}finally{r&&this.#M(r)}}#O(e){if(!(this.capture.disposed||this.capture.captureOwner(e)!==this.#e.ownerId))try{this.capture.release(e,this.#e.ownerId)}catch{}}#k(){if(this.#f)return!0;this.#A();let e=this.controller.disposed,t=this.history?.disposed??!1;if(!this.capture.disposed&&!this.#t.isDisposed()&&!e&&!t)return!1;let n=this.#r,r;if(n)if(this.#u?.active===n)this.#N(this.#u,!0);else{let e=this.#j(n,`lifecycle`,`rollback`);try{try{this.#E(n)}catch(e){r=_u(e)}this.#r=void 0;let e=z({status:r?`failed`:`disposed`,handled:!0,pointerId:n.pointerId,windowId:n.windowId,mode:n.mode,region:n.region,updateCount:n.updateCount,historyRecorded:!1,reason:r?`dependency-disposal-cancellation-failed:${r}`:`interaction-dependency-disposed`});this.#c=e,this.#P(e)}finally{this.#M(e)}}return this.#n(),this.#t.dispose(),this.#f=!0,!0}#A(){let e=this.#r;if(!e?.historyGesture)return;let t;try{t=e.historyGesture.inspect()}catch(n){t={state:`failed`,operation:{action:`move-by`,id:e.windowId},reason:_u(n)}}if(t.state===`active`||t.state===`committed`)return;this.#r=void 0,this.#O(e.pointerId);let n=z({status:t.state===`failed`?`failed`:`cancelled`,handled:!0,pointerId:e.pointerId,windowId:e.windowId,mode:e.mode,region:e.region,updateCount:e.updateCount,historyRecorded:!1,reason:t.reason??`window-history-gesture-${t.state}`});this.#c=n,this.#P(n)}#j(e,t,n){if(this.#u){if(this.#u.active!==e)throw Error(`A different window interaction is already settling.`);return this.#u.claims+=1,this.#u}let r={active:e,delivery:t,phase:n,claims:1};return this.#u=r,r}#M(e){e.claims=Math.max(0,e.claims-1),e.claims===0&&this.#u===e&&(this.#u=void 0)}#N(e,t=!1){if(e.cancellationRequested=!0,t&&(e.disposalRequested=!0),!(e.phase!==`commit`||!e.active.historyGesture))try{e.active.historyGesture.cancel()}catch(t){e.cancellationError=_u(t)}}#P(e){e.pointerId!==void 0&&(this.#l.delete(e.pointerId),!(this.#l.size>=Kl)&&this.#l.set(e.pointerId,pu(e)))}#F(e){return e.pointerId!==void 0&&e.status!==`started`&&e.status!==`updated`&&this.#l.delete(e.pointerId),this.#c=pu(e),e}};function Yl(e,t,n){let r=e.rect,i=t.column-r.column,a=r.column+r.width-1-t.column,o=t.row-r.row,s=r.row+r.height-1-t.row,c=Math.min(n.resizeMargin,Math.ceil(r.width/2)),l=Math.min(n.resizeMargin,Math.ceil(r.height/2)),u=i<c,d=a<c,f=o<l,p=s<l,m=u&&d?i<=a?`left`:`right`:u?`left`:d?`right`:void 0;if((!m||r.width<=c*2)&&o<Math.min(n.titleBarHeight,r.height))return`title-bar`;let h=f&&p?o<=s?`top`:`bottom`:f?`top`:p?`bottom`:void 0;return m&&h?`${h}-${m}`:m||h||`client`}function Xl(e){let t,n,r,i,a,o,s;try{t=e.ownerId,n=e.titleBarHeight,r=e.resizeMargin,i=e.snapDistance,a=e.snapEdgeSpanRatio,o=e.snapCornerReach,s=e.snapOnRelease}catch{throw TypeError(`Window interaction options could not be read safely.`)}let c=Zl({titleBarHeight:n,resizeMargin:r});if(!c)throw RangeError(`Window title-bar and resize metrics must be bounded non-negative integers.`);let l=Ql(t),u=i??Vl;if(!Number.isSafeInteger(u)||u<0||u>Wl)throw RangeError(`Window snap distance must be a bounded non-negative integer.`);if(s!==void 0&&typeof s!=`boolean`)throw TypeError(`Window snapOnRelease must be boolean.`);let d=a??Hl;if(!Number.isFinite(d)||d<=0||d>1)throw RangeError(`Window snap edge span ratio must be in (0, 1].`);let f=o??Ul;if(!Number.isSafeInteger(f)||f<1||f>Wl)throw RangeError(`Window snap corner reach must be a bounded positive integer.`);return{ownerId:l,...c,snapDistance:u,snapEdgeSpanRatio:d,snapCornerReach:f,snapOnRelease:s??!0}}function Zl(e){try{let t=e.titleBarHeight??zl,n=e.resizeMargin??Bl;return!Number.isSafeInteger(t)||t<1||t>Wl||!Number.isSafeInteger(n)||n<0||n>Wl?void 0:{titleBarHeight:t,resizeMargin:n}}catch{return}}function Ql(e){let t=e?.trim()||Rl;if(t.length>Gl||gu(t))throw TypeError(`Window interaction owner id is invalid or too long.`);return t}function $l(e){try{let t=tu(e,`column`),n=tu(e,`row`),r=tu(e,`width`),i=tu(e,`height`);if(t===void 0||n===void 0||r===void 0||i===void 0||![t,n,r,i].every(Number.isFinite))return;let a={column:Math.floor(t),row:Math.floor(n),width:Math.floor(r),height:Math.floor(i)};return!Number.isSafeInteger(a.column)||!Number.isSafeInteger(a.row)||a.width<1||a.height<1||a.width>Wl||a.height>Wl||Math.abs(a.column)>Wl||Math.abs(a.row)>Wl?void 0:a}catch{return}}function eu(e){try{let t=tu(e,`column`),n=tu(e,`row`);if(t===void 0||n===void 0||!Number.isFinite(t)||!Number.isFinite(n))return;let r={column:Math.floor(t),row:Math.floor(n)};return!Number.isSafeInteger(r.column)||!Number.isSafeInteger(r.row)||Math.abs(r.column)>Wl||Math.abs(r.row)>Wl?void 0:r}catch{return}}function tu(e,t){let n=Object.getOwnPropertyDescriptor(e,t);return n&&`value`in n&&typeof n.value==`number`?n.value:void 0}function nu(e){let t=e.coordinates.cell;return t?eu({column:t.x,row:t.y}):void 0}function ru(e,t){return{columns:t.column-e.column,rows:t.row-e.row}}function iu(e,t,n){let r=t.width<=1?0:Math.max(0,Math.min(1,(n.column-t.column)/(t.width-1))),i=Math.round(r*Math.max(0,e.width-1)),a=Math.max(0,Math.min(e.height-1,n.row-t.row));return{...hu(e),column:n.column-i,row:n.row-a}}function au(e){return e===`left`||e===`right`||e.endsWith(`-left`)||e.endsWith(`-right`)}function ou(e){return e===`top`||e===`bottom`||e.startsWith(`top-`)||e.startsWith(`bottom-`)}function su(e,t,n){return e===`left`||e.endsWith(`-left`)?n.column-t.column:n.column+n.width-(t.column+t.width)}function cu(e,t,n){return e===`top`||e.startsWith(`top-`)?n.row-t.row:n.row+n.height-(t.row+t.height)}function lu(e,t){return t.column>=e.column&&t.row>=e.row&&t.column<e.column+e.width&&t.row<e.row+e.height}function uu(e){return e.primary&&(e.button===0||e.device!==`mouse`&&e.button===null)}function du(e,t,n,r,i){let a=t.column,o=t.column+t.width-1,s=t.row,c=t.row+t.height-1,l=e.column>=a-n&&e.column<=o+n,u=e.row>=s-n&&e.row<=c+n,d=u&&Math.abs(e.column-a)<=n,f=u&&Math.abs(e.column-o)<=n,p=l&&e.row<=s&&e.row>=s-n,m=l&&e.row>=c&&e.row<=c+n,h=e.column<=a+i-1,g=e.column>=o-i+1,_=e.row<=s+i-1,v=e.row>=c-i+1,y=p&&h||d&&_?`top-left`:p&&g||f&&_?`top-right`:m&&h||d&&v?`bottom-left`:m&&g||f&&v?`bottom-right`:void 0;if(y)return{kind:`corner`,corner:y};let b=Math.max(1,Math.round(t.width*r/2)),x=a+(t.width-1)/2,S=Math.abs(e.column-x)<=b;if(p&&S)return{kind:`workspace`,edge:`top`};if(m&&S)return{kind:`workspace`,edge:`bottom`};if(d&&f)return{kind:`workspace`,edge:Math.abs(e.column-a)<=Math.abs(e.column-o)?`left`:`right`};if(d)return{kind:`workspace`,edge:`left`};if(f)return{kind:`workspace`,edge:`right`}}function fu(e,t){return z({status:`ignored`,handled:!1,pointerId:e.pointerId,pointerKind:e.kind,reason:t})}function z(e){let t=pu(e);return t.action&&Object.freeze(t.action),t.snapTarget&&Object.freeze(t.snapTarget),Object.freeze(t)}function pu(e){return{...e,action:e.action?{...e.action}:void 0,snapTarget:e.snapTarget?{...e.snapTarget}:void 0}}function mu(e){return{pointerId:e.pointerId,windowId:e.windowId,mode:e.mode,region:e.region,resizeEdge:e.resizeEdge,start:{...e.start},current:{...e.current},startRect:hu(e.startRect),updateCount:e.updateCount}}function hu(e){return{column:e.column,row:e.row,width:e.width,height:e.height}}function gu(e){for(let t=0;t<e.length;t+=1){let n=e.charCodeAt(t);if(n<=31||n===127)return!0}return!1}function _u(e){try{let t=e instanceof Error?e.message:String(e);return t.length>512?`${t.slice(0,511)}…`:t}catch{return`uninspectable-window-interaction-error`}}var vu={column:0,row:0,width:0,height:0},B=1e6,yu=256,bu=128,xu=1024,Su=4096,Cu=64,wu={margin:0,titleBarHeight:1},Tu=class{workspace;overlays;#e=new Map;#t=new Map;#n=new Set;#r=new Map;#i=new Set;#a=new Map;#o=new Set;#s=new Set;#c=new Map;#l=new Map;#u=new Map;#d=new Map;#f=new Map;#p=new Set;#m=new Map;#h=[];#g;#_;#v;#y=[];#b=!1;#x=!1;constructor(e){this.workspace=e.workspace,this.overlays=e.overlays,this.#v=Hd(e.compactMode),this.reconcile(e.root,{layout:e.layout})}get disposed(){return this.#x}get mutationInProgress(){return this.#b}reconcile(e,t={}){this.#re(`reconcile`);let n=this.#k();this.#b=!0;try{try{return this.#S(e,t)}catch(e){try{this.#A(n)}catch(t){throw AggregateError([e,t],`Window reconciliation and rollback publication failed.`)}throw e}}finally{this.#b=!1}}#S(e,t){this.#V(),this.#z();let n=Eu(e,t.layout),r=this.#e,i=this.#t,a=this.#n,o=this.#i,s=n.diagnostics.slice(),c=new Set(this.workspace.inspect().windows.filter(e=>!a.has(e.id)).map(e=>e.id)),l=new Map;for(let e of n.windows){if(c.has(e.id)){s.push({code:`workspace-id-conflict`,severity:`error`,id:e.id,message:`Workspace window id "${e.id}" is already owned outside the declarative integration.`});continue}let t=r.get(e.id);l.set(e.id,e),t?e.stateToken!==void 0&&e.stateToken!==t.stateToken&&this.#C(e,s):(this.#C(e,s),this.#w(e)),t&&(e.placementToken!==void 0&&e.placementToken!==t.placementToken&&this.#l.set(e.id,e.declaredPlacement),e.geometryToken!==void 0&&e.geometryToken!==t.geometryToken&&this.#j(e.id,e.declaredFloatingRect??Bu(e)),e.alwaysOnTopToken!==void 0&&e.alwaysOnTopToken!==t.alwaysOnTopToken&&this.#M(e.id,e.declaredAlwaysOnTop),e.groupToken!==void 0&&e.groupToken!==t.groupToken&&this.#N(e.id,e.declaredGroupId))}this.#e=l,this.#T(),this.#E();let u=new Map;for(let e of n.modals){let t=i.get(e.id),n=e.rect||!t?.rect?e:{...e,rect:H(t.rect)};u.set(n.id,n),t?n.openToken!==void 0&&n.openToken!==t.openToken&&this.#c.set(n.id,n.defaultOpen):this.#c.set(n.id,n.defaultOpen)}return this.#t=u,this.#P(),this.#F(a),this.#R(o,s),this.#W(),this.#y=s,this.inspect()}focus(e){let t=this.#ne(`focus`,e);if(t)return t;if(this.#e.has(e)){if(!this.#q(e))return V(`focus`,`blocked`,e,void 0,`window-not-visible`);if(this.#_&&this.#_!==e)return V(`focus`,`blocked`,e,void 0,`window-hidden-by-maximized-window`);let t=this.#g===e,n=this.#$(e);return this.#Y(e)===`tiled`&&!this.workspace.focus(e)?V(`focus`,`not-found`,e):(this.#Z(e),V(`focus`,t&&n?`unchanged`:`applied`,e))}return this.#t.get(e)?(this.#H(),(this.#i.has(e)?this.overlays.surface(e):void 0)?.visible?(this.overlays.bringToFront(e),V(`focus`,`applied`,e)):V(`focus`,`blocked`,e,void 0,`modal-not-visible`)):V(`focus`,`not-found`,e)}move(e,t){return this.#te(`move`,e)||(!Number.isFinite(t)||Math.trunc(t)===0?V(`move`,`invalid`,e,void 0,`delta-must-be-a-non-zero-finite-number`):this.workspace.move(e,t)?(this.#Z(e),V(`move`,`applied`,e)):V(`move`,`unchanged`,e))}setPlacement(e,t,n={}){let r=this.#te(`set-placement`,e);if(r)return r;if(t!==`tiled`&&t!==`floating`)return V(`set-placement`,`invalid`,e,void 0,`placement-is-invalid`);let i=this.#e.get(e),a;if(n.rect!==void 0&&(a=Uu(n.rect,i),!a))return V(`set-placement`,`invalid`,e,void 0,`floating-rect-is-invalid`);let o=this.#Y(e),s=this.#u.get(e);return o===t&&(!a||fd(s,a))?V(`set-placement`,`unchanged`,e):(a?this.#j(e,a):t===`floating`&&!s&&this.#j(e,Bu(i)),this.#l.set(e,t),this.#f.delete(e),this.#Z(e),this.#B(),V(`set-placement`,`applied`,e))}setFloatingRect(e,t){let n=this.#ee(`set-floating-rect`,e);if(n)return n;let r=Uu(t,this.#e.get(e));return r?fd(this.#u.get(e),r)&&!this.#f.has(e)?V(`set-floating-rect`,`unchanged`,e):(this.#j(e,r),this.#f.delete(e),V(`set-floating-rect`,`applied`,e)):V(`set-floating-rect`,`invalid`,e,void 0,`floating-rect-is-invalid`)}moveBy(e,t){let n=this.#ee(`move-by`,e);if(n)return n;let r=Ku(t);if(!r)return V(`move-by`,`invalid`,e,void 0,`delta-must-use-non-zero-safe-cell-integers`);let i=this.#m.get(e),a=i?[...this.#e.keys()].filter(e=>this.#m.get(e)===i&&this.#Y(e)===`floating`):[e],o=new Map;for(let t of a){let n=qu(this.#X(t),r);if(!n)return V(`move-by`,`invalid`,e,void 0,`floating-rect-exceeds-cell-bounds`);o.set(t,n)}for(let[e,t]of o)this.#j(e,t),this.#f.delete(e);return V(`move-by`,`applied`,e)}resizeWindow(e,t,n){let r=this.#ee(`resize-window`,e);if(r)return r;if(!bd(t))return V(`resize-window`,`invalid`,e,void 0,`resize-edge-is-invalid`);let i=Ku(n);if(!i)return V(`resize-window`,`invalid`,e,void 0,`delta-must-use-non-zero-safe-cell-integers`);let a=this.#X(e),o=Ju(a,t,i,this.#e.get(e));return o?fd(a,o)&&!this.#f.has(e)?V(`resize-window`,`unchanged`,e):(this.#j(e,o),this.#f.delete(e),V(`resize-window`,`applied`,e)):V(`resize-window`,`invalid`,e,void 0,`floating-rect-exceeds-cell-bounds`)}snap(e,t,n){let r=this.#te(`snap`,e);if(r)return r;let i=$u(t);if(!i)return V(`snap`,`invalid`,e,void 0,`snap-target-is-invalid`);let a=Wu(n);if(!a||a.width===0||a.height===0)return V(`snap`,`invalid`,e,void 0,`bounds-must-be-a-non-empty-finite-cell-rectangle`);if(i.kind===`dock`)return this.#e.has(i.targetId)?!this.#q(i.targetId)||this.#Y(i.targetId)!==`tiled`?V(`snap`,`blocked`,e,i.targetId,`target-window-not-tiled-and-visible`):e===i.targetId||!this.workspace.dock(e,i.targetId,i.edge,{ratio:i.ratio})?V(`snap`,`unchanged`,e,i.targetId):(this.#l.set(e,`tiled`),this.#f.set(e,ed(i)),this.#Z(e),this.#B(),V(`snap`,`applied`,e,i.targetId)):V(`snap`,`not-found`,e,i.targetId);let o=this.#e.get(e),s=this.#X(e),c=Qu(i,a,o);return c?(this.#f.has(e)||this.#d.set(e,H(s)),this.#u.set(e,c),this.#l.set(e,`floating`),this.#f.set(e,ed(i)),this.#Z(e),this.#B(),V(`snap`,`applied`,e)):V(`snap`,`invalid`,e,void 0,`snap-geometry-exceeds-cell-bounds`)}setAlwaysOnTop(e,t){return this.#te(`set-always-on-top`,e)||(typeof t==`boolean`?this.#p.has(e)===t?V(`set-always-on-top`,`unchanged`,e):(this.#M(e,t),!this.#Z(e)&&this.#g&&this.#Q(this.#g),V(`set-always-on-top`,`applied`,e)):V(`set-always-on-top`,`invalid`,e,void 0,`always-on-top-must-be-boolean`))}setGroup(e,t){let n=this.#ne(`set-group`,e);if(n)return n;if(!this.#e.has(e))return V(`set-group`,`not-found`,e);let r=hd(t);return t!==void 0&&r===void 0&&t.trim()!==``?V(`set-group`,`invalid`,e,void 0,`group-id-is-invalid-or-too-long`):this.#m.get(e)===r?V(`set-group`,`unchanged`,e):(this.#N(e,r),V(`set-group`,`applied`,e))}recoverBounds(e,t,n={}){let r=this.#ee(`recover-bounds`,e);if(r)return r;let i=Wu(t),a=Xu(n);if(!i||!a)return V(`recover-bounds`,`invalid`,e,void 0,`bounds-or-recovery-options-are-invalid`);let o=this.#X(e),s=Yu(o,i,a);return s?fd(o,s)&&!this.#f.has(e)?V(`recover-bounds`,`unchanged`,e):(this.#j(e,s),this.#f.delete(e),V(`recover-bounds`,`applied`,e)):V(`recover-bounds`,`invalid`,e,void 0,`recovered-geometry-exceeds-cell-bounds`)}swap(e,t){return this.#te(`swap`,e,t)||(this.#e.has(t)?this.#q(t)?e===t||!this.workspace.swap(e,t)?V(`swap`,`unchanged`,e,t):(this.#Z(e),V(`swap`,`applied`,e,t)):V(`swap`,`blocked`,e,t,`target-window-not-visible`):V(`swap`,`not-found`,e,t))}dock(e,t,n,r={}){let i=this.#te(`dock`,e,t);if(i)return i;if(!vd(n))return V(`dock`,`invalid`,e,t,`dock-edge-is-invalid`);if(!this.#e.has(t))return V(`dock`,`not-found`,e,t);if(!this.#q(t)||this.#Y(t)!==`tiled`)return V(`dock`,`blocked`,e,t,`target-window-not-visible`);if(e===t)return V(`dock`,`unchanged`,e,t);let a;try{let n=r.ratio;if(n!==void 0){if(typeof n!=`number`||!Number.isFinite(n))return V(`dock`,`invalid`,e,t,`dock-ratio-must-be-finite`);a=Math.max(.05,Math.min(.95,n))}}catch{return V(`dock`,`invalid`,e,t,`dock-options-are-invalid`)}return this.workspace.dock(e,t,n,{ratio:a})?(this.#l.set(e,`tiled`),this.#f.set(e,a===void 0?{kind:`dock`,targetId:t,edge:n}:{kind:`dock`,targetId:t,edge:n,ratio:a}),this.#Z(e),V(`dock`,`applied`,e,t)):V(`dock`,`unchanged`,e,t)}resize(e,t,n,r={}){let i=this.#ne(`resize`,e);if(i)return i;if(!Number.isFinite(t)||Math.trunc(t)===0)return V(`resize`,`invalid`,e,void 0,`delta-must-be-a-non-zero-finite-number`);let a=this.project(n,r);return a.workspace.separators.some(t=>t.splitId===e)?this.workspace.resizeSplit(e,t,n,{gap:r.gap,separatorHitSize:r.separatorHitSize,visibleWindowIds:a.visibleWindowIds})?V(`resize`,`applied`,e):V(`resize`,`unchanged`,e):V(`resize`,`blocked`,e,void 0,`split-not-visible`)}resizeRatio(e,t){return this.#ne(`resize-ratio`,e)||(!Number.isFinite(t)||t===0?V(`resize-ratio`,`invalid`,e,void 0,`delta-must-be-a-non-zero-finite-number`):this.#L(e)?this.workspace.resizeSplitRatio(e,t)?V(`resize-ratio`,`applied`,e):V(`resize-ratio`,`unchanged`,e):V(`resize-ratio`,`blocked`,e,void 0,`split-is-not-declaratively-owned`))}minimize(e){return this.#ne(`minimize`,e)||(this.#e.has(e)?this.#s.has(e)?V(`minimize`,`blocked`,e,void 0,`window-closed`):this.#o.has(e)?V(`minimize`,`unchanged`,e):(this.#o.add(e),this.#_===e&&(this.#_=void 0),this.#g===e&&(this.#g=void 0),this.#W(),this.#B(),V(`minimize`,`applied`,e)):V(`minimize`,`not-found`,e))}maximize(e){return this.#te(`maximize`,e)||(this.#_===e?V(`maximize`,`unchanged`,e):(this.#_=e,this.#g=e,this.#Q(e),this.#Y(e)===`tiled`&&this.workspace.focus(e),this.#B(),V(`maximize`,`applied`,e)))}restore(e){let t=this.#ne(`restore`,e);if(t)return t;let n=this.#e.get(e);if(n){if(!n.declaredVisible)return V(`restore`,`blocked`,e,void 0,`window-hidden-by-declaration`);let t=this.#s.delete(e),r=this.#o.delete(e),i=this.#_===e;return i&&(this.#_=void 0),!t&&!r&&!i?V(`restore`,`unchanged`,e):(this.#Z(e),this.#B(),V(`restore`,`applied`,e))}let r=this.#t.get(e);return r?r.declaredVisible?r.rect?(this.#H(),this.#i.has(e)?this.overlays.surface(e)?.visible?(this.#c.set(e,!0),V(`restore`,`unchanged`,e)):(this.#c.set(e,!0),this.overlays.open(e),V(`restore`,`applied`,e)):V(`restore`,`blocked`,e,void 0,`modal-overlay-id-conflict`)):V(`restore`,`unsupported`,e,void 0,`modal-layout-geometry-unavailable`):V(`restore`,`blocked`,e,void 0,`modal-hidden-by-declaration`):V(`restore`,`not-found`,e)}close(e){let t=this.#ne(`close`,e);if(t)return t;if(this.#e.has(e))return this.#s.has(e)?V(`close`,`unchanged`,e):(this.#s.add(e),this.#o.delete(e),this.#_===e&&(this.#_=void 0),this.#g===e&&(this.#g=void 0),this.#W(),this.#B(),V(`close`,`applied`,e));if(!this.#t.has(e))return V(`close`,`not-found`,e);if(this.#H(),!this.#i.has(e))return V(`close`,`blocked`,e,void 0,`modal-overlay-id-conflict`);let n=this.overlays.surface(e);return this.#c.set(e,!1),n?.visible?(this.overlays.close(e),V(`close`,`applied`,e)):V(`close`,`unchanged`,e)}project(e,t={}){this.#re(`project`),this.#V(),this.#H();let n=Wu(e)??H(vu),r=Hd(t.compactMode??this.#v),i=this.#G(),a=Ud(t.visibleWindowIds,i),o=this.#_?this.#Y(this.#_):void 0,s=this.#_?o===`tiled`&&i.includes(this.#_)?[this.#_]:[]:a,c=this.workspace.layout(n,{gap:t.gap,separatorHitSize:t.separatorHitSize,visibleWindowIds:s}),l=!this.#_&&s.length>1&&(r===`always`||r===`auto`&&!c.fitsMinimumSize),u;l&&(u=c.activeWindowId&&s.includes(c.activeWindowId)?c.activeWindowId:s[0],s=u?[u]:[],c=this.workspace.layout(n,{gap:t.gap,separatorHitSize:t.separatorHitSize,visibleWindowIds:s}));let d=[];for(let e of this.#e.values()){if(this.#Y(e.id)!==`floating`)continue;let t=this.#J(e.id),r=this.#q(e.id)&&(!this.#_||this.#_===e.id),i=this.#X(e.id),a=this.#f.get(e.id),o=r&&this.#_===e.id?H(n):a&&a.kind!==`dock`?Qu(a,n,e)??i:i,s=r&&this.#_===e.id?H(n):Yu(o,n,wu)??H(o),c=this.#h.indexOf(e.id);d.push({id:e.id,rect:s,floatingRect:H(i),restoreRect:nd(this.#d.get(e.id)),snapTarget:a?ed(a):void 0,state:t,active:this.#g===e.id,visible:r,alwaysOnTop:this.#p.has(e.id),groupId:this.#m.get(e.id),focusOrder:c,zIndex:0,constraintsSatisfied:pd(s,e)})}let f=d.filter(e=>e.visible).sort(md);for(let e=0;e<f.length;e+=1){let t=f[e];t.zIndex=(t.alwaysOnTop?2e3:1e3)+e}let p=new Set([...s,...f.map(e=>e.id)]),m=[];for(let e of this.#K())p.has(e)||m.push(e);let h=this.#i,g=this.overlays.zOrder().filter(e=>h.has(e.id)).map(Bd);return{compact:l,compactMode:r,compactWindowId:u,maximizedWindowId:this.#_,eligibleWindowIds:i,visibleWindowIds:s.slice(),hiddenWindowIds:m,workspace:c,floatingWindows:d,floatingZOrder:f,modals:g,topModalId:this.overlays.topModal()?.id}}inspect(){this.#V(),this.#z();let e=this.workspace.inspect(),t=this.#g&&this.#q(this.#g)?this.#g:void 0,n=[];for(let e of this.#e.values()){let r=this.#J(e.id),i=this.#Y(e.id),a={id:e.id,title:e.title,minWidth:e.minWidth,minHeight:e.minHeight,declaredVisible:e.declaredVisible,state:r,placement:i,alwaysOnTop:this.#p.has(e.id),focusOrder:this.#h.indexOf(e.id),active:t===e.id,visible:this.#q(e.id)&&(!this.#_||this.#_===e.id)};if(e.maxWidth!==void 0&&(a.maxWidth=e.maxWidth),e.maxHeight!==void 0&&(a.maxHeight=e.maxHeight),i===`floating`){a.floatingRect=this.#X(e.id);let t=this.#d.get(e.id);t&&(a.restoreRect=H(t))}let o=this.#f.get(e.id);o&&(a.snapTarget=ed(o));let s=this.#m.get(e.id);s&&(a.groupId=s),n.push(a)}let r=[];for(let e of this.#t.values()){let t=this.#i.has(e.id)?this.overlays.surface(e.id):void 0;r.push({id:e.id,title:e.title,ownerId:e.ownerId,declaredVisible:e.declaredVisible,requestedOpen:this.#c.get(e.id)??!1,registered:this.#i.has(e.id),visible:t?.visible??!1,closeOnOutsideClick:e.closeOnOutsideClick,rect:e.rect?H(e.rect):void 0,surface:t?Bd(t):void 0})}return{disposed:this.#x,compactMode:this.#v,activeWindowId:t,maximizedWindowId:this.#_,windows:n,modals:r,diagnostics:this.#y.map(zd),workspace:e}}snapshot(){this.#re(`snapshot`),this.#V(),this.#z();let e=[...this.#e.keys()],t=this.workspace.snapshot();if(this.#g&&this.#Y(this.#g)===`tiled`){let e=Od(t,this.#g);e&&(t.layout.activePaneId=e)}let n=xd({version:2,compactMode:this.#v,windowIds:e,minimizedWindowIds:e.filter(e=>this.#o.has(e)),closedWindowIds:e.filter(e=>this.#s.has(e)),maximizedWindowId:this.#_,activeWindowId:this.#g,focusOrderWindowIds:this.#h.slice(),placements:e.map(e=>({id:e,placement:this.#Y(e),floatingRect:nd(this.#u.get(e)),restoreRect:nd(this.#d.get(e)),snapTarget:td(this.#f.get(e)),alwaysOnTop:this.#p.has(e),groupId:this.#m.get(e)})),modals:[...this.#t.keys()].map(e=>({id:e,open:this.#c.get(e)??!1})),workspace:t});if(!n.ok)throw RangeError(`Current declarative-window state is not snapshot-safe: ${n.reason}`);return n.snapshot}restoreSnapshot(e){let t=this.#ne(`restore-snapshot`);if(t)return t;this.#b=!0;try{this.#H();let t=xd(e);if(!t.ok)return V(`restore-snapshot`,t.status,void 0,void 0,t.reason);let n=this.#O(t.snapshot);if(n)return V(`restore-snapshot`,`invalid`,void 0,void 0,n);let r=this.#k();try{return this.#D(t.snapshot),V(`restore-snapshot`,`applied`)}catch{try{this.#A(r)}catch{return V(`restore-snapshot`,`invalid`,void 0,void 0,`snapshot-restore-and-rollback-failed`)}return V(`restore-snapshot`,`invalid`,void 0,void 0,`snapshot-restore-failed`)}}finally{this.#b=!1}}dispose(){if(this.#b)throw Error(`MarkupWindowController cannot dispose during a state mutation.`);if(this.#V(),this.#H(),this.#x&&this.#n.size===0&&this.#i.size===0)return;this.#x=!0;let e;if(this.#n.size>0){let t=this.workspace.inspect().windows.filter(e=>!this.#n.has(e.id));try{this.workspace.reconcile(t)}catch(t){e=t}finally{this.#n.clear()}}for(let t of[...this.#i])try{this.overlays.remove(t,{synchronizeFocus:!0})}catch(t){e??=t}finally{this.#i.delete(t),this.#a.delete(t)}if(e!==void 0)throw e}#C(e,t){let n=e.declaredState??`normal`;this.#o.delete(e.id),this.#s.delete(e.id),this.#_===e.id&&(this.#_=void 0),n===`minimized`&&this.#o.add(e.id),n===`closed`&&this.#s.add(e.id),n===`maximized`&&(this.#_&&this.#_!==e.id?t.push({code:`multiple-maximized-windows`,severity:`warning`,id:e.id,message:`Window "${e.id}" requested maximize while "${this.#_}" is already maximized.`}):this.#_=e.id)}#w(e){this.#l.set(e.id,e.declaredPlacement),this.#j(e.id,e.declaredFloatingRect??Bu(e)),this.#M(e.id,e.declaredAlwaysOnTop),this.#N(e.id,e.declaredGroupId),this.#h.includes(e.id)||this.#h.push(e.id)}#T(){let e=new Set(this.#e.keys());this.#o=new Set([...this.#o].filter(t=>e.has(t))),this.#s=new Set([...this.#s].filter(t=>e.has(t))),this.#_&&!e.has(this.#_)&&(this.#_=void 0),this.#g&&!e.has(this.#g)&&(this.#g=void 0)}#E(){let e=new Set(this.#e.keys());this.#l=new Map([...this.#l].filter(([t])=>e.has(t))),this.#u=new Map([...this.#u].filter(([t])=>e.has(t))),this.#d=new Map([...this.#d].filter(([t])=>e.has(t))),this.#f=new Map([...this.#f].filter(([t])=>e.has(t)));for(let[t,n]of this.#f)n.kind===`dock`&&(!e.has(n.targetId)||n.targetId===t)&&this.#f.delete(t);this.#p=new Set([...this.#p].filter(t=>e.has(t))),this.#m=new Map([...this.#m].filter(([t])=>e.has(t))),this.#h=this.#h.filter(t=>e.has(t));for(let e of this.#e.values()){if(this.#l.has(e.id)||this.#l.set(e.id,e.declaredPlacement),!this.#u.has(e.id))this.#j(e.id,e.declaredFloatingRect??Bu(e));else{this.#u.set(e.id,Uu(this.#u.get(e.id),e));let t=this.#d.get(e.id);t&&this.#d.set(e.id,Uu(t,e))}this.#h.includes(e.id)||this.#h.push(e.id)}}#D(e){let t=new Set(this.#e.keys()),n=new Set(e.windowIds),r=this.#I(this.#n);this.workspace.restore(e.workspace,r),this.#v=e.compactMode,this.#o=new Set(e.minimizedWindowIds.filter(e=>t.has(e))),this.#s=new Set(e.closedWindowIds.filter(e=>t.has(e))),this.#_=e.maximizedWindowId&&t.has(e.maximizedWindowId)&&!this.#o.has(e.maximizedWindowId)&&!this.#s.has(e.maximizedWindowId)?e.maximizedWindowId:void 0;let i=new Map(e.placements.map(e=>[e.id,e]));for(let e of this.#e.values()){if(!n.has(e.id))continue;let t=i.get(e.id);this.#l.set(e.id,t?.placement??`tiled`);let r=t?.floatingRect??this.#u.get(e.id)??Bu(e);this.#u.set(e.id,H(r)),t?.restoreRect?this.#d.set(e.id,H(t.restoreRect)):this.#d.delete(e.id),t?.snapTarget?this.#f.set(e.id,ed(t.snapTarget)):this.#f.delete(e.id),this.#M(e.id,t?.alwaysOnTop??!1),this.#N(e.id,t?.groupId)}let a=[];for(let n of e.focusOrderWindowIds)t.has(n)&&!a.includes(n)&&a.push(n);for(let e of this.#e.keys())a.includes(e)||a.push(e);this.#h=a,this.#g=e.activeWindowId&&t.has(e.activeWindowId)?e.activeWindowId:void 0;let o=new Set(this.#t.keys());for(let t of e.modals)o.has(t.id)&&this.#c.set(t.id,t.open);let s=this.#y.filter(e=>e.code!==`missing-modal-geometry`);this.#R(this.#i,s,!1),this.#y=s,this.#W()}#O(e){let t=new Set(this.#e.keys());if(e.windowIds.length!==t.size||e.windowIds.some(e=>!t.has(e)))return`snapshot-window-ids-do-not-match-declarations`;let n=new Map(e.placements.map(e=>[e.id,e]));for(let e of this.#e.values()){let t=n.get(e.id);if(t?.floatingRect&&!pd(t.floatingRect,e))return`snapshot-floating-rect-violates-constraints:${e.id}`;if(t?.restoreRect&&!pd(t.restoreRect,e))return`snapshot-restore-rect-violates-constraints:${e.id}`}}#k(){return{windows:ud(this.#e),modals:dd(this.#t),managedWindowIds:new Set(this.#n),managedWindowGenerations:new Map(this.#r),managedModalIds:new Set(this.#i),managedModalSignatures:sd(this.#a),minimizedWindowIds:new Set(this.#o),closedWindowIds:new Set(this.#s),modalRequestedOpen:new Map(this.#c),placements:new Map(this.#l),floatingRects:rd(this.#u),restoreRects:rd(this.#d),snapTargets:id(this.#f),alwaysOnTopWindowIds:new Set(this.#p),windowGroups:new Map(this.#m),focusOrderWindowIds:this.#h.slice(),activeWindowId:this.#g,maximizedWindowId:this.#_,compactMode:this.#v,diagnostics:this.#y.map(zd),workspace:this.workspace.snapshot(),overlays:this.overlays.snapshot()}}#A(e){this.#e=ud(e.windows),this.#t=dd(e.modals),this.#n=new Set(e.managedWindowIds),this.#r=new Map(e.managedWindowGenerations),this.#i=new Set(e.managedModalIds),this.#a=sd(e.managedModalSignatures),this.#o=new Set(e.minimizedWindowIds),this.#s=new Set(e.closedWindowIds),this.#c=new Map(e.modalRequestedOpen),this.#l=new Map(e.placements),this.#u=rd(e.floatingRects),this.#d=rd(e.restoreRects),this.#f=id(e.snapTargets),this.#p=new Set(e.alwaysOnTopWindowIds),this.#m=new Map(e.windowGroups),this.#h=e.focusOrderWindowIds.slice(),this.#g=e.activeWindowId,this.#_=e.maximizedWindowId,this.#v=e.compactMode,this.#y=e.diagnostics.map(zd);let t=!1;try{this.workspace.restore(e.workspace)}catch{this.workspace.gap.jink(e.workspace.gap),this.workspace.state.jink(structuredClone(e.workspace.layout));try{this.workspace.gap.propagate()}catch{t=!0}try{this.workspace.state.propagate()}catch{t=!0}}try{this.overlays.restoreSnapshot(e.overlays,{synchronizeFocus:!0})}catch{this.overlays.surfaces.jink(e.overlays.surfaces.map(Bd)),this.overlays.synchronizeActiveId(e.overlays.activeId,{propagate:!1});try{this.overlays.surfaces.propagate()}catch{t=!0}try{this.overlays.activeId.propagate()}catch{t=!0}}this.overlays.surfaces.jink(e.overlays.surfaces.map(Bd)),this.overlays.synchronizeActiveId(e.overlays.activeId,{propagate:!1}),this.#r.clear();for(let e of this.#n){let t=this.workspace.windowRegistrationGeneration(e);t!==void 0&&this.#r.set(e,t)}this.#a.clear();for(let e of this.#i){let t=this.overlays.surface(e),n=this.overlays.registrationGeneration(e);t&&n!==void 0&&this.#a.set(e,ad(t,n))}if(t)throw Error(`rollback-signal-publication-failed`)}#j(e,t){this.#u.set(e,H(t)),this.#d.set(e,H(t))}#M(e,t){t?this.#p.add(e):this.#p.delete(e)}#N(e,t){t?this.#m.set(e,t):this.#m.delete(e)}#P(){let e=new Set(this.#t.keys());this.#c=new Map([...this.#c].filter(([t])=>e.has(t)))}#F(e){this.workspace.reconcile(this.#I(e),{activeWindowId:this.#_}),this.#n=new Set(this.#e.keys()),this.#r=new Map([...this.#n].map(e=>[e,this.workspace.windowRegistrationGeneration(e)]))}#I(e){let t=new Set(this.#e.keys()),n=this.workspace.inspect().windows.filter(n=>!e.has(n.id)&&!t.has(n.id));for(let e of this.#e.values())n.push({id:e.id,minWidth:e.minWidth,minHeight:e.minHeight});return n}#L(e){let t=this.workspace.inspect().layout.root;if(!t)return!1;let n=[t];for(;n.length>0;){let t=n.pop();if(t.kind===`pane`)continue;if(t.id!==e){n.push(t.second,t.first);continue}let r=[t.first,t.second],i=0;for(;r.length>0;){let e=r.pop();if(e.kind===`pane`){if(i+=1,!this.#n.has(e.windowId))return!1}else r.push(e.second,e.first)}return i>=2}return!1}#R(e,t,n=!0){let r=this.overlays.activeId.peek(),i=new Set;for(let n of e){let e=this.overlays.surface(n),r=this.#a.get(n),a=!!(e&&r&&od(r,e,this.overlays.registrationGeneration(n)));if(!this.#t.has(n)){a&&this.overlays.remove(n,{synchronizeFocus:!0}),this.#a.delete(n);continue}if(a){i.add(n);continue}this.#a.delete(n),e&&cd(t,n,`Overlay id "${n}" changed ownership after declarative registration; the replacement was preserved.`)}let a=new Set;for(let e of this.#t.values()){let r=this.overlays.surface(e.id);if(!r&&!i.has(e.id)&&!n)continue;if(r&&!i.has(e.id)){cd(t,e.id,`Overlay id "${e.id}" is already owned outside the declarative integration.`);continue}e.rect||t.push({code:`missing-modal-geometry`,severity:`warning`,id:e.id,message:`Modal "${e.id}" has no computed or explicit rectangle and was registered closed.`});let o=!!(e.rect&&e.declaredVisible&&this.#U(e)&&this.#c.get(e.id)),s={id:e.id,rect:e.rect?H(e.rect):H(vu),layer:`modal`,kind:`modal`,zIndex:e.zIndex,visible:o,modal:!0,closeOnOutsideClick:e.closeOnOutsideClick,ownerId:e.ownerId},c=i.has(e.id)?this.overlays.update(e.id,s,{synchronizeFocus:!0}):this.overlays.register(s,{synchronizeFocus:!0});c.visible&&this.overlays.synchronizeActiveId(c.id),a.add(e.id),this.#a.set(e.id,ad(c,this.overlays.registrationGeneration(e.id)))}this.#i=a;for(let e of[...this.#a.keys()])a.has(e)||this.#a.delete(e);r&&this.overlays.surface(r)?.visible&&this.overlays.synchronizeActiveId(r)}#z(){this.#H();for(let e of this.#i){let t=this.#t.get(e),n=this.overlays.surface(e);t?.declaredVisible&&t.rect&&this.#U(t)&&n&&this.#c.set(e,n.visible)}}#B(){this.#H();for(let e of this.#i){let t=this.#t.get(e),n=this.overlays.surface(e);if(!t||!n)continue;let r=!!(t.rect&&t.declaredVisible&&this.#U(t)&&this.#c.get(e));r!==n.visible&&(r?this.overlays.open(e,{synchronizeFocus:!0}):this.overlays.update(e,{visible:!1},{synchronizeFocus:!0}))}}#V(){let e=new Set(this.workspace.windowIds()),t=!1;for(let n of[...this.#n]){let r=this.#r.get(n);e.has(n)&&r!==void 0&&this.workspace.windowRegistrationGeneration(n)===r||(this.#n.delete(n),this.#r.delete(n),this.#e.delete(n),ld(this.#y,n,`Workspace window id "${n}" changed ownership after declarative registration; the replacement was preserved.`),t=!0)}t&&(this.#T(),this.#E(),this.#W())}#H(){for(let e of[...this.#i]){let t=this.overlays.surface(e),n=this.#a.get(e);t&&n&&od(n,t,this.overlays.registrationGeneration(e))||(this.#i.delete(e),this.#a.delete(e),this.#t.has(e)&&cd(this.#y,e,t?`Overlay id "${e}" changed ownership after declarative registration; the replacement was preserved.`:`Declaratively registered overlay id "${e}" was removed outside the window controller.`))}}#U(e){return!e.ownerId||!this.#e.has(e.ownerId)?!0:this.#q(e.ownerId)&&(!this.#_||this.#_===e.ownerId)}#W(){if(this.#_)if(!this.#q(this.#_))this.#_=void 0;else{this.#g=this.#_,this.#Q(this.#_),this.#Y(this.#_)===`tiled`&&this.workspace.focus(this.#_);return}if(this.#g&&this.#q(this.#g)){this.#Y(this.#g)===`tiled`?this.workspace.focus(this.#g):this.#Q(this.#g);return}let e=this.workspace.inspect().activeWindowId;if(e){if(!this.#e.has(e)){this.#g=void 0;return}if(this.#q(e)&&this.#Y(e)===`tiled`){this.#g=e,this.#Q(e);return}}for(let e of this.workspace.windowIds())if(this.#e.has(e)&&this.#q(e)&&this.#Y(e)===`tiled`){this.#g=e,this.#Q(e),this.workspace.focus(e);return}for(let e=this.#h.length-1;e>=0;--e){let t=this.#h[e];if(this.#q(t)){this.#g=t,this.#Q(t),this.#Y(t)===`tiled`&&this.workspace.focus(t);return}}this.#g=void 0}#G(){let e=[];for(let t of this.workspace.windowIds())(!this.#e.has(t)||this.#q(t)&&this.#Y(t)===`tiled`)&&e.push(t);return e}#K(){let e=this.workspace.windowIds(),t=new Set(e);for(let n of this.#e.keys())t.has(n)||e.push(n);return e}#q(e){return!!(this.#e.get(e)?.declaredVisible&&!this.#s.has(e)&&!this.#o.has(e))}#J(e){return this.#s.has(e)?`closed`:this.#o.has(e)?`minimized`:this.#_===e?`maximized`:`normal`}#Y(e){return this.#l.get(e)??`tiled`}#X(e){let t=this.#u.get(e);if(t)return H(t);let n=this.#e.get(e);return n?Bu(n):{column:0,row:0,width:1,height:1}}#Z(e){return this.#_&&this.#_!==e?(this.#g=this.#_,this.#Y(this.#_)===`tiled`&&this.workspace.focus(this.#_),!1):(this.#g=e,this.#Q(e),this.#Y(e)===`tiled`&&this.workspace.focus(e),!0)}#Q(e){let t=this.#h.indexOf(e);return t<0?(this.#h.push(e),!0):this.#$(e)?!1:(this.#h.splice(t,1),this.#h.push(e),!0)}#$(e){let t=this.#p.has(e);for(let n=this.#h.length-1;n>=0;--n){let r=this.#h[n];if(this.#p.has(r)===t)return r===e}return!1}#ee(e,t){let n=this.#te(e,t);if(n)return n;if(this.#Y(t)!==`floating`)return V(e,`blocked`,t,void 0,`window-not-floating`)}#te(e,t,n){let r=this.#ne(e,t,n);if(r)return r;if(!this.#e.has(t))return V(e,`not-found`,t,n);if(!this.#q(t))return V(e,`blocked`,t,n,`window-not-visible`)}#ne(e,t,n){if(this.#x)return V(e,`disposed`,t,n,`controller-disposed`);if(this.#b)return V(e,`blocked`,t,n,`controller-mutation-in-progress`);this.#V()}#re(e){if(this.#x)throw Error(`MarkupWindowController is disposed; cannot ${e}.`);if(this.#b)throw Error(`MarkupWindowController cannot ${e} during a state mutation.`)}};function Eu(e,t){let n=[],r=[],i=[],a=new Set,o=new WeakSet,s=[{node:e,ancestors:[],depth:0}],c=0;for(;s.length>0;){let{node:e,ancestors:l,depth:u}=s.pop();if(u>Cu){Du(i,{code:`layout-depth-exceeded`,severity:`error`,message:`Declarative window discovery exceeds the bounded depth of ${Cu}.`});continue}if(o.has(e)){Du(i,{code:`layout-cycle-detected`,severity:`error`,message:`Declarative window discovery rejected a cyclic or multiply referenced layout node.`});continue}if(o.add(e),c+=1,c>Su){Du(i,{code:`layout-node-limit-exceeded`,severity:`error`,message:`Declarative window discovery exceeds the bounded node limit of ${Su}.`});break}let d=qd(e.tag);if(d===`window`||d===`modal`||d===`dialog`){let o=e.id.trim();o?gd(o)?a.has(o)?i.push({code:`duplicate-surface-id`,severity:`error`,id:o,message:`Declarative surface id "${o}" is duplicated; the first declaration remains authoritative.`}):(a.add(o),n.length+r.length>=xu?Du(i,{code:`surface-limit-exceeded`,severity:`error`,message:`Declarative window surfaces exceed the bounded limit of ${xu}.`}):d===`window`?n.push(Ou(e,t)):r.push(ku(e,d,l,t))):i.push({code:`invalid-surface-id`,severity:`error`,message:`Declarative <${d}> nodes require an id of at most ${yu} non-control characters.`}):i.push({code:`empty-surface-id`,severity:`error`,message:`Declarative <${d}> nodes require a non-empty stable id.`})}let f=[...l,e];for(let t=e.children.length-1;t>=0;--t)s.push({node:e.children[t],ancestors:f,depth:u+1})}return{windows:n,modals:r,diagnostics:i}}function Du(e,t){e.some(e=>e.code===t.code)||e.push(t)}function Ou(e,t){let n=Au(e.attributes),r=Lu(e.attributes),i=Iu(e.attributes),a=t?.byId.get(e.id)?.rect,o=Pu(e.style.minWidth),s=Pu(e.style.minHeight),c=Fu(e.style.maxWidth),l=Fu(e.style.maxHeight),u=c===void 0?void 0:Math.max(o??1,c),d=l===void 0?void 0:Math.max(s??1,l),f=i??(a?Vd(a):void 0),p=f?Uu(f,{minWidth:o,minHeight:s,maxWidth:u,maxHeight:d}):void 0,m=Ru(e.attributes,`always-on-top`,`pinned`),h=Ru(e.attributes,`group-id`,`group`);return{id:e.id.trim(),title:Kd(e.attributes.title??e.attributes[`aria-label`]),minWidth:o,minHeight:s,maxWidth:u,maxHeight:d,declaredVisible:Mu(e),declaredState:n?.state,stateToken:n?.token,declaredPlacement:r.placement,placementToken:r.token,declaredFloatingRect:p,geometryToken:i&&p?zu(p):void 0,declaredAlwaysOnTop:m?Gd(e.attributes,m,!0):!1,alwaysOnTopToken:m?`${m}:${Gd(e.attributes,m,!0)}`:void 0,declaredGroupId:h?hd(e.attributes[h]):void 0,groupToken:h?`${h}:${e.attributes[h]}`:void 0}}function ku(e,t,n,r){let i=ju(e.attributes,t),a=r?.byId.get(e.id),o=a?Vd(a.rect):Iu(e.attributes),s=Nu(n);return{id:e.id.trim(),title:Kd(e.attributes.title??e.attributes[`aria-label`]),ownerId:Kd(e.attributes[`owner-id`]??s?.id),declaredVisible:Mu(e),defaultOpen:i.open,openToken:i.token,closeOnOutsideClick:Gd(e.attributes,`close-on-outside-click`,!1),rect:o,zIndex:Bs(`modal`)+Math.floor(Jd(e.style.zIndex,0))}}function Au(e){let t=e.state?.trim().toLowerCase();if(t===`normal`||t===`minimized`||t===`maximized`||t===`closed`)return{state:t,token:`state:${t}`};for(let t of[`closed`,`minimized`,`maximized`])if(t in e){let n=Gd(e,t,!1);return{state:n?t:`normal`,token:`${t}:${n}`}}}function ju(e,t){let n=e.state?.trim().toLowerCase();if(n===`open`||n===`closed`)return{open:n===`open`,token:`state:${n}`};if(`open`in e){let t=Gd(e,`open`,!0);return{open:t,token:`open:${t}`}}return{open:t===`modal`}}function Mu(e){return e.style.display!==`none`&&e.style.visibility!==`hidden`&&!Gd(e.attributes,`hidden`,!1)&&!Gd(e.attributes,`aria-hidden`,!1)}function Nu(e){for(let t=e.length-1;t>=0;--t)if(qd(e[t].tag)===`window`)return e[t]}function Pu(e){if(!(e.unit!==`cell`||!Number.isFinite(e.value)||e.value<=0))return Math.min(B,Math.max(1,Math.floor(e.value)))}function Fu(e){if(!(e.unit!==`cell`||!Number.isFinite(e.value)||e.value<=0))return Math.min(B,Math.max(1,Math.floor(e.value)))}function Iu(e){let t=Wd(e,`column`)??Wd(e,`x`),n=Wd(e,`row`)??Wd(e,`y`),r=Wd(e,`width`),i=Wd(e,`height`);if(!(t===void 0||n===void 0||r===void 0||i===void 0))return Vd({column:t,row:n,width:r,height:i})}function Lu(e){let t=e.placement?.trim().toLowerCase();if(t===`floating`||t===`tiled`)return{placement:t,token:`placement:${t}`};if(`floating`in e){let t=Gd(e,`floating`,!0);return{placement:t?`floating`:`tiled`,token:`floating:${t}`}}return{placement:`tiled`}}function Ru(e,...t){return t.find(t=>t in e)}function zu(e){return`${e.column}:${e.row}:${e.width}:${e.height}`}function Bu(e){let t=Vu(e);return{column:0,row:0,width:Math.max(t.minWidth,Math.min(t.maxWidth,40)),height:Math.max(t.minHeight,Math.min(t.maxHeight,12))}}function Vu(e){let t=Hu(e.minWidth??1),n=Hu(e.minHeight??1);return{minWidth:t,minHeight:n,maxWidth:Math.max(t,Hu(e.maxWidth??B)),maxHeight:Math.max(n,Hu(e.maxHeight??B))}}function Hu(e){return Math.min(B,Math.max(1,Math.floor(e)))}function Uu(e,t){let n=Gu(e,!1);if(!n||n.width<=0||n.height<=0)return;let r=Vu(t);return{column:n.column,row:n.row,width:Math.max(r.minWidth,Math.min(r.maxWidth,n.width)),height:Math.max(r.minHeight,Math.min(r.maxHeight,n.height))}}function Wu(e){let t=Gu(e,!0);if(!t)return;let n=t.width>0?t.column+t.width-1:t.column,r=t.height>0?t.row+t.height-1:t.row;if(!(Math.abs(n)>B||Math.abs(r)>B))return t}function Gu(e,t){try{if([e.column,e.row,e.width,e.height].some(e=>typeof e!=`number`||!Number.isFinite(e)))return;let n=Math.floor(e.column),r=Math.floor(e.row),i=Math.floor(e.width),a=Math.floor(e.height);return Math.abs(n)>B||Math.abs(r)>B||i>B||a>B||i<+!t||a<+!t?void 0:{column:n,row:r,width:i,height:a}}catch{return}}function Ku(e){try{return!Number.isSafeInteger(e.columns)||!Number.isSafeInteger(e.rows)||Math.abs(e.columns)>B||Math.abs(e.rows)>B||e.columns===0&&e.rows===0?void 0:{columns:e.columns,rows:e.rows}}catch{return}}function qu(e,t){let n=e.column+t.columns,r=e.row+t.rows;if(!(!Number.isSafeInteger(n)||!Number.isSafeInteger(r)||Math.abs(n)>B||Math.abs(r)>B))return{...e,column:n,row:r}}function Ju(e,t,n,r){let i=Vu(r),a=t===`left`||t===`top-left`||t===`bottom-left`,o=t===`right`||t===`top-right`||t===`bottom-right`,s=t===`top`||t===`top-left`||t===`top-right`,c=t===`bottom`||t===`bottom-left`||t===`bottom-right`,l=e.width+(o?n.columns:0)-(a?n.columns:0),u=e.height+(c?n.rows:0)-(s?n.rows:0);return l=Math.max(i.minWidth,Math.min(i.maxWidth,l)),u=Math.max(i.minHeight,Math.min(i.maxHeight,u)),Gu({column:a?e.column+e.width-l:e.column,row:s?e.row+e.height-u:e.row,width:l,height:u},!1)}function Yu(e,t,n){if(t.width<=0||t.height<=0)return H(e);let r=t.column+Math.min(n.margin,Math.max(0,t.width-1)),i=t.column+t.width-1-Math.min(n.margin,Math.max(0,t.width-1)),a=t.row+Math.min(n.margin,Math.max(0,t.height-1)),o=t.row+t.height-1-Math.min(n.margin,Math.max(0,t.height-1)),s=Math.floor((e.width-1)/2),c=r-s,l=i-s,u=Math.max(1,Math.min(e.height,n.titleBarHeight)),d=Math.max(a,o-u+1);return Gu({...e,column:Math.max(c,Math.min(l,e.column)),row:Math.max(a,Math.min(d,e.row))},!1)}function Xu(e){try{let t=e.margin??0,n=e.titleBarHeight??1;return!Number.isSafeInteger(t)||t<0||t>B||!Number.isSafeInteger(n)||n<1||n>B?void 0:{margin:t,titleBarHeight:n}}catch{return}}function Zu(e,t){let n=Math.max(1,Math.ceil(t.width/2)),r=Math.max(1,Math.floor(t.width/2)),i=Math.max(1,Math.ceil(t.height/2)),a=Math.max(1,Math.floor(t.height/2));if(e.kind===`workspace`)switch(e.edge){case`left`:return{...t,width:n};case`right`:return{...t,column:t.column+t.width-r,width:r};case`top`:return{...t,height:i};case`bottom`:return{...t,row:t.row+t.height-a,height:a}}let o=e.corner===`top-right`||e.corner===`bottom-right`,s=e.corner===`bottom-left`||e.corner===`bottom-right`,c=o?r:n,l=s?a:i;return{column:o?t.column+t.width-c:t.column,row:s?t.row+t.height-l:t.row,width:c,height:l}}function Qu(e,t,n){let r=Uu(Zu(e,t),n);if(!r)return;let i=e.kind===`workspace`?e.edge===`right`:e.corner===`top-right`||e.corner===`bottom-right`,a=e.kind===`workspace`?e.edge===`bottom`:e.corner===`bottom-left`||e.corner===`bottom-right`;return i?r.column=t.column+t.width-r.width:r.column=t.column,a?r.row=t.row+t.height-r.height:r.row=t.row,Gu(r,!1)}function $u(e){try{if(!e||typeof e!=`object`)return;if(e.kind===`workspace`&&vd(e.edge))return{kind:`workspace`,edge:e.edge};if(e.kind===`corner`&&yd(e.corner))return{kind:`corner`,corner:e.corner};if(e.kind===`dock`&&gd(e.targetId)&&vd(e.edge)&&(e.ratio===void 0||Number.isFinite(e.ratio)&&e.ratio>=.05&&e.ratio<=.95))return e.ratio===void 0?{kind:`dock`,targetId:e.targetId.trim(),edge:e.edge}:{kind:`dock`,targetId:e.targetId.trim(),edge:e.edge,ratio:e.ratio}}catch{}}function ed(e){return e.kind===`dock`&&e.ratio,{...e}}function td(e){return e?ed(e):void 0}function nd(e){return e?H(e):void 0}function rd(e){return new Map([...e].map(([e,t])=>[e,H(t)]))}function id(e){return new Map([...e].map(([e,t])=>[e,ed(t)]))}function ad(e,t){return{registrationGeneration:t,rect:H(e.rect),layer:e.layer,kind:e.kind,modal:e.modal,closeOnOutsideClick:e.closeOnOutsideClick,ownerId:e.ownerId}}function od(e,t,n){return e.registrationGeneration===n&&fd(e.rect,t.rect)&&e.layer===t.layer&&e.kind===t.kind&&e.modal===t.modal&&e.closeOnOutsideClick===t.closeOnOutsideClick&&e.ownerId===t.ownerId}function sd(e){return new Map([...e].map(([e,t])=>[e,{...t,rect:H(t.rect)}]))}function cd(e,t,n){e.some(e=>e.code===`overlay-id-conflict`&&e.id===t)||e.push({code:`overlay-id-conflict`,severity:`error`,id:t,message:n})}function ld(e,t,n){e.some(e=>e.code===`workspace-id-conflict`&&e.id===t)||e.push({code:`workspace-id-conflict`,severity:`error`,id:t,message:n})}function ud(e){return new Map([...e].map(([e,t])=>[e,{...t,declaredFloatingRect:nd(t.declaredFloatingRect)}]))}function dd(e){return new Map([...e].map(([e,t])=>[e,{...t,rect:nd(t.rect)}]))}function fd(e,t){return!!(e&&t&&e.column===t.column&&e.row===t.row&&e.width===t.width&&e.height===t.height)}function pd(e,t){let n=Vu(t);return e.width>=n.minWidth&&e.width<=n.maxWidth&&e.height>=n.minHeight&&e.height<=n.maxHeight}function md(e,t){return Number(e.alwaysOnTop)-Number(t.alwaysOnTop)||e.focusOrder-t.focusOrder||e.id.localeCompare(t.id)}function hd(e){let t=e?.trim();if(!(!t||t.length>bu||_d(t)))return t}function gd(e){return typeof e==`string`&&e.trim().length>0&&e.trim().length<=yu&&!_d(e)}function _d(e){for(let t=0;t<e.length;t+=1){let n=e.charCodeAt(t);if(n<=31||n===127)return!0}return!1}function vd(e){return e===`left`||e===`right`||e===`top`||e===`bottom`}function yd(e){return e===`top-left`||e===`top-right`||e===`bottom-left`||e===`bottom-right`}function bd(e){return vd(e)||yd(e)}function xd(e){try{let t=Rd(e,[`version`,`compactMode`,`windowIds`,`minimizedWindowIds`,`closedWindowIds`,`maximizedWindowId`,`activeWindowId`,`focusOrderWindowIds`,`placements`,`modals`,`workspace`],[`version`,`compactMode`,`windowIds`,`minimizedWindowIds`,`closedWindowIds`,`modals`,`workspace`],`markup window snapshot`),n=t.version;if(n!==2&&n!==1)return{ok:!1,status:`unsupported`,reason:`unsupported-snapshot-version:${String(n)}`};let r=Id(t.compactMode),i=Ad(t.windowIds,`windowIds`),a=new Set(i),o=Ad(t.minimizedWindowIds,`minimizedWindowIds`,a),s=Ad(t.closedWindowIds,`closedWindowIds`,a);if(o.some(e=>s.includes(e)))throw TypeError(`minimized and closed window ids must be disjoint`);let c=jd(t.maximizedWindowId,a,`maximizedWindowId`);if(c&&(o.includes(c)||s.includes(c)))throw TypeError(`maximized window cannot also be hidden`);let l=wd(t.modals),u=Td(t.workspace);if(n===1){if(Object.hasOwn(t,`activeWindowId`)||Object.hasOwn(t,`focusOrderWindowIds`)||Object.hasOwn(t,`placements`))throw TypeError(`V1 snapshot contains V2-only state`);let e=Dd(u),n=c??e;return{ok:!0,snapshot:{version:2,compactMode:r,windowIds:i,minimizedWindowIds:o,closedWindowIds:s,maximizedWindowId:c,activeWindowId:n&&a.has(n)&&!o.includes(n)&&!s.includes(n)?n:void 0,focusOrderWindowIds:i.slice(),placements:i.map(e=>({id:e,placement:`tiled`,alwaysOnTop:!1})),modals:l,workspace:u}}}if(!(`focusOrderWindowIds`in t)||!(`placements`in t))throw TypeError(`V2 snapshot is missing focus or placement state`);let d=Ad(t.focusOrderWindowIds,`focusOrderWindowIds`,a);if(d.length!==i.length)throw TypeError(`focus order must contain every window exactly once`);let f=jd(t.activeWindowId,a,`activeWindowId`);if(f&&(o.includes(f)||s.includes(f)))throw TypeError(`active window cannot also be hidden`);if(c&&f!==c)throw TypeError(`maximized window must be the active window`);let p=Sd(t.placements,a);if(p.length!==i.length)throw TypeError(`placements must contain every window exactly once`);let m=f?p.find(e=>e.id===f)?.placement:void 0;if(f&&m===`tiled`&&Dd(u)!==f)throw TypeError(`active tiled window must match workspace active pane`);if(f&&m===`floating`){let e=new Map(p.map(e=>[e.id,e])),t=e.get(f),n=d.indexOf(f);for(let r=n+1;r<d.length;r+=1){let n=e.get(d[r]);if(n?.placement===`floating`&&n.alwaysOnTop===t.alwaysOnTop)throw TypeError(`active floating window must be frontmost in its z-order tier`)}}return{ok:!0,snapshot:{version:2,compactMode:r,windowIds:i,minimizedWindowIds:o,closedWindowIds:s,maximizedWindowId:c,activeWindowId:f,focusOrderWindowIds:d,placements:p,modals:l,workspace:u}}}catch{return{ok:!1,status:`invalid`,reason:`snapshot-schema-is-invalid`}}}function Sd(e,t){let n=Ld(e,`placements`);if(n.length>xu)throw RangeError(`too many placements`);let r=[],i=new Set;for(let e=0;e<n.length;e+=1){let a=Rd(n[e],[`id`,`placement`,`floatingRect`,`restoreRect`,`snapTarget`,`alwaysOnTop`,`groupId`],[`id`,`placement`,`alwaysOnTop`],`placement ${e}`),o=Md(a.id,t,`placement ${e} id`);if(i.has(o))throw TypeError(`duplicate placement id`);if(i.add(o),a.placement!==`tiled`&&a.placement!==`floating`)throw TypeError(`invalid placement`);if(typeof a.alwaysOnTop!=`boolean`)throw TypeError(`invalid alwaysOnTop`);let s=a.floatingRect===void 0?void 0:kd(a.floatingRect);if(a.placement===`floating`&&!s)throw TypeError(`floating placement requires rect`);let c=a.restoreRect===void 0?void 0:kd(a.restoreRect),l=a.snapTarget===void 0?void 0:Cd(a.snapTarget);if(l?.kind===`dock`){if(a.placement!==`tiled`||!t.has(l.targetId)||l.targetId===o)throw TypeError(`dock snap requires a distinct tiled inventory target`)}else if(l&&a.placement!==`floating`)throw TypeError(`workspace and corner snaps require floating placement`);let u=a.groupId===void 0?void 0:Pd(a.groupId);r.push({id:o,placement:a.placement,floatingRect:s,restoreRect:c,snapTarget:l,alwaysOnTop:a.alwaysOnTop,groupId:u})}return r}function Cd(e){let t=Rd(e,[`kind`,`edge`,`corner`,`targetId`,`ratio`],[`kind`],`snapTarget`);if(t.kind===`workspace`){if(!vd(t.edge)||t.corner!==void 0||t.targetId!==void 0||t.ratio!==void 0)throw TypeError(`invalid workspace snap`);return{kind:`workspace`,edge:t.edge}}if(t.kind===`corner`){if(!yd(t.corner)||t.edge!==void 0||t.targetId!==void 0||t.ratio!==void 0)throw TypeError(`invalid corner snap`);return{kind:`corner`,corner:t.corner}}if(t.kind===`dock`){let e=Nd(t.targetId,`dock targetId`);if(!vd(t.edge)||t.corner!==void 0)throw TypeError(`invalid dock snap`);if(t.ratio!==void 0&&(typeof t.ratio!=`number`||!Number.isFinite(t.ratio)||t.ratio<.05||t.ratio>.95))throw TypeError(`invalid dock ratio`);return t.ratio===void 0?{kind:`dock`,targetId:e,edge:t.edge}:{kind:`dock`,targetId:e,edge:t.edge,ratio:t.ratio}}throw TypeError(`invalid snap kind`)}function wd(e){let t=Ld(e,`modals`);if(t.length>xu)throw RangeError(`too many modals`);let n=[],r=new Set;for(let e=0;e<t.length;e+=1){let i=Rd(t[e],[`id`,`open`],[`id`,`open`],`modal ${e}`),a=Nd(i.id,`modal ${e} id`);if(r.has(a)||typeof i.open!=`boolean`)throw TypeError(`invalid modal snapshot`);r.add(a),n.push({id:a,open:i.open})}return n}function Td(e){let t=Rd(e,[`version`,`gap`,`layout`],[`version`,`gap`,`layout`],`workspace`);if(t.version!==1)throw TypeError(`unsupported workspace version`);if(!Number.isSafeInteger(t.gap)||t.gap<0||t.gap>B)throw TypeError(`invalid workspace gap`);let n=Rd(t.layout,[`root`,`activePaneId`],[],`workspace layout`),r=new Set,i=new Set,a=new WeakSet,o=n.root===void 0?void 0:Ed(n.root,0,{value:0},a,r,i),s;if(n.activePaneId!==void 0&&(s=Nd(n.activePaneId,`activePaneId`),!r.has(s)))throw TypeError(`active pane is missing`);return{version:1,gap:t.gap,layout:{root:o,activePaneId:s}}}function Ed(e,t,n,r,i,a){if(t>Cu||++n.value>Su)throw RangeError(`workspace layout limit exceeded`);if(!e||typeof e!=`object`||r.has(e))throw TypeError(`invalid or cyclic workspace node`);r.add(e);let o=Rd(e,[`kind`,`id`,`windowId`,`minWidth`,`minHeight`,`direction`,`ratio`,`first`,`second`],[`kind`,`id`],`workspace node`),s=Nd(o.id,`workspace node id`);if(i.has(s))throw TypeError(`duplicate workspace node id`);if(i.add(s),o.kind===`pane`){let e=Nd(o.windowId,`workspace window id`);if(a.has(e)||o.direction!==void 0||o.ratio!==void 0||o.first!==void 0||o.second!==void 0)throw TypeError(`invalid workspace pane`);return a.add(e),{kind:`pane`,id:s,windowId:e,minWidth:Fd(o.minWidth,`pane minWidth`),minHeight:Fd(o.minHeight,`pane minHeight`)}}if(o.kind!==`split`||o.direction!==`row`&&o.direction!==`column`||typeof o.ratio!=`number`||!Number.isFinite(o.ratio)||o.ratio<.05||o.ratio>.95||o.windowId!==void 0||o.minWidth!==void 0||o.minHeight!==void 0||o.first===void 0||o.second===void 0)throw TypeError(`invalid workspace split`);return{kind:`split`,id:s,direction:o.direction,ratio:o.ratio,first:Ed(o.first,t+1,n,r,i,a),second:Ed(o.second,t+1,n,r,i,a)}}function Dd(e){let t=e.layout.activePaneId;if(!t||!e.layout.root)return;let n=[e.layout.root];for(;n.length>0;){let e=n.pop();if(e.kind===`pane`){if(e.id===t)return e.windowId}else n.push(e.second,e.first)}}function Od(e,t){if(!e.layout.root)return;let n=[e.layout.root];for(;n.length>0;){let e=n.pop();if(e.kind===`pane`){if(e.windowId===t)return e.id}else n.push(e.second,e.first)}}function kd(e){let t=Gu(Rd(e,[`column`,`row`,`width`,`height`],[`column`,`row`,`width`,`height`],`rect`),!1);if(!t)throw TypeError(`invalid rect`);return t}function Ad(e,t,n){let r=Ld(e,t);if(r.length>xu)throw RangeError(`${t} is too large`);let i=[],a=new Set;for(let e of r){let r=n?Md(e,n,t):Nd(e,t);if(a.has(r))throw TypeError(`${t} contains duplicates`);a.add(r),i.push(r)}return i}function jd(e,t,n){return e===void 0?void 0:Md(e,t,n)}function Md(e,t,n){let r=Nd(e,n);if(!t.has(r))throw TypeError(`${n} is outside the snapshot inventory`);return r}function Nd(e,t){if(!gd(e))throw TypeError(`${t} is invalid`);return e.trim()}function Pd(e){if(typeof e!=`string`)throw TypeError(`group id must be a string`);let t=hd(e);if(!t)throw TypeError(`group id is invalid`);return t}function Fd(e,t){if(e!==void 0){if(!Number.isSafeInteger(e)||e<1||e>B)throw TypeError(`${t} is invalid`);return e}}function Id(e){if(e!==`auto`&&e!==`always`&&e!==`never`)throw TypeError(`invalid compact mode`);return e}function Ld(e,t){if(!Array.isArray(e)||Object.getPrototypeOf(e)!==Array.prototype)throw TypeError(`${t} must be a plain array`);for(let n=0;n<e.length;n+=1){let r=Object.getOwnPropertyDescriptor(e,String(n));if(!r||!(`value`in r)||!r.enumerable)throw TypeError(`${t} must be dense data`)}for(let n of Reflect.ownKeys(e))if(n!==`length`&&(typeof n!=`string`||!/^(0|[1-9]\d*)$/.test(n)||Number(n)>=e.length))throw TypeError(`${t} has an unexpected property`);return e}function Rd(e,t,n,r){if(!e||typeof e!=`object`||Object.getPrototypeOf(e)!==Object.prototype)throw TypeError(`${r} must be a plain object`);let i=e,a=new Set(t);for(let e of Reflect.ownKeys(i)){if(typeof e!=`string`||!a.has(e))throw TypeError(`${r} has an unexpected property`);let t=Object.getOwnPropertyDescriptor(i,e);if(!t||!(`value`in t)||!t.enumerable)throw TypeError(`${r} properties must be enumerable data`)}for(let e of n)if(!Object.hasOwn(i,e))throw TypeError(`${r} is missing ${e}`);return i}function V(e,t,n,r,i){let a={action:e,status:t,ok:t===`applied`||t===`unchanged`};return n!==void 0&&(a.id=n),r!==void 0&&(a.targetId=r),i!==void 0&&(a.reason=i),a}function zd(e){return{...e}}function Bd(e){return{...e,rect:H(e.rect)}}function H(e){return{column:e.column,row:e.row,width:e.width,height:e.height}}function Vd(e){return{column:Math.floor(Jd(e.column,0)),row:Math.floor(Jd(e.row,0)),width:Math.max(0,Math.floor(Jd(e.width,0))),height:Math.max(0,Math.floor(Jd(e.height,0)))}}function Hd(e){return e===`always`||e===`never`?e:`auto`}function Ud(e,t){if(e===void 0)return t.slice();if(!Array.isArray(e))return[];let n=new Set(t),r=new Set,i=[];for(let t of e)typeof t!=`string`||!n.has(t)||r.has(t)||(r.add(t),i.push(t));return i}function Wd(e,t){let n=e[t];if(n===void 0)return;let r=Number(n);return Number.isFinite(r)?r:void 0}function Gd(e,t,n){if(!(t in e))return n;let r=e[t]?.trim().toLowerCase();return r!==`false`&&r!==`0`&&r!==`no`&&r!==`off`}function Kd(e){return e?.trim()||void 0}function qd(e){return e.trim().toLowerCase()}function Jd(e,t){return Number.isFinite(e)?e:t}function Yd(e,t,n){let r=[...e.tiledWindows,...e.floatingWindows];for(let e=r.length-1;e>=0;--e){let i=r[e];if(Pc(i.rect,t,n)){if(n!==i.rect.row||Pc(i.clientRect,t,n))return;for(let e of i.controls)if(Pc(e.hitRect,t,n))return;return i.id}}}var Xd=64,Zd=1,Qd=0;function $d(e,t=`workbench-window-host`){return Mc({id:t,tag:`main`,children:e.map(e=>{let t=Tc();af(e.minWidth)&&(t.minWidth=Cc(Math.floor(e.minWidth))),af(e.minHeight)&&(t.minHeight=Cc(Math.floor(e.minHeight))),af(e.maxWidth)&&(t.maxWidth=Cc(Math.floor(e.maxWidth))),af(e.maxHeight)&&(t.maxHeight=Cc(Math.floor(e.maxHeight)));let n={title:String(e.title??``)};return e.state!==void 0&&(n.state=e.state),e.placement!==void 0&&(n.placement=e.placement),e.alwaysOnTop!==void 0&&(n[`always-on-top`]=String(e.alwaysOnTop)),e.groupId!==void 0&&(n[`group-id`]=e.groupId),e.floatingRect&&(n.column=String(e.floatingRect.column),n.row=String(e.floatingRect.row),n.width=String(e.floatingRect.width),n.height=String(e.floatingRect.height)),Mc({id:e.id,tag:`window`,attributes:n,style:t})})})}var ef=class{workspace;overlays;history;capture;controller;windowHistory;interactions;commitRevision=new C(0);viewRevision=new C(0);#e;#t;#n;#r;#i;#a;#o;#s=Ic();#c=new Map;#l=new Map;#u=xs();#d;#f;#p;#m;#h;#g;#_=!1;constructor(e){if(!e?.workspace)throw TypeError(`Workbench window host requires an existing tiled workspace.`);if(e.root===void 0==(e.windows===void 0))throw TypeError(`Workbench window host requires exactly one of root or windows.`);this.workspace=e.workspace,this.#e=e.overlays===void 0,this.#t=!0,this.#n=e.capture===void 0,this.overlays=e.overlays??new Us,this.history=new Uo({capacity:e.historyCapacity??Xd}),this.capture=e.capture??new Vi,this.#i=af(e.commandStep)?Math.max(1,Math.floor(e.commandStep)):Zd,this.#a=e.now??Date.now,this.#r=new Br({now:this.#a});let t=e.windowConfigButton??!1;this.#p=typeof t==`function`?t:()=>t,this.#m=e.windowConfigLabel??`config`;let n=new Tu({root:e.root??$d(e.windows,e.rootId),workspace:this.workspace,overlays:this.overlays,compactMode:e.compactMode}),r=e.ownerId??`workbench-window-host-${++Qd}`,i=cf(r,`separator`),a,o,s;try{if(e.initialWorkspace){let t=n.snapshot(),r=n.restoreSnapshot({version:1,compactMode:t.compactMode,windowIds:t.windowIds,minimizedWindowIds:t.minimizedWindowIds,closedWindowIds:t.closedWindowIds,maximizedWindowId:t.maximizedWindowId,modals:t.modals,workspace:e.initialWorkspace});if(!r.ok)throw TypeError(`Initial workbench workspace was rejected: ${r.reason}`)}a=Jc({controller:n,history:this.history,idPrefix:`workbench-window`,group:`workbench-windows`}),s=this.capture.registerOwner({id:i,onPointer:()=>{}}),o=new Jl({controller:n,capture:this.capture,history:a,ownerId:r,titleBarHeight:1,resizeMargin:1,snapDistance:e.snapDistance,snapEdgeSpanRatio:e.snapEdgeSpanRatio,snapCornerReach:e.snapCornerReach,snapOnRelease:e.snapOnRelease})}catch(e){throw lf(()=>o?.dispose()),lf(()=>s?.dispose()),lf(()=>a?.dispose()),lf(()=>n.dispose()),this.#n&&lf(()=>this.capture.dispose()),this.#e&&lf(()=>this.overlays.dispose()),lf(()=>this.commitRevision.dispose()),lf(()=>this.viewRevision.dispose()),e}this.controller=n,this.windowHistory=a,this.interactions=o,this.#d=i,this.#f=s}project(e,t={}){this.#z(`project`),this.viewRevision.value;let n=this.controller.project(e,t),r=this.controller.inspect(),i=new Map(r.windows.map(e=>[e.id,e])),a=[],o=[],s=[],c=0;for(let e of n.workspace.panes){let n=i.get(e.windowId);if(!n)continue;let r=this.#y(n.id,n.title??n.id,`tiled`,e.rect,c++,n,t.titleAdornments?.(n.id)??[]);o.push(r),a.push(r)}for(let e of n.floatingZOrder){let n=i.get(e.id);if(!n)continue;let r=this.#y(n.id,n.title??n.id,`floating`,e.rect,e.zIndex,n,t.titleAdornments?.(n.id)??[]);s.push(r),a.push(r)}let l=this.#b(r,t.shelfBounds),u=n.workspace.separators.map(rf);return{bounds:of(e),compact:n.compact,compactWindowId:n.compactWindowId,topModalId:n.topModalId,windows:a,tiledWindows:o,floatingWindows:s,separators:u,shelf:l,switcher:this.#x(r,t),snapPreview:this.#S(e,r),core:n}}execute(e,t,n={}){if(this.#_)return U(`disposed`,!1,e,void 0,void 0,`window-host-disposed`);if(this.#D())return U(`blocked`,!1,e,void 0,void 0,`window-gesture-active`);try{if(e.kind===`switcher-open`||e.kind===`switcher-step`)return this.#j(e.direction,e,n);if(e.kind===`switcher-cancel`){let t=this.#h!==void 0;return this.#h=void 0,t&&this.#R(),U(t?`applied`:`unchanged`,t,e)}if(e.kind===`switcher-accept`)return this.#M(e,t,n);if(e.kind===`recover-all`)return this.#F(e,t);if(e.kind===`focus-next`)return this.#A(e,t,n);if(e.kind===`restore-floating`)return this.#I(e);if(e.kind===`resize-split`)return this.#k(e,this.windowHistory.resize(e.splitId,e.delta,t,n));let r=e.id??this.controller.inspect().activeWindowId;if(!r)return U(`blocked`,!1,e,void 0,void 0,`no-active-window`);let i=this.controller.inspect().windows.find(e=>e.id===r),a;switch(e.kind){case`focus`:a=this.windowHistory.focus(r);break;case`nudge`:a=this.windowHistory.moveBy(r,e.delta);break;case`resize`:a=this.windowHistory.resizeWindow(r,e.edge,e.delta);break;case`snap`:a=this.windowHistory.snap(r,e.target,t);break;case`dock`:a=this.windowHistory.dock(r,e.targetId,e.edge,{ratio:e.ratio});break;case`set-placement`:a=this.windowHistory.setPlacement(r,e.placement,{rect:e.rect});break;case`toggle-placement`:{if(!i)return U(`invalid`,!1,e,void 0,void 0,`window-not-found`);let t=i.placement===`floating`?`tiled`:`floating`;a=this.windowHistory.setPlacement(r,t,{rect:e.rect});break}case`minimize`:a=this.windowHistory.minimize(r);break;case`maximize`:a=this.windowHistory.maximize(r);break;case`toggle-maximize`:a=i?.state===`maximized`?this.windowHistory.restore(r):this.windowHistory.maximize(r);break;case`restore`:a=this.windowHistory.restore(r);break;case`close`:a=this.windowHistory.close(r);break;case`recover-bounds`:a=this.windowHistory.recoverBounds(r,t,{titleBarHeight:1});break;case`toggle-always-on-top`:if(!i)return U(`invalid`,!1,e,void 0,void 0,`window-not-found`);a=this.windowHistory.setAlwaysOnTop(r,!i.alwaysOnTop);break;case`set-group`:a=this.windowHistory.setGroup(r,e.groupId);break;default:return U(`invalid`,!1,e,void 0,void 0,`unsupported-window-command`)}return this.#k(e,a)}catch(t){return U(`failed`,!1,e,void 0,void 0,gf(t))}}handleKey(e,t,n={}){if(this.#h){if(e.key===`escape`)return this.execute({kind:`switcher-cancel`},t,n);if(e.key===`return`||e.key===`space`)return this.execute({kind:`switcher-accept`},t,n);if(e.key===`tab`||e.key===`right`||e.key===`down`)return this.execute({kind:`switcher-step`,direction:e.shift?-1:1},t,n);if(e.key===`left`||e.key===`up`)return this.execute({kind:`switcher-step`,direction:-1},t,n)}if(!e.meta||!(e.shift||e.key===`tab`))return U(`ignored`,!1,void 0,void 0,void 0,`window-modifier-not-held`);if(e.key===`tab`)return this.execute({kind:`switcher-open`,direction:e.shift?-1:1},t,n);let r=pf(e.key);if(r)return e.ctrl?this.execute({kind:`nudge`,delta:mf(r,this.#i)},t,n):this.execute({kind:`snap`,target:this.#v(r)},t,n);switch(e.key.toLowerCase()){case`m`:return this.execute({kind:`minimize`},t,n);case`f`:return this.execute({kind:`toggle-maximize`},t,n);case`c`:return this.execute({kind:`close`},t,n);case`r`:return this.execute({kind:`recover-bounds`},t,n);case`p`:return this.execute({kind:`toggle-always-on-top`},t,n);case`d`:return this.execute({kind:`toggle-placement`},t,n);default:return U(`ignored`,!1,void 0,void 0,void 0,`unbound-window-key`)}}#v(e){let t=this.#a(),n=this.#o,r=this.controller.inspect().activeWindowId;if(this.#o={edge:e,at:t,id:r},n&&n.id===r&&t-n.at>=0&&t-n.at<=df&&ff(n.edge)!==ff(e)){let t=ff(e)?e:n.edge,r=ff(e)?n.edge:e;return this.#o=void 0,{kind:`corner`,corner:`${t}-${r}`}}return{kind:`workspace`,edge:e}}handlePointer(e,t,n={}){if(this.#_)return U(`disposed`,!1,void 0,void 0,void 0,`window-host-disposed`);let r;try{r=Pi(e)}catch{return U(`invalid`,!1,void 0,void 0,void 0,`pointer-event-is-invalid`)}if(this.#g)return this.#T(r,t);if(r.kind!==`down`&&n.doubleClickMaximizeMs!==void 0){let e=r.coordinates.cell,i=Rc(this.#s,{kind:r.kind===`move`?`move`:r.kind===`up`?`up`:`cancel`,column:e?.x??NaN,row:e?.y??NaN,timestamp:r.timestamp},{doubleClickMs:n.doubleClickMaximizeMs});if(this.#s=i.state,i.outcome.kind===`double-click`)return this.interactions.inspect().active&&this.#C(r,t),this.execute({kind:`toggle-maximize`,id:i.outcome.id},t,n)}if(this.interactions.inspect().active)return this.#C(r,t);if(r.kind===`down`){let e=r.coordinates.cell;if(!e)return U(`ignored`,!1,void 0,void 0,void 0,`pointer-has-no-cell-coordinate`);let i=this.project(t,n);if(i.topModalId)return U(`blocked`,!1,void 0,void 0,void 0,`pointer-blocked-by-modal:${i.topModalId}`);let a=r.primary&&(r.button===0||r.device!==`mouse`&&r.button===null);if(a)for(let n=i.shelf.length-1;n>=0;--n){let r=i.shelf[n];if(r.rect&&Pc(r.rect,e.x,e.y))return this.execute(r.command,t)}if(a&&r.device===`mouse`&&n.doubleClickMaximizeMs!==void 0){let t=Rc(this.#s,{kind:`down`,id:Yd(i,e.x,e.y),column:e.x,row:e.y,timestamp:r.timestamp},{doubleClickMs:n.doubleClickMaximizeMs});this.#s=t.state}let o=n=>{if(!Pc(n.rect,e.x,e.y))return;for(let r=n.controls.length-1;r>=0;--r){let i=n.controls[r];if(a&&i.command&&Pc(i.hitRect,e.x,e.y))return this.execute(i.command,t)}if(!a)return U(`ignored`,!1,void 0,void 0,void 0,`pointer-is-not-a-primary-activation`);if(n.placement===`floating`){let n=this.interactions.hitTest({column:e.x,row:e.y},t);if(n&&n.region!==`client`)return this.#C(r,t)}let i=this.execute({kind:`focus`,id:n.id},t);return Pc(n.clientRect,e.x,e.y)?{...i,handled:!1,reason:`window-client-focus-pass-through`}:i};for(let e=i.floatingWindows.length-1;e>=0;--e){let t=o(i.floatingWindows[e]);if(t)return t}if(a)for(let t=i.separators.length-1;t>=0;--t){let a=i.separators[t];if(Pc(a.hitRect,e.x,e.y))return this.#w(a,r,n)}for(let e=i.tiledWindows.length-1;e>=0;--e){let t=o(i.tiledWindows[e]);if(t)return t}}return this.#C(r,t)}handleMouse(e,t,n,r={}){try{let i=e===`terminal`?this.#r.terminal(t):this.#r.browser(t);return this.handlePointer(zi(i,t),n,r)}catch(e){return U(`invalid`,!1,void 0,void 0,void 0,gf(e))}}reconcileWindows(e,t=`workbench-window-host`){if(this.#_)return U(`disposed`,!1,void 0,void 0,void 0,`window-host-disposed`);let n;try{n=$d(e,t)}catch(e){return U(`failed`,!1,void 0,void 0,void 0,gf(e))}return this.reconcileRoot(n)}reconcileRoot(e,t={}){if(this.#_)return U(`disposed`,!1,void 0,void 0,void 0,`window-host-disposed`);if(this.#D())return U(`blocked`,!1,void 0,void 0,void 0,`window-gesture-active`);if(this.controller.mutationInProgress)return U(`blocked`,!1,void 0,void 0,void 0,`window-controller-mutation-in-progress`);let n=this.history.inspect();if(n.operation||n.transaction)return U(`blocked`,!1,void 0,void 0,void 0,`window-history-active`);try{let n=this.controller.reconcile(e,t);return this.history.clear(),this.#O(n),this.#L(),U(`applied`,!0,void 0,void 0,void 0,`windows-reconciled`)}catch(e){return U(`failed`,!1,void 0,void 0,void 0,gf(e))}}restoreSnapshot(e){if(this.#z(`restore snapshot`),this.#D())return{action:`restore-snapshot`,status:`blocked`,ok:!1,reason:`window-gesture-active`};let t=this.controller.restoreSnapshot(e);return t.ok&&(this.history.clear(),this.#L()),t}restoreLegacyWorkspace(e){this.#z(`restore legacy workspace`);let t=this.controller.snapshot();return this.restoreSnapshot({version:1,compactMode:t.compactMode,windowIds:t.windowIds,minimizedWindowIds:t.minimizedWindowIds,closedWindowIds:t.closedWindowIds,maximizedWindowId:t.maximizedWindowId,modals:t.modals,workspace:e})}snapshot(){return this.controller.snapshot()}async undo(){if(this.#z(`undo`),this.#D())return!1;let e=await this.history.undo();return e&&this.#L(),e}async redo(){if(this.#z(`redo`),this.#D())return!1;let e=await this.history.redo();return e&&this.#L(),e}inspect(){return{disposed:this.#_,ownsOverlays:this.#e,ownsHistory:this.#t,ownsCapture:this.#n,commitRevision:this.commitRevision.peek(),viewRevision:this.viewRevision.peek(),switcherOpen:this.#h!==void 0,controller:this.controller.inspect(),interaction:this.interactions.inspect(),history:this.history.inspect(),separatorResize:this.#g?{pointerId:this.#g.pointerId,splitId:this.#g.splitId,direction:this.#g.direction,delta:this.#g.delta}:void 0}}dispose(){this.#_||(this.#_=!0,this.#E(),this.interactions.dispose(),this.#f.dispose(),this.windowHistory.dispose(),this.history.clear(),this.controller.dispose(),this.#n&&this.capture.dispose(),this.#e&&this.overlays.dispose(),this.commitRevision.dispose(),this.viewRevision.dispose())}#y(e,t,n,r,i,a,o=[]){let s=this.#c.get(e)??Ms();this.#c.set(e,s),Ns(s,{rect:r,title:t,maximized:a.state===`maximized`,alwaysOnTop:n===`floating`?a.alwaysOnTop:void 0,showConfig:this.#p(e),configLabel:this.#m,configAccessibilityLabel:`Configure ${t}`});let c=this.#l.get(e)??[];this.#l.set(e,c);let l=Ps(c,s),u=r.column+Math.floor((Math.max(1,r.width)-1)/2),d=l.filter(e=>!(e.hitRect.row===r.row&&Pc(e.hitRect,u,r.row))).map(t=>{let r=nf(e,t.kind,n,a.state);return{kind:t.kind,text:t.text,rect:of(t.rect),hitRect:of(t.hitRect),tone:t.tone,command:r,semantic:{id:`${e}:control:${t.kind}`,role:`button`,label:t.accessibilityLabel,shortcut:t.shortcut?`Shift+Alt+${t.shortcut}`:void 0}}}),f=[n===`floating`?`Floating window`:`Tiled window`,a.active?`active`:void 0,a.alwaysOnTop?`always on top`:void 0,a.groupId?`group ${a.groupId}`:void 0].filter(Boolean).join(`, `);return{id:e,title:t,placement:n,state:a.state,rect:of(r),titleBarRect:{column:r.column,row:r.row,width:Math.max(0,r.width),height:+(r.height>0)},clientRect:uf(r,1),active:a.active,alwaysOnTop:a.alwaysOnTop,groupId:a.groupId,zIndex:i,controls:d,titleAdornments:o,semantic:{id:`${e}:window`,role:`window`,label:t,description:f,selected:a.active}}}#b(e,t){let n=e.windows.filter(e=>e.state===`minimized`&&e.declaredVisible),r=new Map;if(t&&t.width>0&&t.height>0){let e=bs(this.#u,{row:t.row,column:t.column,width:t.width,entries:n.map(e=>({id:e.id,title:e.title??e.id}))});r=new Map(e.buttons.map(e=>[e.id,of(e.rect)]))}return n.map((e,t)=>({id:e.id,title:e.title??e.id,active:e.active,placement:e.placement,rect:r.get(e.id),command:{kind:`restore`,id:e.id},semantic:{id:`${e.id}:shelf`,role:`button`,label:`Restore ${e.title??e.id}`,positionInSet:t+1,setSize:n.length}}))}#x(e,t){let n=this.#P(e,t);if(!n)return;let r=new Map(e.windows.map(e=>[e.id,e])),i=n.ids.flatMap((e,t)=>{let i=r.get(e);if(!i)return[];let a=t===n.selectedIndex;return[{id:e,title:i.title??e,selected:a,state:i.state,semantic:{id:`${e}:switcher`,role:`option`,label:i.title??e,selected:a,positionInSet:t+1,setSize:n.ids.length}}]});return{selectedIndex:Math.min(n.selectedIndex,Math.max(0,i.length-1)),items:i,semantic:{id:`window-switcher`,role:`listbox`,label:`Windows`}}}#S(e,t){let n=this.interactions.inspect();if(!n.snapOnRelease)return;let r=n.active;if(!r||r.mode!==`move`||r.updateCount===0)return;let i=du({column:r.current.column,row:r.current.row},e,n.snapDistance,n.snapEdgeSpanRatio,n.snapCornerReach);if(!i)return;let a=t.windows.find(e=>e.id===r.windowId);if(!a||a.groupId)return;let o=hf(i,e,a);return o?{windowId:r.windowId,target:i,rect:o}:void 0}#C(e,t){let n=this.interactions.handlePointer(e,t);return n.status===`committed`?this.#L():n.handled&&this.#R(),{status:n.status===`failed`?`failed`:n.status===`blocked`?`blocked`:n.status===`disposed`?`disposed`:n.handled?`applied`:`ignored`,handled:n.handled,interaction:n,reason:n.reason}}#w(e,t,n){let r=t.coordinates.cell,i;try{if(i=this.windowHistory.beginGesture({action:`resize`,id:e.splitId,parameters:{pointer:t.pointerId}}),i.inspect().state!==`active`)return U(`blocked`,!1,e.command,void 0,void 0,i.inspect().reason);this.capture.capture(t.pointerId,this.#d)}catch(t){return lf(()=>i?.cancel()),U(`blocked`,!1,e.command,void 0,void 0,gf(t))}return this.#g={pointerId:t.pointerId,splitId:e.splitId,direction:e.direction,startPointerColumn:r.x,startPointerRow:r.y,startSeparatorColumn:e.rect.column,startSeparatorRow:e.rect.row,delta:0,options:sf(n),gesture:i},this.#R(),U(`applied`,!0,e.command,void 0,void 0,`separator-resize-started`)}#T(e,t){let n=this.#g,r={kind:`resize-split`,splitId:n.splitId,delta:0};if(e.pointerId!==n.pointerId)return U(`blocked`,!1,r,void 0,void 0,`another-pointer-owns-separator-resize`);if(this.capture.captureOwner(n.pointerId)!==this.#d)return this.#E()&&this.#R(),U(`blocked`,!1,r,void 0,void 0,`separator-pointer-capture-lost`);if(e.kind===`cancel`)return this.#E()&&this.#R(),U(`applied`,!0,r,void 0,void 0,`separator-resize-cancelled`);if(e.kind!==`move`&&e.kind!==`up`)return U(`ignored`,!1,r,void 0,void 0,`separator-resize-event-ignored`);let i,a=e.coordinates.cell;if(a){let e=(n.direction===`row`?a.x-n.startPointerColumn:a.y-n.startPointerRow)-n.delta;if(e!==0){if(i=this.controller.resize(n.splitId,e,t,n.options),!i.ok){let t=i.reason;return this.#E(),this.#R(),U(`blocked`,!0,{...r,delta:e},i,void 0,t)}if(i.status===`applied`){let e=this.controller.project(t,n.options).workspace.separators.find(e=>e.splitId===n.splitId);if(!e)return this.#E(),this.#R(),U(`blocked`,!0,{...r,delta:n.delta},i,void 0,`separator-disappeared-during-resize`);n.delta=n.direction===`row`?e.rect.column-n.startSeparatorColumn:e.rect.row-n.startSeparatorRow}}}if(e.kind===`move`)return i?.status===`applied`&&this.#R(),U(i?.status===`applied`?`applied`:`unchanged`,!0,{...r,delta:n.delta},i);let o=!1;try{o=n.gesture.commit()}catch(e){return lf(()=>this.capture.release(n.pointerId,this.#d)),this.#g=void 0,U(`failed`,!0,{...r,delta:n.delta},i,void 0,gf(e))}return lf(()=>this.capture.release(n.pointerId,this.#d)),this.#g=void 0,o?this.#L():this.#R(),U(o?`applied`:`unchanged`,!0,{...r,delta:n.delta},i,void 0,`separator-resize-committed`)}#E(){let e=this.#g;if(!e)return!1;this.#g=void 0;let t=!1;try{t=e.gesture.cancel()}finally{this.capture.disposed||lf(()=>this.capture.release(e.pointerId,this.#d))}return t}#D(){return this.#g!==void 0||this.interactions.inspect().active!==void 0}#O(e){let t=new Set(e.windows.map(e=>e.id));for(let e of this.#c.keys())t.has(e)||this.#c.delete(e);for(let e of this.#l.keys())t.has(e)||this.#l.delete(e);this.#u.buttons.length=0,this.#u.items.length=0,this.#u.placements.length=0;let n=this.#h;if(!n)return;let r=n.ids[n.selectedIndex],i=n.ids.filter(e=>t.has(e));if(i.length===0){this.#h=void 0;return}let a=r===void 0?-1:i.indexOf(r);this.#h={ids:i,selectedIndex:a>=0?a:0}}#k(e,t){return t.status===`applied`?this.#L():t.ok&&this.#R(),U(t.status===`applied`?`applied`:t.status===`unchanged`?`unchanged`:t.status===`disposed`?`disposed`:t.status===`invalid`?`invalid`:`blocked`,t.ok,e,t,void 0,t.reason)}#A(e,t,n){let r=this.controller.inspect(),i=this.#N(r,n);if(i.length===0)return U(`blocked`,!1,e,void 0,void 0,`no-focusable-windows`);let a=i.findIndex(e=>e.id===r.activeWindowId),o=i[a<0?e.direction>0?0:i.length-1:(a+e.direction+i.length)%i.length];return o.state===`minimized`&&this.execute({kind:`restore`,id:o.id},t,n),this.execute({kind:`focus`,id:o.id},t,n)}#j(e,t,n){let r=this.controller.inspect(),i=this.#N(r,n).map(e=>e.id);if(i.length===0)return this.#h=void 0,U(`blocked`,!1,t,void 0,void 0,`no-switcher-windows`);if(this.#h){let t=this.#h.ids[this.#h.selectedIndex],n=i.indexOf(t??``),a=n>=0?n:Math.max(0,i.indexOf(r.activeWindowId??``));this.#h={ids:i,selectedIndex:(a+e+i.length)%i.length}}else{let t=Math.max(0,i.indexOf(r.activeWindowId??``));this.#h={ids:i,selectedIndex:(t+e+i.length)%i.length}}return this.#R(),U(`applied`,!0,t)}#M(e,t,n){let r=this.controller.inspect(),i=this.#P(r,n),a=i?.ids[i.selectedIndex];if(this.#h=void 0,this.#R(),!a)return U(`unchanged`,!1,e,void 0,void 0,`switcher-is-closed`);let o=this.#N(r,n).find(e=>e.id===a);return o?(o.state===`minimized`&&this.execute({kind:`restore`,id:a},t,n),this.execute({kind:`focus`,id:a},t,n)):U(`blocked`,!1,e,void 0,void 0,`switcher-window-not-visible`)}#N(e,t){let n=t.visibleWindowIds?new Set(t.visibleWindowIds):void 0;return e.windows.filter(e=>e.declaredVisible&&e.state!==`closed`&&(e.placement===`floating`||!n||n.has(e.id))).sort((e,t)=>t.focusOrder-e.focusOrder||e.id.localeCompare(t.id))}#P(e,t){let n=this.#h;if(!n)return;let r=this.#N(e,t).map(e=>e.id);if(r.length===0){this.#h=void 0;return}let i=n.ids[n.selectedIndex],a=r.indexOf(i??``),o=r.indexOf(e.activeWindowId??``);return this.#h={ids:r,selectedIndex:a>=0?a:o>=0?o:0},this.#h}#F(e,t){let n=this.controller.inspect().windows.filter(e=>e.placement===`floating`&&e.declaredVisible&&e.state!==`minimized`&&e.state!==`closed`),r;try{r=this.windowHistory.beginGesture({action:`recover-bounds`,parameters:{all:1}})}catch(t){return U(`blocked`,!1,e,void 0,void 0,gf(t))}if(r.inspect().state!==`active`)return U(`blocked`,!1,e,void 0,void 0,r.inspect().reason);let i=!1;try{for(let a of n){let n=this.controller.recoverBounds(a.id,t,{titleBarHeight:1});if(!n.ok)return r.cancel(),U(`blocked`,!1,e,n,void 0,n.reason);i||=n.status===`applied`}let a=r.commit();return i||a?this.#L():this.#R(),U(i?`applied`:`unchanged`,i,e)}catch(t){try{r.cancel()}catch{}return U(`failed`,!1,e,void 0,void 0,gf(t))}}#I(e){let t=e.id??this.controller.inspect().activeWindowId;if(!t)return U(`blocked`,!1,e,void 0,void 0,`no-active-window`);let n;try{n=this.windowHistory.beginGesture({action:`set-placement`,id:t,parameters:{placement:`floating`,restore:1}})}catch(t){return U(`blocked`,!1,e,void 0,void 0,gf(t))}if(n.inspect().state!==`active`)return U(`blocked`,!1,e,void 0,void 0,n.inspect().reason);try{let r=this.controller.restore(t);if(!r.ok)return n.cancel(),U(`blocked`,!1,e,r,void 0,r.reason);let i=this.controller.setPlacement(t,`floating`);if(!i.ok)return n.cancel(),U(`blocked`,!1,e,i,void 0,i.reason);let a=r.status===`applied`||i.status===`applied`,o=n.commit();return a||o?this.#L():this.#R(),U(a?`applied`:`unchanged`,a,e,i)}catch(t){try{n.cancel()}catch{}return U(`failed`,!1,e,void 0,void 0,gf(t))}}#L(){this.commitRevision.value=this.commitRevision.peek()+1,this.#R()}#R(){this.viewRevision.value=this.viewRevision.peek()+1}#z(e){if(this.#_)throw Error(`Workbench window host is disposed; cannot ${e}.`)}};function tf(e){return new ef(e)}function nf(e,t,n,r){if(t!==`config`)return t===`maximize`?{kind:`maximize`,id:e}:t===`restore`?n===`tiled`&&r===`maximized`?{kind:`restore-floating`,id:e}:{kind:`restore`,id:e}:t===`minimize`?{kind:`minimize`,id:e}:t===`close`?{kind:`close`,id:e}:{kind:`toggle-always-on-top`,id:e}}function rf(e){let t=e.axis===`column`?`horizontally`:`vertically`;return{splitId:e.splitId,direction:e.direction,axis:e.axis,ratio:e.ratio,bounds:of(e.bounds),firstRect:of(e.firstRect),rect:of(e.rect),hitRect:of(e.hitRect),secondRect:of(e.secondRect),command:{kind:`resize-split`,splitId:e.splitId,delta:1},semantic:{id:`${e.splitId}:separator`,role:`separator`,label:`Resize split ${t}`,description:`Drag ${t} to resize adjacent tiled windows`}}}function U(e,t,n,r,i,a){return{status:e,handled:t,command:n,action:r,interaction:i,reason:a}}function af(e){return typeof e==`number`&&Number.isFinite(e)&&e>0}function of(e){return{column:e.column,row:e.row,width:e.width,height:e.height}}function sf(e){return{gap:e.gap,separatorHitSize:e.separatorHitSize,compactMode:e.compactMode,visibleWindowIds:e.visibleWindowIds?[...e.visibleWindowIds]:void 0}}function cf(e,t){let n=Math.max(1,127-t.length);return`${e.slice(0,n)}:${t}`}function lf(e){try{e()}catch{}}function uf(e,t){return{column:e.column+Math.min(t,Math.max(0,e.width)),row:e.row+Math.min(t,Math.max(0,e.height)),width:Math.max(0,e.width-t*2),height:Math.max(0,e.height-t*2)}}var df=250;function ff(e){return e===`top`||e===`bottom`}function pf(e){return e===`left`||e===`right`||e===`top`||e===`bottom`?e:e===`up`?`top`:e===`down`?`bottom`:void 0}function mf(e,t){return{columns:e===`left`?-t:e===`right`?t:0,rows:e===`top`?-t:e===`bottom`?t:0}}function hf(e,t,n){if(e.kind===`dock`||t.width<=0||t.height<=0)return;let r=Math.max(1,Math.ceil(t.width/2)),i=Math.max(1,Math.floor(t.width/2)),a=Math.max(1,Math.ceil(t.height/2)),o=Math.max(1,Math.floor(t.height/2)),s=e.kind===`workspace`?e.edge===`right`:e.corner===`top-right`||e.corner===`bottom-right`,c=e.kind===`workspace`?e.edge===`bottom`:e.corner===`bottom-left`||e.corner===`bottom-right`,l=e.kind===`workspace`&&(e.edge===`top`||e.edge===`bottom`)?t.width:s?i:r,u=e.kind===`workspace`&&(e.edge===`left`||e.edge===`right`)?t.height:c?o:a;return l=Math.max(n.minWidth??1,Math.min(n.maxWidth??1e6,l)),u=Math.max(n.minHeight??1,Math.min(n.maxHeight??1e6,u)),{column:s?t.column+t.width-l:t.column,row:c?t.row+t.height-u:t.row,width:l,height:u}}function gf(e){return e instanceof Error&&Array.from(e.message,e=>{let t=e.charCodeAt(0);return t<=31||t===127?` `:e}).join(``).trim().slice(0,256)||`window-host-operation-failed`}function _f(e){return[...e].sort()}var vf=[W(`box`,`Box`,`primitive`,`Filled rectangular surface for backgrounds and panels.`,[`component`,`themeable`]),W(`button`,`Button`,`input`,`Clickable and focusable command button.`,[`component`,`controller`,`keyboard`,`mouse`,`themeable`]),W(`checkbox`,`CheckBox`,`input`,`Boolean input with keyboard and mouse toggling.`,[`component`,`controller`,`keyboard`,`mouse`,`themeable`]),W(`combobox`,`ComboBox`,`input`,`Text input with selectable suggestions.`,[`component`,`controller`,`keyboard`,`mouse`,`selection`,`themeable`]),W(`input`,`Input`,`input`,`Single-line text entry.`,[`component`,`controller`,`keyboard`,`themeable`]),W(`textbox`,`TextBox`,`input`,`Multi-line text editor with cursor, line numbers, and selection.`,[`component`,`controller`,`keyboard`,`themeable`]),W(`slider`,`Slider`,`input`,`Horizontal or vertical numeric slider.`,[`component`,`controller`,`keyboard`,`mouse`,`themeable`]),W(`radio-group`,`RadioGroup`,`input`,`Single-choice option group renderer.`,[`component`,`controller`,`render-helper`,`selection`,`keyboard`,`mouse`,`themeable`]),W(`list`,`List`,`data`,`Selectable list component.`,[`component`,`controller`,`selection`,`themeable`]),W(`virtual-list`,`VirtualList`,`data`,`Windowed list component for large item sets.`,[`component`,`controller`,`selection`,`virtualized`,`themeable`]),W(`table`,`Table`,`data`,`Scrollable table component with headers and selection.`,[`component`,`controller`,`selection`,`themeable`]),W(`data-table`,`DataTable`,`data`,`Filtering, sorting, pagination, and row formatting helpers.`,[`controller`,`render-helper`,`selection`]),W(`tree`,`Tree`,`data`,`Hierarchical rows with expansion state.`,[`component`,`controller`,`render-helper`,`selection`,`keyboard`,`themeable`]),W(`file-explorer`,`FileExplorer`,`data`,`Path-aware tree controller for project and file browsers.`,[`controller`,`selection`,`keyboard`,`mouse`,`themeable`]),W(`tabs`,`Tabs`,`navigation`,`Segmented route or view selector.`,[`controller`,`render-helper`,`selection`,`keyboard`,`themeable`]),W(`breadcrumbs`,`Breadcrumbs`,`navigation`,`Truncated path and route trail renderer.`,[`render-helper`]),W(`stepper`,`Stepper`,`navigation`,`Sequential workflow step indicator.`,[`controller`,`render-helper`,`selection`]),W(`menu-bar`,`MenuBar`,`navigation`,`Top-level command menu row.`,[`controller`,`render-helper`,`selection`,`keyboard`]),W(`key-help`,`KeyHelp`,`navigation`,`Formatted key binding help rows.`,[`render-helper`,`keyboard`]),W(`command-palette`,`CommandPalette`,`overlay`,`Filterable command surface.`,[`controller`,`render-helper`,`selection`,`keyboard`,`async`]),W(`context-menu`,`ContextMenu`,`overlay`,`Selectable contextual command list.`,[`controller`,`render-helper`,`selection`,`keyboard`,`mouse`]),W(`modal`,`Modal`,`overlay`,`Centered overlay frame and focus target.`,[`controller`,`render-helper`,`keyboard`,`mouse`,`themeable`]),W(`toast`,`ToastStack`,`overlay`,`Transient notification stack renderer.`,[`controller`,`render-helper`,`async`]),W(`empty-state`,`EmptyState`,`feedback`,`Centered empty, loading, or fallback message.`,[`render-helper`,`async`]),W(`spinner`,`Spinner`,`feedback`,`Animated status indicator renderer.`,[`render-helper`,`async`]),W(`progressbar`,`ProgressBar`,`feedback`,`Horizontal or vertical progress component.`,[`component`,`controller`,`themeable`]),W(`statusbar`,`StatusBar`,`feedback`,`Left/right status row renderer.`,[`component`,`render-helper`,`themeable`]),W(`sparkline`,`Sparkline`,`visualization`,`Compact trend renderer for metric arrays.`,[`component`,`render-helper`,`dashboard`]),W(`gauge`,`Gauge`,`visualization`,`Compact labeled value bar renderer.`,[`render-helper`,`dashboard`]),W(`chart`,`Chart`,`visualization`,`Text bar chart renderer.`,[`render-helper`,`dashboard`]),W(`log-viewer`,`LogViewer`,`data`,`Tail-following log row window helpers.`,[`controller`,`render-helper`,`virtualized`,`dashboard`]),W(`metric-series`,`MetricSeries`,`data`,`Bounded metric history controller and statistics.`,[`controller`,`dashboard`]),W(`three-ascii`,`ThreeAscii`,`visualization`,`Three.js scene renderer for terminal ASCII output.`,[`component`,`three`,`dashboard`]),W(`frame`,`Frame`,`layout`,`Bordered component frame.`,[`component`,`themeable`]),W(`window-manager`,`WindowManager`,`layout`,`Tiling window state, fullscreen tabs, and chrome model.`,[`controller`,`keyboard`,`mouse`]),W(`scroll-area`,`ScrollArea`,`layout`,`Viewport and scrollbar helper renderers.`,[`controller`,`render-helper`,`virtualized`]),W(`pad`,`Pad`,`layout`,`Off-screen scrollable text surface with viewport slicing and cursor reveal.`,[`controller`,`render-helper`,`virtualized`,`keyboard`,`mouse`]),W(`label`,`Label`,`primitive`,`Aligned text component.`,[`component`,`themeable`]),W(`text`,`Text`,`primitive`,`Raw text draw object.`,[`component`,`themeable`])];bf(vf),xf(vf),Sf(vf),Cf(vf);function W(e,t,n,r,i){return{id:e,name:t,category:n,description:r,capabilities:i}}function yf(e){return e.toLowerCase().replace(/[\s_-]+/g,``)}function bf(e){let t=new Map;for(let n=0;n<e.length;n+=1){let r=e[n];t.set(yf(r.id),r),t.set(yf(r.name),r)}return t}function xf(e){let t=new Map;for(let n=0;n<e.length;n+=1){let r=e[n],i=`${yf(r.id)} ${yf(r.name)} ${yf(r.description)} ${yf(r.category)}`;for(let e=0;e<r.capabilities.length;e+=1)i+=` ${yf(r.capabilities[e])}`;t.set(r,i)}return t}function Sf(e){let t=new Set;for(let n=0;n<e.length;n+=1)t.add(e[n].category);return _f(t)}function Cf(e){let t=new Set;for(let n=0;n<e.length;n+=1){let r=e[n].capabilities;for(let e=0;e<r.length;e+=1)t.add(r[e])}return _f(t)}var wf=[`black`,`red`,`green`,`yellow`,`blue`,`magenta`,`cyan`,`white`,`brightBlack`,`brightRed`,`brightGreen`,`brightYellow`,`brightBlue`,`brightMagenta`,`brightCyan`,`brightWhite`];function Tf(e){return e}function Ef(e){let t=kf(e);if(t.length===0)return Tf;let n=`\x1b[${t.join(`;`)}m`;return e=>`${n}${e}\x1b[0m`}function Df(e){return Ef(e)}function Of(e){let t={};for(let[n,r]of Object.entries(e))t[n]=Ef(r);return t}function kf(e){let t=[];if(e.bold&&t.push(1),e.dim&&t.push(2),e.italic&&t.push(3),e.underline){let n=e.underlineStyle??`solid`,r=[`solid`,`double`,`wavy`,`dotted`,`dashed`].indexOf(n);t.push(r<=0?4:`4:${r+1}`)}if(e.overline&&t.push(53),e.inverse&&t.push(7),e.strikethrough&&t.push(9),e.foreground!==void 0&&t.push(...Af(e.foreground,!1)),e.background!==void 0&&t.push(...Af(e.background,!0)),e.underlineColor!==void 0){let n=e.underlineColor;t.push(58,...typeof n==`string`?[5,Math.max(0,wf.indexOf(n))]:Af(n,!1).slice(1))}return t}function Af(e,t){if(typeof e==`number`)return[t?48:38,5,Mf(e)];if(typeof e!=`string`){let[n,r,i]=e;return[t?48:38,2,Mf(n),Mf(r),Mf(i)]}return[jf(e,t)]}function jf(e,t){let n=wf.indexOf(e),r=t?40:30;return n<8?r+n:r+60+n-8}function Mf(e){return Math.max(0,Math.min(255,Math.round(e)))}var Nf=[`foreground`,`muted`,`accent`,`success`,`warning`,`danger`,`surface`];({...Of({foreground:{foreground:[230,255,246]},muted:{foreground:[104,124,132]},accent:{foreground:[31,231,210]},success:{foreground:[156,255,58]},warning:{foreground:[255,196,87]},danger:{foreground:[255,79,216]},surface:{background:[7,16,23]}})}),{...Of({foreground:{foreground:`white`},muted:{foreground:`brightBlack`},accent:{foreground:`cyan`},success:{foreground:`green`},warning:{foreground:`yellow`},danger:{foreground:`red`}})};function Pf(e={},t={}){let n={...e.variants??{}};for(let[e,r]of Object.entries(t.variants??{}))n[e]={...n[e]??{},...r};return{extends:If(e.extends,t.extends),base:{...e.base??{},...t.base??{}},variants:n}}function Ff(...e){let t={},n={};for(let r of e){Object.assign(t,r.tokens??{});for(let[e,t]of Object.entries(r.components??{}))n[e]=Pf(n[e],t)}return{tokens:t,components:n}}function If(e,t){let n=[...Lf(e),...Lf(t)];return n.length===0?void 0:[...new Set(n)]}function Lf(e){return e===void 0?[]:typeof e==`string`?[e]:[...e]}function Rf(...e){return Ff(...e)}var zf=[...vf].sort((e,t)=>e.name.localeCompare(t.name));zf.map(e=>e.name);var Bf=new Set(zf.flatMap(e=>[Xf(e.id),Xf(e.name)]));function Vf(e={}){let t=e.components?new Set([...e.components].map(Xf)):void 0,n={};for(let e of zf)t&&!t.has(Xf(e.id))&&!t.has(Xf(e.name))||(n[e.name]=Uf(e));if(t)for(let t of e.components??[])Bf.has(Xf(t))||(n[t]=Wf());return n}function Hf(e={}){return Rf({components:Vf()},e)}function Uf(e){return e.name===`Button`?Kf():e.name===`Frame`||e.name===`Box`||e.name===`WindowManager`?Gf():e.category===`data`?qf():e.category===`input`||e.capabilities.includes(`selection`)?Kf():e.category===`overlay`?Jf():e.category===`feedback`||e.category===`visualization`?Yf():e.category===`navigation`||e.category===`layout`?Gf():Wf()}function Wf(){return{base:{base:`foreground`,focused:`accent`,active:`success`,disabled:`muted`},variants:{muted:{base:`muted`},danger:{base:`danger`},warning:{base:`warning`},success:{base:`success`}}}}function Gf(){return{base:{base:[`surface`,`foreground`],focused:[`surface`,`accent`],active:[`surface`,`success`],disabled:[`surface`,`muted`]},variants:{chrome:{base:[`surface`,`accent`],active:[`surface`,`success`]},quiet:{base:`muted`,focused:`accent`},danger:{base:[`surface`,`danger`],focused:[`surface`,`warning`]}}}}function Kf(){return{base:{base:[`surface`,`foreground`],focused:[`surface`,`accent`],active:[`surface`,`success`],disabled:[`surface`,`muted`]},variants:{primary:{base:[`surface`,`accent`],active:[`surface`,`success`]},quiet:{base:`muted`,focused:`accent`},danger:{base:`danger`,focused:`warning`,active:`danger`},warning:{base:`warning`,focused:`accent`,active:`warning`},success:{base:`success`,focused:`accent`,active:`success`}}}}function qf(){return{base:{base:`foreground`,focused:`accent`,active:[`surface`,`foreground`],disabled:`muted`},variants:{header:{base:[`surface`,`accent`],active:[`surface`,`success`]},selected:{base:[`surface`,`foreground`],focused:[`surface`,`accent`],active:[`surface`,`success`]},stale:{base:`warning`,focused:`accent`},danger:{base:`danger`,focused:`warning`}}}}function Jf(){return{base:{base:[`surface`,`foreground`],focused:[`surface`,`accent`],active:[`surface`,`success`],disabled:[`surface`,`muted`]},variants:{palette:{base:[`surface`,`foreground`],focused:[`surface`,`accent`],active:[`surface`,`success`]},warning:{base:[`surface`,`warning`],focused:[`surface`,`accent`]},danger:{base:[`surface`,`danger`],focused:[`surface`,`warning`]}}}}function Yf(){return{base:{base:`foreground`,focused:`accent`,active:`success`,disabled:`muted`},variants:{info:{base:`accent`,active:`accent`},success:{base:`success`,active:`success`},warning:{base:`warning`,active:`warning`},danger:{base:`danger`,active:`danger`}}}}function Xf(e){return e.toLowerCase().replaceAll(/[^a-z0-9]/g,``)}Hf(),Hf(),Hf();var Zf=[{name:`unit01`,label:`Unit-01 Signal`,description:`Bio-electric violet, acid green, and warning orange inspired by late-night mecha command rooms.`,dark:!0,bg:`#09040f`,bgAlt:`#13091e`,panel:`#20112f`,panelAlt:`#2f1b44`,surface:`#42255f`,border:`#6e42a0`,borderStrong:`#a66cff`,text:`#f2ecff`,textMuted:`#b7a4c8`,textSoft:`#d9c8f0`,accent:`#9cff4f`,accentDeep:`#244d19`,warm:`#ff9f3d`,warmDeep:`#68340f`,success:`#a9ff68`,warning:`#ffb13d`,danger:`#ff4f83`,idle:`#867795`,review:`#7ad7ff`,subtitle:`#c5ffa8`},{name:`arcane`,label:`Arcane Tide`,description:`Deep navy, cyan glass, and brass highlights.`,dark:!0,bg:`#081219`,bgAlt:`#0d1a22`,panel:`#10222c`,panelAlt:`#152c37`,surface:`#1a3644`,border:`#335868`,borderStrong:`#4d7a8f`,text:`#f6f1e8`,textMuted:`#9db3bf`,textSoft:`#c7d8df`,accent:`#7ad7ff`,accentDeep:`#2d5364`,warm:`#f4c86a`,warmDeep:`#5d4722`,success:`#9ad29a`,warning:`#f0b35f`,danger:`#ef7d6f`,idle:`#7b8a96`,review:`#b99adf`,subtitle:`#b8d6c7`},{name:`forge`,label:`Forge Ember`,description:`Sooty charcoal with ember copper and furnace gold.`,dark:!0,bg:`#160d0b`,bgAlt:`#211310`,panel:`#341d18`,panelAlt:`#472823`,surface:`#5d372f`,border:`#885845`,borderStrong:`#c28969`,text:`#f8eadc`,textMuted:`#bfad9d`,textSoft:`#e3d2c4`,accent:`#ff9f68`,accentDeep:`#6e3b2a`,warm:`#ffd166`,warmDeep:`#7c5a20`,success:`#a9d290`,warning:`#f2b45f`,danger:`#f08073`,idle:`#8e7a70`,review:`#d6a5f3`,subtitle:`#e4c7a9`},{name:`grove`,label:`Verdant Grove`,description:`Pine green shadows with mint and moss accents.`,dark:!0,bg:`#08130d`,bgAlt:`#0d1d15`,panel:`#153126`,panelAlt:`#1d4434`,surface:`#28614b`,border:`#4c7c63`,borderStrong:`#76ae8b`,text:`#eef7ef`,textMuted:`#a3baaa`,textSoft:`#d0e3d3`,accent:`#7be0bb`,accentDeep:`#295948`,warm:`#d7cb72`,warmDeep:`#5f561f`,success:`#9fda8d`,warning:`#e9bf60`,danger:`#ef8376`,idle:`#778a7d`,review:`#99bbef`,subtitle:`#b9dcc2`},{name:`velvet`,label:`Royal Velvet`,description:`Plum lacquer, rose neon, and velvet gold.`,dark:!0,bg:`#100914`,bgAlt:`#1a0f21`,panel:`#281534`,panelAlt:`#381f47`,surface:`#523066`,border:`#78518f`,borderStrong:`#ac7cc8`,text:`#f7effa`,textMuted:`#b8a6c4`,textSoft:`#ddd0e6`,accent:`#f694d8`,accentDeep:`#643257`,warm:`#ffd08b`,warmDeep:`#6e4e1f`,success:`#aad68c`,warning:`#f3b66b`,danger:`#f27d96`,idle:`#8a7c95`,review:`#9db7ff`,subtitle:`#dfbfed`},{name:`section9`,label:`Section 9 Ghost`,description:`Cybernetic teal, optic amber, and cold blue surfaces inspired by networked city interfaces.`,dark:!0,bg:`#031116`,bgAlt:`#061b22`,panel:`#0b2630`,panelAlt:`#103743`,surface:`#174a58`,border:`#2a7482`,borderStrong:`#49b6c7`,text:`#e8fbff`,textMuted:`#91b8c0`,textSoft:`#c1e5eb`,accent:`#42f5d7`,accentDeep:`#124b45`,warm:`#ffc857`,warmDeep:`#5c4312`,success:`#7dffa8`,warning:`#ffca63`,danger:`#ff6b7f`,idle:`#6f9098`,review:`#9db7ff`,subtitle:`#a7fff1`},{name:`parchment`,label:`Parchment Brass`,description:`Warm ivory panels with brass, ink, and red-wax accents.`,dark:!1,bg:`#f6efdf`,bgAlt:`#efe5d2`,panel:`#e6d9bf`,panelAlt:`#dbcaa9`,surface:`#d0b98f`,border:`#9b7c4a`,borderStrong:`#785d2e`,text:`#2f2415`,textMuted:`#756347`,textSoft:`#4a3920`,accent:`#2f7f9f`,accentDeep:`#8dc5d8`,warm:`#b98a2b`,warmDeep:`#ecd49a`,success:`#5d915b`,warning:`#cb8a2c`,danger:`#b15b52`,idle:`#938165`,review:`#7c70b8`,subtitle:`#5d6f55`},{name:`seaglass`,label:`Seaglass Ledger`,description:`Cool paper whites with teal framing and slate typography.`,dark:!1,bg:`#edf4f3`,bgAlt:`#e0ece9`,panel:`#d2e2dd`,panelAlt:`#bfd4cd`,surface:`#a8c4bc`,border:`#5f8f86`,borderStrong:`#426e67`,text:`#1e3330`,textMuted:`#5d7670`,textSoft:`#31524d`,accent:`#2a91a5`,accentDeep:`#96d5de`,warm:`#d29a34`,warmDeep:`#edd8a7`,success:`#4d8b65`,warning:`#c9853a`,danger:`#b45e63`,idle:`#7a8e89`,review:`#6f7fc1`,subtitle:`#52706b`}];Zf.map(e=>({id:`grwizard-${e.name}`,label:e.label,description:e.description,palette:Qf(e),options:$f(e)}));function Qf(e){return{id:`grwizard-${e.name}`,label:e.label,tokens:{foreground:ep({foreground:e.text}),muted:ep({foreground:e.textMuted,dim:!0}),accent:ep({foreground:e.accent,bold:!0}),success:ep({foreground:e.success,bold:!0}),warning:ep({foreground:e.warning,bold:!0}),danger:ep({foreground:e.danger,bold:!0}),surface:ep({foreground:e.text,background:e.panelAlt})}}}function $f(e){return Hf({components:{Badge:{base:{base:`muted`,focused:`accent`,active:`success`,disabled:`muted`},variants:{blocked:{base:`danger`},review:{base:ep({foreground:e.review,bold:!0})},idle:{base:ep({foreground:e.idle})}}},Button:{base:{base:`foreground`,focused:`accent`,active:`success`,disabled:`muted`},variants:{danger:{base:`danger`,focused:`warning`},warm:{base:`warning`,active:`accent`}}},DataTable:{base:{base:`foreground`,focused:`accent`,active:`surface`,disabled:`muted`}},Frame:{base:{base:ep({foreground:e.border,background:e.panel}),focused:ep({foreground:e.borderStrong,background:e.panelAlt,bold:!0}),active:ep({foreground:e.accent,background:e.surface,bold:!0}),disabled:`muted`}},Input:{base:{base:`foreground`,focused:`accent`,active:`warning`,disabled:`muted`}},List:{base:{base:`foreground`,focused:`accent`,active:`surface`,disabled:`muted`}},StatusBar:{base:{base:`surface`,focused:`accent`,active:`success`,disabled:`muted`},variants:{warning:{base:`warning`},danger:{base:`danger`}}},Text:{base:{base:`foreground`,focused:`accent`,active:`success`,disabled:`muted`},variants:{subtitle:{base:ep({foreground:e.subtitle,italic:!0})},soft:{base:ep({foreground:e.textSoft})}}}}})}function ep(e){return Df({foreground:e.foreground?tp(e.foreground):void 0,background:e.background?tp(e.background):void 0,bold:e.bold,dim:e.dim,italic:e.italic})}function tp(e){let t=e.replace(/^#/,``);return[Number.parseInt(t.slice(0,2),16),Number.parseInt(t.slice(2,4),16),Number.parseInt(t.slice(4,6),16)]}var np={black:[3,4,8],charcoal:[24,26,34],darkBlue:[30,58,112],lightBlue:[205,234,255],darkPurple:[155,115,220],lightPurple:[220,168,255],hotPink:[255,105,180]},rp=[`unit01`,`arcane`,`forge`,`grove`,`velvet`,`section9`,`parchment`,`seaglass`],ip=[{id:`midnight`,label:`Midnight Ops`,background:[8,12,20],surface:[14,21,34],surfaceStrong:[24,35,54],border:[73,101,134],text:[224,235,246],muted:[132,154,178],accent:[76,201,240],success:[73,209,125],warning:[244,190,72],danger:[244,104,110]},{id:`amber`,label:`Amber Glass`,background:[20,12,2],surface:[37,24,7],surfaceStrong:[58,39,10],border:[145,92,21],text:[255,220,145],muted:[188,137,67],accent:[255,174,45],success:[182,219,82],warning:[255,199,80],danger:[255,99,71]},{id:`matrix`,label:`Matrix Phosphor`,background:[1,13,6],surface:[3,25,12],surfaceStrong:[6,43,20],border:[28,112,55],text:[156,255,173],muted:[72,154,91],accent:[45,255,96],success:[113,255,132],warning:[224,241,95],danger:[255,91,91]},{id:`paper`,label:`Paper Terminal`,background:[234,229,215],surface:[248,245,235],surfaceStrong:[218,211,194],border:[104,98,87],text:[35,38,42],muted:[101,100,96],accent:[33,92,145],success:[42,116,65],warning:[157,101,11],danger:[165,48,48]},...Zf.map(ap),{id:`t2`,label:`T2 Neural Steel`,background:np.black,surface:np.charcoal,surfaceStrong:np.darkBlue,border:np.darkPurple,text:np.lightBlue,muted:np.lightPurple,accent:np.hotPink,success:np.lightBlue,warning:np.darkPurple,danger:np.lightPurple},{id:`templeos`,label:`TempleOS`,background:[255,255,255],surface:[255,255,255],surfaceStrong:[170,170,170],border:[0,0,170],text:[0,0,0],muted:[85,85,85],accent:[0,0,170],success:[0,170,0],warning:[170,85,0],danger:[170,0,0]},{id:`miami`,label:`Miami Neon`,background:[214,250,249],surface:[240,255,254],surfaceStrong:[176,222,255],border:[10,132,224],text:[10,45,70],muted:[23,122,84],accent:[198,24,118],success:[8,124,76],warning:[163,96,0],danger:[186,16,44]},{id:`nosferatu`,label:`Nosferatu`,background:[9,7,8],surface:[19,16,17],surfaceStrong:[35,29,31],border:[122,52,56],text:[232,224,222],muted:[110,97,97],accent:[225,58,64],success:[130,176,130],warning:[214,164,84],danger:[255,92,92]},{id:`sabbath`,label:`Sabbath`,background:[8,7,12],surface:[17,15,24],surfaceStrong:[31,27,44],border:[104,78,148],text:[228,223,238],muted:[104,96,122],accent:[178,110,255],success:[132,182,142],warning:[216,168,88],danger:[236,92,100]}];function ap(e){return{id:op(e.name),label:e.label,background:sp(e.bg),surface:sp(e.surface),surfaceStrong:sp(e.panelAlt),border:sp(e.borderStrong),text:sp(e.text),muted:sp(e.textMuted),accent:sp(e.accent),success:sp(e.success),warning:sp(e.warning),danger:sp(e.danger)}}function op(e){let t=rp.find(t=>t===e);if(!t)throw TypeError(`Unsupported Workbench theme id: ${e}`);return t}function sp(e){let t=/^#([\da-f]{6})$/i.exec(e);if(!t)throw TypeError(`Invalid Workbench theme color: ${e}`);let n=Number.parseInt(t[1],16);return[n>>>16&255,n>>>8&255,n&255]}function cp(e){return ip.find(t=>t.id===e)??ip[0]}function lp(e){let t=e=>{let t=e/255;return t<=.03928?t/12.92:((t+.055)/1.055)**2.4};return .2126*t(e[0])+.7152*t(e[1])+.0722*t(e[2])}function up(e){return lp(e.accent)<.3?[255,255,255]:[0,0,0]}function dp(e,t,n){let r=Math.min(1,Math.max(0,n));return[Math.round(e[0]+(t[0]-e[0])*r),Math.round(e[1]+(t[1]-e[1])*r),Math.round(e[2]+(t[2]-e[2])*r)]}var fp=8,pp=1800,mp=16.7,hp=48,gp=1.15,_p=.55,vp=2,yp=class{#e;#t;#n;#r;#i;#a;#o=[];#s=new Uint8Array;constructor(e={}){this.#e=Ep(e.count??fp,1,24),this.#t=Math.max(0,Op(e.pointerLifetimeMs,pp)),this.#n=(e.seed??1297438770)>>>0}setPointer(e,t=performance.now()){!Number.isFinite(e.column)||!Number.isFinite(e.row)||(this.#i={column:e.column,row:e.row,updatedAt:Op(t,performance.now())})}clearPointer(){this.#i=void 0}advance(e){let t=Tp(e.bounds);if(!t)return!1;this.#c(t);let n=Op(e.now,performance.now()),r=this.#a===void 0?mp:Math.min(hp,Math.max(0,n-this.#a));if(this.#a=n,r<=0)return!1;let i=r/mp,a=this.#i&&n-this.#i.updatedAt<=this.#t?this.#i:void 0,o=e.obstacles??[];for(let e of this.#o){a&&bp(e,a,t,i);for(let t of o)xp(e,t,i);let n=.994**i;e.vx*=n,e.vy*=n,Sp(e,.18),e.x+=e.vx*i,e.y+=e.vy*i,Cp(e,t)}return!0}rasterize(e,t=6){let n=Tp(e);if(!n)return this.#s=new Uint8Array,this.#s;this.#c(n);let r=Ep(t,2,16),i=n.width*n.height;this.#s.length!==i&&(this.#s=new Uint8Array(i));let a=0;for(let e=n.row;e<n.row+n.height;e+=1)for(let t=n.column;t<n.column+n.width;t+=1){let n=0;for(let r of this.#o){let i=t-r.x,a=(e-r.y)*vp;n+=r.strength/(i*i+a*a+.8)}let i=Math.min(1,Math.max(0,(n-gp)*_p));this.#s[a++]=i<=0?0:1+Math.min(r-2,Math.floor(i**1.35*(r-1)))}return this.#s}inspect(){return{...this.#r?{bounds:{...this.#r}}:{},...this.#i?{pointer:{...this.#i}}:{},balls:this.#o.map(e=>({...e}))}}#c(e){let t=this.#r;if(t?.column===e.column&&t.row===e.row&&t.width===e.width&&t.height===e.height)return;if(this.#r={...e},this.#s=new Uint8Array(e.width*e.height),!t||this.#o.length===0){this.#o=Array.from({length:this.#e},()=>this.#l(e));return}let n=e.width/t.width,r=e.height/t.height,i=Math.min(n,r*vp),a=wp(e);for(let o of this.#o)o.x=e.column+(o.x-t.column)*n,o.y=e.row+(o.y-t.row)*r,o.radius=Dp(o.radius*i,a.minimum,a.maximum),o.strength=o.radius*o.radius,o.vx*=n,o.vy*=r,Cp(o,e)}#l(e){let t=wp(e),n=t.minimum+this.#u()*(t.maximum-t.minimum),r=.035+this.#u()*.065,i=this.#u()*Math.PI*2;return{x:e.column+this.#u()*Math.max(0,e.width-1),y:e.row+this.#u()*Math.max(0,e.height-1),radius:n,strength:n*n,vx:Math.cos(i)*r,vy:Math.sin(i)*r/vp}}#u(){return this.#n=Math.imul(this.#n,1664525)+1013904223>>>0,this.#n/4294967296}};function bp(e,t,n,r){let i=t.column-e.x,a=(t.row-e.y)*vp,o=Math.hypot(i,a)+.001,s=Math.max(4,Math.min(n.width,n.height*vp)*.7),c=.012*Math.max(0,1-o/s)*r;e.vx+=i/o*c,e.vy+=a/o*c/vp}function xp(e,t,n){let r=Tp(t);if(!r)return;let i=Math.max(1,e.radius*.7),a=Math.max(1,i/vp),o=r.column-i,s=r.column+r.width-1+i,c=r.row-a,l=r.row+r.height-1+a;if(e.x<o||e.x>s||e.y<c||e.y>l)return;let u=[{distance:e.x-o,dx:-1,dy:0},{distance:s-e.x,dx:1,dy:0},{distance:(e.y-c)*vp,dx:0,dy:-1},{distance:(l-e.y)*vp,dx:0,dy:1}],d=u[0];for(let e=1;e<u.length;e+=1)u[e].distance<d.distance&&(d=u[e]);let f=Math.max(1,e.radius*.7),p=Math.max(.15,1-Math.max(0,d.distance)/f),m=.04*p*p*n;e.vx+=d.dx*m,e.vy+=d.dy*m/vp}function Sp(e,t){let n=Math.hypot(e.vx,e.vy*vp);if(n<=t)return;let r=t/n;e.vx*=r,e.vy*=r}function Cp(e,t){let n=t.column+t.width-1,r=t.row+t.height-1;(e.x<t.column||e.x>n)&&(e.vx*=-1,e.x=Dp(e.x,t.column,n)),(e.y<t.row||e.y>r)&&(e.vy*=-1,e.y=Dp(e.y,t.row,r))}function wp(e){let t=Math.max(2,Math.min(e.width,e.height*vp));return{minimum:Math.max(2,t*.08),maximum:Math.max(3,t*.2)}}function Tp(e){if(!Number.isFinite(e.column)||!Number.isFinite(e.row)||!Number.isFinite(e.width)||!Number.isFinite(e.height))return;let t=Math.floor(e.width),n=Math.floor(e.height);if(!(t<=0||n<=0))return{column:Math.floor(e.column),row:Math.floor(e.row),width:t,height:n}}function Ep(e,t,n){return Math.max(t,Math.min(n,Math.floor(Op(e,t))))}function Dp(e,t,n){return Math.max(t,Math.min(n,e))}function Op(e,t){return typeof e==`number`&&Number.isFinite(e)?e:t}function kp(e){return .2126*e[0]+.7152*e[1]+.0722*e[2]}function Ap(e){return Math.max(e[0],e[1],e[2])-Math.min(e[0],e[1],e[2])}function jp(e){let[t,n,r]=e,i=Math.max(t,n,r),a=i-Math.min(t,n,r);if(a===0)return;let o;return o=i===t?(n-r)/a%6:i===n?(r-t)/a+2:(t-n)/a+4,o*=60,o<0?o+360:o}function Mp(e,t){let n=Math.abs(e-t)%360;return n>180?360-n:n}function Np(e,t){let n=e[0]-t[0],r=e[1]-t[1],i=e[2]-t[2];return n*n+r*r+i*i}function Pp(e){let t=[e.accent,e.success,e.warning,e.danger,e.text,e.muted,e.surfaceStrong,e.border],n=t[0];for(let e of t)Ap(e)>Ap(n)&&(n=e);let r=jp(n);if(r===void 0){let n=[e.text,e.surfaceStrong],r=-1;for(let e=0;e<t.length;e+=1)for(let i=e+1;i<t.length;i+=1){let a=Np(t[e],t[i]);a>r&&(r=a,n=[t[e],t[i]])}return kp(n[0])>=kp(n[1])?n:[n[1],n[0]]}let i=n,a=-1;for(let e of t){let t=jp(e);if(t===void 0)continue;let n=Mp(r,t)/180*Ap(e);n>a&&(a=n,i=e)}return i===n&&(i=e.surfaceStrong),kp(n)>=kp(i)?[n,i]:[i,n]}function Fp(e){let[t,n]=Pp(e);return Array.from({length:6},(r,i)=>i===0?e.background:dp(n,t,(i-1)/4))}var Ip=class{#e=new yp;#t;#n;setPointer(e,t){this.#e.setPointer(e,t)}clearPointer(){this.#e.clearPointer()}advance(e){return this.#e.advance(e)}rasterizeCells(e,t){(this.#n!==t.id||!this.#t)&&(this.#t=Fp(t),this.#n=t.id);let n=this.#t,r=this.#e.rasterize(e,6),i=[];for(let t=0;t<e.height;t+=1){let a=[];for(let i=0;i<e.width;i+=1){let o=r[t*e.width+i]??0;a.push(o===0?void 0:{char:`█`,foreground:n[o]})}i.push(a)}return i}};function G(e,t,n){return dp(e,t,n)}var Lp=16.7,Rp=48,zp=1500,Bp=6,Vp=2,Hp=4,Up=18,Wp=.35,Gp=550,Kp=.7,qp=1.4,Jp=.12,Yp=.35,Xp=2,Zp=2,Qp=4,$p=[`.`,`,`,`'`,`"`,"`",`~`],em=Object.freeze([Object.freeze({dx:0,peak:2.8,delay:0}),Object.freeze({dx:-1,peak:2.1,delay:.06}),Object.freeze({dx:1,peak:2.1,delay:.06}),Object.freeze({dx:-2,peak:1.3,delay:.13}),Object.freeze({dx:2,peak:1.3,delay:.13}),Object.freeze({dx:-3,peak:.6,delay:.2}),Object.freeze({dx:3,peak:.6,delay:.2})]),tm=Object.freeze([Object.freeze({weight:.28,low:.09,high:.24}),Object.freeze({weight:.27,low:.3,high:.62}),Object.freeze({weight:.45,low:.95,high:1.9})]),nm=1.1,rm=70,im=Array.from(`ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇ0123456789:･=*+-`),am=class{#e;#t;#n;#r;#i;#a=[];#o=[];#s=[];#c;#l=[];#u=new Uint8Array;#d=[];constructor(e={}){this.#e=(e.seed??1296127058)>>>0,this.#t=sm(cm(e.density,1),.1,4)}setPointer(e,t=performance.now()){!Number.isFinite(e.column)||!Number.isFinite(e.row)||(this.#r={column:e.column,row:e.row,updatedAt:cm(t,performance.now())})}clearPointer(){this.#r=void 0}advance(e){let t=om(e.bounds);if(!t)return!1;this.#f(t);let n=cm(e.now,performance.now()),r=this.#i===void 0?Lp:Math.min(Rp,Math.max(0,n-this.#i));if(this.#i=n,r<=0)return!1;let i=r/Lp,a=this.#r&&n-this.#r.updatedAt<=zp?this.#r:void 0,o=a?a.column-t.column:void 0,s=e.activeObstacle?om(e.activeObstacle):void 0;if(s?this.#c={column:s.column-t.column,row:s.row-t.row,width:s.width,height:s.height}:this.#c=void 0,this.#l=[],e.obstacles)for(let n of e.obstacles){let e=om(n);e&&(s&&e.column===s.column&&e.row===s.row&&e.width===s.width&&e.height===s.height||this.#l.push({column:e.column-t.column,row:e.row-t.row,width:e.width,height:e.height}))}let c=!1,l=this.#c,u=this.#l;for(let e of this.#a){let r=o!==void 0&&Math.abs(e.column-o)<=Bp;e.boost=r?1:Math.max(0,e.boost-.12*i);let a=Math.floor(e.y),s=r?Vp:1;for(let t of u)if(e.column>=t.column&&e.column<t.column+t.width&&a>=t.row&&a<t.row+t.height){s*=Wp;break}let d=a;e.y+=e.speed*s*i;let f=Math.floor(e.y);f!==d&&(c=!0),l&&f!==d&&d<l.row&&f>=l.row&&e.column>=l.column&&e.column<l.column+l.width&&(this.#h(e.column,l.row,n),this.#g(e.column,l),c=!0),e.y-e.tail>t.height&&(this.#_(e,t),c=!0)}for(let e of this.#s)if(!e.falling)e.x+=e.direction*e.hSpeed*i,(e.direction<0?e.x<=e.edgeColumn:e.x>=e.edgeColumn)&&(e.x=e.edgeColumn,e.y=e.windowTop,e.falling=!0),c=!0;else{let t=Math.floor(e.y);e.y+=e.vSpeed*i,Math.floor(e.y)!==t&&(c=!0)}let d=this.#s.length;this.#s=this.#s.filter(e=>e.y-e.tail<e.windowBottom),this.#s.length!==d&&(c=!0),this.#s.length>0&&(c=!0);let f=this.#o.length;this.#o=this.#o.filter(e=>n-e.spawnedAt<Gp),this.#o.length!==f&&(c=!0),this.#o.length>0&&(c=!0);let p=Math.max(1,Math.floor(t.width*t.height/rm));for(let e=0;e<p;e+=1){let e=Math.floor(this.#b()*this.#u.length);this.#u[e]=Math.floor(this.#b()*im.length),c=!0}return c}rasterizeCells(e,t){let n=om(e);if(!n)return this.#d=[],this.#d;this.#f(n);let{width:r,height:i}=n;this.#p(r,i);let a=G(t.text,t.accent,.35),o=this.#c;for(let e of this.#a){let{column:n}=e;if(n<0||n>=r)continue;let s=o!==void 0&&n>=o.column&&n<o.column+o.width,c=Math.floor(e.y);for(let l=0;l<=e.tail;l+=1){let u=c-l;if(u<0||u>=i||s&&u>=o.row)continue;let d=im[this.#u[u*r+n]??0]??im[0];if(l===0){let r=e.boost>0?G(a,t.text,.45*e.boost):a;this.#d[u][n]={char:d,foreground:r,bold:!0};continue}let f=(.18+.8*(l/e.tail))*(1-.3*e.boost);this.#d[u][n]={char:d,foreground:G(t.accent,t.background,f)}}}let s=this.#i??0;for(let e of this.#o){let n=(s-e.spawnedAt)/Gp;if(!(n>=1))for(let o of em){let s=(n-o.delay)/(1-o.delay);if(s<0||s>1)continue;let c=o.peak*Math.sin(Math.PI*s),l=e.row-1-Math.round(c);if(l<0||l>=i)continue;let u=e.column+o.dx;if(u<0||u>=r)continue;let d=$p[Math.min($p.length-1,Math.floor(c/o.peak*($p.length-.01)))]??$p[0],f=Math.sin(Math.PI*s)*(1-Math.abs(o.dx)*.12);if(f<=.05)continue;let p=G(t.background,a,f);this.#d[l][u]={char:d,foreground:p,bold:f>.6}}}let c=G(t.accent,t.background,.25);for(let e of this.#s)if(e.falling){let n=e.edgeColumn;if(n<0||n>=r)continue;let a=Math.floor(e.y);for(let o=0;o<=e.tail;o+=1){let s=a-o;if(s<0||s>=i)continue;let l=o/(e.tail+1),u=G(c,t.background,l),d=im[this.#u[s*r+n]??0]??im[0];this.#d[s][n]={char:d,foreground:u,bold:o===0}}}else{let n=Math.floor(e.x),a=e.windowTop-1;if(a<0||a>=i)continue;for(let i=0;i<=Xp;i+=1){let o=n-e.direction*i;if(o<0||o>=r)continue;let s=i/3,l=G(c,t.background,s),u=im[this.#u[a*r+o]??0]??im[0];this.#d[a][o]={char:u,foreground:l,bold:i===0}}}return this.#d}inspect(){return{...this.#n?{bounds:{...this.#n}}:{},drops:this.#a.map(e=>({...e}))}}#f(e){let t=this.#n;if(t?.width===e.width&&t.height===e.height){this.#n={...e};return}this.#n={...e};let n=e.width*e.height;this.#u=new Uint8Array(n);for(let e=0;e<n;e+=1)this.#u[e]=Math.floor(this.#b()*im.length);let r=Math.max(1,Math.round(e.width*nm*this.#t));this.#a=Array.from({length:r},()=>this.#m(e))}#p(e,t){if(this.#d.length===t&&(this.#d[0]?.length??-1)===e){for(let e of this.#d)e.fill(void 0);return}this.#d=Array.from({length:t},()=>Array(e).fill(void 0))}#m(e){let t=this.#v();return{column:Math.floor(this.#b()*e.width),y:-this.#b()*e.height,speed:t,tail:this.#y(t),boost:0}}#h(e,t,n){this.#o.push({column:e,row:t,spawnedAt:n})}#g(e,t){let n=e-t.column,r=t.column+t.width-1-e,i=n<r||n===r&&this.#b()<.5,a=i?-1:1,o=i?t.column-1:t.column+t.width;this.#s.push({x:e,y:t.row,direction:a,hSpeed:Kp+this.#b()*(qp-Kp),vSpeed:Jp+this.#b()*(Yp-Jp),falling:!1,edgeColumn:o,windowTop:t.row,windowBottom:t.row+t.height,tail:Math.round(Zp+this.#b()*(Qp-Zp))})}#_(e,t){e.column=Math.floor(this.#b()*t.width),e.y=-(1+this.#b()*t.height*.6),e.speed=this.#v(),e.tail=this.#y(e.speed),e.boost=0}#v(){let e=this.#b();for(let t of tm){if(e<t.weight)return t.low+this.#b()*(t.high-t.low);e-=t.weight}let t=tm[tm.length-1];return t.low+this.#b()*(t.high-t.low)}#y(e){let t=Up-Hp,n=Hp+t*Math.min(1,e/tm[tm.length-1].high)*.6;return Math.min(Up,Math.round(n+this.#b()*t*.4))}#b(){return this.#e=Math.imul(this.#e,1664525)+1013904223>>>0,this.#e/4294967296}};function om(e){if(!Number.isFinite(e.column)||!Number.isFinite(e.row)||!Number.isFinite(e.width)||!Number.isFinite(e.height))return;let t=Math.floor(e.width),n=Math.floor(e.height);if(!(t<=0||n<=0))return{column:Math.floor(e.column),row:Math.floor(e.row),width:t,height:n}}function sm(e,t,n){return Math.max(t,Math.min(n,e))}function cm(e,t){return typeof e==`number`&&Number.isFinite(e)?e:t}var lm=16.7,um=48,dm=1500,fm=6,pm=2,mm=3,hm=14,gm=.05,_m=.35,vm=Object.freeze([Object.freeze({weight:.28,low:.09,high:.24}),Object.freeze({weight:.27,low:.3,high:.62}),Object.freeze({weight:.45,low:.95,high:1.9})]),ym=vm[vm.length-1].high,bm=Object.freeze([Object.freeze({head:`╷`,body:`┊`,tip:`.`}),Object.freeze({head:`│`,body:`┆`,tip:`'`}),Object.freeze({head:`┃`,body:`│`,tip:`╵`})]),xm=.55,Sm=[80,140,220],Cm=550,wm=[`.`,`,`,`'`,`"`,"`",`~`],Tm=Object.freeze([Object.freeze({dx:0,peak:2.8,delay:0}),Object.freeze({dx:-1,peak:2.1,delay:.06}),Object.freeze({dx:1,peak:2.1,delay:.06}),Object.freeze({dx:-2,peak:1.3,delay:.13}),Object.freeze({dx:2,peak:1.3,delay:.13}),Object.freeze({dx:-3,peak:.6,delay:.2}),Object.freeze({dx:3,peak:.6,delay:.2})]),Em=.25,Dm=.08,Om=.55,km=.26,Am=.35,jm=.35,Mm=8,Nm=.95,Pm=3,Fm=.14,Im=.5,Lm=.9,Rm=1,zm=.02,Bm=1,Vm=.01,Hm=.004,Um=.03,Wm=[`▁`,`▂`,`▃`,`▄`,`▅`,`▆`,`▇`,`█`],Gm=`▓`,Km=`█`,qm=10,Jm=9,Ym=[96,170,235],Xm=[20,54,108],Zm=.7,Qm=.018,$m=.3,eh=.9,th=3,nh=3,rh=.1,ih=1,ah=[`◐`,`◓`,`◑`,`◒`],oh=`▣`,sh=class{#e;#t;#n;#r;#i;#a=0;#o=[];#s=[];#c=[];#l=[];#u=0;#d=0;#f=new Float32Array;#p=new Float32Array;#m=new Float32Array;#h=new Uint8Array;#g=new Float32Array;#_=new Float32Array;#v=0;#y=!1;#b=0;#x=[];#S=[];#C=[];constructor(e={}){this.#e=(e.seed??1380010318)>>>0,this.#t=mh(hh(e.density,1),.1,4)}get drainOpen(){return this.#y}get waterVolume(){return this.#v}get drainedVolume(){return this.#b}waterAt(e,t){return e<0||e>=this.#u||t<0||t>=this.#d?0:this.#f[t*this.#u+e]??0}setPointer(e,t=performance.now()){!Number.isFinite(e.column)||!Number.isFinite(e.row)||(this.#r={column:e.column,row:e.row,updatedAt:hh(t,performance.now())})}clearPointer(){this.#r=void 0}pick(e,t,n=performance.now()){return this.#T(e,t)?(this.#y=!this.#y,!0):!1}picksOverWindows(e,t){return this.#T(e,t)}advance(e){let t=ph(e.bounds);if(!t)return!1;this.#V(t);let n=hh(e.now,performance.now()),r=this.#i===void 0?lm:Math.min(um,Math.max(0,n-this.#i));if(this.#i=n,r<=0)return!1;let i=r/lm;this.#a+=1;let a=this.#r&&n-this.#r.updatedAt<=dm?this.#r:void 0,o=a?a.column-t.column:void 0,s=e.activeObstacle?this.#E(e.activeObstacle,t):void 0;this.#c=[];for(let n of e.obstacles??[]){let e=this.#E(n,t);!e||s&&fh(e,s)||this.#c.push(e)}let c=[];for(let n of e.solidObstacles??e.obstacles??[]){let e=this.#E(n,t);e&&c.push(e)}s&&!c.some(e=>fh(e,s))&&c.push(s),this.#j(c);let l=!1;for(let e of this.#o)this.#D(e,t,o,i,n)&&(l=!0);for(let e=0;e<Mm;e+=1)this.#M(),this.#N(),this.#P(),this.#I();let u=this.#v;this.#B(),this.#L(),(this.#v>0||u>0)&&(l=!0);let d=this.#l.length;return this.#l=this.#l.filter(e=>n-e.spawnedAt<Cm),(this.#l.length!==d||this.#l.length>0)&&(l=!0),this.#y&&(l=!0),l}rasterizeCells(e,t){let n=ph(e);if(!n)return this.#s=[],this.#s;this.#V(n);let{width:r,height:i}=n;this.#H(r,i);let a=G(G(t.text,Sm,.45),t.accent,.2),o=G(t.accent,Sm,.5);for(let e of this.#o){let{column:n}=e;if(n<0||n>=r)continue;let s=bm[e.streak]??bm[0],c=Math.floor(e.y),l=Math.max(1,Math.round(e.tail*xm));for(let r=0;r<=e.tail;r+=1){let u=c-r;if(u<0||u>=i)continue;if(r===0){let r=e.boost>0?G(a,t.text,.45*e.boost):a;this.#s[u][n]={char:s.head,foreground:r,bold:!0};continue}let d=(.18+.8*(r/e.tail))*(1-.3*e.boost);this.#s[u][n]={char:r<=l?s.body:s.tip,foreground:G(o,t.background,d)}}}return this.#s}rasterizeOverlayCells(e,t){this.#S.length=0;let n=ph(e);if(!n)return this.#S;let{width:r,height:i}=n;if(r!==this.#u||i!==this.#d)return this.#S;let a=G(G(t.text,Sm,.45),t.accent,.2);this.#U(t);let o=this.#i??0;for(let e of this.#l){let n=(o-e.spawnedAt)/Cm;if(!(n>=1))for(let o of Tm){let s=(n-o.delay)/(1-o.delay);if(s<0||s>1)continue;let c=o.peak*e.scale,l=c*Math.sin(Math.PI*s),u=e.row-1-Math.round(l);if(u<0||u>=i)continue;let d=e.column+o.dx;if(d<0||d>=r)continue;let f=wm[Math.min(wm.length-1,Math.floor(l/Math.max(.1,c)*(wm.length-.01)))]??wm[0],p=Math.sin(Math.PI*s)*(1-Math.abs(o.dx)*.12);p<=.05||this.#h[u*r+d]||this.#W(d,u,f,G(t.background,a,p),p>.6)}}if(this.#v>0)for(let e=0;e<r;e+=1){let t=0;for(let n=0;n<i;n+=1){let i=n*r+e;if(this.#h[i]){t=0;continue}let a=this.#f[i];if(a<Um){t=0;continue}let o=this.#C[Math.min(qm-1,Math.round(t/Jm*(qm-1)))];if(t>0){this.#W(e,n,t===1?Gm:Km,o,!1),t+=1;continue}let s=a+this.#g[e];s<Um||(s>1&&n>0&&!this.#h[i-r]?(this.#W(e,n,Gm,o,!1),this.#W(e,n-1,lh(s-1),this.#C[0],!1)):this.#W(e,n,lh(s),o,!1),t+=1)}}let s=this.#w();if(s!==void 0){let e=i-1,n=ah[this.#a%ah.length],a=G(t.border,t.background,.15),o=this.#y?t.warning:G(t.muted,t.text,.2);for(let t=-1;t<=ih;t+=1){let i=s+t;if(i<0||i>=r)continue;let c=t===0?this.#y?n:oh:t<0?`[`:`]`;this.#W(i,e,c,t===0?o:a,t===0)}}return this.#S}#w(){if(!(this.#u<3||this.#d<1))return Math.floor(this.#u/2)}#T(e,t){let n=this.#n,r=this.#w();if(!n||r===void 0)return!1;let i=Math.floor(e-n.column);return Math.floor(t-n.row)===this.#d-1&&Math.abs(i-r)<=ih}#E(e,t){let n=ph(e);if(n)return{column:n.column-t.column,row:n.row-t.row,width:n.width,height:n.height}}#D(e,t,n,r,i){let a=n!==void 0&&Math.abs(e.column-n)<=fm;e.boost=a?1:Math.max(0,e.boost-.12*r);let o=Math.floor(e.y),s=a?pm:1;for(let t of this.#c)if(e.column>=t.column&&e.column<t.column+t.width&&o>=t.row&&o<t.row+t.height){s*=_m;break}e.y+=e.speed*s*r;let c=Math.floor(e.y),l=c!==o,u=km*(.4+.6*Math.min(1,e.speed/ym));for(let n=Math.max(0,o+1);n<=c;n+=1){if(n>=this.#d)return this.#O(e,this.#d-1,u,i),this.#K(e,t),!0;let r=n*this.#u+e.column;if(this.#h[r]){n>0&&!this.#h[r-this.#u]&&(this.#A(e.column,n-1,u*Am),this.#k(e,n-1,i,Am),l=!0);continue}if(this.#f[r]>=jm)return this.#O(e,n,u,i),this.#K(e,t),!0}return e.y-e.tail>t.height&&(this.#K(e,t),l=!0),l}#O(e,t,n,r){this.#A(e.column,t,n),this.#k(e,t,r,1)}#k(e,t,n,r){let i=Math.min(1,e.speed/ym);this.#R(e.column,$m*(.35+.65*i)*r);let a=(Dm+(Om-Dm)*i)*r;if(this.#X()>=a)return;let o=Em+(1-Em)*i;this.#l.push({column:e.column,row:t,spawnedAt:n,scale:o*r})}#A(e,t,n){if(e<0||e>=this.#u||t<0||t>=this.#d)return;let r=t*this.#u+e;this.#h[r]||(this.#f[r]=this.#f[r]+n,this.#v+=n)}#j(e){let t=this.#u,n=this.#d,r=this.#h;r.fill(0);for(let i of e){let e=Math.max(0,i.row),a=Math.min(n,i.row+i.height),o=Math.max(0,i.column),s=Math.min(t,i.column+i.width);for(let n=e;n<a;n+=1)r.fill(1,n*t+o,n*t+s)}for(let e=n-1;e>=0;--e)for(let n=0;n<t;n+=1){let i=e*t+n;if(!r[i])continue;let a=this.#f[i];if(a<=0)continue;this.#f[i]=0;let o=e-1;for(;o>=0&&r[o*t+n];)--o;o>=0?this.#f[o*t+n]=this.#f[o*t+n]+a:this.#v-=a}}#M(){let e=this.#u,t=this.#d,n=this.#f,r=this.#p,i=this.#h;r.set(n);for(let a=t-1;a>=0;--a)for(let o=0;o<e;o+=1){let s=a*e+o;if(i[s])continue;let c=n[s];if(!(c<=Hm)){if(a+1<t){let t=s+e;if(!i[t]){let e=uh(ch(c+n[t])-n[t],c);e>0&&(r[s]=r[s]-e,r[t]=r[t]+e,c-=e)}}if(!(c<=Hm)){if(o>0&&!i[s-1]){let e=dh(c-n[s-1],c);e>0&&(r[s]=r[s]-e,r[s-1]=r[s-1]+e,c-=e)}if(!(c<=Hm)){if(o+1<e&&!i[s+1]){let e=dh(c-n[s+1],c);e>0&&(r[s]=r[s]-e,r[s+1]=r[s+1]+e,c-=e)}if(!(c<=Hm)&&a>0){let t=s-e;if(!i[t]){let e=uh(c-ch(c+n[t]),c);e>0&&(r[s]=r[s]-e,r[t]=r[t]+e)}}}}}}this.#f=r,this.#p=n}#N(){let e=this.#u,t=this.#d,n=this.#f,r=this.#p,i=this.#m,a=this.#h;for(let r=0;r<e;r+=1){let o=0;for(let s=0;s<t;s+=1){let t=s*e+r,c=n[t];if(a[t]||c<=Hm){o=0,i[t]=0;continue}i[t]=o,o+=c}}r.set(n);for(let o=0;o<t;o+=1)for(let t=0;t+1<e;t+=1){let s=o*e+t,c=s+1;if(a[s]||a[c])continue;let l=n[s],u=n[c];if(l<Lm||u<Lm)continue;let d=i[s]-i[c];if(d===0)continue;let f=mh(d*Fm,-.5,Im),p=f>0?Math.min(f,l):-Math.min(-f,u);r[s]=r[s]-p,r[c]=r[c]+p}this.#f=r,this.#p=n}#P(){if(!this.#y)return;let e=this.#w();if(e===void 0)return;let t=this.#u,n=this.#d,r=this.#f,i=this.#h;for(let a=0;a<n;a+=1){let n=a*t;for(let t=e-1;t>=0;--t)this.#F(n+t,n+t+1,r,i);for(let a=e+1;a<t;a+=1)this.#F(n+a,n+a-1,r,i)}}#F(e,t,n,r){if(r[e]||r[t])return;let i=n[e];if(i<=Hm)return;let a=Rm-n[t];if(a<=0)return;let o=Math.min(i*rh,a);n[e]=i-o,n[t]=n[t]+o}#I(){if(!this.#y)return;let e=this.#w();if(e===void 0)return;let t=this.#u,n=this.#d;for(let r=-3;r<=th;r+=1){let i=e+r;if(i<0||i>=t)continue;let a=n-1;for(;a>=0&&this.#h[a*t+i];)--a;if(a<0)continue;let o=a*t+i,s=this.#f[o];if(s<=0)continue;let c=nh*(1-Math.abs(r)/4),l=Math.min(s,c);this.#f[o]=s-l,this.#b+=l}}#L(){let e=this.#u,t=this.#g,n=this.#_;for(let r=0;r<e;r+=1){let i=t[r],a=t[r>0?r-1:0],o=t[r+1<e?r+1:e-1];n[r]=mh((2*i-n[r]+Zm*(a-2*i+o))*(1-Qm),-.9,eh)}this.#g=n,this.#_=t}#R(e,t){this.#z(e,t*.6),this.#z(e-1,t*.2),this.#z(e+1,t*.2)}#z(e,t){e<0||e>=this.#u||(this.#g[e]=mh(this.#g[e]-t,-.9,eh))}#B(){let e=this.#f,t=0;for(let n=0;n<e.length;n+=1){let r=e[n];if(r<=Hm){r!==0&&(e[n]=0);continue}t+=r}this.#v=t}#V(e){let t=this.#n;if(t?.width===e.width&&t.height===e.height){this.#n={...e};return}this.#n={...e},this.#u=e.width,this.#d=e.height;let n=e.width*e.height;this.#f=new Float32Array(n),this.#p=new Float32Array(n),this.#m=new Float32Array(n),this.#h=new Uint8Array(n),this.#g=new Float32Array(e.width),this.#_=new Float32Array(e.width),this.#v=0,this.#l=[];let r=Math.max(1,Math.round(n*gm*this.#t));this.#o=Array.from({length:r},()=>this.#G(e))}#H(e,t){if(this.#s.length===t&&(this.#s[0]?.length??-1)===e){for(let e of this.#s)e.fill(void 0);return}this.#s=Array.from({length:t},()=>Array(e).fill(void 0))}#U(e){let t=G(Ym,e.accent,.25),n=G(Xm,e.background,.35);this.#C.length=0;for(let e=0;e<qm;e+=1)this.#C.push(G(t,n,e/(qm-1)))}#W(e,t,n,r,i){let a=this.#S.length,o=this.#x[a];if(!o){o={column:e,row:t,cell:{char:n,foreground:r,bold:i}},this.#x[a]=o,this.#S.push(o);return}o.column=e,o.row=t,o.cell.char=n,o.cell.foreground=r,o.cell.bold=i,this.#S.push(o)}#G(e){let t=this.#q(),n=this.#J(t);return{column:Math.floor(this.#X()*e.width),y:-this.#X()*e.height,speed:n,streak:t,tail:this.#Y(n),boost:0}}#K(e,t){e.column=Math.floor(this.#X()*t.width),e.y=-(1+this.#X()*t.height*.6),e.streak=this.#q(),e.speed=this.#J(e.streak),e.tail=this.#Y(e.speed),e.boost=0}#q(){let e=this.#X();for(let t=0;t<vm.length;t+=1){if(e<vm[t].weight)return t;e-=vm[t].weight}return vm.length-1}#J(e){let t=vm[e]??vm[vm.length-1];return t.low+this.#X()*(t.high-t.low)}#Y(e){let t=hm-mm,n=mm+t*Math.min(1,e/ym)*.6;return Math.min(hm,Math.round(n+this.#X()*t*.4))}#X(){return this.#e=Math.imul(this.#e,1664525)+1013904223>>>0,this.#e/4294967296}};function ch(e){return e<=Rm?Rm:e<2.02?(Rm*Rm+e*zm)/1.02:(e+zm)/2}function lh(e){return Wm[mh(Math.round(e*Wm.length)-1,0,Wm.length-1)]}function uh(e,t){return mh(e>Vm?e*Nm:e,0,Math.min(Bm,t))}function dh(e,t){return mh(e/Pm,0,Math.min(Bm,t))}function fh(e,t){return e.column===t.column&&e.row===t.row&&e.width===t.width&&e.height===t.height}function ph(e){if(!Number.isFinite(e.column)||!Number.isFinite(e.row)||!Number.isFinite(e.width)||!Number.isFinite(e.height))return;let t=Math.floor(e.width),n=Math.floor(e.height);if(!(t<=0||n<=0))return{column:Math.floor(e.column),row:Math.floor(e.row),width:t,height:n}}function mh(e,t,n){return Math.max(t,Math.min(n,e))}function hh(e,t){return typeof e==`number`&&Number.isFinite(e)?e:t}var gh=[0,1,0,-1],_h=[-1,0,1,0],vh=[`│`,`┌`,`│`,`┐`,`┘`,`─`,`┐`,`─`,`│`,`└`,`│`,`┘`,`└`,`─`,`┌`,`─`];function yh(e,t){return t.y<e.y?0:t.x>e.x?1:t.y>e.y?2:3}function bh(e,t){return e.length<2?[]:e.map((n,r)=>{let i=r===0?yh(n,e[1]):yh(e[r-1],n),a=r===e.length-1?i:yh(n,e[r+1]);return{...n,glyph:r===e.length-1&&t?t:vh[i*4+a]}})}var xh=class{#e=new Uint32Array;#t=new Int32Array;#n=new Int32Array;#r=0;route(e,t,n,r,i,a=0){if(!Number.isSafeInteger(e)||!Number.isSafeInteger(t)||e<=0||t<=0||e*t>4e6)throw RangeError(`Orthogonal routing requires a positive grid of at most 4,000,000 cells.`);let o=n=>Number.isInteger(n.x)&&Number.isInteger(n.y)&&n.x>=0&&n.x<e&&n.y>=0&&n.y<t;if(!o(n)||!o(r))return;let s=e*t;this.#e.length!==s&&(this.#e=new Uint32Array(s),this.#t=new Int32Array(s),this.#n=new Int32Array(s),this.#r=0),this.#r===4294967295&&(this.#e.fill(0),this.#r=0);let c=n.y*e+n.x,l=r.y*e+r.x;if(!i(c)||!i(l))return;let u=++this.#r,d=(Math.trunc(a)%4+4)%4,f=0,p=0;for(this.#n[p++]=c,this.#e[c]=u,this.#t[c]=-1;f<p;){let n=this.#n[f++];if(n===l){let t=[];for(let n=l;n!==-1;n=this.#t[n])t.push({x:n%e,y:Math.floor(n/e)});return t.reverse()}let r=n%e,a=Math.floor(n/e);for(let o=0;o<4;o++){let s=(o+d)%4,c=r+gh[s],l=a+_h[s];if(c<0||c>=e||l<0||l>=t)continue;let f=l*e+c;this.#e[f]===u||!i(f)||(this.#e[f]=u,this.#t[f]=n,this.#n[p++]=f)}}}};function Sh(e,t,n,r,i=`▓`){return t===0?e===0?`╔`:e===n-1?`╗`:`═`:t===r-1?e===0?`╚`:e===n-1?`╝`:`═`:e===0||e===n-1?`║`:i}var Ch=16.7,wh=48,Th=1800,Eh=5,Dh=.5,Oh=6e3,kh=.3,Ah=18e3,jh=40,Mh=150,Nh=56,Ph=8,Fh=5,K=1,Ih=2,Lh=12,Rh=3,zh=2,Bh=14,Vh=.35,Hh=1,Uh=400,Wh=3,Gh=128,Kh=2,qh=.6,Jh=`o`,Yh=`●`,Xh=`▓`,Zh=8,Qh=3,$h=1,eg=`█`,tg=`░`,ng=[`AND`,`OR`,`NAND`,`NOR`,`XOR`,`XNOR`],rg=620,ig=2,ag=3,og=Fh,sg=.22,cg=[`power`,`ground`],lg=`VCC`,ug=`GND`,dg=`CLK`,fg=3,pg=2,mg=6,hg=2400,gg=3,_g=[0,1,0,-1],vg=[-1,0,1,0],yg=class{#e;#t;#n;#r;#i;#a;#o=[];#s=[];#c=new Uint8Array;#l=new Uint8Array;#u=[];#d;#f;#p=[];#m=0;#h=[];#g=0;#_=0;#v=0;#y;#b;#x=[];#S=0;#C=[];#w=0;#T=-1;#E=!1;#D=0;#O=new Set;#k;#A=new xh;constructor(e={}){this.#e=(e.seed??1346585137)>>>0,this.#t=Ng(Pg(e.density,1),.1,4)}setPointer(e,t=performance.now()){!Number.isFinite(e.column)||!Number.isFinite(e.row)||(this.#r={column:e.column,row:e.row,updatedAt:Pg(t,performance.now())})}clearPointer(){this.#r=void 0,this.#i=void 0}advance(e){let t=jg(e.bounds);if(!t)return!1;this.#F(t);let n=Pg(e.now,performance.now()),r=this.#a===void 0?Ch:Math.min(wh,Math.max(0,n-this.#a));if(this.#a=n,r<=0)return!1;let i=r/Ch;this.#g+=r,this.#_+=r,this.#v+=r;let a=this.#r&&n-this.#r.updatedAt<=Th?this.#r:void 0;this.#i=a?{column:a.column-t.column,row:a.row-t.row}:void 0;let o=!1,s=this.#ye(e,t);for(s&&(o=!0),this.#xe(t)&&(o=!0),this.#o.length!==this.#T&&(this.#Le(),this.#E=!0);this.#_>=Ah;)this.#_-=Ah,this.#ke(t)&&(o=!0);for(let e=this.#re(t);this.#g>=e&&(this.#g-=e,this.#Z(t));e=this.#re(t))o=!0;for(this.#E&&(this.#D+=r,(!s||this.#D>=Uh)&&(this.#H(t),this.#D=0,o=!0));this.#v>=rg;)this.#v-=rg,this.#He()&&(o=!0);let c=this.#f;for(let e of this.#s){let t=e.cells.length;if(t===0)continue;let n=e.kind===`tap`&&c!==void 0&&e.obstacleIndex===c,r=this.#j(e)?1:sg;for(let a of e.pulses){let s=e.cells[a.index%t],c=this.#i!==void 0&&Math.max(Math.abs(s.x-this.#i.column),Math.abs(s.y-this.#i.row))<=Eh;a.accumulator+=Dh*(c?2:1)*(n?Kh:1)*r*i;let l=Math.floor(a.accumulator);l>0&&(a.accumulator-=l,a.index=(a.index+l)%t,o=!0)}}return o}#j(e){if(!e.energizedBy)return this.#M(e.driver);let t=this.#M(e.energizedBy);return e.sinking?!t:t}#M(e){switch(e.kind){case`power`:return!0;case`ground`:return!1;case`osc`:return this.#x.find(t=>t.id===e.id)?.state??!1;case`chip`:return this.#o.find(t=>t.id===e.id)?.state??!1}}rasterizeCells(e,t){let n=jg(e);if(!n)return this.#h=[],this.#h;this.#F(n);let{width:r,height:i}=n;this.#Ne(r,i);let a=G(t.border,t.background,.35),o=G(t.border,t.text,.15),s=G(t.border,t.text,.25),c=G(t.surfaceStrong,t.text,.2),l=G(t.muted,t.text,.1),u=G(t.accent,t.text,.2),d=G(t.accent,a,.5),f=G(a,t.accent,.45),p=G(a,t.accent,qh),m=G(o,t.accent,.5),h=G(u,t.text,.35),g=G(d,t.accent,.5),_=G(a,t.accent,.55),v=G(a,t.background,.35),y=G(c,t.accent,.5),b=G(s,t.accent,.55),x=G(l,t.text,.6),S=G(t.warning,t.text,.25),C=G(t.warning,t.text,.45),w=this.#i,T=this.#f;for(let e of this.#s){let t=e.kind===`tap`&&T!==void 0&&e.obstacleIndex===T,n=this.#j(e),a=this.#W(e),s=a?S:t?p:n?_:v;for(let n of e.cells){if(n.x<0||n.x>=r||n.y<0||n.y>=i)continue;let e=w!==void 0&&Math.max(Math.abs(n.x-w.column),Math.abs(n.y-w.row))<=Eh,c=a?S:e?f:n.glyph===Jh?t?m:o:s,l=this.#O.has(n.y*r+n.x)&&n.glyph!==Jh;this.#h[n.y][n.x]={char:l?Yh:n.glyph,foreground:c,...a||l?{bold:!0}:{}}}let c=e.cells.length;if(c!==0)for(let n of e.pulses){let a=e.cells[n.index%c],o=e.cells[(n.index-1+c)%c];o.y>=0&&o.y<i&&o.x>=0&&o.x<r&&(this.#h[o.y][o.x]=t?{char:o.glyph,foreground:g,bold:!0}:{char:o.glyph,foreground:d}),a.y>=0&&a.y<i&&a.x>=0&&a.x<r&&(this.#h[a.y][a.x]={char:a.glyph,foreground:t?h:u,bold:!0})}}for(let e of this.#o){let t=e.height-1,n=e.width-1,a=e.id===this.#k,o=e.state?y:c,u=a?C:e.state?b:s;for(let a=0;a<e.height;a+=1){let s=e.y+a;if(!(s<0||s>=i))for(let i=0;i<e.width;i+=1){let c=e.x+i;if(c<0||c>=r)continue;let l=a===0||a===t||i===0||i===n,d=Sh(i,a,e.width,e.height,Xh);this.#h[s][c]={char:d,foreground:l?u:o}}}let d=Math.max(0,e.width-2),f=e.label.slice(0,d),p=e.y+Math.floor(e.height/2),m=e.x+1+Math.max(0,Math.floor((d-f.length)/2));for(let t=0;t<f.length;t+=1){let n=m+t;p<0||p>=i||n<0||n>=r||(this.#h[p][n]={char:f[t],foreground:e.state?x:l,bold:!0})}}this.#N(this.#y,t,G(t.warning,t.text,.3),!0,r,i),this.#N(this.#b,t,G(t.muted,t.background,.2),!1,r,i);let E=G(t.accent,t.text,.4),ee=G(t.accent,t.background,.35);for(let e of this.#x){if(e.y<0||e.y>=i)continue;let t=e.state?E:ee,n=e.state?`CL^`:`CL_`;for(let i=0;i<n.length;i+=1){let a=e.x+i;a<0||a>=r||this.#l[e.y*r+a]===0&&(this.#h[e.y][a]={char:n[i],foreground:t,bold:e.state})}}let te=G(t.success,t.text,.35),ne=G(t.muted,t.background,.55);for(let e of this.#C)e.x<0||e.x>=r||e.y<0||e.y>=i||this.#l[e.y*r+e.x]===0&&(this.#h[e.y][e.x]={char:e.state?eg:tg,foreground:e.state?te:ne,bold:e.state});return this.#h}#N(e,t,n,r,i,a){if(!(!e||e.y<0||e.y>=a))for(let t=0;t<e.label.length;t+=1){let a=e.x+t;a<0||a>=i||this.#l[e.y*i+a]===0&&(this.#h[e.y][a]={char:e.label[t],foreground:n,bold:r})}}inspect(){let e=this.#Re();return{...this.#n?{bounds:{...this.#n}}:{},chips:this.#o.map(e=>({id:e.id,x:e.x,y:e.y,width:e.width,height:e.height,label:e.label,gate:e.gate,inputCount:e.inputs.length,state:e.state,stage:e.stage})),traces:this.#s.map(e=>({chipIndex:e.chipIndex,kind:e.kind,...e.kind===`tap`&&e.obstacleIndex!==void 0?{obstacleIndex:e.obstacleIndex}:{},driver:e.driver.kind,...e.consumerChipId===void 0?{}:{consumerChipId:e.consumerChipId},...e.consumerLedId===void 0?{}:{consumerLedId:e.consumerLedId},cells:e.cells.map(e=>({...e})),pulses:e.pulses.map(e=>({index:e.index}))})),obstacles:this.#u.map(e=>({...e})),...this.#f===void 0?{}:{activeObstacleIndex:this.#f},pendingJobs:this.#p.length,...this.#y?{power:{...this.#y}}:{},...this.#b?{ground:{...this.#b}}:{},oscillators:this.#x.map(e=>({x:e.x,y:e.y,label:e.label,periodTicks:e.periodTicks,state:e.state})),leds:this.#C.map(e=>({id:e.id,x:e.x,y:e.y,state:e.state,driven:e.driver!==void 0,connected:e.connected})),danglingChips:this.#P(),junctions:this.#O.size,...this.#k===void 0?{}:{selectedChipId:this.#k},liveChips:this.#o.reduce((e,t)=>e+ +!!t.state,0),groundedChips:this.#ze(),clockedChips:this.#o.reduce((t,n)=>t+ +!!e.get(n.id),0),floatingChips:this.#o.reduce((e,t)=>e+ +(t.inputs.length===0),0)}}#P(){let e=new Set;for(let t of this.#o)for(let n of t.inputs)n.kind===`chip`&&e.add(n.id);for(let t of this.#C)t.driver?.kind===`chip`&&e.add(t.driver.id);return this.#o.reduce((t,n)=>t+ +!e.has(n.id),0)}#F(e){let t=this.#n;if(t?.width===e.width&&t.height===e.height){this.#n={...e};return}this.#n={...e},this.#I(e)}#I(e){let{width:t,height:n}=e;this.#c=new Uint8Array(t*n),this.#l=new Uint8Array(t*n),this.#u=[],this.#d=void 0,this.#f=void 0,this.#p=[],this.#o=[],this.#s=[],this.#O.clear(),this.#k=void 0,this.#y=void 0,this.#b=void 0,this.#x=[],this.#C=[],this.#T=-1,this.#v=0,this.#g=0,this.#_=0,this.#E=!1,!(Math.min(t,n)<5)&&(this.#le(e),this.#ue(e),this.#X(e),this.#Ve(),this.#de(),this.#T=this.#o.length,this.#H(e))}#L(e,t){let n=e.x+e.width,r=e.y+(e.height>>1);for(let i=0;i<e.height;i+=1){let a=i%2==0?r+(i>>1):r-(i+1>>1);if(!(a<e.y||a>=e.y+e.height)&&this.#B(n,a,t))return{x:n,y:a}}return this.#V(e,t)}#R(e,t,n){let r=e.x-1,i=new Set,a=[];for(let o=0;o<t;o+=1){let s=e.y+Math.min(e.height-1,Math.floor((o+.5)*e.height/Math.max(1,t))),c;for(let t=0;t<e.height;t+=1){let a=t%2==0?s+(t>>1):s-(t+1>>1);if(!(a<e.y||a>=e.y+e.height||i.has(a))&&this.#B(r,a,n)){c=a;break}}if(c===void 0){let t=a.findLast(e=>e!==void 0)??this.#V(e,n);a.push(t);continue}i.add(c),a.push({x:r,y:c})}return a}#z(e,t,n){let r=t===`power`?e.y-1:e.y+e.height,i=e.x+Math.max(0,Math.min(e.width-1,Math.round(e.width*(t===`power`?.3:.7))));for(let t=0;t<e.width;t+=1){let a=t%2==0?i+(t>>1):i-(t+1>>1);if(!(a<e.x||a>=e.x+e.width)&&this.#B(a,r,n))return{x:a,y:r}}}#B(e,t,n){if(e<0||e>=n.width||t<0||t>=n.height)return!1;let r=t*n.width+e;return this.#c[r]!==1&&this.#l[r]===0}#V(e,t){for(let n=0;n<e.height;n+=1){if(this.#B(e.x+e.width,e.y+n,t))return{x:e.x+e.width,y:e.y+n};if(this.#B(e.x-1,e.y+n,t))return{x:e.x-1,y:e.y+n}}for(let n=0;n<e.width;n+=1){if(this.#B(e.x+n,e.y-1,t))return{x:e.x+n,y:e.y-1};if(this.#B(e.x+n,e.y+e.height,t))return{x:e.x+n,y:e.y+e.height}}}#H(e){if(this.#E=!1,this.#s=this.#s.filter(e=>e.kind===`tap`),this.#o.length===0)return;let t=new Map,n=new Map;for(let r=0;r<this.#o.length;r+=1){let i=this.#o[r];t.set(i.id,r);let a=this.#L(i,e);a&&n.set(i.id,a)}let r=new Map,i=e=>{if(e.kind===`power`)return this.#y;if(e.kind===`ground`)return this.#b;if(e.kind===`osc`)return this.#x.find(t=>t.id===e.id)},a=t=>{if(t.kind===`chip`){let e=n.get(t.id);return e?[{point:e,exitTo:{x:1,y:0}}]:[]}let a=t.kind===`osc`?`osc:${t.id}`:t.kind,o=r.get(a);if(!o){let n=i(t);o={pins:n?this.#K(n.x,n.y,e):[],cursor:0},r.set(a,o)}let s=o.pins;if(s.length===0)return[];let c=o.cursor;return o.cursor+=1,s.map((e,t)=>s[(c+t)%s.length])},o=(t,n,r)=>{for(let i of a(t)){let t=this.#q(i.point,n,e,i.exitTo,r);if(t)return t}};for(let n of this.#o){let r=this.#R(n,n.inputs.length,e);for(let e=0;e<n.inputs.length;e+=1){let i=n.inputs[e],a=r[e];if(!a)continue;let s=o(i,a);if(!s)continue;let c=2+Math.floor(this.#Ue()*3),l=Array.from({length:c},()=>({index:Math.floor(this.#Ue()*s.length),accumulator:0}));this.#s.push({kind:`wire`,driver:i,consumerChipId:n.id,chipIndex:i.kind===`chip`?t.get(i.id)??-1:-1,cells:s,pulses:l})}}for(let t=0;t<this.#o.length;t+=1){let n=this.#o[t];for(let t of cg){let r=this.#z(n,t,e);if(!r)continue;let i;if(t===`power`)i=o({kind:t},r,{x:0,y:-1});else for(let t of a({kind:`ground`}))if(i=this.#q(r,t.point,e,{x:0,y:1},t.exitTo),i)break;i&&this.#s.push({kind:`rail`,driver:{kind:t},consumerChipId:n.id,chipIndex:-1,energizedBy:{kind:`chip`,id:n.id},sinking:t===`ground`,cells:i,pulses:[{index:Math.floor(this.#Ue()*i.length),accumulator:0}]})}}for(let n of this.#C){n.connected=!1;let r=n.driver;if(!r)continue;let i={x:n.x-1,y:n.y};if(!this.#B(i.x,i.y,e))continue;let s=o(r,i);if(!s)continue;let c=this.#G(n,e);if(!c)continue;let l;for(let t of a({kind:`ground`}))if(l=this.#q(c.point,t.point,e,c.exitTo,t.exitTo),l)break;if(!l)continue;let u=1+Math.floor(this.#Ue()*2);this.#s.push({kind:`wire`,driver:r,consumerLedId:n.id,chipIndex:r.kind===`chip`?t.get(r.id)??-1:-1,cells:s,pulses:Array.from({length:u},()=>({index:Math.floor(this.#Ue()*s.length),accumulator:0}))}),this.#s.push({kind:`return`,driver:r,consumerLedId:n.id,chipIndex:-1,cells:l,pulses:[{index:Math.floor(this.#Ue()*l.length),accumulator:0}]}),n.connected=!0}this.#U(e)}#U(e){this.#O.clear();let t=new Map,n=(e,t,n)=>{let r=e.get(t);r||(r=new Set,e.set(t,r)),r.add(n)};for(let r of this.#s){if(r.kind===`tap`)continue;let i=bg(r.driver),a=t.get(i);a||(a=new Map,t.set(i,a));for(let t=0;t<r.cells.length;t+=1){let i=r.cells[t];if(i.x<0||i.x>=e.width||i.y<0||i.y>=e.height)continue;let o=i.y*e.width+i.x,s=r.cells[t-1],c=r.cells[t+1];s&&n(a,o,s.y*e.width+s.x),c&&n(a,o,c.y*e.width+c.x)}}for(let e of t.values())for(let[t,n]of e)n.size>=3&&this.#O.add(t)}pick(e,t){let n=this.#n;if(!n)return!1;let r=Math.floor(e-n.column),i=Math.floor(t-n.row),a=this.#o.find(e=>r>=e.x&&r<e.x+e.width&&i>=e.y&&i<e.y+e.height),o=this.#k;return this.#k=a===void 0||a.id===o?void 0:a.id,a!==void 0}#W(e){let t=this.#k;return t===void 0?!1:e.consumerChipId===t||e.driver.kind===`chip`&&e.driver.id===t?!0:e.energizedBy?.kind===`chip`&&e.energizedBy.id===t}#G(e,t){let n=[{point:{x:e.x,y:e.y+1},exitTo:{x:0,y:1}},{point:{x:e.x,y:e.y-1},exitTo:{x:0,y:-1}},{point:{x:e.x+1,y:e.y},exitTo:{x:1,y:0}}];for(let e of n)if(this.#B(e.point.x,e.point.y,t))return e}#K(e,t,n){let r=e+fg/2>n.width/2,i=r?e-1:e+fg,a={x:r?-1:1,y:0},o=t*2<n.height?1:-1,s={x:0,y:o},c=[{point:{x:i,y:t},exitTo:a},{point:{x:e+1,y:t+o},exitTo:s},{point:{x:i,y:t+o},exitTo:s},{point:{x:e+fg-1-(r?0:2),y:t+o},exitTo:s},{point:{x:i+a.x,y:t},exitTo:a}],l=[];for(let e of c)this.#B(e.point.x,e.point.y,n)&&(l.some(t=>Tg(t.point,e.point))||l.push(e));return l}#q(e,t,n,r={x:1,y:0},i={x:-1,y:0}){let a={x:e.x+r.x,y:e.y+r.y},o={x:t.x+i.x,y:t.y+i.y};if(!Tg(e,t)){if(Tg(a,t)||Tg(o,e))return Eg(e,t)?Og([e,t]):this.#J(e,t,n);if(this.#B(a.x,a.y,n)&&this.#B(o.x,o.y,n)){let r=Tg(a,o)?[a]:this.#J(a,o,n,[e,t])?.map(e=>({x:e.x,y:e.y}));if(r)return Og([e,...r,t])}return this.#J(e,t,n)}}#J(e,t,n,r=[]){let i=[];for(let e of r){if(e.x<0||e.x>=n.width||e.y<0||e.y>=n.height)continue;let t=e.y*n.width+e.x;i.push([t,this.#c[t]]),this.#c[t]=1}try{return this.#Y(e,t,n)}finally{for(let[e,t]of i)this.#c[e]=t}}#Y(e,t,n){let{width:r,height:i}=n,a=e=>this.#c[e]!==1&&this.#l[e]===0;if(!a(e.y*r+e.x)||!a(t.y*r+t.x))return;let o=Math.floor(this.#Ue()*4),s=this.#A.route(r,i,e,t,a,o);return s&&s.length>=2?bh(s):void 0}#X(e){if(this.#x.length!==0)for(let t=0;t<Rh;t+=1){if(!this.#ie(e))return;let t=this.#o[this.#o.length-1],n=t?t.stage+1:1,r=this.#se(this.#oe(n,e),e,-1);if(!r)return;let i=t?[{kind:`chip`,id:t.id}]:[{kind:`osc`,id:this.#x[0].id}],a=this.#ee(r.x,r.y,i,()=>!1);a&&i.push(a),this.#o.push(this.#Pe(r.x,r.y,n,i)),this.#je(this.#o.length-1,1)}}#Z(e){if(this.#o.length===0){let t=this.#o.length;return this.#X(e),this.#o.length===t?!1:(this.#Ve(),this.#de(),this.#T=this.#o.length,this.#E=!0,!0)}return this.#o.length>=this.#ne(e)||!(this.#o.length>=2&&this.#Ue()<Vh&&this.#$(e)||this.#Q(e))?!1:(this.#Ve(),this.#de(),this.#T=this.#o.length,this.#E=!0,!0)}#Q(e){let t=this.#o[Math.floor(this.#Ue()*this.#o.length)];if(!this.#ie(e))return!1;let n=t.stage+1,r=this.#se(this.#ae(t,e),e,-1);if(!r)return!1;let i=[{kind:`chip`,id:t.id}],a=ig+(this.#Ue()<.35?ag-ig:0);for(;i.length<a;){let e=this.#ee(r.x,r.y,i,()=>!1);if(!e)break;i.push(e)}return this.#o.push(this.#Pe(r.x,r.y,n,i)),this.#je(this.#o.length-1,1),!0}#$(e){let t=this.#s.filter(e=>e.kind===`wire`&&e.consumerChipId!==void 0&&xg(e.driver));if(t.length===0)return!1;let n=t[Math.floor(this.#Ue()*t.length)],r=xg(n.driver)?n.driver:void 0,i=this.#o.find(e=>e.id===n.consumerChipId);if(!i||!r)return!1;let a=i.inputs.findIndex(e=>Sg(e,r));if(a<0||!this.#ie(e))return!1;let o=r,s=o.kind===`chip`?this.#o.find(e=>e.id===o.id)?.stage??0:0,c=o.kind===`chip`?this.#o.find(e=>e.id===o.id):void 0,l=c?Math.round((c.x+c.width+i.x)/2):this.#ae(void 0,e),u=this.#se(l,e,-1);if(!u)return!1;let d=[r],f=this.#ee(u.x,u.y,d,e=>e.id===i.id||this.#te(e.id,i.id));f&&d.push(f);let p=this.#Pe(u.x,u.y,s+1,d);return this.#o.push(p),this.#je(this.#o.length-1,1),i.inputs[a]={kind:`chip`,id:p.id},i.stage=Math.max(i.stage,p.stage+1),!0}#ee(e,t,n,r){let i=t+Fh/2,a=[],o=(t,r,o)=>{if(n.some(e=>Sg(e,t)))return;let s=r>=e?Bh*4:0;a.push({ref:t,score:Math.abs(r-e)+Math.abs(o-i)+s})};for(let e of this.#o)r(e)||o({kind:`chip`,id:e.id},e.x+e.width,e.y+e.height/2);for(let e of this.#x)o({kind:`osc`,id:e.id},e.x+fg,e.y);if(a.length===0)return;a.sort((e,t)=>e.score-t.score);let s=a.slice(0,Math.min(3,a.length));return s[Math.floor(this.#Ue()*s.length)].ref}#te(e,t){let n=new Set,r=[e];for(;r.length>0;){let e=r.pop();if(e===t)return!0;if(n.has(e))continue;n.add(e);let i=this.#o.find(t=>t.id===e);if(i)for(let e of i.inputs)e.kind===`chip`&&!n.has(e.id)&&r.push(e.id)}return!1}#ne(e){return Mg(Math.round((Rh+e.width*e.height/Mh)*this.#t),Rh,jh)}#re(e){let t=Math.min(1,this.#o.length/Math.max(1,this.#ne(e)));return Oh*(kh+(1-kh)*t)}#ie(e){return e.width-2*K>=Ph&&e.height-2*K>=Fh}#ae(e,t){if(!e)return 6;let n=e.x+e.width+Ih+2;return n+Ph+K<=t.width?n:6}#oe(e,t){let n=t.width-6-Ph-K,r=Math.max(1,Math.floor(n/Bh)+1);return 6+Math.max(0,e-1)%r*Bh}#se(e,t,n){let r=Math.max(K,zh),i=t.width-Ph-K,a=t.height-Fh-K;if(i<r||a<K)return;let o=a-K+1;for(let t=0;t<Lh;t+=1){let t=Mg(e+Math.floor((this.#Ue()-.5)*Bh),r,i),a=K+Math.floor(this.#Ue()*o);if(this.#Ae(t,a,n))return{x:t,y:a}}let s,c=-1;for(let e=0;e<Nh;e+=1){let e=r+Math.floor(this.#Ue()*(i-r+1)),t=K+Math.floor(this.#Ue()*o);if(!this.#Ae(e,t,n))continue;let a=this.#ce(e,t,n);a<=c||(c=a,s={x:e,y:t})}return s}#ce(e,t,n){let r=1/0;for(let i=0;i<this.#o.length;i+=1){if(i===n)continue;let a=this.#o[i],o=Math.abs(a.x+a.width/2-(e+Ph/2))+Math.abs(a.y+a.height/2-(t+Fh/2));o<r&&(r=o)}return r}#le(e){let t=e.width*e.height,n=e.width>=10&&e.height>=4,r=Math.max(0,e.width-fg),i=Math.max(0,e.height-1);this.#y=this.#me(e,lg,0,0)??{x:0,y:0,homeX:0,homeY:0,label:lg},n?(this.#pe(e,r,0),this.#pe(e,0,i)):t>=400&&this.#pe(e,0,i),n&&t>=hg&&this.#x.length<gg&&this.#pe(e,Math.floor((e.width-fg)/2),Math.floor(e.height/2)),this.#b=this.#me(e,ug,r,i)??{x:r,y:i,homeX:r,homeY:i,label:ug}}#ue(e){let t=e.height>3?$h:0,n=e.width-2*zh,r=Mg(Math.floor((n+Qh-1)/Qh),0,Zh);if(r<=0)return;let i=(r-1)*Qh+1,a=Math.max(zh,Math.floor((e.width-i)/2));for(let n=0;n<r;n+=1){let r=a+n*Qh;if(r<0||r>=e.width)continue;let i=t*e.width+r;this.#c[i]===0&&(this.#c[i]=1,this.#C.push({id:this.#w++,x:r,y:t,connected:!1,state:!1}))}}#de(){if(this.#o.length===0)return;let e=new Set;for(let t of this.#o)for(let n of t.inputs)n.kind===`chip`&&e.add(n.id);for(let t of this.#C)t.driver?.kind===`chip`&&e.add(t.driver.id);for(let t of this.#o){if(e.has(t.id))continue;let n=this.#C.find(e=>e.driver===void 0);if(n){n.driver={kind:`chip`,id:t.id},e.add(t.id);continue}let r=this.#o.filter(e=>e.id!==t.id&&e.inputs.length<og&&!this.#te(t.id,e.id)&&!e.inputs.some(e=>e.kind===`chip`&&e.id===t.id)).sort((e,n)=>wg(e,t)-wg(n,t))[0];if(r){r.inputs.push({kind:`chip`,id:t.id}),e.add(t.id);continue}let i=this.#fe();i&&(i.driver={kind:`chip`,id:t.id},i.connected=!1,i.state=!1,e.add(t.id))}let t=new Set;for(let e of this.#C)e.driver?.kind===`chip`&&t.add(e.driver.id);for(let e of this.#C){if(e.driver!==void 0)continue;let n=this.#o.slice().sort((t,n)=>Cg(t,e)-Cg(n,e));if(n.length===0)continue;n.every(e=>t.has(e.id))&&t.clear();let r=n.find(e=>!t.has(e.id))??n[0];e.driver={kind:`chip`,id:r.id},t.add(r.id)}}#fe(){let e=new Map;for(let t of this.#C)t.driver?.kind===`chip`&&e.set(t.driver.id,(e.get(t.driver.id)??0)+1);let t=new Set;for(let e of this.#o)for(let n of e.inputs)n.kind===`chip`&&t.add(n.id);let n;for(let r of this.#C)if(r.driver?.kind===`chip`){if((e.get(r.driver.id)??0)>1)return r;t.has(r.driver.id)&&(n??=r)}return n}#pe(e,t,n){let r=this.#me(e,dg,t,n);r&&this.#x.push({id:this.#S++,x:r.x,y:r.y,homeX:t,homeY:n,label:dg,periodTicks:pg+Math.floor(this.#Ue()*5),phase:Math.floor(this.#Ue()*mg),state:this.#Ue()<.5})}#me(e,t,n,r){let i=this.#he(e,n,r);if(i)return this.#ge(e,i.x,i.y,1),{x:i.x,y:i.y,homeX:n,homeY:r,label:t}}#he(e,t,n){let r=Math.max(0,e.width-fg);for(let i=0;i<e.height;i+=1){let a=i%2==0?n+(i>>1):n-(i+1>>1);if(!(a<0||a>=e.height))for(let n=0;n<=r;n+=1){let i=n%2==0?t+(n>>1):t-(n+1>>1);if(!(i<0||i>r)&&this.#Ie(i,a,e))return{x:i,y:a}}}}#ge(e,t,n,r){if(!(n<0||n>=e.height))for(let i=t;i<t+fg;i+=1)i<0||i>=e.width||(this.#c[n*e.width+i]=r)}#_e(e){let t=!1,n=[...this.#y?[this.#y]:[],...this.#b?[this.#b]:[],...this.#x];for(let r of n){if(r.x===r.homeX&&r.y===r.homeY&&!this.#ve(e,r.x,r.y))continue;this.#ge(e,r.x,r.y,0);let n=this.#he(e,r.homeX,r.homeY);n&&(n.x!==r.x||n.y!==r.y)&&(r.x=n.x,r.y=n.y,t=!0),this.#ge(e,r.x,r.y,1)}return t}#ve(e,t,n){if(n<0||n>=e.height)return!1;for(let r=t;r<t+fg;r+=1)if(!(r<0||r>=e.width)&&this.#l[n*e.width+r]!==0)return!0;return!1}#ye(e,t){let n=[];for(let r of e.obstacles??[]){let e=jg(r);e&&n.push({column:e.column-t.column,row:e.row-t.row,width:e.width,height:e.height})}this.#f=void 0;let r=e.activeObstacle?jg(e.activeObstacle):void 0;if(r){let e={column:r.column-t.column,row:r.row-t.row,width:r.width,height:r.height},i=n.findIndex(t=>Ag(t,e));i>=0&&(this.#f=i)}let i=n.map(e=>`${e.column},${e.row},${e.width},${e.height}`).join(`;`);return i===this.#d?!1:(this.#d=i,this.#u=n,this.#be(t))}#be(e){let{width:t,height:n}=e;this.#l.length===t*n?this.#l.fill(0):this.#l=new Uint8Array(t*n);for(let e of this.#u){let r=Math.max(0,e.column-Hh),i=Math.max(0,e.row-Hh),a=Math.min(t-1,e.column+e.width-1+Hh),o=Math.min(n-1,e.row+e.height-1+Hh);for(let e=i;e<=o;e+=1)this.#l.fill(1,e*t+r,e*t+a+1)}this.#_e(e),this.#E=!0;for(let t=this.#s.length-1;t>=0;--t){let n=this.#s[t];if(n.kind!==`tap`)continue;let r=n.obstacleRect?this.#u.findIndex(e=>Ag(e,n.obstacleRect)):-1;if(r>=0&&this.#De(n,e)){n.obstacleIndex=r;continue}this.#Me(n,e),this.#s.splice(t,1)}for(let t of this.#o)this.#Oe(t,e)&&this.#Se({kind:`relocate-chip`,chipId:t.id});for(let e of this.#u)this.#s.some(t=>t.kind===`tap`&&t.obstacleRect!==void 0&&Ag(t.obstacleRect,e))||this.#Se({kind:`grow-taps`,rect:{...e}});return!0}#xe(e){let t=!1;for(let n=0;n<Wh&&this.#p.length>0;n+=1){let n=this.#p.shift();if(n.kind===`relocate-chip`)this.#Ce(n.chipId,e)&&(t=!0);else{let r=this.#u.findIndex(e=>Ag(e,n.rect));if(r<0)continue;!this.#s.some(e=>e.kind===`tap`&&e.obstacleRect!==void 0&&Ag(e.obstacleRect,n.rect))&&this.#Te(r,e)&&(t=!0)}}return t}#Se(e){if(!(this.#p.length>=Gh)){for(let t of this.#p)if(t.kind===e.kind&&(e.kind===`grow-taps`&&t.kind===`grow-taps`&&Ag(t.rect,e.rect)||e.kind===`relocate-chip`&&t.kind===`relocate-chip`&&t.chipId===e.chipId))return;this.#p.push(e)}}#Ce(e,t){let n=this.#o.findIndex(t=>t.id===e);if(n<0)return!1;let r=this.#o[n];if(!this.#Oe(r,t))return!1;let i=[];for(let e=this.#s.length-1;e>=0;--e){let r=this.#s[e];r.chipIndex===n&&(r.kind===`tap`&&r.obstacleRect&&i.push({...r.obstacleRect}),this.#Me(r,t),this.#s.splice(e,1))}this.#je(n,0);let a=this.#se(this.#oe(r.stage,t),t,n);a?(r.x=a.x,r.y=a.y,this.#je(n,1)):this.#we(n,t),this.#E=!0;for(let e of i)this.#Se({kind:`grow-taps`,rect:e});return!0}#we(e,t){this.#o[e]?.id===this.#k&&(this.#k=void 0);for(let n=this.#s.length-1;n>=0;--n){let r=this.#s[n];r.chipIndex===e?(this.#Me(r,t),this.#s.splice(n,1)):r.chipIndex>e&&--r.chipIndex}this.#o.splice(e,1)}#Te(e,t){let n=1+Math.floor(this.#Ue()*3),r=!1;for(let i=0;i<n;i+=1)this.#Ee(e,t)&&(r=!0);return r}#Ee(e,t){let n=this.#u[e];if(!n||this.#o.length===0)return!1;let r=n.column+n.width/2,i=n.row+n.height/2,a=-1,o=1/0;for(let e=0;e<this.#o.length;e+=1){let t=this.#o[e],n=Math.abs(t.x+t.width/2-r)+Math.abs(t.y+t.height/2-i);n<o&&(o=n,a=e)}if(a<0)return!1;let s=this.#o[a],{width:c,height:l}=t,u=(e,t)=>e>=n.column&&e<=n.column+n.width-1&&t>=n.row&&t<=n.row+n.height-1,d=(e,t)=>!u(e,t)&&e>=n.column-Hh&&e<=n.column+n.width-1+Hh&&t>=n.row-Hh&&t<=n.row+n.height-1+Hh,f=Math.floor(this.#Ue()*4),p=new Int32Array(c*l).fill(-2),m=[],h=(e,t)=>{if(e<0||e>=c||t<0||t>=l)return;let n=t*c+e;p[n]!==-2||this.#c[n]!==0||this.#l[n]!==0&&!d(e,t)||(p[n]=-1,m.push(n))};for(let e=s.x;e<s.x+s.width;e+=1)h(e,s.y-1),h(e,s.y+s.height);for(let e=s.y;e<s.y+s.height;e+=1)h(s.x-1,e),h(s.x+s.width,e);let g=-1,_=-1;for(let e=0;e<m.length&&g<0;e+=1){let t=m[e],n=t%c,r=Math.floor(t/c);if(d(n,r)){for(let e=0;e<4;e+=1){let i=(e+f)%4,a=n+_g[i],o=r+vg[i];if(a<0||a>=c||o<0||o>=l||!u(a,o))continue;let s=o*c+a;if(this.#c[s]===0){g=t,_=s;break}}continue}for(let e=0;e<4;e+=1){let i=(e+f)%4,a=n+_g[i],o=r+vg[i];if(a<0||a>=c||o<0||o>=l)continue;let s=o*c+a;p[s]!==-2||this.#c[s]!==0||this.#l[s]!==0&&!d(a,o)||(p[s]=t,m.push(s))}}if(g<0||_<0)return!1;let v=[];for(let e=g;e!==-1;e=p[e])v.push(e);let y=[];for(let e=v.length-1;e>=0;--e){let t=v[e];y.push({x:t%c,y:Math.floor(t/c)})}if(y.push({x:_%c,y:Math.floor(_/c)}),y.length<2)return!1;for(let e of y)this.#c[e.y*c+e.x]=2;let b=kg(y),x=2+Math.floor(this.#Ue()*3),S=Array.from({length:x},()=>({index:Math.floor(this.#Ue()*b.length),accumulator:0}));return this.#s.push({chipIndex:a,kind:`tap`,driver:{kind:`chip`,id:s.id},obstacleIndex:e,obstacleRect:{...n},cells:b,pulses:S}),!0}#De(e,t){let n=e.obstacleRect;if(!n)return!1;let{width:r}=t;for(let t of e.cells)if(this.#l[t.y*r+t.x]!==0&&!(t.x>=n.column-Hh&&t.x<=n.column+n.width-1+Hh&&t.y>=n.row-Hh&&t.y<=n.row+n.height-1+Hh))return!1;return!0}#Oe(e,t){let{width:n,height:r}=t;for(let t=e.y;t<e.y+e.height;t+=1)if(!(t<0||t>=r)){for(let r=e.x;r<e.x+e.width;r+=1)if(!(r<0||r>=n)&&this.#l[t*n+r]!==0)return!0}return!1}#ke(e){if(this.#o.length===0)return!1;let t=Math.floor(this.#Ue()*this.#o.length),n=this.#o[t],r=Math.floor(this.#Ue()*4);for(let n=this.#s.length-1;n>=0;--n){let r=this.#s[n];r.kind!==`tap`||r.chipIndex!==t||(r.obstacleRect&&this.#Se({kind:`grow-taps`,rect:{...r.obstacleRect}}),this.#Me(r,e),this.#s.splice(n,1))}this.#je(t,0);let i=n.x+_g[r],a=n.y+vg[r];return this.#Ae(i,a,t)&&(n.x=i,n.y=a),this.#je(t,1),this.#E=!0,!0}#Ae(e,t,n){let r=this.#n;if(!r||e<Math.max(K,zh)||t<K||e+Ph>r.width-K||t+Fh>r.height-K)return!1;for(let r=0;r<this.#o.length;r+=1){if(r===n)continue;let i=this.#o[r];if(e<i.x+i.width+Ih&&i.x<e+Ph+Ih&&t<i.y+i.height+Ih&&i.y<t+Fh+Ih)return!1}for(let n=t;n<t+Fh;n+=1)for(let t=e;t<e+Ph;t+=1){let e=n*r.width+t;if(this.#c[e]!==0||this.#l[e]!==0)return!1}return!0}#je(e,t){let n=this.#n,r=this.#o[e];if(!(!n||!r)){for(let e=r.y;e<r.y+r.height;e+=1)if(!(e<0||e>=n.height))for(let i=r.x;i<r.x+r.width;i+=1)i<0||i>=n.width||(this.#c[e*n.width+i]=t)}}#Me(e,t){for(let n of e.cells)n.x<0||n.x>=t.width||n.y<0||n.y>=t.height||(this.#c[n.y*t.width+n.x]=0)}#Ne(e,t){if(this.#h.length===t&&(this.#h[0]?.length??-1)===e){for(let e of this.#h)e.fill(void 0);return}this.#h=Array.from({length:t},()=>Array(e).fill(void 0))}#Pe(e,t,n,r){let i=this.#Fe();return{id:this.#m++,x:e,y:t,width:Ph,height:Fh,label:i,gate:i,inputs:[...r],stage:n,state:this.#Ue()<.5,nextState:!1}}#Fe(){let e=new Set(this.#o.map(e=>e.gate)),t=ng.filter(t=>!e.has(t)),n=t.length>0?t:ng;return n[Math.floor(this.#Ue()*n.length)]}#Ie(e,t,n){if(t<0||t>=n.height)return!1;for(let r=e;r<e+fg;r+=1){if(r<0||r>=n.width)return!1;let e=t*n.width+r;if(this.#c[e]!==0||this.#l[e]!==0)return!1}return!0}#Le(){let e=this.#o;if(this.#T=e.length,e.length===0)return;let t=new Set(e.map(e=>e.id)),n=new Set(this.#x.map(e=>e.id));for(let r of e){let e=[];for(let i of r.inputs)i.kind===`chip`&&(!t.has(i.id)||i.id===r.id)||i.kind===`osc`&&!n.has(i.id)||e.some(e=>Sg(e,i))||e.push(i);r.inputs=e}for(let e of this.#C)e.driver?.kind===`chip`&&!t.has(e.driver.id)&&(e.driver=void 0,e.connected=!1,e.state=!1);for(let t of e)for(;t.inputs.length<ig;){let e=this.#ee(t.x,t.y,t.inputs,e=>e.id===t.id||this.#te(e.id,t.id));if(!e)break;t.inputs.push(e)}this.#Ve(),this.#de();for(let e=this.#o.length-1;e>=0;--e)this.#o[e].inputs.length>0||(this.#je(e,0),this.#we(e,this.#n??{column:0,row:0,width:0,height:0}));this.#T=this.#o.length,this.#Be()}#Re(){let e=new Map;for(let t of this.#o)e.set(t.id,!1);for(let t=0;t<=this.#o.length;t+=1){let t=!1;for(let n of this.#o)if(e.get(n.id)!==!0){for(let r of n.inputs)if(!(r.kind!==`osc`&&e.get(r.id)!==!0)){e.set(n.id,!0),t=!0;break}}if(!t)break}return e}#ze(){let e=new Set,t=new Set;for(let n of this.#s)n.kind!==`rail`||n.consumerChipId===void 0||(n.driver.kind===`power`&&e.add(n.consumerChipId),n.driver.kind===`ground`&&t.add(n.consumerChipId));return this.#o.reduce((n,r)=>n+(e.has(r.id)&&t.has(r.id)?1:0),0)}#Be(){for(let e of this.#o)e.stage=1;for(let e=0;e<this.#o.length;e+=1){let e=!1;for(let t of this.#o)for(let n of t.inputs){if(n.kind!==`chip`)continue;let r=this.#o.find(e=>e.id===n.id);!r||r.stage+1<=t.stage||(t.stage=r.stage+1,e=!0)}if(!e)break}}#Ve(){if(this.#o.length!==0)for(let e of this.#x){let t={kind:`osc`,id:e.id};if(this.#o.some(e=>e.inputs.some(e=>Sg(e,t))))continue;let n=this.#o.filter(e=>e.inputs.length<ag).sort((t,n)=>Cg(t,e)-Cg(n,e))[0];n&&n.inputs.push(t)}}#He(){let e=this.#o;if(e.length===0)return!1;let t=new Map;for(let n of e)t.set(n.id,n);let n=new Map;for(let e of this.#x)n.set(e.id,e);for(let r of e){let e=0,i=0;for(let a of r.inputs)i+=1,(a.kind===`osc`?n.get(a.id)?.state:t.get(a.id)?.state)&&(e+=1);r.nextState=Dg(r.gate,e,i)}let r=!1;for(let e of this.#C){let t=e.connected&&e.driver!==void 0&&this.#M(e.driver);t!==e.state&&(r=!0),e.state=t}for(let t of e)t.nextState!==t.state&&(r=!0),t.state=t.nextState;for(let e of this.#x)e.phase+=1,e.phase>=e.periodTicks&&(e.phase=0,e.state=!e.state,r=!0);return r}#Ue(){return this.#e=Math.imul(this.#e,1664525)+1013904223>>>0,this.#e/4294967296}};function bg(e){return e.kind===`chip`||e.kind===`osc`?`${e.kind}:${e.id}`:e.kind}function xg(e){return e.kind===`chip`||e.kind===`osc`}function Sg(e,t){return e.kind===t.kind?e.kind===`chip`&&t.kind===`chip`||e.kind===`osc`&&t.kind===`osc`?e.id===t.id:!0:!1}function Cg(e,t){return Math.abs(e.x+e.width/2-t.x)+Math.abs(e.y+e.height/2-t.y)}function wg(e,t){let n=e.x<t.x?Bh*4:0;return Math.abs(e.x-t.x)+Math.abs(e.y-t.y)+n}function Tg(e,t){return e.x===t.x&&e.y===t.y}function Eg(e,t){return Math.abs(e.x-t.x)+Math.abs(e.y-t.y)===1}function Dg(e,t,n){if(n===0)return!1;switch(e){case`AND`:return t===n;case`OR`:return t>0;case`NAND`:return t!==n;case`NOR`:return t===0;case`XOR`:return(t&1)==1;case`XNOR`:return(t&1)==0}}function Og(e){return bh(e)}function kg(e){return bh(e,Jh)}function Ag(e,t){return e.column===t.column&&e.row===t.row&&e.width===t.width&&e.height===t.height}function jg(e){if(!Number.isFinite(e.column)||!Number.isFinite(e.row)||!Number.isFinite(e.width)||!Number.isFinite(e.height))return;let t=Math.floor(e.width),n=Math.floor(e.height);if(!(t<=0||n<=0))return{column:Math.floor(e.column),row:Math.floor(e.row),width:t,height:n}}function Mg(e,t,n){return Math.max(t,Math.min(n,Math.floor(Pg(e,t))))}function Ng(e,t,n){return Math.max(t,Math.min(n,e))}function Pg(e,t){return typeof e==`number`&&Number.isFinite(e)?e:t}var Fg=Math.PI*2,Ig=16.7,Lg=48,Rg=1500,zg=5,Bg=5,Vg=5,Hg=4,Ug=.14,Wg=[`╬`,`╪`,`╫`,`║`,`▌`,`▐`],Gg=[`░`,`▒`,`▓`,`█`],Kg=[`≈`,`∽`,`~`,`=`],qg=class{#e;#t;#n;#r;#i;#a;#o;#s={column:0,row:0,strength:0};#c;#l=0;#u=[];#d=[];#f=-1;#p=[];constructor(e={}){this.#e=(e.seed??1112100685)>>>0;let t=Zg(Qg(e.density,1),.25,2);this.#t=Math.floor(this.#O()*4294967295)>>>0,this.#n=[1,.6,.35].map(e=>({kx:.05+this.#O()*.11,ky:.14+this.#O()*.26,phase:this.#O()*Fg,speed:(.35+this.#O()*.85)*(this.#O()<.5?-1:1),weight:e}));let n=Xg(Math.round(3*t),2,8);this.#r=Array.from({length:n},()=>({xFraction:this.#O(),amplitude:1+this.#O()*1.8,wavelength:3+this.#O()*4,phase:this.#O()*Fg,speed:(.3+this.#O()*.5)*(this.#O()<.5?-1:1),glyphOffset:Math.floor(this.#O()*Kg.length),paired:this.#O()<.5}));let r=Xg(Math.round(2.6+t*1.8),3,6);this.#i=Array.from({length:r},()=>({columnFraction:this.#O(),topFraction:.05+this.#O()*.4,spanFraction:.3+this.#O()*.2,periodMs:3e3+this.#O()*3e3,phase:this.#O()*Fg}))}setPointer(e,t=performance.now()){!Number.isFinite(e.column)||!Number.isFinite(e.row)||(this.#o={column:e.column,row:e.row,updatedAt:Qg(t,performance.now())})}clearPointer(){this.#o=void 0}advance(e){let t=Yg(e.bounds);if(!t)return!1;this.#T(t);let n=Qg(e.now,performance.now()),r=this.#c===void 0?Ig:Math.min(Lg,Math.max(0,n-this.#c));if(this.#c=n,r<=0)return!1;this.#l+=r;let i=this.#o;if(i){let e=Math.max(0,n-i.updatedAt);this.#s={column:i.column,row:i.row,strength:Math.max(0,1-e/Rg)}}else this.#s={column:0,row:0,strength:0};return!0}rasterizeCells(e,t){let n=Yg(e);return n?(this.#T(n),this.#w(n),this.#m(n.width),this.#h(n),this.#v(n,t),this.#b(n,t),this.#x(n,t),this.#S(n,t),this.#u):(this.#u=[],this.#u)}#m(e){if(this.#f===e)return;let t=[],n=-2-this.#E(0,101)%3,r=0;for(;t.push({x:n,phaseA:Fg*this.#D(r,7),phaseB:Fg*this.#D(r,11),speed:(.4+.7*this.#D(r,13))*(this.#D(r,17)<.5?-1:1),glyphOffset:this.#E(r,19)%Wg.length,depth:this.#D(r,23)}),!(n>e+2);)n+=Bg+this.#E(r,29)%Vg,r+=1;this.#d=t,this.#f=e,this.#p=[]}#h(e){let t=this.#d.length;(this.#p.length!==t||(this.#p[0]?.length??-1)!==e.height)&&(this.#p=Array.from({length:t},()=>Array(e.height)));let n=this.#l/1e3;for(let r=0;r<t;r+=1){let t=this.#d[r],i=this.#p[r];for(let r=0;r<e.height;r+=1){let a=1.35*(1+1.1*this.#_(t.x,r,e)),o=.75*Math.sin(r*.31+t.phaseA+t.speed*n)+.5*Math.sin(r*.12+t.phaseB-.6*t.speed*n);i[r]=t.x+Zg(Math.round(a*o),-2,2)}}}#g(e,t,n){let r=0,i=0;for(let a of this.#n)r+=a.weight*Math.sin(a.kx*e+a.ky*t+a.phase+a.speed*n),i+=a.weight;return r/i}#_(e,t,n){let r=this.#s;if(r.strength<=0)return 0;let i=e-(r.column-n.column),a=2*(t-(r.row-n.row)),o=zg;return r.strength*Math.exp(-(i*i+a*a)/(2*o*o))}#v(e,t){let n=this.#l/1e3;for(let r=0;r<e.height;r+=1)for(let i=0;i+1<this.#d.length;i+=1){let a=this.#p[i][r],o=this.#p[i+1][r],s=o-a;if(s<2)continue;let c=this.#D(i,31),l=1.6+c*1.4,u=Math.max(0,a+1),d=Math.min(e.width-1,o-1);for(let i=u;i<=d;i+=1){let o=(i-a)/s,u=this.#g(i,r,n),d=this.#_(i,r,e),f=l*4*o*(1-o),p=((r+f+1.7*u+2.6*d)%Hg+Hg)%Hg,m=Zg(.5+.5*u+.45*d,0,1);if(p<.95){let n=-4*l*(1-2*o)/s,a=o<.16?`(`:o>.84?`)`:n<-.28||Math.abs(n)<=.28&&o<.5?`/`:`\\`;this.#C(e,i,r,this.#y(a,Zg(.35+.65*m,0,1),c,t));continue}let h=Zg(m*(1.05-.7*(Math.min(p,Hg-p)/(Hg/2))),0,1);if(h<Ug)continue;let g=Math.min(Gg.length-1,Math.floor(h*Gg.length));this.#C(e,i,r,this.#y(Gg[g],h,c,t))}}}#y(e,t,n,r){let i=G(G(r.muted,r.border,n),r.surfaceStrong,.3),a=G(r.background,i,.15+.75*t);return t>.8&&(a=G(a,r.accent,(t-.8)*4)),t>.9?{char:e,foreground:a,bold:!0}:{char:e,foreground:a}}#b(e,t){let n=this.#l/1e3;for(let r of this.#r){let i=Math.round(r.xFraction*(e.width-1));for(let a=0;a<e.height;a+=1){let o=i+Math.round(r.amplitude*Math.sin(a/r.wavelength+r.phase+r.speed*n)),s=Zg(.45+.35*this.#g(o,a,n)+.4*this.#_(o,a,e),0,1),c=G(t.background,t.surfaceStrong,.3+.5*s),l=Kg[(Math.floor(a/2)+r.glyphOffset)%Kg.length];this.#C(e,o,a,{char:l,foreground:c}),r.paired&&this.#C(e,o+1,a,{char:`│`,foreground:c})}}}#x(e,t){let n=this.#l/1e3,r=Math.floor(n*1.4);for(let i=0;i<this.#d.length;i+=1){let a=this.#d[i],o=G(t.muted,t.border,a.depth);for(let s=0;s<e.height;s+=1){let c=this.#p[i][s],l=this.#_(c,s,e),u=Zg(.55+.35*this.#g(c,s,n)+.5*l,0,1),d=G(t.background,t.surfaceStrong,.3+.5*u);this.#C(e,c-1,s,{char:`(`,foreground:d}),this.#C(e,c+1,s,{char:`)`,foreground:d});let f=G(t.background,o,.35+.6*u);u>.78&&(f=G(f,t.accent,(u-.78)*3));let p=Wg.length,m=Wg[((s+a.glyphOffset+r)%p+p)%p];this.#C(e,c,s,u>.88?{char:m,foreground:f,bold:!0}:{char:m,foreground:f})}}}#S(e,t){let n=this.#d.filter(t=>t.x>=1&&t.x<=e.width-2);if(n.length===0)return;let r=G(t.background,t.border,.7),i=G(t.background,t.muted,.6);for(let a of this.#i){let o=a.columnFraction*(e.width-1),s=n[0].x;for(let e of n)Math.abs(e.x-o)<Math.abs(s-o)&&(s=e.x);let c=Math.max(5,Math.round(a.spanFraction*e.height)),l=Math.min(e.height-2,Math.round(a.topFraction*(e.height-1))+c),u=Math.max(0,l-c);if(l-u<4)continue;this.#C(e,s,u,{char:`▓`,foreground:r}),this.#C(e,s,l+1,{char:`▓`,foreground:r});let d=.5+.5*Math.sin(Fg*this.#l/a.periodMs+a.phase),f=u+1+Math.round(d*(l-u-1));for(let t=u+1;t<f;t+=1)this.#C(e,s,t,{char:`║`,foreground:i});let p=this.#_(s,f,e);this.#C(e,s,f,{char:`╦`,foreground:G(t.accent,t.text,.15+.25*p),bold:!0})}}#C(e,t,n,r){t<0||t>=e.width||n<0||n>=e.height||(this.#u[n][t]=r)}#w(e){(this.#u.length!==e.height||(this.#u[0]?.length??-1)!==e.width)&&(this.#u=Array.from({length:e.height},()=>Array(e.width)));for(let e of this.#u)e.fill(void 0)}#T(e){let t=this.#a;t?.column===e.column&&t.row===e.row&&t.width===e.width&&t.height===e.height||(this.#a={...e})}#E(e,t){return Jg(this.#t,e,t)}#D(e,t){return this.#E(e,t)/4294967296}#O(){return this.#e=Math.imul(this.#e,1664525)+1013904223>>>0,this.#e/4294967296}};function Jg(e,t,n){let r=(e^Math.imul(t+40503,2246822507)^Math.imul(n+32586,3266489909))>>>0;return r=Math.imul(r^r>>>15,739982445)>>>0,r=Math.imul(r^r>>>12,695872825)>>>0,(r^r>>>15)>>>0}function Yg(e){if(!Number.isFinite(e.column)||!Number.isFinite(e.row)||!Number.isFinite(e.width)||!Number.isFinite(e.height))return;let t=Math.floor(e.width),n=Math.floor(e.height);if(!(t<=0||n<=0))return{column:Math.floor(e.column),row:Math.floor(e.row),width:t,height:n}}function Xg(e,t,n){return Math.max(t,Math.min(n,Math.floor(Qg(e,t))))}function Zg(e,t,n){return Math.max(t,Math.min(n,e))}function Qg(e,t){return typeof e==`number`&&Number.isFinite(e)?e:t}var $g=Math.PI*2,e_=16.7,t_=48,n_=1800,r_=7,i_=1200,a_=8e3,o_=12e3,s_=.2,c_=15,l_=25,u_=[-1,1],d_=[{frondBase:17,swayAmplitude:.7},{frondBase:14,swayAmplitude:1.4},{frondBase:12,swayAmplitude:2.2}],f_=class{#e;#t;#n;#r;#i=[];#a;#o=0;#s=-1/0;#c=0;#l;#u=[];constructor(e={}){this.#e=(e.seed??1247104583)>>>0;let t=C_(w_(e.density,1),.25,2);this.#t=d_.map(e=>this.#d(e,t)),this.#l=a_+this.#x()*o_}setPointer(e,t=performance.now()){!Number.isFinite(e.column)||!Number.isFinite(e.row)||(this.#r={column:e.column,row:e.row,updatedAt:w_(t,performance.now())})}clearPointer(){this.#r=void 0}advance(e){let t=x_(e.bounds);if(!t)return!1;this.#b(t);let n=w_(e.now,performance.now()),r=this.#a===void 0?e_:Math.min(t_,Math.max(0,n-this.#a));if(this.#a=n,r<=0)return!1;this.#o+=r,this.#o>=this.#l&&(this.#s=this.#l,this.#c=2500+this.#x()*1500,this.#l=this.#s+this.#c+a_+this.#x()*o_);let i=this.#r&&n-this.#r.updatedAt<=n_?this.#r:void 0,a=(e.obstacles??[]).map(x_).filter(e=>e!==void 0),o=a.filter(e=>!this.#i.some(t=>y_(t,e)));this.#i=a;for(let e of this.#t)for(let n of e.fronds){let e=h_(n,t);if(i&&e.some(([e,t])=>Math.hypot(i.column-e,i.row-t)<=r_)){n.lastRustleAt=this.#o;continue}for(let t of o)if(g_(e,t)){n.lastRustleAt=this.#o;break}}return!0}rasterizeCells(e,t){let n=x_(e);if(!n)return this.#u=[],this.#u;this.#b(n),this.#y(n);for(let e=0;e<this.#t.length;e+=1)this.#h(this.#t[e],e,n,t);return this.#u}#d(e,t){let n=S_(Math.round(e.frondBase*t),4,30);return{spec:e,swayPhaseA:this.#x()*$g,swayPhaseB:this.#x()*$g,swaySpeedA:.25+this.#x()*.35,swaySpeedB:.6+this.#x()*.5,fronds:Array.from({length:n},()=>{let e=Math.floor(this.#x()*4),t=e===0?-Math.PI/2:e===1?Math.PI/2:e===2?0:Math.PI;return{edge:e,anchorFraction:this.#x(),angle:t+(this.#x()-.5)*1.7,curl:this.#x()*2-1,lengthFraction:this.#x(),swayPhase:this.#x()*$g,swaySpeed:.5+this.#x()*.7,leafletPhase:this.#x()*$g,glyphSeed:Math.floor(this.#x()*65535),lastRustleAt:-1/0}})}}#f(){let e=this.#o-this.#s;return e<0||this.#c<=0||e>this.#c?1:1+Math.sin(Math.PI*(e/this.#c))}#p(e){let t=this.#o/1e3,n=Math.sin(e.swaySpeedA*t+e.swayPhaseA)+.5*Math.sin(e.swaySpeedB*t+e.swayPhaseB);return e.spec.swayAmplitude*this.#f()*(n/1.5)}#m(e){return Math.max(0,1-(this.#o-e.lastRustleAt)/i_)}#h(e,t,n,r){let i=this.#p(e),a=this.#o/1e3;for(let o of e.fronds)this.#g(o,e,t,i,a,n,r)}#g(e,t,n,r,i,a,o){let[s,c]=p_(e,a),l=m_(e),u=this.#m(e),d=Math.cos(e.angle),f=Math.sin(e.angle),p=-f,m=d,h=Math.sin(i*e.swaySpeed+e.swayPhase),g=u>0?u*1.5*Math.sin(this.#o*.02+e.swayPhase):0,_=r*(.6+.4*h)+h*.5*t.spec.swayAmplitude+g,v=e.curl*l*.35,y=s+d*l*.55+p*v*.5+_,b=c+f*l*.55+m*v*.5,x=s+d*l+p*v+_*1.7,S=c+f*l+m*v,C=l*2,w=s,T=c;for(let t=1;t<=C;t+=1){let r=t/C,l=1-r,d=l*l*s+2*l*r*y+r*r*x,f=l*l*c+2*l*r*b+r*r*S,p=d-w,m=f-T;if(w=d,T=f,this.#v(a,Math.round(d),Math.round(f),this.#_(n,__(p,m),.85,.35+.4*u,u,!1,o)),t%2!=0)continue;let h=Math.atan2(m,p),g=.95+.25*Math.sin(i*1.3+e.leafletPhase+t*.6)*(1+u),_=S_(2+Math.round(4*l),2,6);for(let r of u_){let i=h+r*g,s=Math.cos(i),c=Math.sin(i);for(let i=1;i<=_;i+=1){let p=Math.round(d+s*i),m=Math.round(f+c*i*.6),h=b_(e.glyphSeed,t*2+r,i),g=1-i/(_+1),v=C_(h%97/97*.5+l*.4+.5*u,0,1),y=i===1,b=y?h&1?`▒`:`▓`:v_(s,c,h);this.#v(a,p,m,this.#_(n,b,g,v,u,!y,o))}}}}#_(e,t,n,r,i,a,o){if(e===0)return{char:t,foreground:G(o.background,o.muted,.3+.3*n+.15*i)};if(e===1){let e=G(o.muted,o.success,.35+.65*n);return{char:t,foreground:G(o.background,e,.6+.15*n+.2*i)}}let s=G(G(o.success,o.accent,r*.85),o.text,s_);return a&&r>.7?{char:t,foreground:s,bold:!0}:{char:t,foreground:s}}#v(e,t,n,r){t<0||t>=e.width||n<0||n>=e.height||(this.#u[n][t]=r)}#y(e){(this.#u.length!==e.height||(this.#u[0]?.length??-1)!==e.width)&&(this.#u=Array.from({length:e.height},()=>Array(e.width)));for(let e of this.#u)e.fill(void 0)}#b(e){let t=this.#n;t?.column===e.column&&t.row===e.row&&t.width===e.width&&t.height===e.height||(this.#n={...e})}#x(){return this.#e=Math.imul(this.#e,1664525)+1013904223>>>0,this.#e/4294967296}};function p_(e,t){let n=t.width-1,r=t.height-1;switch(e.edge){case 0:return[e.anchorFraction*n,r];case 1:return[e.anchorFraction*n,0];case 2:return[0,e.anchorFraction*r];default:return[n,e.anchorFraction*r]}}function m_(e){return c_+Math.round(e.lengthFraction*l_)}function h_(e,t){let[n,r]=p_(e,t),i=m_(e),a=n+Math.cos(e.angle)*i,o=r+Math.sin(e.angle)*i,s=t.column,c=t.row;return[[s+n,c+r],[s+(n+a)/2,c+(r+o)/2],[s+a,c+o]]}function g_(e,t){let n=1/0,r=-1/0,i=1/0,a=-1/0;for(let[t,o]of e)n=Math.min(n,t),r=Math.max(r,t),i=Math.min(i,o),a=Math.max(a,o);return r+5>=t.column&&n-5<=t.column+t.width-1&&a+5>=t.row&&i-5<=t.row+t.height-1}function __(e,t){return Math.abs(e)<.4*Math.abs(t)?`│`:e*t>0?`╲`:`╱`}function v_(e,t,n){if(Math.abs(e)<.35)return n%3==0?`y`:n%3==1?`v`:`V`;let r=e*t>0;return n%3==0?r?`╲`:`╱`:r?`\\`:`/`}function y_(e,t){return e.column===t.column&&e.row===t.row&&e.width===t.width&&e.height===t.height}function b_(e,t,n){let r=(e^Math.imul(t+127,2654435761)^Math.imul(n+127,2246822507))>>>0;return r=Math.imul(r^r>>>15,739982445)>>>0,r=Math.imul(r^r>>>12,695872825)>>>0,(r^r>>>15)>>>0}function x_(e){if(!Number.isFinite(e.column)||!Number.isFinite(e.row)||!Number.isFinite(e.width)||!Number.isFinite(e.height))return;let t=Math.floor(e.width),n=Math.floor(e.height);if(!(t<=0||n<=0))return{column:Math.floor(e.column),row:Math.floor(e.row),width:t,height:n}}function S_(e,t,n){return Math.max(t,Math.min(n,Math.floor(w_(e,t))))}function C_(e,t,n){return Math.max(t,Math.min(n,e))}function w_(e,t){return typeof e==`number`&&Number.isFinite(e)?e:t}var T_=16.7,E_=48,D_=1500,O_=2,k_=.45,A_=.4,j_=4e4,M_=.9,N_=4,P_=1600,F_=12,I_=1,L_=6,R_=.055,z_=1/12,B_=.1,V_=.06,H_=3,U_=1200,W_=.03,G_=[`.`,`·`,`˙`],K_=new Set([`░`,`▒`,`▓`]),q_=class{#e;#t;#n;#r;#i;#a=0;#o=0;#s=[];#c=[];#l=[];#u=[];constructor(e={}){this.#e=(e.seed??1447120975)>>>0,this.#t=Math.max(0,$_(e.pointerLifetimeMs,D_))}setPointer(e,t=performance.now()){!Number.isFinite(e.column)||!Number.isFinite(e.row)||(this.#r={column:e.column,row:e.row,updatedAt:$_(t,performance.now())})}clearPointer(){this.#r=void 0}advance(e){let t=Z_(e.bounds);if(!t)return!1;this.#m(t);let n=$_(e.now,performance.now()),r=this.#i===void 0?T_:Math.min(E_,Math.max(0,n-this.#i));if(this.#i=n,r<=0)return!1;let i=r/T_;this.#a+=r;let a=this.#r&&n-this.#r.updatedAt<=this.#t?this.#r:void 0,o=t.width*B_,s=a?Q_(a.column-t.column-t.width/2,-o,o):0;this.#o+=(s-this.#o)*Math.min(1,V_*i);for(let e=0;e<this.#s.length;e+=1){let t=this.#s[e]-R_*i;for(;t<I_;)t+=L_;this.#s[e]=t}return!0}rasterizeCells(e,t){let n=Z_(e);if(!n)return this.#u=[],this.#u;this.#m(n);let{width:r,height:i}=n;this.#h(r,i);let a=J_(i),o=r/2+this.#o,s=Q_(r*A_/2,2,Math.max(2,r/2-1)),c=Math.max(2,s/O_),l=a+(1-(.65+.35*Math.sin(this.#a/j_*Math.PI*2+M_)))*c,u=Math.max(0,Math.ceil(l-c)),d=this.#a/P_;return this.#d(t,r,a,o,l,s),this.#f(t,r,a,o,l,s,c,u,d),this.#p(t,r,i,a,o),this.#u}inspect(){return{...this.#n?{bounds:{...this.#n},horizonRow:J_(this.#n.height)}:{},time:this.#a,parallax:this.#o,lineDepths:[...this.#s]}}#d(e,t,n,r,i,a){let o=G(e.danger,e.surface,.5),s=t=>{let r=n<=1?1:t/(n-1);return G(e.background,o,.45*r**1.6)};for(let e=0;e<n;e+=1){let n=s(e);for(let r=0;r<t;r+=1)this.#u[e][r]={char:`░`,foreground:n}}let c=Math.floor(this.#a/U_);for(let r=0;r<this.#l.length;r+=1){let i=this.#l[r];if(i<0||i>=n)continue;let a=G(s(i),e.muted,.45);for(let e=0;e<t;e+=1)((e+c+r*3)%7+7)%7>=5||(this.#u[i][e]={char:`─`,foreground:a})}for(let o of this.#c){if(o.row>=n||o.column<0||o.column>=t)continue;let c=o.column-r,l=(o.row-i)*O_;Math.hypot(c,l)<a*1.35||(this.#u[o.row][o.column]={char:G_[o.glyph]??G_[0],foreground:G(s(o.row),e.muted,.35+.45*o.brightness)})}}#f(e,t,n,r,i,a,o,s,c){let l=Math.max(1,n-1-s);for(let u=s;u<n;u+=1){let d=(i-u)/o;if(d>=1)continue;let f=a*Math.sqrt(Math.max(0,1-d*d));if(f<.35)continue;let p=n-u;if(Y_(p,c))continue;let m=Q_((u-s)/l,0,1),h=G(e.warning,e.danger,m),g=m<.4,_=u===s?`▀`:p>1&&Y_(p-1,c)?`▄`:`█`,v=Math.max(0,Math.ceil(r-f)),y=Math.min(t-1,Math.floor(r+f));for(let e=v;e<=y;e+=1){let t=Math.abs(e-r)>f-1.2,n=_===`█`&&t?`▓`:_;this.#u[u][e]={char:n,foreground:h,bold:g}}}}#p(e,t,n,r,i){if(r<n){let n=G(e.accent,e.danger,.4);for(let e=0;e<t;e+=1)this.#u[r][e]={char:`▄`,foreground:n}}let a=n-1-r;if(a<1)return;let o=Math.max(3,t*z_),s=Math.ceil(t/o)+1;for(let c=-s;c<=s;c+=1)for(let s=r+1;s<n;s+=1){let n=(s-r)/a,l=Math.round(i+c*o*n);if(l<0||l>=t)continue;let u=.15+.7*(1-n);this.#u[s][l]={char:X_(n),foreground:G(e.accent,e.background,u)}}for(let i of this.#s){let o=r+Math.max(1,Math.floor(a/i));if(o>=n)continue;let s=Q_(.1+.75*((i-I_)/L_),0,1),c=G(e.accent,e.background,s),l=G(c,e.text,.35),u=i<1.6,d=s>.6?`░`:s>.3?`▒`:`▄`;for(let e=0;e<t;e+=1){let t=this.#u[o][e];this.#u[o][e]=t&&K_.has(t.char)?{char:`█`,foreground:l,bold:u}:{char:d,foreground:c,bold:u}}}}#m(e){let t=this.#n;if(t?.width===e.width&&t.height===e.height){this.#n={...e};return}this.#n={...e};let n=J_(e.height);this.#s=Array.from({length:F_},(e,t)=>I_+(t+this.#g()*.3)*(L_/F_));let r=Math.max(1,n),i=Math.max(3,Math.round(e.width*r*W_));this.#c=Array.from({length:i},()=>({column:Math.floor(this.#g()*e.width),row:Math.floor(this.#g()*r),glyph:Math.floor(this.#g()*G_.length),brightness:this.#g()})),this.#l=Array.from({length:H_},()=>1+Math.floor(this.#g()*Math.max(1,r-2)))}#h(e,t){if(this.#u.length===t&&(this.#u[0]?.length??-1)===e){for(let e of this.#u)e.fill(void 0);return}this.#u=Array.from({length:t},()=>Array(e).fill(void 0))}#g(){return this.#e=Math.imul(this.#e,1664525)+1013904223>>>0,this.#e/4294967296}};function J_(e){return Q_(Math.round(e*k_),1,Math.max(1,e-2))}function Y_(e,t){let n=Math.max(0,2.4-e*.28);return n<=0?!1:((e+t)%N_+N_)%N_<n}function X_(e){return e<.33?`░`:e<.66?`▒`:`▓`}function Z_(e){if(!Number.isFinite(e.column)||!Number.isFinite(e.row)||!Number.isFinite(e.width)||!Number.isFinite(e.height))return;let t=Math.floor(e.width),n=Math.floor(e.height);if(!(t<=0||n<=0))return{column:Math.floor(e.column),row:Math.floor(e.row),width:t,height:n}}function Q_(e,t,n){return Math.max(t,Math.min(n,e))}function $_(e,t){return typeof e==`number`&&Number.isFinite(e)?e:t}var ev=Math.PI*2,tv=16.7,nv=48,rv=2,iv=3e3,av=150,ov=300,sv=6e3,cv=9e3,lv=200,uv=100,dv=5e3,fv=.08,pv=4,mv=2,hv=255,gv=.09,_v=0,vv=1,yv=2,bv=3,xv=4,Sv=5,Cv=6,wv=7,Tv=8,Ev=[[-.54,0],[-.47,.25],[-.36,.37],[-.26,.4],[-.15,.34],[-.05,.43],[.07,.39],[.19,.33],[.31,.3],[.45,.22],[.56,0]],Dv=[`◙`,`▣`,`⊟`,`o`],Ov=[`╪`,`╧`,`◙`,`▣`,`⊟`],kv=[`▓`,`▒`,`▣`,`▤`],Av=[`∙`,`˚`,`·`],jv=[`╱`,`╲`,`⟋`],Mv=[[1,0],[0,1],[-1,0],[0,-1]],Nv=class{#e;#t;#n;#r;#i;#a;#o;#s=0;#c=0;#l=0;#u;#d;#f=[];constructor(e={}){this.#e=(e.seed??1397445964)>>>0,this.#t=Math.max(0,Jv(e.pointerIdleMs,iv)),this.#n=this.#e}setPointer(e,t=performance.now()){!Number.isFinite(e.column)||!Number.isFinite(e.row)||(this.#a={column:e.column,row:e.row,updatedAt:Jv(t,performance.now())})}clearPointer(){this.#a=void 0}advance(e){let t=Kv(e.bounds);if(!t)return!1;this.#y(t);let n=Jv(e.now,performance.now()),r=this.#o===void 0?tv:Math.min(nv,Math.max(0,n-this.#o));return this.#o=n,r<=0?!1:(this.#s+=r,this.#p(t,n,r),this.#m(n),!0)}rasterizeCells(e,t){let n=Kv(e);if(!n)return this.#f=[],this.#f;this.#y(n);let r=this.#i;if(this.#v(n),!r)return this.#f;let i=this.#s/1e3,a=Math.sin(ev*this.#s/dv),o=1+fv*a,s=this.#u!==void 0,c=G(t.text,t.accent,.1),l=G(t.muted,t.border,.35),u=G(t.border,t.background,.45),d={char:`█`,foreground:G(t.background,t.border,.22)},f={char:`█`,foreground:G(t.background,t.muted,.05)},p={char:`█`,foreground:G(t.background,t.border,.11)},m={char:`█`,foreground:G(t.warning,t.text,.2),bold:!0},h={char:`▓`,foreground:G(t.background,t.muted,.08)},g={char:`▓`,foreground:G(u,t.background,.25)},_=G(t.text,t.muted,.28),v=G(t.background,t.muted,.22),y=.06+.05*(.5+.5*a);for(let e=0;e<r.height;e+=1){let n=this.#f[e];for(let b=0;b<r.width;b+=1){let x=e*r.width+b;switch(r.mask[x]){case vv:{let e=r.level[x]/250,i=e<.5?G(u,l,e/.5):G(l,c,(e-.5)/.5),o=Math.max(0,.5-e)*(.32+.14*a),s=o>0?G(i,t.background,o):i,d=r.overlayChar[x];n[b]=d===void 0?{char:Iv(e),foreground:s}:{char:d,foreground:G(s,t.background,.5)};break}case yv:n[b]=d;break;case bv:n[b]=s?g:f;break;case xv:n[b]=s?g:p;break;case Sv:n[b]=s?g:m;break;case Cv:n[b]=h;break;case Tv:n[b]={char:`▓`,foreground:G(t.background,t.muted,y)};break;case wv:{let e=r.level[x]/250;n[b]={char:e>.5?`█`:e>.24?`▓`:`▒`,foreground:G(v,_,e)};break}default:n[b]=this.#h(r,x,t,o,i)}}}return s||this.#g(r,t),this.#f}inspect(){return{...this.#r?{bounds:{...this.#r}}:{},...this.#a?{pointer:{...this.#a}}:{},pupilOffset:{x:this.#c,y:this.#l},blinkActive:this.#u!==void 0,breathPhase:this.#s%dv/dv,tubeCount:this.#i?.tubes.length??0,eyes:(this.#i?.eyes??[]).map(e=>({column:e.cx,row:e.cy,socketRadius:e.socketRadius,irisRadius:e.irisRadius}))}}#p(e,t,n){let r=this.#i,i=this.#a,a=i!==void 0&&t-i.updatedAt<=this.#t,o=0,s=0;if(a&&r&&r.eyes.length>0){let t=e.column+(r.width-1)/2,n=e.row+r.eyes[0].cy,a=i.column-t,c=(i.row-n)*rv,l=Math.hypot(a,c);if(l>.001){let e=Math.min(1,l/r.gazeReach);o=a/l*e*r.maxPupilX,s=c/l*e*r.maxPupilX/rv}}let c=1-Math.exp(-n/(a?av:ov));this.#c+=(o-this.#c)*c,this.#l+=(s-this.#l)*c}#m(e){if(this.#u!==void 0&&this.#s>=this.#u&&(this.#u=void 0,this.#d=this.#s+sv+this.#x()*cv),this.#d??=this.#s+sv+this.#x()*cv,this.#u!==void 0||this.#s<this.#d)return;let t=this.#a;if(t!==void 0&&e-t.updatedAt<uv){this.#d=this.#s+uv*2;return}this.#u=this.#s+lv}#h(e,t,n,r,i){let a=e.overlayChar[t];if(a!==void 0){let o=e.overlayDepth[t]/255,s=G(n.border,n.muted,o),c=e.overlayTube[t];if(c>0){let l=Pv(e.tubes[c-1],e.overlayPos[t],i),u=G(n.background,s,Math.min(1,(.26+.4*o)*r));return l>0&&(u=G(u,n.accent,.65*l)),l>.75?{char:a,foreground:u,bold:!0}:{char:a,foreground:u}}let l=G(n.background,s,Math.min(1,(.24+.42*o)*r));return o>.85&&(l=G(l,n.accent,.3)),{char:a,foreground:l}}let o=e.level[t];if(o===hv)return;let s=o/250,c=G(n.border,n.muted,s);return{char:s<.55?`░`:`▒`,foreground:G(n.background,c,Math.min(1,(.14+.38*s)*r))}}#g(e,t){let n={char:`█`,foreground:G(t.background,t.border,.06)},r={char:`█`,foreground:G(t.text,t.warning,.08),bold:!0};for(let t of e.eyes){let i=Math.round(t.cy+this.#l),a=Math.round(t.cx+this.#c);this.#_(e,a,i,n),this.#_(e,a-1,i-1,r)||this.#_(e,a-1,i,r)}}#_(e,t,n,r){return t<0||t>=e.width||n<0||n>=e.height||e.mask[n*e.width+t]!==Sv?!1:(this.#f[n][t]=r,!0)}#v(e){(this.#f.length!==e.height||(this.#f[0]?.length??-1)!==e.width)&&(this.#f=Array.from({length:e.height},()=>Array(e.width)));for(let e of this.#f)e.fill(void 0)}#y(e){let t=this.#r;if(t?.column===e.column&&t.row===e.row&&t.width===e.width&&t.height===e.height)return;let n=t?.width!==e.width||t.height!==e.height;this.#r={...e},(n||!this.#i)&&(this.#i=this.#b(e.width,e.height))}#b(e,t){let n=Wv(this.#e,e,t),r=n===0?2654435769:n,i=()=>(r=Math.imul(r,1664525)+1013904223>>>0,r/4294967296),a=e*t,o=new Uint8Array(a),s=new Uint8Array(a),c=Array(a),l=new Int32Array(a),u=new Uint16Array(a),d=new Uint8Array(a),f=(e-1)/2,p=(t-1)/2,m=.62*Math.min(e,t*rv),h=Ev[0][0]*m,g=Ev[Ev.length-1][0]*m,_=.205*m,v=-.06*m,y=Math.max(2,.15*m),b=Math.max(2,.135*m),x=.2,S=Math.cos(x),C=Math.sin(x),w=Math.max(1.3,y*.34),T=-.3*m,E=-.205*m,ee=.05*m,te=.24*m,ne=Math.max(1.2,.09*m),re=.29*m,ie=.45*m,ae=.37*m,D=Math.max(3,.24*m),oe=Math.max(2.2,.052*m),se=Math.max(3,.16*m);for(let r=0;r<t;r+=1){let t=(r-p)*rv,i=Fv(t/m)*m;for(let a=0;a<e;a+=1){let l=r*e+a,u=a-f,d=i-Math.abs(u);if(d<=0){o[l]=_v,s[l]=Gv(n,a,r)<gv?hv:Math.floor(Gv(n,a+7919,r+104729)*251);continue}let p=Math.min(d,t-h,g-t);if(p<1){o[l]=yv;continue}let m=u<0?-1:1,x=u-m*_,ce=t-v,O=x*S-m*C*ce,le=m*C*x+ce*S,ue=Rv(O/y,le/b,2.6);if(ue<=1){o[l]=Math.hypot(u-m*_,t-v)<=w?Sv:bv;continue}if(ue<=1.18){o[l]=xv;continue}if(t>=T&&t<=E){o[l]=Tv;continue}if(t>=ee&&t<=te){let e=(t-ee)/(te-ee),n=ne*zv(e);if(Math.abs(u)<=n&&!(Math.abs(u)<.7&&e>.55)){o[l]=Cv;continue}}if(t>=re&&t<=ie&&Math.abs(u)<=D){o[l]=wv;let e=1-Math.abs(u)/D*.45;if(Math.abs(t-ae)<.6)s[l]=6;else{let t=Bv(u+D,oe),n=t<.85||t>oe-.85;s[l]=Math.round(n?28*e:150*e+55)}continue}o[l]=vv;let de=Vv(p/se);if(s[l]=Math.round(de*250),de>.35){let e=Gv(n,a+3301,r+61003);e<.045?c[l]=Av[Math.floor(Gv(n,a+811,r+907)*Av.length)]:e<.062&&(c[l]=jv[Math.floor(Gv(n,a+211,r+509)*jv.length)])}}}let ce=(n,r)=>n>=0&&n<e&&r>=0&&r<t&&o[r*e+n]===_v,O=(t,n,r,i,a,o)=>{let s=n*e+t;c[s]=c[s]!==void 0&&l[s]>0?`╬`:r,l[s]=i+1,u[s]=Math.min(65535,a),d[s]=o},le=[],ue=qv(Math.round(a/110),8,64);for(let n=0;n<ue;n+=1){let n=-1,r=-1;for(let a=0;a<24;a+=1){let a=Math.floor(i()*e),o=Math.floor(i()*t);if(ce(a,o)&&c[o*e+a]===void 0){n=a,r=o;break}}if(n<0)continue;let a=i()<.55,o=a&&i()<.5,s=i()<.2,l=i()<.5?0:2,u=i()<.5?1:3,d=Math.floor(80+i()*175),f=le.length,p=s?l:Math.floor(i()*4),m=s?6+Math.floor(i()*6):2+Math.floor(i()*3),h=0,g=!0,_=(t,n,r)=>{if(O(t,n,Hv(r,a),f,h,d),!a)return;let i=r%2==0?0:1,s=+(r%2==0),l=r%2==0?`═`:`║`,u=o?2:1;for(let r=1;r<=u;r+=1){let a=t+i*r,o=n+s*r;ce(a,o)&&c[o*e+a]===void 0&&O(a,o,l,f,h,d)}};_(n,r,p);for(let e=0;e<m&&g;e+=1){let t=s?1+Math.floor(i()*2):6+Math.floor(i()*20);for(let e=0;e<t;e+=1){let[e,t]=Mv[p];if(!ce(n+e,r+t)){O(n,r,Dv[Math.floor(i()*Dv.length)],f,h,d),g=!1;break}n+=e,r+=t,h+=1,_(n,r,p)}if(!g)break;if(e<m-1){let e=s?p===l?u:l:p%2==0?i()<.5?1:3:i()<.5?0:2;O(n,r,Uv(p,e),f,h,d),p=e}else O(n,r,Dv[Math.floor(i()*Dv.length)],f,h,d)}let v=h+1,y=i()<.5?[i()*v]:[i()*v,i()*v];le.push({length:v,speed:(.7+i()*.6)*(i()<.5?-1:1),waves:y})}let de=qv(Math.round(a/80),5,96);for(let n=0;n<de;n+=1){let n=Math.floor(i()*Math.max(1,e-3)),r=Math.floor(i()*Math.max(1,t-2)),a=2+Math.floor(i()*2);for(let t=r;t<r+2;t+=1)for(let r=n;r<n+a;r+=1){if(!ce(r,t))continue;let n=t*e+r;c[n]===void 0&&(c[n]=kv[Math.floor(i()*kv.length)],d[n]=Math.floor(60+i()*195))}}for(let r=0;r<t;r+=1)for(let i=0;i<e;i+=1){let a=r*e+i;o[a]!==_v||c[a]!==void 0||(Lv(o,e,t,i+1,r)||Lv(o,e,t,i-1,r)||Lv(o,e,t,i,r+1)||Lv(o,e,t,i,r-1))&&Gv(n,i+5003,r+2011)<.34&&(c[a]=Ov[Math.floor(Gv(n,i+17,r+29)*Ov.length)],d[a]=230)}let fe=p+v/rv;return{width:e,height:t,mask:o,level:s,overlayChar:c,overlayTube:l,overlayPos:u,overlayDepth:d,tubes:le,eyes:[{cx:f-_,cy:fe,socketRadius:y,irisRadius:w},{cx:f+_,cy:fe,socketRadius:y,irisRadius:w}],gazeReach:Math.max(4,e*.3),maxPupilX:Math.max(.8,w-1.4)}}#x(){return this.#n=Math.imul(this.#n,1664525)+1013904223>>>0,this.#n/4294967296}};function Pv(e,t,n){if(e.length<2)return 0;let r=n*pv*e.speed,i=0;for(let n of e.waves){let a=((n+r)%e.length+e.length)%e.length,o=Math.abs(t-a),s=Math.min(o,e.length-o);s<=mv&&(i=Math.max(i,1-s/2.5))}return i}function Fv(e){let t=Ev;if(e<=t[0][0]||e>=t[t.length-1][0])return 0;for(let n=0;n<t.length-1;n+=1){let r=t[n],i=t[n+1];if(e>=r[0]&&e<=i[0])return r[1]+(i[1]-r[1])*zv((e-r[0])/(i[0]-r[0]))}return 0}function Iv(e){return e<.38?`░`:e<.6?`▒`:e<.82?`▓`:`█`}function Lv(e,t,n,r,i){return r>=0&&r<t&&i>=0&&i<n&&e[i*t+r]===yv}function Rv(e,t,n){return(Math.abs(e)**+n+Math.abs(t)**+n)**(1/n)}function zv(e){let t=Math.min(1,Math.max(0,e));return t*t*(3-2*t)}function Bv(e,t){return(e%t+t)%t}function Vv(e){return Math.min(1,Math.max(0,e))}function Hv(e,t){return e%2==0?t?`═`:`─`:t?`║`:`│`}function Uv(e,t){switch(1<<(e+2)%4|1<<t){case 3:return`╔`;case 9:return`╚`;case 6:return`╗`;case 12:return`╝`;default:return`╬`}}function Wv(e,t,n){let r=(e^Math.imul(t+40503,2246822507)^Math.imul(n+32586,3266489909))>>>0;return r=Math.imul(r^r>>>15,739982445)>>>0,r=Math.imul(r^r>>>12,695872825)>>>0,(r^r>>>15)>>>0}function Gv(e,t,n){return Wv(e,t,n)/4294967296}function Kv(e){if(!Number.isFinite(e.column)||!Number.isFinite(e.row)||!Number.isFinite(e.width)||!Number.isFinite(e.height))return;let t=Math.floor(e.width),n=Math.floor(e.height);if(!(t<=0||n<=0))return{column:Math.floor(e.column),row:Math.floor(e.row),width:t,height:n}}function qv(e,t,n){return Math.max(t,Math.min(n,Math.floor(Jv(e,t))))}function Jv(e,t){return typeof e==`number`&&Number.isFinite(e)?e:t}var Yv=Math.PI*2,Xv=16.7,Zv=48,Qv=1600,$v=.16,ey=.34,ty=18,ny=70,ry=6e3,iy=6e5,ay=8e3,oy=25e3,sy=5e4,cy=12e3,ly=6e4,uy=14e3,dy=.055,fy=.01,py=.007,my=3,hy=1,gy=900,_y=18,vy=1400,yy=.055,by=40,xy=40,Sy=1,Cy=[`░`,`▒`,`▓`,`█`],wy=`▒`,Ty=[`<`,`>`,`v`,`^`],Ey=[`.`,`:`,`+`,`*`],Dy=`o`,Oy=`@`,ky=[`*`,`+`,`x`,`'`,`.`],Ay=class{#e;#t;#n;#r=[];#i=new Uint8Array;#a=[];#o;#s;#c;#l;#u=0;#d=0;#f=[];#p=[];constructor(e={}){this.#e=Math.min(3,Math.max(.25,e.density??1)),this.#t=(e.seed??1230395697)>>>0}setPointer(e,t=performance.now()){!Number.isFinite(e.column)||!Number.isFinite(e.row)||(this.#s={column:e.column,row:e.row,updatedAt:Fy(t,0)})}clearPointer(){this.#s=void 0}advance(e){let t=Iy(e.bounds);if(!t)return!1;this.#m(t);let n=Fy(e.now,performance.now()),r=this.#l===void 0?Xv:Math.min(Zv,Math.max(0,n-this.#l));if(this.#l=n,r<=0)return!1;let i=r/Xv;this.#u+=r;let a=this.#s&&n-this.#s.updatedAt<=Qv?this.#s:void 0;this.#c=a?{column:a.column-t.column,row:a.row-t.row}:void 0;let o=this.#T(e,t);this.#d+=r;let s=this.#d>=gy;s&&(this.#d=0);for(let e=this.#r.length-1;e>=0;--e){let n=this.#r[e];n.ageMs+=r,this.#_(n,t,i)&&(o=!0),this.#v(n,r,s)&&(o=!0),s&&n.ageMs>iy&&(n.cells.shift(),o=!0,n.cells.length===0&&this.#r.splice(e,1))}for(this.#b(r,i,t)&&(o=!0);this.#u>=ry;)this.#u-=ry,this.#S(t)&&(o=!0);return o}rasterizeCells(e,t){let n=Iy(e);if(!n)return[];this.#m(n);let{width:r,height:i}=n;this.#h(r,i);for(let e of this.#p)e.fill(void 0);let a=G(t.background,t.success,.45),o=G(t.success,t.text,.3),s=[t.accent,t.warning,t.danger,G(t.accent,t.text,.4)];for(let e of this.#r)for(let n of e.cells){if(n.x<0||n.x>=r||n.y<0||n.y>=i)continue;let e=Math.min(1,n.ageMs/(sy*1.2)),c=G(a,o,.2+e*.6);if(n.ageMs>=uy){let e=Ny(n.heading+Yv/4),t=n.x+e.dx,o=n.y+e.dy;t>=0&&t<r&&o>=0&&o<i&&!this.#p[o][t]&&(this.#p[o][t]={char:wy,foreground:G(a,c,.55)})}let l=Math.min(Cy.length-1,Math.floor(e*Cy.length));if(this.#p[n.y][n.x]={char:Cy[l],foreground:c},n.ornament===`leaf`)this.#p[n.y][n.x]={char:Ty[n.seed%Ty.length],foreground:G(c,t.success,.5)};else if(n.ornament===`flower`){let e=Math.min(1,n.bloomMs/cy),t=s[n.hue%s.length];this.#p[n.y][n.x]={char:Ey[My(n.bloomMs)],foreground:G(o,t,.3+e*.7),...e>.6?{bold:!0}:{}}}else if(n.ornament===`fruit`){let e=(n.fruitMs??0)>=ly,t=s[(n.hue+2)%s.length];this.#p[n.y][n.x]={char:e?Oy:Dy,foreground:e?t:G(c,t,.4),...e?{bold:!0}:{}}}}for(let e of this.#f){let t=Math.round(e.x),n=Math.round(e.y);if(t<0||t>=r||n<0||n>=i)continue;let o=Math.min(1,e.lifeMs/vy),c=Math.min(ky.length-1,Math.floor(o*ky.length)),l=s[e.hue%s.length];this.#p[n][t]={char:ky[c],foreground:G(l,a,o*.7),...o<.5?{bold:!0}:{}}}return this.#p}inspect(){return{strands:this.#r.map(e=>({cells:e.cells.map(e=>({x:e.x,y:e.y,ageMs:e.ageMs,ornament:e.ornament,openness:Math.min(1,e.bloomMs/cy),ripe:e.ornament===`fruit`&&(e.fruitMs??0)>=ly})),ageMs:e.ageMs,growing:e.cells.length<e.targetLength})),obstacles:this.#a.map(e=>({...e})),confetti:this.#f.length,ripeFruit:this.#r.reduce((e,t)=>e+t.cells.filter(e=>e.ornament===`fruit`&&(e.fruitMs??0)>=ly).length,0)}}#m(e){let t=this.#n;if(t?.width===e.width&&t.height===e.height){this.#n={...e};return}this.#n={...e},this.#i=new Uint8Array(e.width*e.height),this.#a=[],this.#o=void 0,this.#r=[],this.#f=[];let n=Py(Math.round((4+e.width*e.height/380)*this.#e),3,by);for(let t=0;t<n;t+=1)this.#g(e)}#h(e,t){this.#p.length===t&&this.#p[0]?.length===e||(this.#p=Array.from({length:t},()=>Array(e).fill(void 0)))}#g(e,t){let{width:n,height:r}=e,i,a,o;if(t)i=t.x,a=t.y,o=this.#E()*Yv;else{let e=Math.floor(this.#E()*4);e===0?(i=Math.floor(this.#E()*n),a=0,o=Yv/4):e===1?(i=n-1,a=Math.floor(this.#E()*r),o=Yv/2):e===2?(i=Math.floor(this.#E()*n),a=r-1,o=-Yv/4):(i=0,a=Math.floor(this.#E()*r),o=0)}if(!this.#w(i,a,e))return!1;let s=Math.floor(this.#E()*4);return this.#r.push({cells:[{x:i,y:a,heading:o,ageMs:0,ornament:`none`,bloomMs:0,hue:s,seed:Math.floor(this.#E()*1024)}],heading:o,curl:(this.#E()-.5)*ey,curlHoldCells:3+Math.floor(this.#E()*8),targetLength:ty+Math.floor(this.#E()*ny),growthAccumulator:0,ageMs:0,hue:s}),!0}#_(e,t,n){if(e.cells.length>=e.targetLength)return!1;e.growthAccumulator+=$v*n;let r=!1;for(;e.growthAccumulator>=1;){--e.growthAccumulator;let n=e.cells[e.cells.length-1];--e.curlHoldCells,e.curlHoldCells<=0&&(e.curl=(this.#E()-.5)*ey*2,e.curlHoldCells=3+Math.floor(this.#E()*8)),e.heading,e.heading+=e.curl;let i=Ny(e.heading),a=n.x+i.dx,o=n.y+i.dy;if(!this.#w(a,o,t)){let i=!1;for(let r of[Yv/8,-Yv/8,Yv/4,-Yv/4]){let s=Ny(e.heading+r);if(this.#w(n.x+s.dx,n.y+s.dy,t)){e.heading+=r,a=n.x+s.dx,o=n.y+s.dy,i=!0;break}}if(!i)return e.targetLength=e.cells.length,r}e.cells.push({x:a,y:o,heading:e.heading,ageMs:0,ornament:`none`,bloomMs:0,hue:e.hue,seed:Math.floor(this.#E()*1024)}),r=!0}return r}#v(e,t,n){let r=!1;for(let i=0;i<e.cells.length;i+=1){let a=e.cells[i];if(a.ageMs+=t,a.ornament===`flower`&&a.bloomMs<cy){let e=My(a.bloomMs);a.bloomMs=Math.min(cy,a.bloomMs+t),My(a.bloomMs)!==e&&(r=!0)}if(a.fruitMs!==void 0){let e=a.fruitMs>=ly;a.fruitMs+=t,!e&&a.fruitMs>=ly&&(r=!0)}if(!n)continue;let o=Math.min(1,a.ageMs/(sy*1.5)),s=this.#E();if(a.ornament===`none`){if(a.ageMs<ay||s>dy*(.35+o)||this.#y(e,i,jy(a.ageMs)))continue;a.ornament=`leaf`,r=!0}else if(a.ornament===`leaf`&&a.ageMs>=oy){if(s>fy*(.35+o))continue;a.ornament=`flower`,a.bloomMs=0,r=!0}else if(a.ornament===`flower`&&a.bloomMs>=cy&&a.ageMs>=sy){if(s>py*(.35+o))continue;a.ornament=`fruit`,a.fruitMs=0,r=!0}}return r}#y(e,t,n){let r=Math.max(0,t-n),i=Math.min(e.cells.length-1,t+n);for(let n=r;n<=i;n+=1)if(n!==t&&e.cells[n].ornament!==`none`)return!0;return!1}#b(e,t,n){if(this.#f.length===0)return!1;for(let r=this.#f.length-1;r>=0;--r){let i=this.#f[r];i.lifeMs+=e,i.x+=i.vx*t,i.y+=i.vy*t,i.vy+=yy*t,(i.lifeMs>=vy||i.x<-2||i.y<-2||i.x>n.width+2||i.y>n.height+2)&&this.#f.splice(r,1)}return!0}pick(e,t,n=performance.now()){let r=this.#n;if(!r)return!1;let i=Math.floor(e-r.column),a=Math.floor(t-r.row);for(let e of this.#r)for(let t of e.cells)if(!(t.x!==i||t.y!==a)&&!(t.ornament!==`fruit`||(t.fruitMs??0)<ly))return t.ornament=`none`,t.fruitMs=void 0,t.bloomMs=0,this.#x(i,a,t.hue),this.#l=Fy(n,this.#l??0),!0;return!1}#x(e,t,n){for(let r=0;r<_y;r+=1){let i=r/_y*Yv+this.#E()*.4,a=.25+this.#E()*.75;this.#f.push({x:e,y:t,vx:Math.cos(i)*a,vy:Math.sin(i)*a-.35,lifeMs:0,hue:(n+r)%4})}}#S(e){let t=Py(Math.round((4+e.width*e.height/380)*this.#e),3,by);if(this.#r.length>=t)return!1;let n=new Set;for(let t of this.#r)for(let r of t.cells)n.add(r.y*e.width+r.x);for(let t=0;t<xy;t+=1){let t=Math.floor(this.#E()*e.width),r=Math.floor(this.#E()*e.height);if(this.#w(t,r,e)&&!this.#C(t,r,e,n)&&this.#g(e,{x:t,y:r}))return!0}return!1}#C(e,t,n,r){for(let i=-3;i<=3;i+=1)for(let a=-3;a<=3;a+=1){let o=e+a,s=t+i;if(!(o<0||s<0||o>=n.width||s>=n.height)&&r.has(s*n.width+o))return!0}return!1}#w(e,t,n){return e<0||t<0||e>=n.width||t>=n.height?!1:this.#i[t*n.width+e]!==1}#T(e,t){let n=[];for(let r of e.obstacles??[]){let e=Iy(r);e&&n.push({column:e.column-t.column,row:e.row-t.row,width:e.width,height:e.height})}let r=n.map(e=>`${e.column},${e.row},${e.width},${e.height}`).join(`;`);if(r===this.#o)return!1;this.#o=r,this.#a=n;let{width:i,height:a}=t;this.#i.length===i*a?this.#i.fill(0):this.#i=new Uint8Array(i*a);for(let e of this.#a){let t=Math.max(0,e.column-Sy),n=Math.max(0,e.row-Sy),r=Math.min(i-1,e.column+e.width-1+Sy),o=Math.min(a-1,e.row+e.height-1+Sy);if(!(r<t||o<n))for(let e=n;e<=o;e+=1)this.#i.fill(1,e*i+t,e*i+r+1)}for(let e=this.#r.length-1;e>=0;--e){let n=this.#r[e],r=n.cells.findIndex(e=>!this.#w(e.x,e.y,t));r<0||(n.cells.length=r,n.targetLength=Math.min(n.targetLength,r),n.cells.length===0&&this.#r.splice(e,1))}return!0}#E(){return this.#t=Math.imul(this.#t,1664525)+1013904223>>>0,this.#t/4294967296}};function jy(e){return e>=sy?hy:e>=oy?2:my}function My(e){return Math.min(Ey.length-1,Math.floor(e/cy*Ey.length))}function Ny(e){let t=(e%Yv+Yv)%Yv;switch(Math.round(t/(Yv/8))%8){case 0:return{dx:1,dy:0};case 1:return{dx:1,dy:1};case 2:return{dx:0,dy:1};case 3:return{dx:-1,dy:1};case 4:return{dx:-1,dy:0};case 5:return{dx:-1,dy:-1};case 6:return{dx:0,dy:-1};default:return{dx:1,dy:-1}}}function Py(e,t,n){return Number.isFinite(e)?Math.max(t,Math.min(n,Math.round(e))):t}function Fy(e,t){return Number.isFinite(e)?e:t}function Iy(e){if(!Number.isFinite(e.column)||!Number.isFinite(e.row)||!Number.isFinite(e.width)||!Number.isFinite(e.height))return;let t=Math.floor(e.width),n=Math.floor(e.height);if(!(t<=0||n<=0))return{column:Math.floor(e.column),row:Math.floor(e.row),width:t,height:n}}var Ly=16.7,Ry=48,zy=1400,By=6,Vy=.9,Hy=.42,Uy=.986,Wy=.018,Gy=.05,Ky=.07,qy=.1,Jy=[`.`,`:`,`*`,`░`,`▒`,`▓`,`█`],Yy=class{#e;#t;#n;#r=0;#i=0;#a=new Float32Array;#o=new Float32Array;#s=[];#c;#l;#u;#d=[];constructor(e={}){this.#e=Math.min(1.6,Math.max(.3,e.intensity??1)),this.#t=(e.seed??1179210309)>>>0}setPointer(e,t=performance.now()){!Number.isFinite(e.column)||!Number.isFinite(e.row)||(this.#l={column:e.column,row:e.row,updatedAt:Qy(t,0)})}clearPointer(){this.#l=void 0}advance(e){let t=$y(e.bounds);if(!t||(this.#f(t),this.#r===0||this.#i===0))return!1;let n=Qy(e.now,performance.now()),r=this.#u===void 0?Ly:Math.min(Ry,Math.max(0,n-this.#u));if(this.#u=n,r<=0)return!1;let i=n/1e3;return this.#_(e,t),this.#m(i),this.#g(t,n),this.#v(),!0}rasterizeCells(e,t){let n=$y(e);if(!n)return[];this.#f(n);let r=this.#r,i=this.#i;this.#p(r,i);let a=G(t.background,t.danger,.85),o=t.warning,s=G(t.warning,t.text,.7);for(let e=0;e<i;e+=1){let t=this.#d[e];for(let n=0;n<r;n+=1){let i=this.#a[e*r+n];if(i<qy){t[n]=void 0;continue}t[n]={char:Jy[Math.min(Jy.length-1,Math.floor(i*Jy.length))],foreground:Xy(i,a,o,s),...i>.82?{bold:!0}:{}}}}return this.#d}inspect(){let e=this.#a.length,t=0,n=0;for(let r=0;r<e;r+=1){let e=this.#a[r];t+=e,e>n&&(n=e)}let r=0;if(this.#i>0){let e=(this.#i-1)*this.#r;for(let t=0;t<this.#r;t+=1)r+=this.#a[e+t]}return{bounds:this.#n?{...this.#n}:void 0,pointer:this.#l?{column:this.#l.column,row:this.#l.row}:void 0,meanHeat:e>0?t/e:0,maxHeat:n,baseHeat:this.#r>0?r/this.#r:0}}#f(e){if(this.#n?.width===e.width&&this.#n.height===e.height){this.#n={...e};return}this.#n={...e},this.#r=e.width,this.#i=e.height,this.#a=new Float32Array(this.#r*this.#i),this.#o=new Float32Array(this.#r*this.#i),this.#c=void 0,this.#u=void 0}#p(e,t){this.#d.length===t&&this.#d[0]?.length===e||(this.#d=Array.from({length:t},()=>Array(e).fill(void 0)))}#m(e){let t=this.#r,n=this.#i,r=this.#a,i=this.#o,a=Math.floor(n*(1-Hy));for(let o=0;o<n;o+=1){let s=o+1<n?(o+1)*t:-1,c=o*t;for(let l=0;l<t;l+=1){let u;if(s<0)u=0;else{let e=l>0?r[s+l-1]:r[s+l],n=l+1<t?r[s+l+1]:r[s+l];u=Uy*(.42*r[s+l]+.14*e+.14*n+.3*r[c+l])}let d=Wy+Gy*this.#y(l,o,e),f=this.#h(l,o,n,a,e);i[c+l]=Zy(u+f-d)}}this.#a=i,this.#o=r}#h(e,t,n,r,i){let a=.42+.3*Math.sin(e*.28+i*1.7)+.16*Math.sin(e*.11-i*1.1)+.12*Math.sin(e*.5+t*.2+i*2.6),o=.4+.6*(.5+.5*Math.sin(e*.6-i*3.1));if(t>=r){let e=(t-r)/Math.max(1,n-r);return this.#e*(.32+.5*e)*Zy(a)*o}return Ky*this.#e*Zy(a)*Zy(a)}#g(e,t){let n=this.#l;if(!n)return;let r=t-n.updatedAt;if(r>zy)return;let i=Vy*(1-r/zy),a=n.column-e.column,o=n.row-e.row,s=this.#r,c=this.#i,l=Math.max(0,Math.floor(a-By)),u=Math.min(s-1,Math.ceil(a+By)),d=Math.max(0,Math.floor(o-By)),f=Math.min(c-1,Math.ceil(o+By));for(let e=d;e<=f;e+=1)for(let t=l;t<=u;t+=1){let n=Math.hypot(t-a,e-o);if(n>By)continue;let r=1-n/By,c=e*s+t;this.#a[c]=Zy(this.#a[c]+i*r*r)}}#_(e,t){let n=[];for(let r of e.obstacles??[]){let e=$y(r);e&&n.push({column:e.column-t.column,row:e.row-t.row,width:e.width,height:e.height})}let r=n.map(e=>`${e.column},${e.row},${e.width},${e.height}`).join(`;`);r!==this.#c&&(this.#c=r,this.#s=n)}#v(){if(this.#s.length===0)return;let e=this.#r,t=this.#i;for(let n of this.#s){let r=Math.max(0,n.column),i=Math.max(0,n.row),a=Math.min(e-1,n.column+n.width-1),o=Math.min(t-1,n.row+n.height-1);for(let t=i;t<=o;t+=1)this.#a.fill(0,t*e+r,t*e+a+1)}}#y(e,t,n){let r=Math.floor(n*20),i=Math.imul(e+2654435769,2246822507)^Math.imul(t+374761393,3266489909)^Math.imul(r+this.#t,668265263);return i=Math.imul(i^i>>>15,1415530769),(i>>>0)%1e5/1e5}};function Xy(e,t,n,r){return e<.55?G(t,n,e/.55):e<.82?G(n,r,(e-.55)/.27):r}function Zy(e){return e<0?0:e>1?1:e}function Qy(e,t){return Number.isFinite(e)?e:t}function $y(e){if(!Number.isFinite(e.column)||!Number.isFinite(e.row)||!Number.isFinite(e.width)||!Number.isFinite(e.height))return;let t=Math.floor(e.width),n=Math.floor(e.height);if(!(t<=0||n<=0))return{column:Math.floor(e.column),row:Math.floor(e.row),width:t,height:n}}async function eb(){}var tb,nb;function rb(){return tb??=(async()=>{try{await eb();let e=typeof navigator>`u`?void 0:await navigator.gpu?.requestAdapter(`Bun`in globalThis?{powerPreference:`high-performance`}:void 0);if(!e)return;let t=await e.requestDevice();nb=t;try{t.addEventListener(`uncapturederror`,e=>{e.error?.message})}catch{}return t.lost.then(e=>{nb===t&&(`device lost: ${e?.reason??`unknown`} ${e?.message??``}`.trim(),tb=void 0,nb=void 0)}).catch(()=>{nb===t&&(tb=void 0,nb=void 0)}),t}catch(e){`${e instanceof Error?e.message:String(e)}`;return}})(),tb}var ib=16.7,ab=48,ob=1500,sb=1.85,cb=.055,lb=.012,ub=4,db=.08,fb=.995,q=9,pb=[0,1,0,-1,0,1,-1,-1,1],mb=[0,0,1,0,-1,1,1,-1,-1],hb=[4/9,1/9,1/9,1/9,1/9,1/36,1/36,1/36,1/36],gb=[0,3,4,1,2,7,8,5,6],_b=[` `,`.`,`,`,`;`,`:`,`~`,`=`,`#`],vb=[`-`,`/`,`|`,`\\`,`-`,`/`,`|`,`\\`],yb=`
struct Params {
  width: u32,
  height: u32,
  omega: f32,
  inflow_vy: f32,
  perturbation: f32,
  frame: u32,
  damping: f32,
  _pad: u32,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> fIn: array<f32>;
@group(0) @binding(2) var<storage, read_write> fOut: array<f32>;
@group(0) @binding(3) var<storage, read> obs: array<u32>;
@group(0) @binding(4) var<storage, read_write> macro_out: array<f32>;

const ex = array<i32, 9>(0, 1, 0, -1, 0, 1, -1, -1, 1);
const ey = array<i32, 9>(0, 0, 1, 0, -1, 1, 1, -1, -1);
const wt = array<f32, 9>(0.44444444, 0.11111111, 0.11111111, 0.11111111, 0.11111111,
                          0.02777778, 0.02777778, 0.02777778, 0.02777778);
const opp = array<u32, 9>(0u, 3u, 4u, 1u, 2u, 7u, 8u, 5u, 6u);

fn feq(rho: f32, ux: f32, uy: f32, i: u32) -> f32 {
  let eu = f32(ex[i]) * ux + f32(ey[i]) * uy;
  let usq = ux * ux + uy * uy;
  return wt[i] * rho * (1.0 + 3.0 * eu + 4.5 * eu * eu - 1.5 * usq);
}

fn hash(seed: u32) -> f32 {
  var h = seed;
  h = h ^ (h >> 16u);
  h = h * 0x45d9f3bu;
  h = h ^ (h >> 16u);
  return f32(h & 0xFFFFu) / 65536.0 - 0.5;
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let x = id.x;
  let y = id.y;
  if (x >= params.width || y >= params.height) { return; }
  let W = params.width;
  let idx = y * W + x;
  let base = idx * 9u;

  // Pull streaming: gather distributions from source cells.
  var f: array<f32, 9>;
  for (var i = 0u; i < 9u; i = i + 1u) {
    let sx = i32(x) - ex[i];
    let sy = i32(y) - ey[i];
    if (sx >= 0 && sx < i32(W) && sy >= 0 && sy < i32(params.height)) {
      f[i] = fIn[u32(sy) * W * 9u + u32(sx) * 9u + i];
    } else if (sy < 0) {
      // Top boundary: inflow with perturbation.
      let pert = params.perturbation * hash(x + params.frame * 131u);
      f[i] = feq(1.0, pert, params.inflow_vy, i);
    } else {
      f[i] = fIn[base + i];
    }
  }

  // Obstacle bounce-back.
  if (obs[idx] != 0u) {
    for (var i = 0u; i < 9u; i = i + 1u) {
      fOut[base + opp[i]] = f[i];
    }
    macro_out[idx * 3u] = 1.0;
    macro_out[idx * 3u + 1u] = 0.0;
    macro_out[idx * 3u + 2u] = 0.0;
    return;
  }

  // Macroscopic density and velocity.
  var rho: f32 = 0.0;
  var ux: f32 = 0.0;
  var uy: f32 = 0.0;
  for (var i = 0u; i < 9u; i = i + 1u) {
    rho = rho + f[i];
    ux = ux + f32(ex[i]) * f[i];
    uy = uy + f32(ey[i]) * f[i];
  }
  if (rho > 0.001) { ux = ux / rho; uy = uy / rho; }

  // Stability clamp. Use negated form so NaN fails the check too.
  if (!(rho >= 0.5 && rho <= 1.5 && abs(ux) < 1.0 && abs(uy) < 1.0)) {
    rho = 1.0;
    ux = 0.0;
    uy = params.inflow_vy;
    // Hard reset to equilibrium when the cell is invalid.
    for (var j = 0u; j < 9u; j = j + 1u) {
      fOut[base + j] = feq(rho, ux, uy, j);
    }
    macro_out[idx * 3u] = rho;
    macro_out[idx * 3u + 1u] = ux;
    macro_out[idx * 3u + 2u] = uy;
    return;
  }

  // Drag: dampen velocity so energy dissipates over time.
  ux = ux * params.damping;
  uy = uy * params.damping;

  // BGK collision.
  for (var i = 0u; i < 9u; i = i + 1u) {
    fOut[base + i] = f[i] + params.omega * (feq(rho, ux, uy, i) - f[i]);
  }

  macro_out[idx * 3u] = rho;
  macro_out[idx * 3u + 1u] = ux;
  macro_out[idx * 3u + 2u] = uy;
}
`;function bb(e,t,n,r){let i=pb[r]*t+mb[r]*n,a=t*t+n*n;return hb[r]*e*(1+3*i+4.5*i*i-1.5*a)}var xb=class{width;height;fA;fB;obstacles;macro;ping=!1;frame=0;constructor(e,t){this.width=e,this.height=t;let n=e*t;this.fA=new Float32Array(n*q),this.fB=new Float32Array(n*q),this.obstacles=new Uint8Array(n),this.macro=new Float32Array(n*3),this.#e()}#e(){let{width:e,height:t,fA:n}=this;for(let r=0;r<t;r+=1)for(let t=0;t<e;t+=1){let i=(r*e+t)*q;for(let e=0;e<q;e+=1)n[i+e]=bb(1,0,cb,e)}}setObstacles(e,t){let{width:n,height:r,obstacles:i}=this,a=new Uint8Array(i);i.fill(0);for(let a of e){let e=Math.max(0,Math.floor(a.column-t.column)),o=Math.max(0,Math.floor(a.row-t.row)),s=Math.min(n,Math.floor(a.column-t.column+a.width)),c=Math.min(r,Math.floor(a.row-t.row+a.height));for(let t=o;t<c;t+=1)for(let r=e;r<s;r+=1)i[t*n+r]=1}let o=this.ping?this.fB:this.fA;for(let e=0;e<n*r;e+=1)if(a[e]&&!i[e]){let t=e*q;for(let e=0;e<q;e+=1)o[t+e]=bb(1,0,cb,e)}}step(){let{width:e,height:t,obstacles:n,macro:r}=this,i=this.ping?this.fB:this.fA,a=this.ping?this.fA:this.fB;this.frame+=1;for(let o=0;o<t;o+=1)for(let s=0;s<e;s+=1){let c=o*e+s,l=c*q,u=new Float64Array(q);for(let n=0;n<q;n+=1){let r=s-pb[n],a=o-mb[n];if(r>=0&&r<e&&a>=0&&a<t)u[n]=i[(a*e+r)*q+n];else if(a<0){let e=s+this.frame*131>>>0;u[n]=bb(1,lb*(((Math.imul(e^e>>>16,73244475)^e>>>16)&65535)/65536-.5),cb,n)}else u[n]=i[l+n]}if(n[c]){for(let e=0;e<q;e+=1)a[l+gb[e]]=u[e];r[c*3]=1,r[c*3+1]=0,r[c*3+2]=0;continue}let d=0,f=0,p=0;for(let e=0;e<q;e+=1)d+=u[e],f+=pb[e]*u[e],p+=mb[e]*u[e];d>.001&&(f/=d,p/=d),(!(d>=.5&&d<=1.5)||!Number.isFinite(f)||!Number.isFinite(p))&&(d=1,f=0,p=cb),f*=fb,p*=fb;for(let e=0;e<q;e+=1){let t=u[e],n=t+sb*(bb(d,f,p,e)-t);a[l+e]=Number.isFinite(n)?n:bb(1,0,cb,e)}r[c*3]=d,r[c*3+1]=f,r[c*3+2]=p}this.ping=!this.ping}injectVelocity(e,t,n,r){let{width:i,height:a}=this,o=this.ping?this.fB:this.fA;for(let s=-2;s<=2;s+=1)for(let c=-2;c<=2;c+=1){let l=e+c,u=t+s;if(l<0||l>=i||u<0||u>=a||this.obstacles[u*i+l])continue;let d=(u*i+l)*q,f=0;for(let e=0;e<q;e+=1)f+=o[d+e];if(f<.001)continue;let p=n,m=r;for(let e=0;e<q;e+=1)o[d+e]=bb(f,p,m,e)}}};async function Sb(e,t){try{let n=await rb();if(!n)return null;let r=e*t,i=r*q*4,a=r*3*4,o=r*4,s=n.createShaderModule({code:yb}),c=n.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:`read-only-storage`}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:`read-only-storage`}},{binding:4,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}}]}),l=n.createComputePipeline({layout:n.createPipelineLayout({bindGroupLayouts:[c]}),compute:{module:s,entryPoint:`main`}}),u=n.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),d=n.createBuffer({size:i,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),f=n.createBuffer({size:i,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),p=n.createBuffer({size:o,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),m=n.createBuffer({size:a,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),h=n.createBuffer({size:a,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),g=(e,t)=>n.createBindGroup({layout:c,entries:[{binding:0,resource:{buffer:u}},{binding:1,resource:{buffer:e}},{binding:2,resource:{buffer:t}},{binding:3,resource:{buffer:p}},{binding:4,resource:{buffer:m}}]}),_=new Float32Array(r*q);for(let e=0;e<r;e+=1)for(let t=0;t<q;t+=1)_[e*q+t]=bb(1,0,cb,t);return n.queue.writeBuffer(d,0,_),{device:n,pipeline:l,paramsBuffer:u,fBufferA:d,fBufferB:f,obsBuffer:p,macroBuffer:m,stagingBuffer:h,bindGroupA:g(d,f),bindGroupB:g(f,d),width:e,height:t,ping:!1,frame:0,readbackPending:!1,readbackData:null}}catch{return null}}function Cb(e,t){let{device:n,pipeline:r,paramsBuffer:i,macroBuffer:a,stagingBuffer:o}=e,s=Math.ceil(e.width/8),c=Math.ceil(e.height/8),l=new Float32Array(8);l[2]=sb,l[3]=cb,l[4]=lb,l[6]=fb;let u=new Uint32Array(l.buffer);u[0]=e.width,u[1]=e.height,u[5]=e.frame,u[7]=0,n.queue.writeBuffer(i,0,l);let d=n.createCommandEncoder();for(let n=0;n<t;n+=1){let t=d.beginComputePass();t.setPipeline(r),t.setBindGroup(0,e.ping?e.bindGroupB:e.bindGroupA),t.dispatchWorkgroups(s,c),t.end(),e.ping=!e.ping,e.frame+=1}d.copyBufferToBuffer(a,0,o,0,a.size),n.queue.submit([d.finish()])}function wb(e){e.readbackPending||(e.readbackPending=!0,e.stagingBuffer.mapAsync(1).then(()=>{let t=e.stagingBuffer.getMappedRange();e.readbackData=new Float32Array(new Float32Array(t).slice(0)),e.stagingBuffer.unmap(),e.readbackPending=!1}).catch(()=>{e.readbackPending=!1}))}var Tb=class{#e;#t;#n;#r=null;#i=null;#a=`uninit`;#o;#s=[];#c=new Float32Array;constructor(e={}){}setPointer(e,t=performance.now()){!Number.isFinite(e.column)||!Number.isFinite(e.row)||(this.#t={column:e.column,row:e.row,updatedAt:Db(t,performance.now())})}clearPointer(){this.#t=void 0}advance(e){let t=Eb(e.bounds);if(!t)return!1;let n=Db(e.now,performance.now()),r=this.#n===void 0?ib:Math.min(ab,Math.max(0,n-this.#n));if(this.#n=n,r<=0)return!1;this.#l(t),this.#u(e.obstacles??[],t);let i=this.#t&&n-this.#t.updatedAt<=ob?this.#t:void 0;if(i&&this.#r){let e=Math.floor(i.column-t.column),n=Math.floor(i.row-t.row);this.#r.injectVelocity(e,n,db*.5,db)}if(this.#a===`uninit`&&(this.#a=`initializing`,Sb(t.width,t.height).then(e=>{e?(this.#i=e,this.#a=`ready`,this.#r&&e.device.queue.writeBuffer(e.obsBuffer,0,new Uint32Array(this.#r.obstacles))):this.#a=`failed`}).catch(()=>{this.#a=`failed`})),this.#a===`ready`&&this.#i&&(this.#i.readbackData&&this.#r&&(this.#r.macro.set(this.#i.readbackData),this.#i.readbackData=null),Cb(this.#i,ub),wb(this.#i)),this.#r){for(let e=0;e<ub;e+=1)this.#r.step();this.#d()}return!0}rasterizeCells(e,t){let n=Eb(e);if(!n)return this.#s=[],this.#s;let{width:r,height:i}=n;this.#f(r,i);let a=this.#r;if(!a)return this.#s;let{macro:o,obstacles:s}=a,c=this.#c,l=G(t.accent,t.text,.3),u=G(t.muted,t.text,.3);for(let e=0;e<i;e+=1)for(let n=0;n<r;n+=1){let i=e*r+n;if(s[i])continue;let a=o[i*3+1],d=o[i*3+2];if(!Number.isFinite(a)||!Number.isFinite(d))continue;let f=Math.sqrt(a*a+d*d),p=c[i]??0,m=Math.abs(p);if(f<.003&&m<5e-4)continue;let h;if(h=m>.002?_b[Math.min(_b.length-1,Math.floor(m*2500))]??_b[0]:f>.005?vb[(Math.round(Math.atan2(d,a)/(Math.PI/4))%8+8)%8]??`-`:`.`,h===` `)continue;let g=Math.min(1,f*8+m*800),_=p>0?l:u,v=G(t.background,_,g);this.#s[e][n]={char:h,foreground:v,bold:m>.005}}return this.#s}#l(e){if(this.#e?.width===e.width&&this.#e.height===e.height){this.#e={...e};return}this.#e={...e},this.#r=new xb(e.width,e.height),this.#c=new Float32Array(e.width*e.height),this.#i&&(this.#i=null,this.#a=`uninit`),this.#o=void 0}#u(e,t){let n=e.map(e=>`${e.column},${e.row},${e.width},${e.height}`).join(`|`);if(n!==this.#o&&(this.#o=n,this.#r?.setObstacles(e,t),this.#i&&this.#r)){let e=new Uint32Array(this.#r.obstacles);this.#i.device.queue.writeBuffer(this.#i.obsBuffer,0,e)}}#d(){let e=this.#r;if(!e)return;let{width:t,height:n,macro:r}=e,i=this.#c;for(let e=1;e<n-1;e+=1)for(let n=1;n<t-1;n+=1){let a=e*t+n;i[a]=(r[(e*t+n+1)*3+2]-r[(e*t+n-1)*3+2])*.5-(r[((e+1)*t+n)*3+1]-r[((e-1)*t+n)*3+1])*.5}}#f(e,t){if(this.#s.length===t&&(this.#s[0]?.length??-1)===e){for(let e of this.#s)e.fill(void 0);return}this.#s=Array.from({length:t},()=>Array(e).fill(void 0))}};function Eb(e){if(!Number.isFinite(e.column)||!Number.isFinite(e.row)||!Number.isFinite(e.width)||!Number.isFinite(e.height))return;let t=Math.floor(e.width),n=Math.floor(e.height);if(!(t<=0||n<=0))return{column:Math.floor(e.column),row:Math.floor(e.row),width:t,height:n}}function Db(e,t){return typeof e==`number`&&Number.isFinite(e)?e:t}var Ob=[{id:`metaballs`,label:`metaballs`,create:()=>new Ip},{id:`matrix`,label:`matrix`,create:()=>new am},{id:`rainy windows`,label:`rainy windows`,create:()=>new sh},{id:`circuit`,label:`circuit`,create:()=>new yg},{id:`biomech`,label:`biomech`,create:()=>new qg},{id:`jungle`,label:`jungle`,create:()=>new f_},{id:`vaporwave`,label:`vaporwave`,create:()=>new q_},{id:`skull`,label:`skull`,create:()=>new Nv},{id:`ivy`,label:`ivy`,create:()=>new Ay},{id:`fire`,label:`fire`,create:()=>new Yy},{id:`turbulence`,label:`turbulence`,create:()=>new Tb}];Object.freeze([`0d`,`0dt`,`1d`,`1dt`,`2d`,`2dt`,`3d`,`3dt`]);function kb(e){return Number(e[0])}function*Ab(e){if(typeof e==`number`){Number.isFinite(e)&&(yield e);return}if(Array.isArray(e))for(let t of e)yield*Ab(t)}function jb(e,t){let n=Math.max(0,Math.floor(t));if(n===0)return[];if(e.length===0)return Array(n).fill(0);if(e.length===n)return[...e];if(e.length<n)return Array.from({length:n},(t,r)=>e[Math.min(e.length-1,Math.floor(r*e.length/n))]);let r=[];for(let t=0;t<n;t+=1){let i=Math.floor(t*e.length/n),a=Math.max(i+1,Math.floor((t+1)*e.length/n)),o=0;for(let t=i;t<a;t+=1)o+=e[t];let s=o/(a-i),c=e[i];for(let t=i;t<a;t+=1)Math.abs(e[t]-s)>Math.abs(c-s)&&(c=e[t]);r.push(c)}return r}function J(e){if(!Number.isFinite(e.min)||!Number.isFinite(e.max))return{min:0,max:1};if(e.max>e.min)return e;let t=e.min;return{min:t-.5,max:t+.5}}function Y(e){let t=1/0,n=-1/0;for(let r of e)for(let e of Ab(r))e<t&&(t=e),e>n&&(n=e);return J({min:t,max:n})}function Mb(e,t){if(t)return J(t);let n=Y(e);return J({min:Math.min(0,n.min),max:Math.max(0,n.max)})}function X(e,t){let n=J(t);return Number.isFinite(e)?Math.min(1,Math.max(0,(e-n.min)/(n.max-n.min))):0}var Nb=new Set(Nf),Pb=class e{#e;constructor(e){this.#e=e??new Map}declare(t,n){if(!t.includes(`:`))throw TypeError(`token "${t}" must be namespaced as "namespace:name"`);if(Nb.has(t))throw TypeError(`token "${t}" collides with the compatibility profile`);if(this.#e.has(t))throw TypeError(`token "${t}" is already declared`);if(!Nb.has(n.fallback)&&!this.#e.has(n.fallback))throw TypeError(`fallback "${n.fallback}" is not a known token`);let r=new Map(this.#e);return r.set(t,{fallback:n.fallback,description:n.description}),new e(r)}has(e){return Nb.has(e)||this.#e.has(e)}known(){return[...Nf,...this.#e.keys()]}chain(e){let t=[e],n=e;for(;!Nb.has(n);){let e=this.#e.get(n);if(!e)break;n=e.fallback,t.push(n)}return t}style(e,t){for(let n of this.chain(e)){let e=t[n];if(e!==void 0)return e}}};function Fb(){return new Pb}Object.freeze({chrome:`Chrome basics`,window:`Windows`,button:`Buttons`,menu:`Menus`,control:`Controls`,scrollbar:`Scrollbars`,desktop:`Desktop`,status:`Status`,viz:`Visualisations`});var Ib=[{name:`chrome:background`,group:`chrome`,label:`Panel background`,fallback:`surface`,role:`background`,description:`The ground every panel, window body and control sits on.`},{name:`desktop:background`,group:`chrome`,label:`Desktop background`,fallback:`surface`,role:`background`,description:`Behind every window, where the wallpaper or animation shows.`},{name:`chrome:foreground`,group:`chrome`,label:`Text`,fallback:`foreground`,role:`foreground`,against:`chrome:background`,description:`Body text on a panel.`},{name:`chrome:muted`,group:`chrome`,label:`Secondary text`,fallback:`muted`,role:`foreground`,against:`chrome:background`,description:`Labels, hints and anything meant to sit behind the body text.`},{name:`chrome:line`,group:`chrome`,label:`Lines and borders`,fallback:`muted`,role:`line`,against:`chrome:background`,description:`Frames, separators and rules.`},{name:`chrome:accent`,group:`chrome`,label:`Accent fill`,fallback:`accent`,role:`background`,description:`The colour that marks what is focused, selected or active.`},{name:`chrome:on-accent`,group:`chrome`,label:`Text on accent`,fallback:`surface`,role:`foreground`,against:`chrome:accent`,description:`Text drawn on top of an accent fill.`}],Lb=[{name:`window:background`,group:`window`,label:`Window body`,fallback:`chrome:background`,role:`background`},{name:`window:foreground`,group:`window`,label:`Window text`,fallback:`chrome:foreground`,role:`foreground`,against:`window:background`},{name:`window:border`,group:`window`,label:`Border`,fallback:`chrome:line`,role:`line`},{name:`window:border-active`,group:`window`,label:`Active border`,fallback:`chrome:accent`,role:`line`,description:`The frame around the window with focus.`},{name:`window:titlebar-background`,group:`window`,label:`Title bar`,fallback:`chrome:background`,role:`background`},{name:`window:titlebar-foreground`,group:`window`,label:`Title bar text`,fallback:`chrome:foreground`,role:`foreground`,against:`window:titlebar-background`},{name:`window:titlebar-background-active`,group:`window`,label:`Active title bar`,fallback:`chrome:accent`,role:`background`},{name:`window:titlebar-foreground-active`,group:`window`,label:`Active title bar text`,fallback:`chrome:on-accent`,role:`foreground`,against:`window:titlebar-background-active`},{name:`button:background`,group:`button`,label:`Button`,fallback:`chrome:background`,role:`background`},{name:`button:foreground`,group:`button`,label:`Button text`,fallback:`chrome:foreground`,role:`foreground`,against:`button:background`},{name:`button:border`,group:`button`,label:`Button border`,fallback:`chrome:line`,role:`line`},{name:`button:background-active`,group:`button`,label:`Pressed button`,fallback:`chrome:accent`,role:`background`},{name:`button:foreground-active`,group:`button`,label:`Pressed button text`,fallback:`chrome:on-accent`,role:`foreground`,against:`button:background-active`},{name:`button:background-disabled`,group:`button`,label:`Disabled button`,fallback:`chrome:background`,role:`background`},{name:`button:foreground-disabled`,group:`button`,label:`Disabled button text`,fallback:`chrome:muted`,role:`foreground`,against:`button:background-disabled`},{name:`menu:background`,group:`menu`,label:`Menu`,fallback:`chrome:background`,role:`background`},{name:`menu:foreground`,group:`menu`,label:`Menu item`,fallback:`chrome:foreground`,role:`foreground`,against:`menu:background`},{name:`menu:background-selected`,group:`menu`,label:`Highlighted item`,fallback:`chrome:accent`,role:`background`},{name:`menu:foreground-selected`,group:`menu`,label:`Highlighted item text`,fallback:`chrome:on-accent`,role:`foreground`,against:`menu:background-selected`},{name:`menu:border`,group:`menu`,label:`Menu border`,fallback:`chrome:line`,role:`line`},{name:`menu:shortcut`,group:`menu`,label:`Shortcut hint`,fallback:`chrome:muted`,role:`foreground`,against:`menu:background`},{name:`control:background`,group:`control`,label:`Control`,fallback:`chrome:background`,role:`background`},{name:`control:foreground`,group:`control`,label:`Control text`,fallback:`chrome:foreground`,role:`foreground`,against:`control:background`},{name:`control:background-selected`,group:`control`,label:`Selected row`,fallback:`chrome:accent`,role:`background`},{name:`control:foreground-selected`,group:`control`,label:`Selected row text`,fallback:`chrome:on-accent`,role:`foreground`,against:`control:background-selected`},{name:`control:background-selected-unfocused`,group:`control`,label:`Selected row, unfocused`,fallback:`chrome:muted`,role:`background`,description:`The current row of a list that does not hold the keyboard.`},{name:`control:foreground-selected-unfocused`,group:`control`,label:`Selected row text, unfocused`,fallback:`chrome:on-accent`,role:`foreground`,against:`control:background-selected-unfocused`},{name:`control:border-focused`,group:`control`,label:`Focus ring`,fallback:`chrome:accent`,role:`line`},{name:`control:placeholder`,group:`control`,label:`Placeholder text`,fallback:`chrome:muted`,role:`foreground`,against:`control:background`},{name:`control:selection-background`,group:`control`,label:`Text selection`,fallback:`chrome:accent`,role:`background`},{name:`control:selection-foreground`,group:`control`,label:`Selected text`,fallback:`chrome:on-accent`,role:`foreground`,against:`control:selection-background`},{name:`scrollbar:track`,group:`scrollbar`,label:`Track`,fallback:`chrome:background`,role:`background`},{name:`scrollbar:thumb`,group:`scrollbar`,label:`Thumb`,fallback:`chrome:muted`,role:`foreground`,against:`scrollbar:track`},{name:`scrollbar:thumb-active`,group:`scrollbar`,label:`Dragged thumb`,fallback:`chrome:accent`,role:`foreground`,against:`scrollbar:track`},{name:`desktop:topbar-background`,group:`desktop`,label:`Top bar`,fallback:`chrome:background`,role:`background`},{name:`desktop:topbar-foreground`,group:`desktop`,label:`Top bar text`,fallback:`chrome:foreground`,role:`foreground`,against:`desktop:topbar-background`},{name:`desktop:statusbar-background`,group:`desktop`,label:`Status bar`,fallback:`chrome:background`,role:`background`},{name:`desktop:statusbar-foreground`,group:`desktop`,label:`Status bar text`,fallback:`chrome:muted`,role:`foreground`,against:`desktop:statusbar-background`},{name:`status:success`,group:`status`,label:`Success`,fallback:`success`,role:`foreground`,against:`chrome:background`},{name:`status:warning`,group:`status`,label:`Warning`,fallback:`warning`,role:`foreground`,against:`chrome:background`},{name:`status:danger`,group:`status`,label:`Danger`,fallback:`danger`,role:`foreground`,against:`chrome:background`},{name:`status:info`,group:`status`,label:`Info`,fallback:`chrome:accent`,role:`foreground`,against:`chrome:background`}],Rb=[{name:`viz:background`,group:`viz`,label:`Chart ground`,fallback:`chrome:background`,role:`background`},{name:`viz:foreground`,group:`viz`,label:`Chart text`,fallback:`chrome:foreground`,role:`foreground`,against:`viz:background`},{name:`viz:grid`,group:`viz`,label:`Grid lines`,fallback:`chrome:line`,role:`line`},{name:`viz:axis`,group:`viz`,label:`Axis and ticks`,fallback:`chrome:muted`,role:`foreground`,against:`viz:background`},{name:`viz:series`,group:`viz`,label:`Series`,fallback:`chrome:accent`,role:`foreground`,against:`viz:background`},{name:`viz:series-alt`,group:`viz`,label:`Second series`,fallback:`status:info`,role:`foreground`,against:`viz:background`},{name:`viz:calm`,group:`viz`,label:`Calm`,fallback:`status:success`,role:`foreground`,against:`viz:background`},{name:`viz:warn`,group:`viz`,label:`Warning`,fallback:`status:warning`,role:`foreground`,against:`viz:background`},{name:`viz:alarm`,group:`viz`,label:`Alarm`,fallback:`status:danger`,role:`foreground`,against:`viz:background`}],zb=Object.freeze([...Ib,...Lb,...Rb]);new Map(zb.map(e=>[e.name,e]));var Bb;function Vb(){if(Bb)return Bb;let e=Fb();for(let t of zb)e=e.declare(t.name,{fallback:t.fallback,...t.description===void 0?{}:{description:t.description}});return Bb=e,Bb}function Hb(e){let t=Vb();return t.has(e)?t.chain(e):[e]}function Ub(e,t){for(let n of Hb(e)){let e=t[n];if(e)return e}}var Wb=Object.freeze({background:[16,18,24],foreground:[220,226,240],grid:[44,52,68],axis:[110,122,148],series:[96,176,255],seriesAlt:[126,220,200],ramp:[[90,200,120],[230,180,70],[230,90,90]]});function Gb(e){let t=(t,n)=>{let r=Ub(t,e);return r?[r[0],r[1],r[2]]:n};return{background:t(`viz:background`,Wb.background),foreground:t(`viz:foreground`,Wb.foreground),grid:t(`viz:grid`,Wb.grid),axis:t(`viz:axis`,Wb.axis),series:t(`viz:series`,Wb.series),seriesAlt:t(`viz:series-alt`,Wb.seriesAlt),ramp:[t(`viz:calm`,Wb.ramp[0]),t(`viz:warn`,Wb.ramp[1]),t(`viz:alarm`,Wb.ramp[2])]}}function Kb(e,t,n){let r=Math.min(1,Math.max(0,n));return[Math.round(e[0]+(t[0]-e[0])*r),Math.round(e[1]+(t[1]-e[1])*r),Math.round(e[2]+(t[2]-e[2])*r)]}var qb=32;function Z(e,t){let n=Math.round(Math.min(1,Math.max(0,t))*qb)/qb,r=e.ramp.length-1,i=n*r,a=Math.min(r-1,Math.floor(i));return Kb(e.ramp[a],e.ramp[a+1],i-a)}function Q(e,t={char:` `}){let n=Math.max(0,Math.floor(e.width)),r=Math.max(0,Math.floor(e.height));return Array.from({length:r},()=>Array.from({length:n},()=>t))}function Jb(e,t,n,r,i={}){let a=e[n];if(a)for(let e=0;e<r.length;e+=1){let n=t+e;n<0||n>=a.length||(a[n]={char:r[e],...i})}}function Yb(e,t){let n=Math.round(t.column),r=Math.round(t.row),i=Math.round(e.column),a=Math.round(e.row),o=Math.abs(n-i),s=Math.abs(r-a),c=i<n?1:-1,l=a<r?1:-1,u=o-s,d=[],f=o+s+1;for(let e=0;e<=f&&(d.push({column:i,row:a}),!(i===n&&a===r));e+=1){let e=2*u;e>-s&&(u-=s,i+=c),e<o&&(u+=o,a+=l)}return d}function Xb(e){if(e.length===0)return[];if(e.length===1)return[{column:Math.round(e[0].column),row:Math.round(e[0].row)}];let t=[];for(let n=1;n<e.length;n+=1){let r=Yb(e[n-1],e[n]);t.push(...n===1?r:r.slice(1))}return t}var Zb=[[1,8],[2,16],[4,32],[64,128]],Qb=` ▘▝▀▖▌▞▛▗▚▐▜▄▙▟█`;function $b(e){if(e===0)return` `;if(e===63)return`█`;if(e===21)return`▌`;if(e===42)return`▐`;let t=e-1;return e>21&&--t,e>42&&--t,String.fromCodePoint(129792+t)}var ex={braille:{x:2,y:4},sextant:{x:2,y:3},quadrant:{x:2,y:2},"full-cell":{x:1,y:1}};function tx(e){return ex[e]}function nx(e,t){let n=e=>e===`braille`?t.braille??!1:e===`sextant`?t.sextants??!1:e===`quadrant`?t.quadrants??!1:!0;if(n(e))return{backend:e,degraded:!1};let r=[`braille`,`sextant`,`quadrant`,`full-cell`];for(let t of r.slice(r.indexOf(e)+1))if(n(t))return{backend:t,degraded:!0};return{backend:`full-cell`,degraded:!0}}var rx=class{#e=new Set;width;height;constructor(e){this.width=Math.max(1,e.width),this.height=Math.max(1,e.height)}plot(e,t){let n=Math.floor(e),r=Math.floor(t);n<0||r<0||n>=this.width||r>=this.height||this.#e.add(r*this.width+n)}hasDot(e,t){return this.#e.has(Math.floor(t)*this.width+Math.floor(e))}render(e,t={}){let{backend:n,degraded:r}=nx(e,t),{x:i,y:a}=ex[n],o=Math.ceil(this.width/i),s=Math.ceil(this.height/a),c=[];for(let e=0;e<s;e+=1){let t=``;for(let r=0;r<o;r+=1)t+=this.#t(n,r*i,e*a,i,a);c.push(t)}return{backend:n,requested:e,degraded:r,lines:c}}#t(e,t,n,r,i){let a=0,o=!1;for(let s=0;s<i;s+=1)for(let i=0;i<r;i+=1)this.hasDot(t+i,n+s)&&(o=!0,e===`braille`?a|=Zb[s][i]:(e===`sextant`||e===`quadrant`)&&(a|=1<<s*2+i));switch(e){case`braille`:return a===0?` `:String.fromCodePoint(10240+a);case`sextant`:return $b(a);case`quadrant`:return Qb[a]??` `;case`full-cell`:return o?`█`:` `}}};function ix(e,t,n,r,i={}){let a=e[Math.round(n)];if(!a)return;let o=Math.round(t);o<0||o>=a.length||(a[o]={char:r,...i})}function ax(e,t){let n=t.column-e.column,r=t.row-e.row;return Math.abs(n)>=Math.abs(r)*2?`─`:Math.abs(r)>=Math.abs(n)*2?`│`:n>0==r>0?`╲`:`╱`}var ox=`auto`;function sx(e,t,n,r,i={}){let a=r===`auto`?ax(t,n):r;for(let r of Yb(t,n))ix(e,r.column,r.row,a,i)}function cx(e,t,n,r,i={}){let a=i.from??0,o=(i.to??1)-a;if(o===0)return;let s=Math.max(8,Math.round(Math.max(n.column,n.row)*8*Math.abs(o)));for(let c=0;c<=s;c+=1){let l=c/s,u=(a+o*l)*Math.PI*2;ix(e,t.column+Math.cos(u)*n.column,t.row+Math.sin(u)*n.row,r,i.styleAt?.(l)??{...i.foreground?{foreground:i.foreground}:{},...i.background?{background:i.background}:{}})}}function lx(e,t,n,r={}){for(let i=t.row;i<t.row+t.height;i+=1)for(let a=t.column;a<t.column+t.width;a+=1)ix(e,a,i,n,r)}var ux=class{#e;#t=new Map;#n;#r;#i;constructor(e,t={}){let{backend:n}=nx(t.backend??`braille`,t.capabilities??{braille:!0,sextants:!0,quadrants:!0});this.#n=n,this.#r=tx(n),this.#i={width:Math.max(1,e.width),height:Math.max(1,e.height)},this.#e=new rx({width:this.#i.width*this.#r.x,height:this.#i.height*this.#r.y})}get resolution(){return{width:this.#i.width*this.#r.x,height:this.#i.height*this.#r.y}}get backend(){return this.#n}plot(e,t,n){if(this.#e.plot(e,t),!n)return;let r=Math.floor(t/this.#r.y)*this.#i.width+Math.floor(e/this.#r.x);this.#t.set(r,n)}paint(e,t={column:0,row:0},n={}){let{lines:r}=this.#e.render(this.#n,{braille:!0,sextants:!0,quadrants:!0});for(let i=0;i<r.length;i+=1){let a=r[i];for(let r=0;r<a.length;r+=1){let o=a[r];if(o===` `)continue;let s=this.#t.get(i*this.#i.width+r)??n.foreground;ix(e,t.column+r,t.row+i,o,{...n,...s?{foreground:s}:{}})}}}},dx=[`▏`,`▎`,`▍`,`▌`,`▋`,`▊`,`▉`,`█`],fx={id:`meter`,label:`Meter`,accepts:`0d`,minimum:{width:3,height:1},weight:.5,render(e,t){let{width:n,height:r}=t.size,i=Q(t.size,{char:` `,background:t.theme.background});if(n<=0||r<=0)return i;let a=X(e,J(t.domain??{min:0,max:1})),o=Z(t.theme,a),s=a*n,c=Math.floor(s),l=s-c,u=i[0];for(let e=0;e<n;e+=1)e<c?u[e]={char:`█`,foreground:o,background:t.theme.background}:e===c&&l>0?u[e]={char:dx[Math.min(dx.length-1,Math.floor(l*dx.length))],foreground:o,background:t.theme.background}:u[e]={char:`·`,foreground:t.theme.grid,background:t.theme.background};return t.label&&r>1&&Jb(i,0,1,t.label,{foreground:t.theme.axis}),i}},px=[`▁`,`▂`,`▃`,`▄`,`▅`,`▆`,`▇`,`█`],mx={id:`sparkline`,label:`Sparkline`,accepts:`0dt`,minimum:{width:2,height:1},weight:.7,render(e,t){let n=Q(t.size,{char:` `,background:t.theme.background}),{width:r,height:i}=t.size;if(r<=0||i<=0)return n;let a=jb(e.map(e=>e.value),r),o=J(t.domain??Y(a)),s=n[i-1];for(let e=0;e<r;e+=1){let n=X(a[e]??0,o);s[e]={char:px[Math.min(px.length-1,Math.round(n*(px.length-1)))],foreground:Z(t.theme,n),background:t.theme.background}}return n}},hx=[`▁`,`▂`,`▃`,`▄`,`▅`,`▆`,`▇`,`█`],gx={id:`area`,label:`Area`,accepts:`0dt`,minimum:{width:4,height:2},weight:1.1,render(e,t){let n=Q(t.size,{char:` `,background:t.theme.background}),{width:r,height:i}=t.size;if(r<=0||i<=0)return n;let a=jb(e.map(e=>e.value),r),o=Mb(a,t.domain);for(let e=0;e<r;e+=1){let r=X(a[e]??0,o),s=Z(t.theme,r),c=Kb(s,t.theme.background,.55),l=r*i,u=Math.min(i,Math.floor(l));for(let r=0;r<u;r+=1)n[i-1-r][e]={char:`█`,foreground:c,background:t.theme.background};if(u<i){let r=l-u,a=Math.max(0,Math.min(hx.length-1,Math.floor(r*hx.length)));n[i-1-u][e]={char:hx[a],foreground:s,background:t.theme.background}}}return n}},_x=[`■`,`●`,`▲`,`◆`,`▼`,`★`],vx=`╋`;function yx(e){let t=e[0];if(t===void 0)return[];if(Array.isArray(t))return e.map(e=>[...e]);let n=e;if(typeof n[0].value==`number`)return[n.map(e=>e.value)];let r=Math.max(...n.map(e=>e.value.length));return Array.from({length:r},(e,t)=>n.map(e=>e.value[t]??0))}var bx={id:`psychograph`,label:`Psychograph`,accepts:[`0dt`,`1dt`,`2d`],minimum:{width:8,height:4},weight:1,perEntry:{rows:1},suits:e=>kb(e.kind)===0||(e.extent?.[0]??1)<=8,render(e,t){let n=Q(t.size,{char:` `,background:t.theme.background}),{width:r,height:i}=t.size;if(r<=0||i<=0)return n;let a=yx(e);if(a.length===0)return n;let o=J(t.domain??Y(a)),s=[t.theme.series,t.theme.seriesAlt,...t.theme.ramp],c=a.length===1,l=new Int8Array(r*i).fill(-1);for(let e=0;e<a.length;e+=1){let u=jb(a[e],r),d=c?`■`:_x[e%_x.length],f=s[e%s.length];for(let a=0;a<r;a+=1){let p=X(u[a]??0,o),m=Math.min(i-1,Math.max(0,Math.round((1-p)*(i-1)))),h=m*r+a,g=l[h];if(g>=0&&g!==e){n[m][a]={char:vx,foreground:Kb(s[g%s.length],f,.5),background:t.theme.background};continue}l[h]=e,n[m][a]={char:d,foreground:c?Z(t.theme,p):f,background:t.theme.background}}}return n}},xx={id:`readout`,label:`Readout`,accepts:`0d`,minimum:{width:1,height:1},weight:.2,render(e,t){let n=Q(t.size,{char:` `,background:t.theme.background}),{width:r,height:i}=t.size;if(r<=0||i<=0)return n;let a=X(e,J(t.domain??{min:0,max:1})),o=t.format?.(e)??`${Math.round(a*100)}%`;return Jb(n,0,0,o.length>r?o.slice(o.length-r):o.padStart(r),{foreground:Z(t.theme,a),background:t.theme.background}),n}},Sx={id:`dial`,label:`Dial`,accepts:`0d`,minimum:{width:9,height:5},weight:.65,render(e,t){let n=Q(t.size,{char:` `,background:t.theme.background}),{width:r,height:i}=t.size;if(r<=0||i<=0)return n;let a=X(e,J(t.domain??{min:0,max:1})),o={column:(r-1)/2,row:(i-1)/2},s={column:Math.max(2,(r-1)/2-1),row:Math.max(1,(i-1)/2)},c=.375;cx(n,o,s,`·`,{from:c,to:1.125,foreground:t.theme.grid,background:t.theme.background}),a>0&&cx(n,o,s,`●`,{from:c,to:c+.75*a,styleAt:e=>({foreground:Z(t.theme,a*e),background:t.theme.background})});let l=t.format?.(e)??`${Math.round(a*100)}%`;return l.length<=r-2&&Jb(n,Math.round(o.column-(l.length-1)/2),Math.round(o.row),l,{foreground:Z(t.theme,a),background:t.theme.background}),n}},Cx=Object.freeze({0:[`┏━┓`,`┃ ┃`,`┗━┛`],1:[` ┓ `,` ┃ `,` ╹ `],2:[`┏━┓`,`┏━┛`,`┗━╸`],3:[`┏━┓`,` ━┫`,`┗━┛`],4:[`╻ ╻`,`┗━┫`,`  ╹`],5:[`┏━╸`,`┗━┓`,`┗━┛`],6:[`┏━╸`,`┣━┓`,`┗━┛`],7:[`┏━┓`,`  ┃`,`  ╹`],8:[`┏━┓`,`┣━┫`,`┗━┛`],9:[`┏━┓`,`┗━┫`,`┗━┛`],"%":[`╻ ╱`,` ╱ `,`╱ ╹`],".":[`   `,`   `,` ╺ `],"-":[`   `,`╺━╸`,`   `],"°":[`┏┓ `,`┗┛ `,`   `]," ":[`   `,`   `,`   `]}),wx=Object.freeze([fx,xx,Sx,{id:`odometer`,label:`Odometer`,accepts:`0d`,minimum:{width:12,height:3},weight:.55,render(e,t){let n=Q(t.size,{char:` `,background:t.theme.background}),{width:r,height:i}=t.size;if(r<=0||i<=0)return n;let a=X(e,J(t.domain??{min:0,max:1})),o=[...t.format?.(e)??`${Math.round(a*100)}%`].map(e=>Cx[e]??Cx[` `]),s=o.reduce((e,t)=>e+t[0].length,0),c={foreground:Z(t.theme,a),background:t.theme.background},l=r-s,u=Math.max(0,Math.floor((i-3)/2));for(let e of o){for(let t=0;t<e.length;t+=1)Jb(n,l,u+t,e[t],c);l+=e[0].length}return n}},{id:`strip`,label:`Strip`,accepts:`0dt`,minimum:{width:6,height:3},weight:.9,render(e,t){let n=Q(t.size,{char:` `,background:t.theme.background}),{width:r,height:i}=t.size;if(r<=0||i<=0)return n;let a=jb(e.map(e=>e.value),r),o=J(t.domain??Y(a)),s=a.map((e,t)=>({column:t,row:Math.min(i-1,Math.max(0,Math.round((1-X(e,o))*(i-1)))),value:e}));for(let e=1;e<s.length;e+=1){let r=s[e];sx(n,s[e-1],r,`─`,{foreground:Z(t.theme,X(r.value,o)),background:t.theme.background})}let c=s.at(-1);return c&&ix(n,c.column,c.row,`●`,{foreground:Z(t.theme,X(c.value,o)),background:t.theme.background}),n}},mx,gx,bx]),Tx=3,Ex=2,Dx=8,Ox=[`▁`,`▂`,`▃`,`▄`,`▅`,`▆`,`▇`,`█`],kx=[`·`,`░`,`▒`,`▓`,`█`],Ax={id:`bars`,label:`Bars`,accepts:`1d`,minimum:{width:2,height:2},perEntry:{columns:1},weight:.8,render(e,t){let n=Q(t.size,{char:` `,background:t.theme.background}),{width:r,height:i}=t.size;if(r<=0||i<=0||e.length===0)return n;let a=Mb([e],t.domain);for(let o=0;o<r;o+=1){let s=X(e[Math.min(e.length-1,Math.floor(o*e.length/r))]??0,a),c=Z(t.theme,s),l=s*i,u=Math.floor(l);for(let e=0;e<i;e+=1){let r=i-1-e;if(r<u)n[e][o]={char:`█`,foreground:c,background:t.theme.background};else if(r===u){let r=l-u;if(r>0){let i=Math.min(Ox.length-1,Math.floor(r*Ox.length));n[e][o]={char:Ox[i],foreground:c,background:t.theme.background}}}}}return n}},jx={id:`rack`,label:`Rack`,accepts:`1d`,minimum:{width:8,height:1},perEntry:{rows:1},weight:.6,render(e,t){let n=Q(t.size,{char:` `,background:t.theme.background}),{width:r,height:i}=t.size;if(r<=0||i<=0||e.length===0)return n;let a=Mb([e],t.domain),o=Math.min(8,Math.max(0,r-6)),s=Math.max(1,r-o-5),c=Math.min(i,e.length);for(let r=0;r<c;r+=1){let i=X(e[r]??0,a),c=Z(t.theme,i);if(o>0){let e=t.labels?.[r]??String(r);Jb(n,0,r,e.padEnd(o).slice(0,o),{foreground:t.theme.axis,background:t.theme.background})}let l=Math.round(i*s);for(let e=0;e<s;e+=1)n[r][o+e]={char:e<l?`█`:`·`,foreground:e<l?c:t.theme.grid,background:t.theme.background};Jb(n,o+s+1,r,String(Math.round(i*100)).padStart(3),{foreground:t.theme.foreground,background:t.theme.background})}return n}},Mx={id:`waterfall`,label:`Waterfall`,accepts:`1dt`,minimum:{width:4,height:3},perEntry:{columns:1},minimumEntries:6,weight:1,render(e,t){let n=Q(t.size,{char:` `,background:t.theme.background}),{width:r,height:i}=t.size;if(r<=0||i<=0||e.length===0)return n;let a=J(t.domain??Y(e.map(e=>e.value))),o=e.slice(Math.max(0,e.length-i)).reverse();for(let e=0;e<Math.min(i,o.length);e+=1){let i=jb(o[e].value,r);for(let o=0;o<r;o+=1){let r=X(i[o]??0,a),s=Math.min(kx.length-1,Math.round(r*(kx.length-1)));n[e][o]={char:kx[s],foreground:s===0?t.theme.grid:Z(t.theme,r),background:t.theme.background}}}return n}},Nx={id:`scope`,label:`Scope`,accepts:`1d`,minimum:{width:8,height:3},minimumEntries:8,weight:.85,render(e,t){let n=Q(t.size,{char:` `,background:t.theme.background}),{width:r,height:i}=t.size;if(r<=0||i<=0||e.length===0)return n;let a=jb(e,r),o=J(t.domain??Y([e])),s;for(let e=0;e<r;e+=1){let r=X(a[e]??0,o),c=Math.min(i-1,Math.max(0,Math.round((1-r)*(i-1)))),l=Z(t.theme,r);if(s!==void 0&&Math.abs(s-c)>1){let r=s<c?1:-1,i=Kb(l,t.theme.background,.45);for(let a=s+r;a!==c;a+=r)n[a][e]={char:`│`,foreground:i,background:t.theme.background}}n[c][e]={char:`─`,foreground:l,background:t.theme.background},s=c}return n}},Px={id:`hexgrid`,label:`Honeycomb`,accepts:`1d`,minimum:{width:6,height:2},perEntry:{cells:Tx*Ex},minimumEntries:4,weight:.75,render(e,t){let n=Q(t.size,{char:` `,background:t.theme.background}),{width:r,height:i}=t.size;if(r<=0||i<=0||e.length===0)return n;let a=Mb([e],t.domain),o=Math.max(1,Math.floor((r-1)/Tx));for(let r=0;r<e.length;r+=1){let s=Math.floor(r/o),c=s*Ex;if(c>=i)break;let l=r%o*Tx+(s%2==0?0:1),u=X(e[r]??0,a),d=kx[Math.min(kx.length-1,Math.round(u*(kx.length-1)))],f={foreground:Z(t.theme,u),background:t.theme.background};lx(n,{column:l,row:c,width:Tx-1,height:Ex},d,f)}return n}},Fx=Object.freeze([Ax,Nx,Px,{id:`status-grid`,label:`Status Grid`,accepts:`1d`,minimum:{width:8,height:1},perEntry:{cells:Dx},minimumEntries:3,weight:.7,render(e,t){let n=Q(t.size,{char:` `,background:t.theme.background}),{width:r,height:i}=t.size;if(r<=0||i<=0||e.length===0)return n;let a=Mb([e],t.domain),o=Math.max(1,Math.floor(r/Dx));for(let r=0;r<e.length;r+=1){let s=Math.floor(r/o);if(s>=i)break;let c=r%o*Dx,l=X(e[r]??0,a),u=Z(t.theme,l),d=(t.labels?.[r]??String(r)).slice(0,Dx-3);Jb(n,c,s,`▌`,{foreground:u,background:t.theme.background}),Jb(n,c+1,s,d.padEnd(Dx-2).slice(0,Dx-2),{foreground:l>.66?u:t.theme.foreground,background:t.theme.background})}return n}},jx,Mx]),Ix=[` `,`░`,`▒`,`▓`,`█`],Lx={id:`heatmap`,label:`Heatmap`,accepts:`2d`,minimum:{width:2,height:2},render(e,t){let n=Q(t.size,{char:` `,background:t.theme.background}),{width:r,height:i}=t.size;if(r<=0||i<=0||e.length===0)return n;let a=J(t.domain??Y([e]));for(let o=0;o<i;o+=1){let s=e[Math.min(e.length-1,Math.floor(o*e.length/i))];for(let e=0;e<r;e+=1){let i=X(s[s.length===0?0:Math.min(s.length-1,Math.floor(e*s.length/r))]??0,a),c=Math.min(Ix.length-1,Math.round(i*(Ix.length-1)));n[o][e]={char:Ix[c],foreground:Z(t.theme,i),background:t.theme.background}}}return n}},Rx={id:`lattice`,label:`Lattice (2D)`,accepts:`1dt`,minimum:{width:8,height:4},perEntry:{columns:1},minimumEntries:6,weight:.9,render(e,t){let n=Q(t.size,{char:` `,background:t.theme.background}),{width:r,height:i}=t.size;if(r<=0||i<=0||e.length===0)return n;let a=e.at(-1).value,o=J(t.domain??Y([a])),s=Math.floor(i/2);for(let e=0;e<r;e+=1)n[s][e]={char:`─`,foreground:t.theme.grid,background:t.theme.background};for(let e=0;e<r;e+=1){let s=X(a[a.length===0?0:Math.min(a.length-1,Math.floor(e*a.length/r))]??0,o),c=Math.min(i-1,Math.max(0,Math.round((1-s)*(i-1))));n[c][e]={char:`▄`,foreground:Z(t.theme,s),background:t.theme.background}}return n}},zx={id:`volume-projection`,label:`Volume (max projection)`,accepts:`3d`,minimum:{width:2,height:2},render(e,t){let n=[];for(let t of e)for(let e=0;e<t.length;e+=1){let r=n[e]??=[],i=t[e];for(let e=0;e<i.length;e+=1){let t=i[e]??0;(r[e]===void 0||t>r[e])&&(r[e]=t)}}return Lx.render(n,t)}},Bx={id:`overlay`,label:`Overlay`,accepts:[`1dt`,`2d`],minimum:{width:8,height:4},perEntry:{rows:.25},suits:e=>(e.extent?.[0]??1)<=128,weight:1.05,render(e,t){let n=Q(t.size,{char:` `,background:t.theme.background}),{width:r,height:i}=t.size;if(r<=0||i<=0||e.length===0)return n;let a=Vx(e);if(a.length===0)return n;let o=J(t.domain??Y(a)),s=Hx(t.theme,a.length),c=new ux(t.size),l=c.resolution.width,u=c.resolution.height;for(let e=0;e<a.length;e+=1){let t=jb(a[e],l),n=s[e],r=t.map((e,t)=>({column:t,row:Math.min(u-1,Math.max(0,Math.round((1-X(e,o))*(u-1))))}));for(let e of Xb(r))c.plot(e.column,e.row,n)}return c.paint(n,{column:0,row:0},{background:t.theme.background}),n}};function Vx(e){let t=e[0];if(t===void 0)return[];if(Array.isArray(t))return e.map(e=>[...e]);let n=e,r=Math.max(...n.map(e=>e.value.length));return Array.from({length:r},(e,t)=>n.map(e=>e.value[t]??0))}function Hx(e,t){let n=[e.series,e.seriesAlt,...e.ramp];if(t<=n.length)return n.slice(0,t);let r=[...n];for(let e=n.length;e<t;e+=1)r.push(Ux(e*.618033988749895%1,.62,.68));return r}function Ux(e,t,n){let r=(1-Math.abs(2*n-1))*t,i=e*6,a=r*(1-Math.abs(i%2-1)),[o,s,c]=i<1?[r,a,0]:i<2?[a,r,0]:i<3?[0,r,a]:i<4?[0,a,r]:i<5?[a,0,r]:[r,0,a],l=n-r/2;return[Math.round((o+l)*255),Math.round((s+l)*255),Math.round((c+l)*255)]}var Wx=Object.freeze([Lx,Bx,{id:`scatter`,label:`Scatter`,accepts:`2d`,minimum:{width:8,height:4},weight:.9,suits:e=>{let t=e.extent?.[1];return t===void 0||t===2||t===3},render(e,t){let n=Q(t.size,{char:` `,background:t.theme.background}),{width:r,height:i}=t.size;if(r<=0||i<=0||e.length===0)return n;let a=new ux(t.size),o=e.map(e=>e[0]??0),s=e.map(e=>e[1]??0),c=J(Y([o])),l=J(Y([s])),u=e.map(e=>e[2]),d=u.some(e=>e!==void 0)?J(t.domain??Y([u.map(e=>e??0)])):void 0;for(let n=0;n<e.length;n+=1){let e=X(o[n]??0,c),r=X(s[n]??0,l),i=d?X(u[n]??0,d):r;a.plot(Math.round(e*(a.resolution.width-1)),Math.round((1-r)*(a.resolution.height-1)),Z(t.theme,i))}return a.paint(n,{column:0,row:0},{background:t.theme.background}),n}},Rx,zx]);function Gx(e,t={}){let n=(t.yaw??.12)*Math.PI*2,r=(t.pitch??.09)*Math.PI*2,i=t.distance??3.2,a=t.focal??1.6,o=t.cellAspect??2,s=(e.width-1)/2,c=(e.height-1)/2,l=e.width/2,u=e.height/2*o,d=Math.cos(n),f=Math.sin(n),p=Math.cos(r),m=Math.sin(r);return{project(e){let t=e.x*d-e.z*f,n=e.x*f+e.z*d,r=e.y*p+n*m,h=i+(n*p-e.y*m);if(h<=.05)return{column:0,row:0,depth:h,visible:!1};let g=a/h;return{column:s+t*g*l,row:c-r*g*u/o,depth:h,visible:!0}}}}function Kx(e,t){let n=t.max-t.min;return n===0?0:(e-t.min)/n*2-1}function qx(e,t,n){return n<=t?0:Math.min(1,Math.max(0,(e-t)/(n-t)))}var Jx=3.2;function Yx(e,t,n){return Kb(e,t,qx(n,Jx-1.2,4.6)*.65)}var Xx=Object.freeze([{id:`surface`,label:`Surface`,accepts:`2d`,minimum:{width:16,height:8},weight:.95,suits:e=>(e.extent?.[1]??0)!==2,render(e,t){let n=Q(t.size,{char:` `,background:t.theme.background}),{width:r,height:i}=t.size;if(r<=0||i<=0||e.length===0)return n;let a=J(t.domain??Y(e)),o=Gx(t.size,{yaw:.06,pitch:.145,distance:Jx}),s=e.length,c=Math.min(Math.max(...e.map(e=>e.length)),Math.max(2,r));if(c===0)return n;let l=e.map((e,t)=>{let n=jb(e,c);return Array.from({length:c},(e,r)=>{let i=X(n[r]??0,a),l={x:Kx(r,{min:0,max:Math.max(1,c-1)}),y:-.55+i*1.1,z:Kx(t,{min:0,max:Math.max(1,s-1)})};return{...o.project(l),heat:i}})}),u=Array(r).fill(1/0),d=Array.from({length:s},(e,t)=>t).sort((e,t)=>(l[e][0]?.depth??0)-(l[t][0]?.depth??0));for(let e of d){let i=l[e];for(let e=0;e+1<c;e+=1){let a=i[e],o=i[e+1];if(!a.visible||!o.visible)continue;let s={foreground:Yx(Z(t.theme,a.heat),t.theme.background,a.depth),background:t.theme.background},c=ax(a,o),l=Math.max(Math.abs(o.column-a.column),Math.abs(o.row-a.row),1);for(let e=0;e<=l;e+=1){let t=e/l,i=Math.round(a.column+(o.column-a.column)*t),d=Math.round(a.row+(o.row-a.row)*t);i<0||i>=r||d>=u[i]||(u[i]=d,ix(n,i,d,c,s))}}}return n}},{id:`ring-volume`,label:`Ring Volume`,accepts:`2d`,minimum:{width:14,height:7},weight:.85,suits:e=>(e.extent?.[1]??0)!==2,render(e,t){let n=Q(t.size,{char:` `,background:t.theme.background}),{width:r,height:i}=t.size;if(r<=0||i<=0||e.length===0)return n;let a=J(t.domain??Y(e)),o=Gx(t.size,{yaw:.02,pitch:.2,distance:3.6}),s=e.length,c=[];for(let t=0;t<s;t+=1){let n=e[t]??[],r=Kx(t,{min:0,max:Math.max(1,s-1)}),i,l;for(let e=0;e<=n.length;e+=1){let t=e%Math.max(1,n.length),s=X(n[t]??0,a),u=t/Math.max(1,n.length)*Math.PI*2,d=.58+s*.34,f=o.project({x:Math.cos(u)*d,y:r*.9,z:Math.sin(u)*d});e===0&&(l=f),c.push({at:f,heat:s,...i?{previous:i}:{}}),i=f}l&&i&&c.push({at:l,heat:0,previous:i})}c.sort((e,t)=>t.at.depth-e.at.depth);for(let e of c){if(!e.at.visible)continue;let r={foreground:Yx(Z(t.theme,e.heat),t.theme.background,e.at.depth),background:t.theme.background};e.previous?.visible&&sx(n,e.previous,e.at,ox,r)}return n}},{id:`point-cloud`,label:`Point Cloud`,accepts:`3d`,minimum:{width:12,height:6},weight:.9,render(e,t){let n=Q(t.size,{char:` `,background:t.theme.background}),{width:r,height:i}=t.size;if(r<=0||i<=0||e.length===0)return n;let a=Mb(e,t.domain),o=Gx(t.size,{yaw:.09,pitch:.1,distance:Jx}),s=e.length,c=new ux(t.size),l=[];for(let t=0;t<s;t+=1){let n=e[t]??[];for(let e=0;e<n.length;e+=1){let r=n[e]??[];for(let i=0;i<r.length;i+=1){let c=r[i]??0;if(c<=0)continue;let u=X(c,a);l.push({at:o.project({x:Kx(i,{min:0,max:Math.max(1,r.length-1)}),y:Kx(e,{min:0,max:Math.max(1,n.length-1)}),z:Kx(t,{min:0,max:Math.max(1,s-1)})}),heat:u})}}}l.sort((e,t)=>t.at.depth-e.at.depth);let u=c.resolution.width/r,d=c.resolution.height/i;for(let e of l)e.at.visible&&c.plot(Math.round(e.at.column*u),Math.round(e.at.row*d),Yx(Z(t.theme,e.heat),t.theme.background,e.at.depth));return c.paint(n,{column:0,row:0},{background:t.theme.background}),n}},{id:`vector-field`,label:`Vector Field`,accepts:`3d`,minimum:{width:14,height:7},weight:.9,suits:e=>e.extent?.[2]===3,render(e,t){let n=Q(t.size,{char:` `,background:t.theme.background}),{width:r,height:i}=t.size;if(r<=0||i<=0||e.length===0)return n;let a=Gx(t.size,{yaw:.1,pitch:.1,distance:Jx}),o=Math.min(e.length,Math.max(2,Math.floor(i/2))),s=e.flatMap(e=>e.map(e=>Math.hypot(e[0]??0,e[1]??0,e[2]??0))),c=J(t.domain??Y([s])),l=[];for(let t=0;t<o;t+=1){let n=e[Math.round(t*(e.length-1)/Math.max(1,o-1))]??[],i=Math.min(n.length,Math.max(2,Math.floor(r/6)));for(let e=0;e<i;e+=1){let r=n[Math.round(e*(n.length-1)/Math.max(1,i-1))]??[],s=Math.hypot(r[0]??0,r[1]??0,r[2]??0),u=X(s,c),d={x:Kx(e,{min:0,max:Math.max(1,i-1)}),y:0,z:Kx(t,{min:0,max:Math.max(1,o-1)})},f=.22*(s===0?0:u/Math.max(s,1e-6));l.push({from:a.project(d),to:a.project({x:d.x+(r[0]??0)*f,y:d.y+(r[1]??0)*f,z:d.z+(r[2]??0)*f}),heat:u})}}l.sort((e,t)=>t.from.depth-e.from.depth);for(let e of l){if(!e.from.visible||!e.to.visible)continue;let r={foreground:Yx(Z(t.theme,e.heat),t.theme.background,e.from.depth),background:t.theme.background};sx(n,e.from,e.to,ox,r),ix(n,e.to.column,e.to.row,`◆`,r)}return n}}]);Object.freeze([...wx,...Fx,...Wx,...Xx]);var Zx=JSON.parse(String.raw`{
  "schema": "deno-tui.unicode-data-pack",
  "schemaVersion": 1,
  "unicodeVersion": "17.0.0",
  "fingerprint": "4c885bc9201552e99c0797a4b8ea72db55fc2c315af3347ad53a9743c65bbfc2",
  "sources": [
    {
      "name": "east-asian-width",
      "url": "https://www.unicode.org/Public/17.0.0/ucd/EastAsianWidth.txt",
      "sha256": "ea7ce50f3444a050333448dffef1cadd9325af55cbb764b4a2280faf52170a33"
    },
    {
      "name": "emoji-properties",
      "url": "https://www.unicode.org/Public/17.0.0/ucd/emoji/emoji-data.txt",
      "sha256": "2cb2bb9455cda83e8481541ecf5b6dfda66a3bb89efa3fa7c5297eccf607b72b"
    },
    {
      "name": "grapheme-break",
      "url": "https://www.unicode.org/Public/17.0.0/ucd/auxiliary/GraphemeBreakProperty.txt",
      "sha256": "d6b51d1d2ae5c33b451b7ed994b48f1f4dc62b2272a5831e7fd418514a6bae89"
    }
  ],
  "tables": {
    "graphemeBreak": [
      {
        "start": 0,
        "end": 9,
        "value": "Control"
      },
      {
        "start": 10,
        "end": 10,
        "value": "LF"
      },
      {
        "start": 11,
        "end": 12,
        "value": "Control"
      },
      {
        "start": 13,
        "end": 13,
        "value": "CR"
      },
      {
        "start": 14,
        "end": 31,
        "value": "Control"
      },
      {
        "start": 127,
        "end": 159,
        "value": "Control"
      },
      {
        "start": 173,
        "end": 173,
        "value": "Control"
      },
      {
        "start": 768,
        "end": 879,
        "value": "Extend"
      },
      {
        "start": 1155,
        "end": 1161,
        "value": "Extend"
      },
      {
        "start": 1425,
        "end": 1469,
        "value": "Extend"
      },
      {
        "start": 1471,
        "end": 1471,
        "value": "Extend"
      },
      {
        "start": 1473,
        "end": 1474,
        "value": "Extend"
      },
      {
        "start": 1476,
        "end": 1477,
        "value": "Extend"
      },
      {
        "start": 1479,
        "end": 1479,
        "value": "Extend"
      },
      {
        "start": 1536,
        "end": 1541,
        "value": "Prepend"
      },
      {
        "start": 1552,
        "end": 1562,
        "value": "Extend"
      },
      {
        "start": 1564,
        "end": 1564,
        "value": "Control"
      },
      {
        "start": 1611,
        "end": 1631,
        "value": "Extend"
      },
      {
        "start": 1648,
        "end": 1648,
        "value": "Extend"
      },
      {
        "start": 1750,
        "end": 1756,
        "value": "Extend"
      },
      {
        "start": 1757,
        "end": 1757,
        "value": "Prepend"
      },
      {
        "start": 1759,
        "end": 1764,
        "value": "Extend"
      },
      {
        "start": 1767,
        "end": 1768,
        "value": "Extend"
      },
      {
        "start": 1770,
        "end": 1773,
        "value": "Extend"
      },
      {
        "start": 1807,
        "end": 1807,
        "value": "Prepend"
      },
      {
        "start": 1809,
        "end": 1809,
        "value": "Extend"
      },
      {
        "start": 1840,
        "end": 1866,
        "value": "Extend"
      },
      {
        "start": 1958,
        "end": 1968,
        "value": "Extend"
      },
      {
        "start": 2027,
        "end": 2035,
        "value": "Extend"
      },
      {
        "start": 2045,
        "end": 2045,
        "value": "Extend"
      },
      {
        "start": 2070,
        "end": 2073,
        "value": "Extend"
      },
      {
        "start": 2075,
        "end": 2083,
        "value": "Extend"
      },
      {
        "start": 2085,
        "end": 2087,
        "value": "Extend"
      },
      {
        "start": 2089,
        "end": 2093,
        "value": "Extend"
      },
      {
        "start": 2137,
        "end": 2139,
        "value": "Extend"
      },
      {
        "start": 2192,
        "end": 2193,
        "value": "Prepend"
      },
      {
        "start": 2199,
        "end": 2207,
        "value": "Extend"
      },
      {
        "start": 2250,
        "end": 2273,
        "value": "Extend"
      },
      {
        "start": 2274,
        "end": 2274,
        "value": "Prepend"
      },
      {
        "start": 2275,
        "end": 2306,
        "value": "Extend"
      },
      {
        "start": 2307,
        "end": 2307,
        "value": "SpacingMark"
      },
      {
        "start": 2362,
        "end": 2362,
        "value": "Extend"
      },
      {
        "start": 2363,
        "end": 2363,
        "value": "SpacingMark"
      },
      {
        "start": 2364,
        "end": 2364,
        "value": "Extend"
      },
      {
        "start": 2366,
        "end": 2368,
        "value": "SpacingMark"
      },
      {
        "start": 2369,
        "end": 2376,
        "value": "Extend"
      },
      {
        "start": 2377,
        "end": 2380,
        "value": "SpacingMark"
      },
      {
        "start": 2381,
        "end": 2381,
        "value": "Extend"
      },
      {
        "start": 2382,
        "end": 2383,
        "value": "SpacingMark"
      },
      {
        "start": 2385,
        "end": 2391,
        "value": "Extend"
      },
      {
        "start": 2402,
        "end": 2403,
        "value": "Extend"
      },
      {
        "start": 2433,
        "end": 2433,
        "value": "Extend"
      },
      {
        "start": 2434,
        "end": 2435,
        "value": "SpacingMark"
      },
      {
        "start": 2492,
        "end": 2492,
        "value": "Extend"
      },
      {
        "start": 2494,
        "end": 2494,
        "value": "Extend"
      },
      {
        "start": 2495,
        "end": 2496,
        "value": "SpacingMark"
      },
      {
        "start": 2497,
        "end": 2500,
        "value": "Extend"
      },
      {
        "start": 2503,
        "end": 2504,
        "value": "SpacingMark"
      },
      {
        "start": 2507,
        "end": 2508,
        "value": "SpacingMark"
      },
      {
        "start": 2509,
        "end": 2509,
        "value": "Extend"
      },
      {
        "start": 2519,
        "end": 2519,
        "value": "Extend"
      },
      {
        "start": 2530,
        "end": 2531,
        "value": "Extend"
      },
      {
        "start": 2558,
        "end": 2558,
        "value": "Extend"
      },
      {
        "start": 2561,
        "end": 2562,
        "value": "Extend"
      },
      {
        "start": 2563,
        "end": 2563,
        "value": "SpacingMark"
      },
      {
        "start": 2620,
        "end": 2620,
        "value": "Extend"
      },
      {
        "start": 2622,
        "end": 2624,
        "value": "SpacingMark"
      },
      {
        "start": 2625,
        "end": 2626,
        "value": "Extend"
      },
      {
        "start": 2631,
        "end": 2632,
        "value": "Extend"
      },
      {
        "start": 2635,
        "end": 2637,
        "value": "Extend"
      },
      {
        "start": 2641,
        "end": 2641,
        "value": "Extend"
      },
      {
        "start": 2672,
        "end": 2673,
        "value": "Extend"
      },
      {
        "start": 2677,
        "end": 2677,
        "value": "Extend"
      },
      {
        "start": 2689,
        "end": 2690,
        "value": "Extend"
      },
      {
        "start": 2691,
        "end": 2691,
        "value": "SpacingMark"
      },
      {
        "start": 2748,
        "end": 2748,
        "value": "Extend"
      },
      {
        "start": 2750,
        "end": 2752,
        "value": "SpacingMark"
      },
      {
        "start": 2753,
        "end": 2757,
        "value": "Extend"
      },
      {
        "start": 2759,
        "end": 2760,
        "value": "Extend"
      },
      {
        "start": 2761,
        "end": 2761,
        "value": "SpacingMark"
      },
      {
        "start": 2763,
        "end": 2764,
        "value": "SpacingMark"
      },
      {
        "start": 2765,
        "end": 2765,
        "value": "Extend"
      },
      {
        "start": 2786,
        "end": 2787,
        "value": "Extend"
      },
      {
        "start": 2810,
        "end": 2815,
        "value": "Extend"
      },
      {
        "start": 2817,
        "end": 2817,
        "value": "Extend"
      },
      {
        "start": 2818,
        "end": 2819,
        "value": "SpacingMark"
      },
      {
        "start": 2876,
        "end": 2876,
        "value": "Extend"
      },
      {
        "start": 2878,
        "end": 2879,
        "value": "Extend"
      },
      {
        "start": 2880,
        "end": 2880,
        "value": "SpacingMark"
      },
      {
        "start": 2881,
        "end": 2884,
        "value": "Extend"
      },
      {
        "start": 2887,
        "end": 2888,
        "value": "SpacingMark"
      },
      {
        "start": 2891,
        "end": 2892,
        "value": "SpacingMark"
      },
      {
        "start": 2893,
        "end": 2893,
        "value": "Extend"
      },
      {
        "start": 2901,
        "end": 2903,
        "value": "Extend"
      },
      {
        "start": 2914,
        "end": 2915,
        "value": "Extend"
      },
      {
        "start": 2946,
        "end": 2946,
        "value": "Extend"
      },
      {
        "start": 3006,
        "end": 3006,
        "value": "Extend"
      },
      {
        "start": 3007,
        "end": 3007,
        "value": "SpacingMark"
      },
      {
        "start": 3008,
        "end": 3008,
        "value": "Extend"
      },
      {
        "start": 3009,
        "end": 3010,
        "value": "SpacingMark"
      },
      {
        "start": 3014,
        "end": 3016,
        "value": "SpacingMark"
      },
      {
        "start": 3018,
        "end": 3020,
        "value": "SpacingMark"
      },
      {
        "start": 3021,
        "end": 3021,
        "value": "Extend"
      },
      {
        "start": 3031,
        "end": 3031,
        "value": "Extend"
      },
      {
        "start": 3072,
        "end": 3072,
        "value": "Extend"
      },
      {
        "start": 3073,
        "end": 3075,
        "value": "SpacingMark"
      },
      {
        "start": 3076,
        "end": 3076,
        "value": "Extend"
      },
      {
        "start": 3132,
        "end": 3132,
        "value": "Extend"
      },
      {
        "start": 3134,
        "end": 3136,
        "value": "Extend"
      },
      {
        "start": 3137,
        "end": 3140,
        "value": "SpacingMark"
      },
      {
        "start": 3142,
        "end": 3144,
        "value": "Extend"
      },
      {
        "start": 3146,
        "end": 3149,
        "value": "Extend"
      },
      {
        "start": 3157,
        "end": 3158,
        "value": "Extend"
      },
      {
        "start": 3170,
        "end": 3171,
        "value": "Extend"
      },
      {
        "start": 3201,
        "end": 3201,
        "value": "Extend"
      },
      {
        "start": 3202,
        "end": 3203,
        "value": "SpacingMark"
      },
      {
        "start": 3260,
        "end": 3260,
        "value": "Extend"
      },
      {
        "start": 3262,
        "end": 3262,
        "value": "SpacingMark"
      },
      {
        "start": 3263,
        "end": 3264,
        "value": "Extend"
      },
      {
        "start": 3265,
        "end": 3265,
        "value": "SpacingMark"
      },
      {
        "start": 3266,
        "end": 3266,
        "value": "Extend"
      },
      {
        "start": 3267,
        "end": 3268,
        "value": "SpacingMark"
      },
      {
        "start": 3270,
        "end": 3272,
        "value": "Extend"
      },
      {
        "start": 3274,
        "end": 3277,
        "value": "Extend"
      },
      {
        "start": 3285,
        "end": 3286,
        "value": "Extend"
      },
      {
        "start": 3298,
        "end": 3299,
        "value": "Extend"
      },
      {
        "start": 3315,
        "end": 3315,
        "value": "SpacingMark"
      },
      {
        "start": 3328,
        "end": 3329,
        "value": "Extend"
      },
      {
        "start": 3330,
        "end": 3331,
        "value": "SpacingMark"
      },
      {
        "start": 3387,
        "end": 3388,
        "value": "Extend"
      },
      {
        "start": 3390,
        "end": 3390,
        "value": "Extend"
      },
      {
        "start": 3391,
        "end": 3392,
        "value": "SpacingMark"
      },
      {
        "start": 3393,
        "end": 3396,
        "value": "Extend"
      },
      {
        "start": 3398,
        "end": 3400,
        "value": "SpacingMark"
      },
      {
        "start": 3402,
        "end": 3404,
        "value": "SpacingMark"
      },
      {
        "start": 3405,
        "end": 3405,
        "value": "Extend"
      },
      {
        "start": 3406,
        "end": 3406,
        "value": "Prepend"
      },
      {
        "start": 3415,
        "end": 3415,
        "value": "Extend"
      },
      {
        "start": 3426,
        "end": 3427,
        "value": "Extend"
      },
      {
        "start": 3457,
        "end": 3457,
        "value": "Extend"
      },
      {
        "start": 3458,
        "end": 3459,
        "value": "SpacingMark"
      },
      {
        "start": 3530,
        "end": 3530,
        "value": "Extend"
      },
      {
        "start": 3535,
        "end": 3535,
        "value": "Extend"
      },
      {
        "start": 3536,
        "end": 3537,
        "value": "SpacingMark"
      },
      {
        "start": 3538,
        "end": 3540,
        "value": "Extend"
      },
      {
        "start": 3542,
        "end": 3542,
        "value": "Extend"
      },
      {
        "start": 3544,
        "end": 3550,
        "value": "SpacingMark"
      },
      {
        "start": 3551,
        "end": 3551,
        "value": "Extend"
      },
      {
        "start": 3570,
        "end": 3571,
        "value": "SpacingMark"
      },
      {
        "start": 3633,
        "end": 3633,
        "value": "Extend"
      },
      {
        "start": 3635,
        "end": 3635,
        "value": "SpacingMark"
      },
      {
        "start": 3636,
        "end": 3642,
        "value": "Extend"
      },
      {
        "start": 3655,
        "end": 3662,
        "value": "Extend"
      },
      {
        "start": 3761,
        "end": 3761,
        "value": "Extend"
      },
      {
        "start": 3763,
        "end": 3763,
        "value": "SpacingMark"
      },
      {
        "start": 3764,
        "end": 3772,
        "value": "Extend"
      },
      {
        "start": 3784,
        "end": 3790,
        "value": "Extend"
      },
      {
        "start": 3864,
        "end": 3865,
        "value": "Extend"
      },
      {
        "start": 3893,
        "end": 3893,
        "value": "Extend"
      },
      {
        "start": 3895,
        "end": 3895,
        "value": "Extend"
      },
      {
        "start": 3897,
        "end": 3897,
        "value": "Extend"
      },
      {
        "start": 3902,
        "end": 3903,
        "value": "SpacingMark"
      },
      {
        "start": 3953,
        "end": 3966,
        "value": "Extend"
      },
      {
        "start": 3967,
        "end": 3967,
        "value": "SpacingMark"
      },
      {
        "start": 3968,
        "end": 3972,
        "value": "Extend"
      },
      {
        "start": 3974,
        "end": 3975,
        "value": "Extend"
      },
      {
        "start": 3981,
        "end": 3991,
        "value": "Extend"
      },
      {
        "start": 3993,
        "end": 4028,
        "value": "Extend"
      },
      {
        "start": 4038,
        "end": 4038,
        "value": "Extend"
      },
      {
        "start": 4141,
        "end": 4144,
        "value": "Extend"
      },
      {
        "start": 4145,
        "end": 4145,
        "value": "SpacingMark"
      },
      {
        "start": 4146,
        "end": 4151,
        "value": "Extend"
      },
      {
        "start": 4153,
        "end": 4154,
        "value": "Extend"
      },
      {
        "start": 4155,
        "end": 4156,
        "value": "SpacingMark"
      },
      {
        "start": 4157,
        "end": 4158,
        "value": "Extend"
      },
      {
        "start": 4182,
        "end": 4183,
        "value": "SpacingMark"
      },
      {
        "start": 4184,
        "end": 4185,
        "value": "Extend"
      },
      {
        "start": 4190,
        "end": 4192,
        "value": "Extend"
      },
      {
        "start": 4209,
        "end": 4212,
        "value": "Extend"
      },
      {
        "start": 4226,
        "end": 4226,
        "value": "Extend"
      },
      {
        "start": 4228,
        "end": 4228,
        "value": "SpacingMark"
      },
      {
        "start": 4229,
        "end": 4230,
        "value": "Extend"
      },
      {
        "start": 4237,
        "end": 4237,
        "value": "Extend"
      },
      {
        "start": 4253,
        "end": 4253,
        "value": "Extend"
      },
      {
        "start": 4352,
        "end": 4447,
        "value": "L"
      },
      {
        "start": 4448,
        "end": 4519,
        "value": "V"
      },
      {
        "start": 4520,
        "end": 4607,
        "value": "T"
      },
      {
        "start": 4957,
        "end": 4959,
        "value": "Extend"
      },
      {
        "start": 5906,
        "end": 5909,
        "value": "Extend"
      },
      {
        "start": 5938,
        "end": 5940,
        "value": "Extend"
      },
      {
        "start": 5970,
        "end": 5971,
        "value": "Extend"
      },
      {
        "start": 6002,
        "end": 6003,
        "value": "Extend"
      },
      {
        "start": 6068,
        "end": 6069,
        "value": "Extend"
      },
      {
        "start": 6070,
        "end": 6070,
        "value": "SpacingMark"
      },
      {
        "start": 6071,
        "end": 6077,
        "value": "Extend"
      },
      {
        "start": 6078,
        "end": 6085,
        "value": "SpacingMark"
      },
      {
        "start": 6086,
        "end": 6086,
        "value": "Extend"
      },
      {
        "start": 6087,
        "end": 6088,
        "value": "SpacingMark"
      },
      {
        "start": 6089,
        "end": 6099,
        "value": "Extend"
      },
      {
        "start": 6109,
        "end": 6109,
        "value": "Extend"
      },
      {
        "start": 6155,
        "end": 6157,
        "value": "Extend"
      },
      {
        "start": 6158,
        "end": 6158,
        "value": "Control"
      },
      {
        "start": 6159,
        "end": 6159,
        "value": "Extend"
      },
      {
        "start": 6277,
        "end": 6278,
        "value": "Extend"
      },
      {
        "start": 6313,
        "end": 6313,
        "value": "Extend"
      },
      {
        "start": 6432,
        "end": 6434,
        "value": "Extend"
      },
      {
        "start": 6435,
        "end": 6438,
        "value": "SpacingMark"
      },
      {
        "start": 6439,
        "end": 6440,
        "value": "Extend"
      },
      {
        "start": 6441,
        "end": 6443,
        "value": "SpacingMark"
      },
      {
        "start": 6448,
        "end": 6449,
        "value": "SpacingMark"
      },
      {
        "start": 6450,
        "end": 6450,
        "value": "Extend"
      },
      {
        "start": 6451,
        "end": 6456,
        "value": "SpacingMark"
      },
      {
        "start": 6457,
        "end": 6459,
        "value": "Extend"
      },
      {
        "start": 6679,
        "end": 6680,
        "value": "Extend"
      },
      {
        "start": 6681,
        "end": 6682,
        "value": "SpacingMark"
      },
      {
        "start": 6683,
        "end": 6683,
        "value": "Extend"
      },
      {
        "start": 6741,
        "end": 6741,
        "value": "SpacingMark"
      },
      {
        "start": 6742,
        "end": 6742,
        "value": "Extend"
      },
      {
        "start": 6743,
        "end": 6743,
        "value": "SpacingMark"
      },
      {
        "start": 6744,
        "end": 6750,
        "value": "Extend"
      },
      {
        "start": 6752,
        "end": 6752,
        "value": "Extend"
      },
      {
        "start": 6754,
        "end": 6754,
        "value": "Extend"
      },
      {
        "start": 6757,
        "end": 6764,
        "value": "Extend"
      },
      {
        "start": 6765,
        "end": 6770,
        "value": "SpacingMark"
      },
      {
        "start": 6771,
        "end": 6780,
        "value": "Extend"
      },
      {
        "start": 6783,
        "end": 6783,
        "value": "Extend"
      },
      {
        "start": 6832,
        "end": 6877,
        "value": "Extend"
      },
      {
        "start": 6880,
        "end": 6891,
        "value": "Extend"
      },
      {
        "start": 6912,
        "end": 6915,
        "value": "Extend"
      },
      {
        "start": 6916,
        "end": 6916,
        "value": "SpacingMark"
      },
      {
        "start": 6964,
        "end": 6973,
        "value": "Extend"
      },
      {
        "start": 6974,
        "end": 6977,
        "value": "SpacingMark"
      },
      {
        "start": 6978,
        "end": 6980,
        "value": "Extend"
      },
      {
        "start": 7019,
        "end": 7027,
        "value": "Extend"
      },
      {
        "start": 7040,
        "end": 7041,
        "value": "Extend"
      },
      {
        "start": 7042,
        "end": 7042,
        "value": "SpacingMark"
      },
      {
        "start": 7073,
        "end": 7073,
        "value": "SpacingMark"
      },
      {
        "start": 7074,
        "end": 7077,
        "value": "Extend"
      },
      {
        "start": 7078,
        "end": 7079,
        "value": "SpacingMark"
      },
      {
        "start": 7080,
        "end": 7085,
        "value": "Extend"
      },
      {
        "start": 7142,
        "end": 7142,
        "value": "Extend"
      },
      {
        "start": 7143,
        "end": 7143,
        "value": "SpacingMark"
      },
      {
        "start": 7144,
        "end": 7145,
        "value": "Extend"
      },
      {
        "start": 7146,
        "end": 7148,
        "value": "SpacingMark"
      },
      {
        "start": 7149,
        "end": 7149,
        "value": "Extend"
      },
      {
        "start": 7150,
        "end": 7150,
        "value": "SpacingMark"
      },
      {
        "start": 7151,
        "end": 7155,
        "value": "Extend"
      },
      {
        "start": 7204,
        "end": 7211,
        "value": "SpacingMark"
      },
      {
        "start": 7212,
        "end": 7219,
        "value": "Extend"
      },
      {
        "start": 7220,
        "end": 7221,
        "value": "SpacingMark"
      },
      {
        "start": 7222,
        "end": 7223,
        "value": "Extend"
      },
      {
        "start": 7376,
        "end": 7378,
        "value": "Extend"
      },
      {
        "start": 7380,
        "end": 7392,
        "value": "Extend"
      },
      {
        "start": 7393,
        "end": 7393,
        "value": "SpacingMark"
      },
      {
        "start": 7394,
        "end": 7400,
        "value": "Extend"
      },
      {
        "start": 7405,
        "end": 7405,
        "value": "Extend"
      },
      {
        "start": 7412,
        "end": 7412,
        "value": "Extend"
      },
      {
        "start": 7415,
        "end": 7415,
        "value": "SpacingMark"
      },
      {
        "start": 7416,
        "end": 7417,
        "value": "Extend"
      },
      {
        "start": 7616,
        "end": 7679,
        "value": "Extend"
      },
      {
        "start": 8203,
        "end": 8203,
        "value": "Control"
      },
      {
        "start": 8204,
        "end": 8204,
        "value": "Extend"
      },
      {
        "start": 8205,
        "end": 8205,
        "value": "ZWJ"
      },
      {
        "start": 8206,
        "end": 8207,
        "value": "Control"
      },
      {
        "start": 8232,
        "end": 8238,
        "value": "Control"
      },
      {
        "start": 8288,
        "end": 8303,
        "value": "Control"
      },
      {
        "start": 8400,
        "end": 8432,
        "value": "Extend"
      },
      {
        "start": 11503,
        "end": 11505,
        "value": "Extend"
      },
      {
        "start": 11647,
        "end": 11647,
        "value": "Extend"
      },
      {
        "start": 11744,
        "end": 11775,
        "value": "Extend"
      },
      {
        "start": 12330,
        "end": 12335,
        "value": "Extend"
      },
      {
        "start": 12441,
        "end": 12442,
        "value": "Extend"
      },
      {
        "start": 42607,
        "end": 42610,
        "value": "Extend"
      },
      {
        "start": 42612,
        "end": 42621,
        "value": "Extend"
      },
      {
        "start": 42654,
        "end": 42655,
        "value": "Extend"
      },
      {
        "start": 42736,
        "end": 42737,
        "value": "Extend"
      },
      {
        "start": 43010,
        "end": 43010,
        "value": "Extend"
      },
      {
        "start": 43014,
        "end": 43014,
        "value": "Extend"
      },
      {
        "start": 43019,
        "end": 43019,
        "value": "Extend"
      },
      {
        "start": 43043,
        "end": 43044,
        "value": "SpacingMark"
      },
      {
        "start": 43045,
        "end": 43046,
        "value": "Extend"
      },
      {
        "start": 43047,
        "end": 43047,
        "value": "SpacingMark"
      },
      {
        "start": 43052,
        "end": 43052,
        "value": "Extend"
      },
      {
        "start": 43136,
        "end": 43137,
        "value": "SpacingMark"
      },
      {
        "start": 43188,
        "end": 43203,
        "value": "SpacingMark"
      },
      {
        "start": 43204,
        "end": 43205,
        "value": "Extend"
      },
      {
        "start": 43232,
        "end": 43249,
        "value": "Extend"
      },
      {
        "start": 43263,
        "end": 43263,
        "value": "Extend"
      },
      {
        "start": 43302,
        "end": 43309,
        "value": "Extend"
      },
      {
        "start": 43335,
        "end": 43345,
        "value": "Extend"
      },
      {
        "start": 43346,
        "end": 43346,
        "value": "SpacingMark"
      },
      {
        "start": 43347,
        "end": 43347,
        "value": "Extend"
      },
      {
        "start": 43360,
        "end": 43388,
        "value": "L"
      },
      {
        "start": 43392,
        "end": 43394,
        "value": "Extend"
      },
      {
        "start": 43395,
        "end": 43395,
        "value": "SpacingMark"
      },
      {
        "start": 43443,
        "end": 43443,
        "value": "Extend"
      },
      {
        "start": 43444,
        "end": 43445,
        "value": "SpacingMark"
      },
      {
        "start": 43446,
        "end": 43449,
        "value": "Extend"
      },
      {
        "start": 43450,
        "end": 43451,
        "value": "SpacingMark"
      },
      {
        "start": 43452,
        "end": 43453,
        "value": "Extend"
      },
      {
        "start": 43454,
        "end": 43455,
        "value": "SpacingMark"
      },
      {
        "start": 43456,
        "end": 43456,
        "value": "Extend"
      },
      {
        "start": 43493,
        "end": 43493,
        "value": "Extend"
      },
      {
        "start": 43561,
        "end": 43566,
        "value": "Extend"
      },
      {
        "start": 43567,
        "end": 43568,
        "value": "SpacingMark"
      },
      {
        "start": 43569,
        "end": 43570,
        "value": "Extend"
      },
      {
        "start": 43571,
        "end": 43572,
        "value": "SpacingMark"
      },
      {
        "start": 43573,
        "end": 43574,
        "value": "Extend"
      },
      {
        "start": 43587,
        "end": 43587,
        "value": "Extend"
      },
      {
        "start": 43596,
        "end": 43596,
        "value": "Extend"
      },
      {
        "start": 43597,
        "end": 43597,
        "value": "SpacingMark"
      },
      {
        "start": 43644,
        "end": 43644,
        "value": "Extend"
      },
      {
        "start": 43696,
        "end": 43696,
        "value": "Extend"
      },
      {
        "start": 43698,
        "end": 43700,
        "value": "Extend"
      },
      {
        "start": 43703,
        "end": 43704,
        "value": "Extend"
      },
      {
        "start": 43710,
        "end": 43711,
        "value": "Extend"
      },
      {
        "start": 43713,
        "end": 43713,
        "value": "Extend"
      },
      {
        "start": 43755,
        "end": 43755,
        "value": "SpacingMark"
      },
      {
        "start": 43756,
        "end": 43757,
        "value": "Extend"
      },
      {
        "start": 43758,
        "end": 43759,
        "value": "SpacingMark"
      },
      {
        "start": 43765,
        "end": 43765,
        "value": "SpacingMark"
      },
      {
        "start": 43766,
        "end": 43766,
        "value": "Extend"
      },
      {
        "start": 44003,
        "end": 44004,
        "value": "SpacingMark"
      },
      {
        "start": 44005,
        "end": 44005,
        "value": "Extend"
      },
      {
        "start": 44006,
        "end": 44007,
        "value": "SpacingMark"
      },
      {
        "start": 44008,
        "end": 44008,
        "value": "Extend"
      },
      {
        "start": 44009,
        "end": 44010,
        "value": "SpacingMark"
      },
      {
        "start": 44012,
        "end": 44012,
        "value": "SpacingMark"
      },
      {
        "start": 44013,
        "end": 44013,
        "value": "Extend"
      },
      {
        "start": 44032,
        "end": 44032,
        "value": "LV"
      },
      {
        "start": 44033,
        "end": 44059,
        "value": "LVT"
      },
      {
        "start": 44060,
        "end": 44060,
        "value": "LV"
      },
      {
        "start": 44061,
        "end": 44087,
        "value": "LVT"
      },
      {
        "start": 44088,
        "end": 44088,
        "value": "LV"
      },
      {
        "start": 44089,
        "end": 44115,
        "value": "LVT"
      },
      {
        "start": 44116,
        "end": 44116,
        "value": "LV"
      },
      {
        "start": 44117,
        "end": 44143,
        "value": "LVT"
      },
      {
        "start": 44144,
        "end": 44144,
        "value": "LV"
      },
      {
        "start": 44145,
        "end": 44171,
        "value": "LVT"
      },
      {
        "start": 44172,
        "end": 44172,
        "value": "LV"
      },
      {
        "start": 44173,
        "end": 44199,
        "value": "LVT"
      },
      {
        "start": 44200,
        "end": 44200,
        "value": "LV"
      },
      {
        "start": 44201,
        "end": 44227,
        "value": "LVT"
      },
      {
        "start": 44228,
        "end": 44228,
        "value": "LV"
      },
      {
        "start": 44229,
        "end": 44255,
        "value": "LVT"
      },
      {
        "start": 44256,
        "end": 44256,
        "value": "LV"
      },
      {
        "start": 44257,
        "end": 44283,
        "value": "LVT"
      },
      {
        "start": 44284,
        "end": 44284,
        "value": "LV"
      },
      {
        "start": 44285,
        "end": 44311,
        "value": "LVT"
      },
      {
        "start": 44312,
        "end": 44312,
        "value": "LV"
      },
      {
        "start": 44313,
        "end": 44339,
        "value": "LVT"
      },
      {
        "start": 44340,
        "end": 44340,
        "value": "LV"
      },
      {
        "start": 44341,
        "end": 44367,
        "value": "LVT"
      },
      {
        "start": 44368,
        "end": 44368,
        "value": "LV"
      },
      {
        "start": 44369,
        "end": 44395,
        "value": "LVT"
      },
      {
        "start": 44396,
        "end": 44396,
        "value": "LV"
      },
      {
        "start": 44397,
        "end": 44423,
        "value": "LVT"
      },
      {
        "start": 44424,
        "end": 44424,
        "value": "LV"
      },
      {
        "start": 44425,
        "end": 44451,
        "value": "LVT"
      },
      {
        "start": 44452,
        "end": 44452,
        "value": "LV"
      },
      {
        "start": 44453,
        "end": 44479,
        "value": "LVT"
      },
      {
        "start": 44480,
        "end": 44480,
        "value": "LV"
      },
      {
        "start": 44481,
        "end": 44507,
        "value": "LVT"
      },
      {
        "start": 44508,
        "end": 44508,
        "value": "LV"
      },
      {
        "start": 44509,
        "end": 44535,
        "value": "LVT"
      },
      {
        "start": 44536,
        "end": 44536,
        "value": "LV"
      },
      {
        "start": 44537,
        "end": 44563,
        "value": "LVT"
      },
      {
        "start": 44564,
        "end": 44564,
        "value": "LV"
      },
      {
        "start": 44565,
        "end": 44591,
        "value": "LVT"
      },
      {
        "start": 44592,
        "end": 44592,
        "value": "LV"
      },
      {
        "start": 44593,
        "end": 44619,
        "value": "LVT"
      },
      {
        "start": 44620,
        "end": 44620,
        "value": "LV"
      },
      {
        "start": 44621,
        "end": 44647,
        "value": "LVT"
      },
      {
        "start": 44648,
        "end": 44648,
        "value": "LV"
      },
      {
        "start": 44649,
        "end": 44675,
        "value": "LVT"
      },
      {
        "start": 44676,
        "end": 44676,
        "value": "LV"
      },
      {
        "start": 44677,
        "end": 44703,
        "value": "LVT"
      },
      {
        "start": 44704,
        "end": 44704,
        "value": "LV"
      },
      {
        "start": 44705,
        "end": 44731,
        "value": "LVT"
      },
      {
        "start": 44732,
        "end": 44732,
        "value": "LV"
      },
      {
        "start": 44733,
        "end": 44759,
        "value": "LVT"
      },
      {
        "start": 44760,
        "end": 44760,
        "value": "LV"
      },
      {
        "start": 44761,
        "end": 44787,
        "value": "LVT"
      },
      {
        "start": 44788,
        "end": 44788,
        "value": "LV"
      },
      {
        "start": 44789,
        "end": 44815,
        "value": "LVT"
      },
      {
        "start": 44816,
        "end": 44816,
        "value": "LV"
      },
      {
        "start": 44817,
        "end": 44843,
        "value": "LVT"
      },
      {
        "start": 44844,
        "end": 44844,
        "value": "LV"
      },
      {
        "start": 44845,
        "end": 44871,
        "value": "LVT"
      },
      {
        "start": 44872,
        "end": 44872,
        "value": "LV"
      },
      {
        "start": 44873,
        "end": 44899,
        "value": "LVT"
      },
      {
        "start": 44900,
        "end": 44900,
        "value": "LV"
      },
      {
        "start": 44901,
        "end": 44927,
        "value": "LVT"
      },
      {
        "start": 44928,
        "end": 44928,
        "value": "LV"
      },
      {
        "start": 44929,
        "end": 44955,
        "value": "LVT"
      },
      {
        "start": 44956,
        "end": 44956,
        "value": "LV"
      },
      {
        "start": 44957,
        "end": 44983,
        "value": "LVT"
      },
      {
        "start": 44984,
        "end": 44984,
        "value": "LV"
      },
      {
        "start": 44985,
        "end": 45011,
        "value": "LVT"
      },
      {
        "start": 45012,
        "end": 45012,
        "value": "LV"
      },
      {
        "start": 45013,
        "end": 45039,
        "value": "LVT"
      },
      {
        "start": 45040,
        "end": 45040,
        "value": "LV"
      },
      {
        "start": 45041,
        "end": 45067,
        "value": "LVT"
      },
      {
        "start": 45068,
        "end": 45068,
        "value": "LV"
      },
      {
        "start": 45069,
        "end": 45095,
        "value": "LVT"
      },
      {
        "start": 45096,
        "end": 45096,
        "value": "LV"
      },
      {
        "start": 45097,
        "end": 45123,
        "value": "LVT"
      },
      {
        "start": 45124,
        "end": 45124,
        "value": "LV"
      },
      {
        "start": 45125,
        "end": 45151,
        "value": "LVT"
      },
      {
        "start": 45152,
        "end": 45152,
        "value": "LV"
      },
      {
        "start": 45153,
        "end": 45179,
        "value": "LVT"
      },
      {
        "start": 45180,
        "end": 45180,
        "value": "LV"
      },
      {
        "start": 45181,
        "end": 45207,
        "value": "LVT"
      },
      {
        "start": 45208,
        "end": 45208,
        "value": "LV"
      },
      {
        "start": 45209,
        "end": 45235,
        "value": "LVT"
      },
      {
        "start": 45236,
        "end": 45236,
        "value": "LV"
      },
      {
        "start": 45237,
        "end": 45263,
        "value": "LVT"
      },
      {
        "start": 45264,
        "end": 45264,
        "value": "LV"
      },
      {
        "start": 45265,
        "end": 45291,
        "value": "LVT"
      },
      {
        "start": 45292,
        "end": 45292,
        "value": "LV"
      },
      {
        "start": 45293,
        "end": 45319,
        "value": "LVT"
      },
      {
        "start": 45320,
        "end": 45320,
        "value": "LV"
      },
      {
        "start": 45321,
        "end": 45347,
        "value": "LVT"
      },
      {
        "start": 45348,
        "end": 45348,
        "value": "LV"
      },
      {
        "start": 45349,
        "end": 45375,
        "value": "LVT"
      },
      {
        "start": 45376,
        "end": 45376,
        "value": "LV"
      },
      {
        "start": 45377,
        "end": 45403,
        "value": "LVT"
      },
      {
        "start": 45404,
        "end": 45404,
        "value": "LV"
      },
      {
        "start": 45405,
        "end": 45431,
        "value": "LVT"
      },
      {
        "start": 45432,
        "end": 45432,
        "value": "LV"
      },
      {
        "start": 45433,
        "end": 45459,
        "value": "LVT"
      },
      {
        "start": 45460,
        "end": 45460,
        "value": "LV"
      },
      {
        "start": 45461,
        "end": 45487,
        "value": "LVT"
      },
      {
        "start": 45488,
        "end": 45488,
        "value": "LV"
      },
      {
        "start": 45489,
        "end": 45515,
        "value": "LVT"
      },
      {
        "start": 45516,
        "end": 45516,
        "value": "LV"
      },
      {
        "start": 45517,
        "end": 45543,
        "value": "LVT"
      },
      {
        "start": 45544,
        "end": 45544,
        "value": "LV"
      },
      {
        "start": 45545,
        "end": 45571,
        "value": "LVT"
      },
      {
        "start": 45572,
        "end": 45572,
        "value": "LV"
      },
      {
        "start": 45573,
        "end": 45599,
        "value": "LVT"
      },
      {
        "start": 45600,
        "end": 45600,
        "value": "LV"
      },
      {
        "start": 45601,
        "end": 45627,
        "value": "LVT"
      },
      {
        "start": 45628,
        "end": 45628,
        "value": "LV"
      },
      {
        "start": 45629,
        "end": 45655,
        "value": "LVT"
      },
      {
        "start": 45656,
        "end": 45656,
        "value": "LV"
      },
      {
        "start": 45657,
        "end": 45683,
        "value": "LVT"
      },
      {
        "start": 45684,
        "end": 45684,
        "value": "LV"
      },
      {
        "start": 45685,
        "end": 45711,
        "value": "LVT"
      },
      {
        "start": 45712,
        "end": 45712,
        "value": "LV"
      },
      {
        "start": 45713,
        "end": 45739,
        "value": "LVT"
      },
      {
        "start": 45740,
        "end": 45740,
        "value": "LV"
      },
      {
        "start": 45741,
        "end": 45767,
        "value": "LVT"
      },
      {
        "start": 45768,
        "end": 45768,
        "value": "LV"
      },
      {
        "start": 45769,
        "end": 45795,
        "value": "LVT"
      },
      {
        "start": 45796,
        "end": 45796,
        "value": "LV"
      },
      {
        "start": 45797,
        "end": 45823,
        "value": "LVT"
      },
      {
        "start": 45824,
        "end": 45824,
        "value": "LV"
      },
      {
        "start": 45825,
        "end": 45851,
        "value": "LVT"
      },
      {
        "start": 45852,
        "end": 45852,
        "value": "LV"
      },
      {
        "start": 45853,
        "end": 45879,
        "value": "LVT"
      },
      {
        "start": 45880,
        "end": 45880,
        "value": "LV"
      },
      {
        "start": 45881,
        "end": 45907,
        "value": "LVT"
      },
      {
        "start": 45908,
        "end": 45908,
        "value": "LV"
      },
      {
        "start": 45909,
        "end": 45935,
        "value": "LVT"
      },
      {
        "start": 45936,
        "end": 45936,
        "value": "LV"
      },
      {
        "start": 45937,
        "end": 45963,
        "value": "LVT"
      },
      {
        "start": 45964,
        "end": 45964,
        "value": "LV"
      },
      {
        "start": 45965,
        "end": 45991,
        "value": "LVT"
      },
      {
        "start": 45992,
        "end": 45992,
        "value": "LV"
      },
      {
        "start": 45993,
        "end": 46019,
        "value": "LVT"
      },
      {
        "start": 46020,
        "end": 46020,
        "value": "LV"
      },
      {
        "start": 46021,
        "end": 46047,
        "value": "LVT"
      },
      {
        "start": 46048,
        "end": 46048,
        "value": "LV"
      },
      {
        "start": 46049,
        "end": 46075,
        "value": "LVT"
      },
      {
        "start": 46076,
        "end": 46076,
        "value": "LV"
      },
      {
        "start": 46077,
        "end": 46103,
        "value": "LVT"
      },
      {
        "start": 46104,
        "end": 46104,
        "value": "LV"
      },
      {
        "start": 46105,
        "end": 46131,
        "value": "LVT"
      },
      {
        "start": 46132,
        "end": 46132,
        "value": "LV"
      },
      {
        "start": 46133,
        "end": 46159,
        "value": "LVT"
      },
      {
        "start": 46160,
        "end": 46160,
        "value": "LV"
      },
      {
        "start": 46161,
        "end": 46187,
        "value": "LVT"
      },
      {
        "start": 46188,
        "end": 46188,
        "value": "LV"
      },
      {
        "start": 46189,
        "end": 46215,
        "value": "LVT"
      },
      {
        "start": 46216,
        "end": 46216,
        "value": "LV"
      },
      {
        "start": 46217,
        "end": 46243,
        "value": "LVT"
      },
      {
        "start": 46244,
        "end": 46244,
        "value": "LV"
      },
      {
        "start": 46245,
        "end": 46271,
        "value": "LVT"
      },
      {
        "start": 46272,
        "end": 46272,
        "value": "LV"
      },
      {
        "start": 46273,
        "end": 46299,
        "value": "LVT"
      },
      {
        "start": 46300,
        "end": 46300,
        "value": "LV"
      },
      {
        "start": 46301,
        "end": 46327,
        "value": "LVT"
      },
      {
        "start": 46328,
        "end": 46328,
        "value": "LV"
      },
      {
        "start": 46329,
        "end": 46355,
        "value": "LVT"
      },
      {
        "start": 46356,
        "end": 46356,
        "value": "LV"
      },
      {
        "start": 46357,
        "end": 46383,
        "value": "LVT"
      },
      {
        "start": 46384,
        "end": 46384,
        "value": "LV"
      },
      {
        "start": 46385,
        "end": 46411,
        "value": "LVT"
      },
      {
        "start": 46412,
        "end": 46412,
        "value": "LV"
      },
      {
        "start": 46413,
        "end": 46439,
        "value": "LVT"
      },
      {
        "start": 46440,
        "end": 46440,
        "value": "LV"
      },
      {
        "start": 46441,
        "end": 46467,
        "value": "LVT"
      },
      {
        "start": 46468,
        "end": 46468,
        "value": "LV"
      },
      {
        "start": 46469,
        "end": 46495,
        "value": "LVT"
      },
      {
        "start": 46496,
        "end": 46496,
        "value": "LV"
      },
      {
        "start": 46497,
        "end": 46523,
        "value": "LVT"
      },
      {
        "start": 46524,
        "end": 46524,
        "value": "LV"
      },
      {
        "start": 46525,
        "end": 46551,
        "value": "LVT"
      },
      {
        "start": 46552,
        "end": 46552,
        "value": "LV"
      },
      {
        "start": 46553,
        "end": 46579,
        "value": "LVT"
      },
      {
        "start": 46580,
        "end": 46580,
        "value": "LV"
      },
      {
        "start": 46581,
        "end": 46607,
        "value": "LVT"
      },
      {
        "start": 46608,
        "end": 46608,
        "value": "LV"
      },
      {
        "start": 46609,
        "end": 46635,
        "value": "LVT"
      },
      {
        "start": 46636,
        "end": 46636,
        "value": "LV"
      },
      {
        "start": 46637,
        "end": 46663,
        "value": "LVT"
      },
      {
        "start": 46664,
        "end": 46664,
        "value": "LV"
      },
      {
        "start": 46665,
        "end": 46691,
        "value": "LVT"
      },
      {
        "start": 46692,
        "end": 46692,
        "value": "LV"
      },
      {
        "start": 46693,
        "end": 46719,
        "value": "LVT"
      },
      {
        "start": 46720,
        "end": 46720,
        "value": "LV"
      },
      {
        "start": 46721,
        "end": 46747,
        "value": "LVT"
      },
      {
        "start": 46748,
        "end": 46748,
        "value": "LV"
      },
      {
        "start": 46749,
        "end": 46775,
        "value": "LVT"
      },
      {
        "start": 46776,
        "end": 46776,
        "value": "LV"
      },
      {
        "start": 46777,
        "end": 46803,
        "value": "LVT"
      },
      {
        "start": 46804,
        "end": 46804,
        "value": "LV"
      },
      {
        "start": 46805,
        "end": 46831,
        "value": "LVT"
      },
      {
        "start": 46832,
        "end": 46832,
        "value": "LV"
      },
      {
        "start": 46833,
        "end": 46859,
        "value": "LVT"
      },
      {
        "start": 46860,
        "end": 46860,
        "value": "LV"
      },
      {
        "start": 46861,
        "end": 46887,
        "value": "LVT"
      },
      {
        "start": 46888,
        "end": 46888,
        "value": "LV"
      },
      {
        "start": 46889,
        "end": 46915,
        "value": "LVT"
      },
      {
        "start": 46916,
        "end": 46916,
        "value": "LV"
      },
      {
        "start": 46917,
        "end": 46943,
        "value": "LVT"
      },
      {
        "start": 46944,
        "end": 46944,
        "value": "LV"
      },
      {
        "start": 46945,
        "end": 46971,
        "value": "LVT"
      },
      {
        "start": 46972,
        "end": 46972,
        "value": "LV"
      },
      {
        "start": 46973,
        "end": 46999,
        "value": "LVT"
      },
      {
        "start": 47000,
        "end": 47000,
        "value": "LV"
      },
      {
        "start": 47001,
        "end": 47027,
        "value": "LVT"
      },
      {
        "start": 47028,
        "end": 47028,
        "value": "LV"
      },
      {
        "start": 47029,
        "end": 47055,
        "value": "LVT"
      },
      {
        "start": 47056,
        "end": 47056,
        "value": "LV"
      },
      {
        "start": 47057,
        "end": 47083,
        "value": "LVT"
      },
      {
        "start": 47084,
        "end": 47084,
        "value": "LV"
      },
      {
        "start": 47085,
        "end": 47111,
        "value": "LVT"
      },
      {
        "start": 47112,
        "end": 47112,
        "value": "LV"
      },
      {
        "start": 47113,
        "end": 47139,
        "value": "LVT"
      },
      {
        "start": 47140,
        "end": 47140,
        "value": "LV"
      },
      {
        "start": 47141,
        "end": 47167,
        "value": "LVT"
      },
      {
        "start": 47168,
        "end": 47168,
        "value": "LV"
      },
      {
        "start": 47169,
        "end": 47195,
        "value": "LVT"
      },
      {
        "start": 47196,
        "end": 47196,
        "value": "LV"
      },
      {
        "start": 47197,
        "end": 47223,
        "value": "LVT"
      },
      {
        "start": 47224,
        "end": 47224,
        "value": "LV"
      },
      {
        "start": 47225,
        "end": 47251,
        "value": "LVT"
      },
      {
        "start": 47252,
        "end": 47252,
        "value": "LV"
      },
      {
        "start": 47253,
        "end": 47279,
        "value": "LVT"
      },
      {
        "start": 47280,
        "end": 47280,
        "value": "LV"
      },
      {
        "start": 47281,
        "end": 47307,
        "value": "LVT"
      },
      {
        "start": 47308,
        "end": 47308,
        "value": "LV"
      },
      {
        "start": 47309,
        "end": 47335,
        "value": "LVT"
      },
      {
        "start": 47336,
        "end": 47336,
        "value": "LV"
      },
      {
        "start": 47337,
        "end": 47363,
        "value": "LVT"
      },
      {
        "start": 47364,
        "end": 47364,
        "value": "LV"
      },
      {
        "start": 47365,
        "end": 47391,
        "value": "LVT"
      },
      {
        "start": 47392,
        "end": 47392,
        "value": "LV"
      },
      {
        "start": 47393,
        "end": 47419,
        "value": "LVT"
      },
      {
        "start": 47420,
        "end": 47420,
        "value": "LV"
      },
      {
        "start": 47421,
        "end": 47447,
        "value": "LVT"
      },
      {
        "start": 47448,
        "end": 47448,
        "value": "LV"
      },
      {
        "start": 47449,
        "end": 47475,
        "value": "LVT"
      },
      {
        "start": 47476,
        "end": 47476,
        "value": "LV"
      },
      {
        "start": 47477,
        "end": 47503,
        "value": "LVT"
      },
      {
        "start": 47504,
        "end": 47504,
        "value": "LV"
      },
      {
        "start": 47505,
        "end": 47531,
        "value": "LVT"
      },
      {
        "start": 47532,
        "end": 47532,
        "value": "LV"
      },
      {
        "start": 47533,
        "end": 47559,
        "value": "LVT"
      },
      {
        "start": 47560,
        "end": 47560,
        "value": "LV"
      },
      {
        "start": 47561,
        "end": 47587,
        "value": "LVT"
      },
      {
        "start": 47588,
        "end": 47588,
        "value": "LV"
      },
      {
        "start": 47589,
        "end": 47615,
        "value": "LVT"
      },
      {
        "start": 47616,
        "end": 47616,
        "value": "LV"
      },
      {
        "start": 47617,
        "end": 47643,
        "value": "LVT"
      },
      {
        "start": 47644,
        "end": 47644,
        "value": "LV"
      },
      {
        "start": 47645,
        "end": 47671,
        "value": "LVT"
      },
      {
        "start": 47672,
        "end": 47672,
        "value": "LV"
      },
      {
        "start": 47673,
        "end": 47699,
        "value": "LVT"
      },
      {
        "start": 47700,
        "end": 47700,
        "value": "LV"
      },
      {
        "start": 47701,
        "end": 47727,
        "value": "LVT"
      },
      {
        "start": 47728,
        "end": 47728,
        "value": "LV"
      },
      {
        "start": 47729,
        "end": 47755,
        "value": "LVT"
      },
      {
        "start": 47756,
        "end": 47756,
        "value": "LV"
      },
      {
        "start": 47757,
        "end": 47783,
        "value": "LVT"
      },
      {
        "start": 47784,
        "end": 47784,
        "value": "LV"
      },
      {
        "start": 47785,
        "end": 47811,
        "value": "LVT"
      },
      {
        "start": 47812,
        "end": 47812,
        "value": "LV"
      },
      {
        "start": 47813,
        "end": 47839,
        "value": "LVT"
      },
      {
        "start": 47840,
        "end": 47840,
        "value": "LV"
      },
      {
        "start": 47841,
        "end": 47867,
        "value": "LVT"
      },
      {
        "start": 47868,
        "end": 47868,
        "value": "LV"
      },
      {
        "start": 47869,
        "end": 47895,
        "value": "LVT"
      },
      {
        "start": 47896,
        "end": 47896,
        "value": "LV"
      },
      {
        "start": 47897,
        "end": 47923,
        "value": "LVT"
      },
      {
        "start": 47924,
        "end": 47924,
        "value": "LV"
      },
      {
        "start": 47925,
        "end": 47951,
        "value": "LVT"
      },
      {
        "start": 47952,
        "end": 47952,
        "value": "LV"
      },
      {
        "start": 47953,
        "end": 47979,
        "value": "LVT"
      },
      {
        "start": 47980,
        "end": 47980,
        "value": "LV"
      },
      {
        "start": 47981,
        "end": 48007,
        "value": "LVT"
      },
      {
        "start": 48008,
        "end": 48008,
        "value": "LV"
      },
      {
        "start": 48009,
        "end": 48035,
        "value": "LVT"
      },
      {
        "start": 48036,
        "end": 48036,
        "value": "LV"
      },
      {
        "start": 48037,
        "end": 48063,
        "value": "LVT"
      },
      {
        "start": 48064,
        "end": 48064,
        "value": "LV"
      },
      {
        "start": 48065,
        "end": 48091,
        "value": "LVT"
      },
      {
        "start": 48092,
        "end": 48092,
        "value": "LV"
      },
      {
        "start": 48093,
        "end": 48119,
        "value": "LVT"
      },
      {
        "start": 48120,
        "end": 48120,
        "value": "LV"
      },
      {
        "start": 48121,
        "end": 48147,
        "value": "LVT"
      },
      {
        "start": 48148,
        "end": 48148,
        "value": "LV"
      },
      {
        "start": 48149,
        "end": 48175,
        "value": "LVT"
      },
      {
        "start": 48176,
        "end": 48176,
        "value": "LV"
      },
      {
        "start": 48177,
        "end": 48203,
        "value": "LVT"
      },
      {
        "start": 48204,
        "end": 48204,
        "value": "LV"
      },
      {
        "start": 48205,
        "end": 48231,
        "value": "LVT"
      },
      {
        "start": 48232,
        "end": 48232,
        "value": "LV"
      },
      {
        "start": 48233,
        "end": 48259,
        "value": "LVT"
      },
      {
        "start": 48260,
        "end": 48260,
        "value": "LV"
      },
      {
        "start": 48261,
        "end": 48287,
        "value": "LVT"
      },
      {
        "start": 48288,
        "end": 48288,
        "value": "LV"
      },
      {
        "start": 48289,
        "end": 48315,
        "value": "LVT"
      },
      {
        "start": 48316,
        "end": 48316,
        "value": "LV"
      },
      {
        "start": 48317,
        "end": 48343,
        "value": "LVT"
      },
      {
        "start": 48344,
        "end": 48344,
        "value": "LV"
      },
      {
        "start": 48345,
        "end": 48371,
        "value": "LVT"
      },
      {
        "start": 48372,
        "end": 48372,
        "value": "LV"
      },
      {
        "start": 48373,
        "end": 48399,
        "value": "LVT"
      },
      {
        "start": 48400,
        "end": 48400,
        "value": "LV"
      },
      {
        "start": 48401,
        "end": 48427,
        "value": "LVT"
      },
      {
        "start": 48428,
        "end": 48428,
        "value": "LV"
      },
      {
        "start": 48429,
        "end": 48455,
        "value": "LVT"
      },
      {
        "start": 48456,
        "end": 48456,
        "value": "LV"
      },
      {
        "start": 48457,
        "end": 48483,
        "value": "LVT"
      },
      {
        "start": 48484,
        "end": 48484,
        "value": "LV"
      },
      {
        "start": 48485,
        "end": 48511,
        "value": "LVT"
      },
      {
        "start": 48512,
        "end": 48512,
        "value": "LV"
      },
      {
        "start": 48513,
        "end": 48539,
        "value": "LVT"
      },
      {
        "start": 48540,
        "end": 48540,
        "value": "LV"
      },
      {
        "start": 48541,
        "end": 48567,
        "value": "LVT"
      },
      {
        "start": 48568,
        "end": 48568,
        "value": "LV"
      },
      {
        "start": 48569,
        "end": 48595,
        "value": "LVT"
      },
      {
        "start": 48596,
        "end": 48596,
        "value": "LV"
      },
      {
        "start": 48597,
        "end": 48623,
        "value": "LVT"
      },
      {
        "start": 48624,
        "end": 48624,
        "value": "LV"
      },
      {
        "start": 48625,
        "end": 48651,
        "value": "LVT"
      },
      {
        "start": 48652,
        "end": 48652,
        "value": "LV"
      },
      {
        "start": 48653,
        "end": 48679,
        "value": "LVT"
      },
      {
        "start": 48680,
        "end": 48680,
        "value": "LV"
      },
      {
        "start": 48681,
        "end": 48707,
        "value": "LVT"
      },
      {
        "start": 48708,
        "end": 48708,
        "value": "LV"
      },
      {
        "start": 48709,
        "end": 48735,
        "value": "LVT"
      },
      {
        "start": 48736,
        "end": 48736,
        "value": "LV"
      },
      {
        "start": 48737,
        "end": 48763,
        "value": "LVT"
      },
      {
        "start": 48764,
        "end": 48764,
        "value": "LV"
      },
      {
        "start": 48765,
        "end": 48791,
        "value": "LVT"
      },
      {
        "start": 48792,
        "end": 48792,
        "value": "LV"
      },
      {
        "start": 48793,
        "end": 48819,
        "value": "LVT"
      },
      {
        "start": 48820,
        "end": 48820,
        "value": "LV"
      },
      {
        "start": 48821,
        "end": 48847,
        "value": "LVT"
      },
      {
        "start": 48848,
        "end": 48848,
        "value": "LV"
      },
      {
        "start": 48849,
        "end": 48875,
        "value": "LVT"
      },
      {
        "start": 48876,
        "end": 48876,
        "value": "LV"
      },
      {
        "start": 48877,
        "end": 48903,
        "value": "LVT"
      },
      {
        "start": 48904,
        "end": 48904,
        "value": "LV"
      },
      {
        "start": 48905,
        "end": 48931,
        "value": "LVT"
      },
      {
        "start": 48932,
        "end": 48932,
        "value": "LV"
      },
      {
        "start": 48933,
        "end": 48959,
        "value": "LVT"
      },
      {
        "start": 48960,
        "end": 48960,
        "value": "LV"
      },
      {
        "start": 48961,
        "end": 48987,
        "value": "LVT"
      },
      {
        "start": 48988,
        "end": 48988,
        "value": "LV"
      },
      {
        "start": 48989,
        "end": 49015,
        "value": "LVT"
      },
      {
        "start": 49016,
        "end": 49016,
        "value": "LV"
      },
      {
        "start": 49017,
        "end": 49043,
        "value": "LVT"
      },
      {
        "start": 49044,
        "end": 49044,
        "value": "LV"
      },
      {
        "start": 49045,
        "end": 49071,
        "value": "LVT"
      },
      {
        "start": 49072,
        "end": 49072,
        "value": "LV"
      },
      {
        "start": 49073,
        "end": 49099,
        "value": "LVT"
      },
      {
        "start": 49100,
        "end": 49100,
        "value": "LV"
      },
      {
        "start": 49101,
        "end": 49127,
        "value": "LVT"
      },
      {
        "start": 49128,
        "end": 49128,
        "value": "LV"
      },
      {
        "start": 49129,
        "end": 49155,
        "value": "LVT"
      },
      {
        "start": 49156,
        "end": 49156,
        "value": "LV"
      },
      {
        "start": 49157,
        "end": 49183,
        "value": "LVT"
      },
      {
        "start": 49184,
        "end": 49184,
        "value": "LV"
      },
      {
        "start": 49185,
        "end": 49211,
        "value": "LVT"
      },
      {
        "start": 49212,
        "end": 49212,
        "value": "LV"
      },
      {
        "start": 49213,
        "end": 49239,
        "value": "LVT"
      },
      {
        "start": 49240,
        "end": 49240,
        "value": "LV"
      },
      {
        "start": 49241,
        "end": 49267,
        "value": "LVT"
      },
      {
        "start": 49268,
        "end": 49268,
        "value": "LV"
      },
      {
        "start": 49269,
        "end": 49295,
        "value": "LVT"
      },
      {
        "start": 49296,
        "end": 49296,
        "value": "LV"
      },
      {
        "start": 49297,
        "end": 49323,
        "value": "LVT"
      },
      {
        "start": 49324,
        "end": 49324,
        "value": "LV"
      },
      {
        "start": 49325,
        "end": 49351,
        "value": "LVT"
      },
      {
        "start": 49352,
        "end": 49352,
        "value": "LV"
      },
      {
        "start": 49353,
        "end": 49379,
        "value": "LVT"
      },
      {
        "start": 49380,
        "end": 49380,
        "value": "LV"
      },
      {
        "start": 49381,
        "end": 49407,
        "value": "LVT"
      },
      {
        "start": 49408,
        "end": 49408,
        "value": "LV"
      },
      {
        "start": 49409,
        "end": 49435,
        "value": "LVT"
      },
      {
        "start": 49436,
        "end": 49436,
        "value": "LV"
      },
      {
        "start": 49437,
        "end": 49463,
        "value": "LVT"
      },
      {
        "start": 49464,
        "end": 49464,
        "value": "LV"
      },
      {
        "start": 49465,
        "end": 49491,
        "value": "LVT"
      },
      {
        "start": 49492,
        "end": 49492,
        "value": "LV"
      },
      {
        "start": 49493,
        "end": 49519,
        "value": "LVT"
      },
      {
        "start": 49520,
        "end": 49520,
        "value": "LV"
      },
      {
        "start": 49521,
        "end": 49547,
        "value": "LVT"
      },
      {
        "start": 49548,
        "end": 49548,
        "value": "LV"
      },
      {
        "start": 49549,
        "end": 49575,
        "value": "LVT"
      },
      {
        "start": 49576,
        "end": 49576,
        "value": "LV"
      },
      {
        "start": 49577,
        "end": 49603,
        "value": "LVT"
      },
      {
        "start": 49604,
        "end": 49604,
        "value": "LV"
      },
      {
        "start": 49605,
        "end": 49631,
        "value": "LVT"
      },
      {
        "start": 49632,
        "end": 49632,
        "value": "LV"
      },
      {
        "start": 49633,
        "end": 49659,
        "value": "LVT"
      },
      {
        "start": 49660,
        "end": 49660,
        "value": "LV"
      },
      {
        "start": 49661,
        "end": 49687,
        "value": "LVT"
      },
      {
        "start": 49688,
        "end": 49688,
        "value": "LV"
      },
      {
        "start": 49689,
        "end": 49715,
        "value": "LVT"
      },
      {
        "start": 49716,
        "end": 49716,
        "value": "LV"
      },
      {
        "start": 49717,
        "end": 49743,
        "value": "LVT"
      },
      {
        "start": 49744,
        "end": 49744,
        "value": "LV"
      },
      {
        "start": 49745,
        "end": 49771,
        "value": "LVT"
      },
      {
        "start": 49772,
        "end": 49772,
        "value": "LV"
      },
      {
        "start": 49773,
        "end": 49799,
        "value": "LVT"
      },
      {
        "start": 49800,
        "end": 49800,
        "value": "LV"
      },
      {
        "start": 49801,
        "end": 49827,
        "value": "LVT"
      },
      {
        "start": 49828,
        "end": 49828,
        "value": "LV"
      },
      {
        "start": 49829,
        "end": 49855,
        "value": "LVT"
      },
      {
        "start": 49856,
        "end": 49856,
        "value": "LV"
      },
      {
        "start": 49857,
        "end": 49883,
        "value": "LVT"
      },
      {
        "start": 49884,
        "end": 49884,
        "value": "LV"
      },
      {
        "start": 49885,
        "end": 49911,
        "value": "LVT"
      },
      {
        "start": 49912,
        "end": 49912,
        "value": "LV"
      },
      {
        "start": 49913,
        "end": 49939,
        "value": "LVT"
      },
      {
        "start": 49940,
        "end": 49940,
        "value": "LV"
      },
      {
        "start": 49941,
        "end": 49967,
        "value": "LVT"
      },
      {
        "start": 49968,
        "end": 49968,
        "value": "LV"
      },
      {
        "start": 49969,
        "end": 49995,
        "value": "LVT"
      },
      {
        "start": 49996,
        "end": 49996,
        "value": "LV"
      },
      {
        "start": 49997,
        "end": 50023,
        "value": "LVT"
      },
      {
        "start": 50024,
        "end": 50024,
        "value": "LV"
      },
      {
        "start": 50025,
        "end": 50051,
        "value": "LVT"
      },
      {
        "start": 50052,
        "end": 50052,
        "value": "LV"
      },
      {
        "start": 50053,
        "end": 50079,
        "value": "LVT"
      },
      {
        "start": 50080,
        "end": 50080,
        "value": "LV"
      },
      {
        "start": 50081,
        "end": 50107,
        "value": "LVT"
      },
      {
        "start": 50108,
        "end": 50108,
        "value": "LV"
      },
      {
        "start": 50109,
        "end": 50135,
        "value": "LVT"
      },
      {
        "start": 50136,
        "end": 50136,
        "value": "LV"
      },
      {
        "start": 50137,
        "end": 50163,
        "value": "LVT"
      },
      {
        "start": 50164,
        "end": 50164,
        "value": "LV"
      },
      {
        "start": 50165,
        "end": 50191,
        "value": "LVT"
      },
      {
        "start": 50192,
        "end": 50192,
        "value": "LV"
      },
      {
        "start": 50193,
        "end": 50219,
        "value": "LVT"
      },
      {
        "start": 50220,
        "end": 50220,
        "value": "LV"
      },
      {
        "start": 50221,
        "end": 50247,
        "value": "LVT"
      },
      {
        "start": 50248,
        "end": 50248,
        "value": "LV"
      },
      {
        "start": 50249,
        "end": 50275,
        "value": "LVT"
      },
      {
        "start": 50276,
        "end": 50276,
        "value": "LV"
      },
      {
        "start": 50277,
        "end": 50303,
        "value": "LVT"
      },
      {
        "start": 50304,
        "end": 50304,
        "value": "LV"
      },
      {
        "start": 50305,
        "end": 50331,
        "value": "LVT"
      },
      {
        "start": 50332,
        "end": 50332,
        "value": "LV"
      },
      {
        "start": 50333,
        "end": 50359,
        "value": "LVT"
      },
      {
        "start": 50360,
        "end": 50360,
        "value": "LV"
      },
      {
        "start": 50361,
        "end": 50387,
        "value": "LVT"
      },
      {
        "start": 50388,
        "end": 50388,
        "value": "LV"
      },
      {
        "start": 50389,
        "end": 50415,
        "value": "LVT"
      },
      {
        "start": 50416,
        "end": 50416,
        "value": "LV"
      },
      {
        "start": 50417,
        "end": 50443,
        "value": "LVT"
      },
      {
        "start": 50444,
        "end": 50444,
        "value": "LV"
      },
      {
        "start": 50445,
        "end": 50471,
        "value": "LVT"
      },
      {
        "start": 50472,
        "end": 50472,
        "value": "LV"
      },
      {
        "start": 50473,
        "end": 50499,
        "value": "LVT"
      },
      {
        "start": 50500,
        "end": 50500,
        "value": "LV"
      },
      {
        "start": 50501,
        "end": 50527,
        "value": "LVT"
      },
      {
        "start": 50528,
        "end": 50528,
        "value": "LV"
      },
      {
        "start": 50529,
        "end": 50555,
        "value": "LVT"
      },
      {
        "start": 50556,
        "end": 50556,
        "value": "LV"
      },
      {
        "start": 50557,
        "end": 50583,
        "value": "LVT"
      },
      {
        "start": 50584,
        "end": 50584,
        "value": "LV"
      },
      {
        "start": 50585,
        "end": 50611,
        "value": "LVT"
      },
      {
        "start": 50612,
        "end": 50612,
        "value": "LV"
      },
      {
        "start": 50613,
        "end": 50639,
        "value": "LVT"
      },
      {
        "start": 50640,
        "end": 50640,
        "value": "LV"
      },
      {
        "start": 50641,
        "end": 50667,
        "value": "LVT"
      },
      {
        "start": 50668,
        "end": 50668,
        "value": "LV"
      },
      {
        "start": 50669,
        "end": 50695,
        "value": "LVT"
      },
      {
        "start": 50696,
        "end": 50696,
        "value": "LV"
      },
      {
        "start": 50697,
        "end": 50723,
        "value": "LVT"
      },
      {
        "start": 50724,
        "end": 50724,
        "value": "LV"
      },
      {
        "start": 50725,
        "end": 50751,
        "value": "LVT"
      },
      {
        "start": 50752,
        "end": 50752,
        "value": "LV"
      },
      {
        "start": 50753,
        "end": 50779,
        "value": "LVT"
      },
      {
        "start": 50780,
        "end": 50780,
        "value": "LV"
      },
      {
        "start": 50781,
        "end": 50807,
        "value": "LVT"
      },
      {
        "start": 50808,
        "end": 50808,
        "value": "LV"
      },
      {
        "start": 50809,
        "end": 50835,
        "value": "LVT"
      },
      {
        "start": 50836,
        "end": 50836,
        "value": "LV"
      },
      {
        "start": 50837,
        "end": 50863,
        "value": "LVT"
      },
      {
        "start": 50864,
        "end": 50864,
        "value": "LV"
      },
      {
        "start": 50865,
        "end": 50891,
        "value": "LVT"
      },
      {
        "start": 50892,
        "end": 50892,
        "value": "LV"
      },
      {
        "start": 50893,
        "end": 50919,
        "value": "LVT"
      },
      {
        "start": 50920,
        "end": 50920,
        "value": "LV"
      },
      {
        "start": 50921,
        "end": 50947,
        "value": "LVT"
      },
      {
        "start": 50948,
        "end": 50948,
        "value": "LV"
      },
      {
        "start": 50949,
        "end": 50975,
        "value": "LVT"
      },
      {
        "start": 50976,
        "end": 50976,
        "value": "LV"
      },
      {
        "start": 50977,
        "end": 51003,
        "value": "LVT"
      },
      {
        "start": 51004,
        "end": 51004,
        "value": "LV"
      },
      {
        "start": 51005,
        "end": 51031,
        "value": "LVT"
      },
      {
        "start": 51032,
        "end": 51032,
        "value": "LV"
      },
      {
        "start": 51033,
        "end": 51059,
        "value": "LVT"
      },
      {
        "start": 51060,
        "end": 51060,
        "value": "LV"
      },
      {
        "start": 51061,
        "end": 51087,
        "value": "LVT"
      },
      {
        "start": 51088,
        "end": 51088,
        "value": "LV"
      },
      {
        "start": 51089,
        "end": 51115,
        "value": "LVT"
      },
      {
        "start": 51116,
        "end": 51116,
        "value": "LV"
      },
      {
        "start": 51117,
        "end": 51143,
        "value": "LVT"
      },
      {
        "start": 51144,
        "end": 51144,
        "value": "LV"
      },
      {
        "start": 51145,
        "end": 51171,
        "value": "LVT"
      },
      {
        "start": 51172,
        "end": 51172,
        "value": "LV"
      },
      {
        "start": 51173,
        "end": 51199,
        "value": "LVT"
      },
      {
        "start": 51200,
        "end": 51200,
        "value": "LV"
      },
      {
        "start": 51201,
        "end": 51227,
        "value": "LVT"
      },
      {
        "start": 51228,
        "end": 51228,
        "value": "LV"
      },
      {
        "start": 51229,
        "end": 51255,
        "value": "LVT"
      },
      {
        "start": 51256,
        "end": 51256,
        "value": "LV"
      },
      {
        "start": 51257,
        "end": 51283,
        "value": "LVT"
      },
      {
        "start": 51284,
        "end": 51284,
        "value": "LV"
      },
      {
        "start": 51285,
        "end": 51311,
        "value": "LVT"
      },
      {
        "start": 51312,
        "end": 51312,
        "value": "LV"
      },
      {
        "start": 51313,
        "end": 51339,
        "value": "LVT"
      },
      {
        "start": 51340,
        "end": 51340,
        "value": "LV"
      },
      {
        "start": 51341,
        "end": 51367,
        "value": "LVT"
      },
      {
        "start": 51368,
        "end": 51368,
        "value": "LV"
      },
      {
        "start": 51369,
        "end": 51395,
        "value": "LVT"
      },
      {
        "start": 51396,
        "end": 51396,
        "value": "LV"
      },
      {
        "start": 51397,
        "end": 51423,
        "value": "LVT"
      },
      {
        "start": 51424,
        "end": 51424,
        "value": "LV"
      },
      {
        "start": 51425,
        "end": 51451,
        "value": "LVT"
      },
      {
        "start": 51452,
        "end": 51452,
        "value": "LV"
      },
      {
        "start": 51453,
        "end": 51479,
        "value": "LVT"
      },
      {
        "start": 51480,
        "end": 51480,
        "value": "LV"
      },
      {
        "start": 51481,
        "end": 51507,
        "value": "LVT"
      },
      {
        "start": 51508,
        "end": 51508,
        "value": "LV"
      },
      {
        "start": 51509,
        "end": 51535,
        "value": "LVT"
      },
      {
        "start": 51536,
        "end": 51536,
        "value": "LV"
      },
      {
        "start": 51537,
        "end": 51563,
        "value": "LVT"
      },
      {
        "start": 51564,
        "end": 51564,
        "value": "LV"
      },
      {
        "start": 51565,
        "end": 51591,
        "value": "LVT"
      },
      {
        "start": 51592,
        "end": 51592,
        "value": "LV"
      },
      {
        "start": 51593,
        "end": 51619,
        "value": "LVT"
      },
      {
        "start": 51620,
        "end": 51620,
        "value": "LV"
      },
      {
        "start": 51621,
        "end": 51647,
        "value": "LVT"
      },
      {
        "start": 51648,
        "end": 51648,
        "value": "LV"
      },
      {
        "start": 51649,
        "end": 51675,
        "value": "LVT"
      },
      {
        "start": 51676,
        "end": 51676,
        "value": "LV"
      },
      {
        "start": 51677,
        "end": 51703,
        "value": "LVT"
      },
      {
        "start": 51704,
        "end": 51704,
        "value": "LV"
      },
      {
        "start": 51705,
        "end": 51731,
        "value": "LVT"
      },
      {
        "start": 51732,
        "end": 51732,
        "value": "LV"
      },
      {
        "start": 51733,
        "end": 51759,
        "value": "LVT"
      },
      {
        "start": 51760,
        "end": 51760,
        "value": "LV"
      },
      {
        "start": 51761,
        "end": 51787,
        "value": "LVT"
      },
      {
        "start": 51788,
        "end": 51788,
        "value": "LV"
      },
      {
        "start": 51789,
        "end": 51815,
        "value": "LVT"
      },
      {
        "start": 51816,
        "end": 51816,
        "value": "LV"
      },
      {
        "start": 51817,
        "end": 51843,
        "value": "LVT"
      },
      {
        "start": 51844,
        "end": 51844,
        "value": "LV"
      },
      {
        "start": 51845,
        "end": 51871,
        "value": "LVT"
      },
      {
        "start": 51872,
        "end": 51872,
        "value": "LV"
      },
      {
        "start": 51873,
        "end": 51899,
        "value": "LVT"
      },
      {
        "start": 51900,
        "end": 51900,
        "value": "LV"
      },
      {
        "start": 51901,
        "end": 51927,
        "value": "LVT"
      },
      {
        "start": 51928,
        "end": 51928,
        "value": "LV"
      },
      {
        "start": 51929,
        "end": 51955,
        "value": "LVT"
      },
      {
        "start": 51956,
        "end": 51956,
        "value": "LV"
      },
      {
        "start": 51957,
        "end": 51983,
        "value": "LVT"
      },
      {
        "start": 51984,
        "end": 51984,
        "value": "LV"
      },
      {
        "start": 51985,
        "end": 52011,
        "value": "LVT"
      },
      {
        "start": 52012,
        "end": 52012,
        "value": "LV"
      },
      {
        "start": 52013,
        "end": 52039,
        "value": "LVT"
      },
      {
        "start": 52040,
        "end": 52040,
        "value": "LV"
      },
      {
        "start": 52041,
        "end": 52067,
        "value": "LVT"
      },
      {
        "start": 52068,
        "end": 52068,
        "value": "LV"
      },
      {
        "start": 52069,
        "end": 52095,
        "value": "LVT"
      },
      {
        "start": 52096,
        "end": 52096,
        "value": "LV"
      },
      {
        "start": 52097,
        "end": 52123,
        "value": "LVT"
      },
      {
        "start": 52124,
        "end": 52124,
        "value": "LV"
      },
      {
        "start": 52125,
        "end": 52151,
        "value": "LVT"
      },
      {
        "start": 52152,
        "end": 52152,
        "value": "LV"
      },
      {
        "start": 52153,
        "end": 52179,
        "value": "LVT"
      },
      {
        "start": 52180,
        "end": 52180,
        "value": "LV"
      },
      {
        "start": 52181,
        "end": 52207,
        "value": "LVT"
      },
      {
        "start": 52208,
        "end": 52208,
        "value": "LV"
      },
      {
        "start": 52209,
        "end": 52235,
        "value": "LVT"
      },
      {
        "start": 52236,
        "end": 52236,
        "value": "LV"
      },
      {
        "start": 52237,
        "end": 52263,
        "value": "LVT"
      },
      {
        "start": 52264,
        "end": 52264,
        "value": "LV"
      },
      {
        "start": 52265,
        "end": 52291,
        "value": "LVT"
      },
      {
        "start": 52292,
        "end": 52292,
        "value": "LV"
      },
      {
        "start": 52293,
        "end": 52319,
        "value": "LVT"
      },
      {
        "start": 52320,
        "end": 52320,
        "value": "LV"
      },
      {
        "start": 52321,
        "end": 52347,
        "value": "LVT"
      },
      {
        "start": 52348,
        "end": 52348,
        "value": "LV"
      },
      {
        "start": 52349,
        "end": 52375,
        "value": "LVT"
      },
      {
        "start": 52376,
        "end": 52376,
        "value": "LV"
      },
      {
        "start": 52377,
        "end": 52403,
        "value": "LVT"
      },
      {
        "start": 52404,
        "end": 52404,
        "value": "LV"
      },
      {
        "start": 52405,
        "end": 52431,
        "value": "LVT"
      },
      {
        "start": 52432,
        "end": 52432,
        "value": "LV"
      },
      {
        "start": 52433,
        "end": 52459,
        "value": "LVT"
      },
      {
        "start": 52460,
        "end": 52460,
        "value": "LV"
      },
      {
        "start": 52461,
        "end": 52487,
        "value": "LVT"
      },
      {
        "start": 52488,
        "end": 52488,
        "value": "LV"
      },
      {
        "start": 52489,
        "end": 52515,
        "value": "LVT"
      },
      {
        "start": 52516,
        "end": 52516,
        "value": "LV"
      },
      {
        "start": 52517,
        "end": 52543,
        "value": "LVT"
      },
      {
        "start": 52544,
        "end": 52544,
        "value": "LV"
      },
      {
        "start": 52545,
        "end": 52571,
        "value": "LVT"
      },
      {
        "start": 52572,
        "end": 52572,
        "value": "LV"
      },
      {
        "start": 52573,
        "end": 52599,
        "value": "LVT"
      },
      {
        "start": 52600,
        "end": 52600,
        "value": "LV"
      },
      {
        "start": 52601,
        "end": 52627,
        "value": "LVT"
      },
      {
        "start": 52628,
        "end": 52628,
        "value": "LV"
      },
      {
        "start": 52629,
        "end": 52655,
        "value": "LVT"
      },
      {
        "start": 52656,
        "end": 52656,
        "value": "LV"
      },
      {
        "start": 52657,
        "end": 52683,
        "value": "LVT"
      },
      {
        "start": 52684,
        "end": 52684,
        "value": "LV"
      },
      {
        "start": 52685,
        "end": 52711,
        "value": "LVT"
      },
      {
        "start": 52712,
        "end": 52712,
        "value": "LV"
      },
      {
        "start": 52713,
        "end": 52739,
        "value": "LVT"
      },
      {
        "start": 52740,
        "end": 52740,
        "value": "LV"
      },
      {
        "start": 52741,
        "end": 52767,
        "value": "LVT"
      },
      {
        "start": 52768,
        "end": 52768,
        "value": "LV"
      },
      {
        "start": 52769,
        "end": 52795,
        "value": "LVT"
      },
      {
        "start": 52796,
        "end": 52796,
        "value": "LV"
      },
      {
        "start": 52797,
        "end": 52823,
        "value": "LVT"
      },
      {
        "start": 52824,
        "end": 52824,
        "value": "LV"
      },
      {
        "start": 52825,
        "end": 52851,
        "value": "LVT"
      },
      {
        "start": 52852,
        "end": 52852,
        "value": "LV"
      },
      {
        "start": 52853,
        "end": 52879,
        "value": "LVT"
      },
      {
        "start": 52880,
        "end": 52880,
        "value": "LV"
      },
      {
        "start": 52881,
        "end": 52907,
        "value": "LVT"
      },
      {
        "start": 52908,
        "end": 52908,
        "value": "LV"
      },
      {
        "start": 52909,
        "end": 52935,
        "value": "LVT"
      },
      {
        "start": 52936,
        "end": 52936,
        "value": "LV"
      },
      {
        "start": 52937,
        "end": 52963,
        "value": "LVT"
      },
      {
        "start": 52964,
        "end": 52964,
        "value": "LV"
      },
      {
        "start": 52965,
        "end": 52991,
        "value": "LVT"
      },
      {
        "start": 52992,
        "end": 52992,
        "value": "LV"
      },
      {
        "start": 52993,
        "end": 53019,
        "value": "LVT"
      },
      {
        "start": 53020,
        "end": 53020,
        "value": "LV"
      },
      {
        "start": 53021,
        "end": 53047,
        "value": "LVT"
      },
      {
        "start": 53048,
        "end": 53048,
        "value": "LV"
      },
      {
        "start": 53049,
        "end": 53075,
        "value": "LVT"
      },
      {
        "start": 53076,
        "end": 53076,
        "value": "LV"
      },
      {
        "start": 53077,
        "end": 53103,
        "value": "LVT"
      },
      {
        "start": 53104,
        "end": 53104,
        "value": "LV"
      },
      {
        "start": 53105,
        "end": 53131,
        "value": "LVT"
      },
      {
        "start": 53132,
        "end": 53132,
        "value": "LV"
      },
      {
        "start": 53133,
        "end": 53159,
        "value": "LVT"
      },
      {
        "start": 53160,
        "end": 53160,
        "value": "LV"
      },
      {
        "start": 53161,
        "end": 53187,
        "value": "LVT"
      },
      {
        "start": 53188,
        "end": 53188,
        "value": "LV"
      },
      {
        "start": 53189,
        "end": 53215,
        "value": "LVT"
      },
      {
        "start": 53216,
        "end": 53216,
        "value": "LV"
      },
      {
        "start": 53217,
        "end": 53243,
        "value": "LVT"
      },
      {
        "start": 53244,
        "end": 53244,
        "value": "LV"
      },
      {
        "start": 53245,
        "end": 53271,
        "value": "LVT"
      },
      {
        "start": 53272,
        "end": 53272,
        "value": "LV"
      },
      {
        "start": 53273,
        "end": 53299,
        "value": "LVT"
      },
      {
        "start": 53300,
        "end": 53300,
        "value": "LV"
      },
      {
        "start": 53301,
        "end": 53327,
        "value": "LVT"
      },
      {
        "start": 53328,
        "end": 53328,
        "value": "LV"
      },
      {
        "start": 53329,
        "end": 53355,
        "value": "LVT"
      },
      {
        "start": 53356,
        "end": 53356,
        "value": "LV"
      },
      {
        "start": 53357,
        "end": 53383,
        "value": "LVT"
      },
      {
        "start": 53384,
        "end": 53384,
        "value": "LV"
      },
      {
        "start": 53385,
        "end": 53411,
        "value": "LVT"
      },
      {
        "start": 53412,
        "end": 53412,
        "value": "LV"
      },
      {
        "start": 53413,
        "end": 53439,
        "value": "LVT"
      },
      {
        "start": 53440,
        "end": 53440,
        "value": "LV"
      },
      {
        "start": 53441,
        "end": 53467,
        "value": "LVT"
      },
      {
        "start": 53468,
        "end": 53468,
        "value": "LV"
      },
      {
        "start": 53469,
        "end": 53495,
        "value": "LVT"
      },
      {
        "start": 53496,
        "end": 53496,
        "value": "LV"
      },
      {
        "start": 53497,
        "end": 53523,
        "value": "LVT"
      },
      {
        "start": 53524,
        "end": 53524,
        "value": "LV"
      },
      {
        "start": 53525,
        "end": 53551,
        "value": "LVT"
      },
      {
        "start": 53552,
        "end": 53552,
        "value": "LV"
      },
      {
        "start": 53553,
        "end": 53579,
        "value": "LVT"
      },
      {
        "start": 53580,
        "end": 53580,
        "value": "LV"
      },
      {
        "start": 53581,
        "end": 53607,
        "value": "LVT"
      },
      {
        "start": 53608,
        "end": 53608,
        "value": "LV"
      },
      {
        "start": 53609,
        "end": 53635,
        "value": "LVT"
      },
      {
        "start": 53636,
        "end": 53636,
        "value": "LV"
      },
      {
        "start": 53637,
        "end": 53663,
        "value": "LVT"
      },
      {
        "start": 53664,
        "end": 53664,
        "value": "LV"
      },
      {
        "start": 53665,
        "end": 53691,
        "value": "LVT"
      },
      {
        "start": 53692,
        "end": 53692,
        "value": "LV"
      },
      {
        "start": 53693,
        "end": 53719,
        "value": "LVT"
      },
      {
        "start": 53720,
        "end": 53720,
        "value": "LV"
      },
      {
        "start": 53721,
        "end": 53747,
        "value": "LVT"
      },
      {
        "start": 53748,
        "end": 53748,
        "value": "LV"
      },
      {
        "start": 53749,
        "end": 53775,
        "value": "LVT"
      },
      {
        "start": 53776,
        "end": 53776,
        "value": "LV"
      },
      {
        "start": 53777,
        "end": 53803,
        "value": "LVT"
      },
      {
        "start": 53804,
        "end": 53804,
        "value": "LV"
      },
      {
        "start": 53805,
        "end": 53831,
        "value": "LVT"
      },
      {
        "start": 53832,
        "end": 53832,
        "value": "LV"
      },
      {
        "start": 53833,
        "end": 53859,
        "value": "LVT"
      },
      {
        "start": 53860,
        "end": 53860,
        "value": "LV"
      },
      {
        "start": 53861,
        "end": 53887,
        "value": "LVT"
      },
      {
        "start": 53888,
        "end": 53888,
        "value": "LV"
      },
      {
        "start": 53889,
        "end": 53915,
        "value": "LVT"
      },
      {
        "start": 53916,
        "end": 53916,
        "value": "LV"
      },
      {
        "start": 53917,
        "end": 53943,
        "value": "LVT"
      },
      {
        "start": 53944,
        "end": 53944,
        "value": "LV"
      },
      {
        "start": 53945,
        "end": 53971,
        "value": "LVT"
      },
      {
        "start": 53972,
        "end": 53972,
        "value": "LV"
      },
      {
        "start": 53973,
        "end": 53999,
        "value": "LVT"
      },
      {
        "start": 54000,
        "end": 54000,
        "value": "LV"
      },
      {
        "start": 54001,
        "end": 54027,
        "value": "LVT"
      },
      {
        "start": 54028,
        "end": 54028,
        "value": "LV"
      },
      {
        "start": 54029,
        "end": 54055,
        "value": "LVT"
      },
      {
        "start": 54056,
        "end": 54056,
        "value": "LV"
      },
      {
        "start": 54057,
        "end": 54083,
        "value": "LVT"
      },
      {
        "start": 54084,
        "end": 54084,
        "value": "LV"
      },
      {
        "start": 54085,
        "end": 54111,
        "value": "LVT"
      },
      {
        "start": 54112,
        "end": 54112,
        "value": "LV"
      },
      {
        "start": 54113,
        "end": 54139,
        "value": "LVT"
      },
      {
        "start": 54140,
        "end": 54140,
        "value": "LV"
      },
      {
        "start": 54141,
        "end": 54167,
        "value": "LVT"
      },
      {
        "start": 54168,
        "end": 54168,
        "value": "LV"
      },
      {
        "start": 54169,
        "end": 54195,
        "value": "LVT"
      },
      {
        "start": 54196,
        "end": 54196,
        "value": "LV"
      },
      {
        "start": 54197,
        "end": 54223,
        "value": "LVT"
      },
      {
        "start": 54224,
        "end": 54224,
        "value": "LV"
      },
      {
        "start": 54225,
        "end": 54251,
        "value": "LVT"
      },
      {
        "start": 54252,
        "end": 54252,
        "value": "LV"
      },
      {
        "start": 54253,
        "end": 54279,
        "value": "LVT"
      },
      {
        "start": 54280,
        "end": 54280,
        "value": "LV"
      },
      {
        "start": 54281,
        "end": 54307,
        "value": "LVT"
      },
      {
        "start": 54308,
        "end": 54308,
        "value": "LV"
      },
      {
        "start": 54309,
        "end": 54335,
        "value": "LVT"
      },
      {
        "start": 54336,
        "end": 54336,
        "value": "LV"
      },
      {
        "start": 54337,
        "end": 54363,
        "value": "LVT"
      },
      {
        "start": 54364,
        "end": 54364,
        "value": "LV"
      },
      {
        "start": 54365,
        "end": 54391,
        "value": "LVT"
      },
      {
        "start": 54392,
        "end": 54392,
        "value": "LV"
      },
      {
        "start": 54393,
        "end": 54419,
        "value": "LVT"
      },
      {
        "start": 54420,
        "end": 54420,
        "value": "LV"
      },
      {
        "start": 54421,
        "end": 54447,
        "value": "LVT"
      },
      {
        "start": 54448,
        "end": 54448,
        "value": "LV"
      },
      {
        "start": 54449,
        "end": 54475,
        "value": "LVT"
      },
      {
        "start": 54476,
        "end": 54476,
        "value": "LV"
      },
      {
        "start": 54477,
        "end": 54503,
        "value": "LVT"
      },
      {
        "start": 54504,
        "end": 54504,
        "value": "LV"
      },
      {
        "start": 54505,
        "end": 54531,
        "value": "LVT"
      },
      {
        "start": 54532,
        "end": 54532,
        "value": "LV"
      },
      {
        "start": 54533,
        "end": 54559,
        "value": "LVT"
      },
      {
        "start": 54560,
        "end": 54560,
        "value": "LV"
      },
      {
        "start": 54561,
        "end": 54587,
        "value": "LVT"
      },
      {
        "start": 54588,
        "end": 54588,
        "value": "LV"
      },
      {
        "start": 54589,
        "end": 54615,
        "value": "LVT"
      },
      {
        "start": 54616,
        "end": 54616,
        "value": "LV"
      },
      {
        "start": 54617,
        "end": 54643,
        "value": "LVT"
      },
      {
        "start": 54644,
        "end": 54644,
        "value": "LV"
      },
      {
        "start": 54645,
        "end": 54671,
        "value": "LVT"
      },
      {
        "start": 54672,
        "end": 54672,
        "value": "LV"
      },
      {
        "start": 54673,
        "end": 54699,
        "value": "LVT"
      },
      {
        "start": 54700,
        "end": 54700,
        "value": "LV"
      },
      {
        "start": 54701,
        "end": 54727,
        "value": "LVT"
      },
      {
        "start": 54728,
        "end": 54728,
        "value": "LV"
      },
      {
        "start": 54729,
        "end": 54755,
        "value": "LVT"
      },
      {
        "start": 54756,
        "end": 54756,
        "value": "LV"
      },
      {
        "start": 54757,
        "end": 54783,
        "value": "LVT"
      },
      {
        "start": 54784,
        "end": 54784,
        "value": "LV"
      },
      {
        "start": 54785,
        "end": 54811,
        "value": "LVT"
      },
      {
        "start": 54812,
        "end": 54812,
        "value": "LV"
      },
      {
        "start": 54813,
        "end": 54839,
        "value": "LVT"
      },
      {
        "start": 54840,
        "end": 54840,
        "value": "LV"
      },
      {
        "start": 54841,
        "end": 54867,
        "value": "LVT"
      },
      {
        "start": 54868,
        "end": 54868,
        "value": "LV"
      },
      {
        "start": 54869,
        "end": 54895,
        "value": "LVT"
      },
      {
        "start": 54896,
        "end": 54896,
        "value": "LV"
      },
      {
        "start": 54897,
        "end": 54923,
        "value": "LVT"
      },
      {
        "start": 54924,
        "end": 54924,
        "value": "LV"
      },
      {
        "start": 54925,
        "end": 54951,
        "value": "LVT"
      },
      {
        "start": 54952,
        "end": 54952,
        "value": "LV"
      },
      {
        "start": 54953,
        "end": 54979,
        "value": "LVT"
      },
      {
        "start": 54980,
        "end": 54980,
        "value": "LV"
      },
      {
        "start": 54981,
        "end": 55007,
        "value": "LVT"
      },
      {
        "start": 55008,
        "end": 55008,
        "value": "LV"
      },
      {
        "start": 55009,
        "end": 55035,
        "value": "LVT"
      },
      {
        "start": 55036,
        "end": 55036,
        "value": "LV"
      },
      {
        "start": 55037,
        "end": 55063,
        "value": "LVT"
      },
      {
        "start": 55064,
        "end": 55064,
        "value": "LV"
      },
      {
        "start": 55065,
        "end": 55091,
        "value": "LVT"
      },
      {
        "start": 55092,
        "end": 55092,
        "value": "LV"
      },
      {
        "start": 55093,
        "end": 55119,
        "value": "LVT"
      },
      {
        "start": 55120,
        "end": 55120,
        "value": "LV"
      },
      {
        "start": 55121,
        "end": 55147,
        "value": "LVT"
      },
      {
        "start": 55148,
        "end": 55148,
        "value": "LV"
      },
      {
        "start": 55149,
        "end": 55175,
        "value": "LVT"
      },
      {
        "start": 55176,
        "end": 55176,
        "value": "LV"
      },
      {
        "start": 55177,
        "end": 55203,
        "value": "LVT"
      },
      {
        "start": 55216,
        "end": 55238,
        "value": "V"
      },
      {
        "start": 55243,
        "end": 55291,
        "value": "T"
      },
      {
        "start": 64286,
        "end": 64286,
        "value": "Extend"
      },
      {
        "start": 65024,
        "end": 65039,
        "value": "Extend"
      },
      {
        "start": 65056,
        "end": 65071,
        "value": "Extend"
      },
      {
        "start": 65279,
        "end": 65279,
        "value": "Control"
      },
      {
        "start": 65438,
        "end": 65439,
        "value": "Extend"
      },
      {
        "start": 65520,
        "end": 65531,
        "value": "Control"
      },
      {
        "start": 66045,
        "end": 66045,
        "value": "Extend"
      },
      {
        "start": 66272,
        "end": 66272,
        "value": "Extend"
      },
      {
        "start": 66422,
        "end": 66426,
        "value": "Extend"
      },
      {
        "start": 68097,
        "end": 68099,
        "value": "Extend"
      },
      {
        "start": 68101,
        "end": 68102,
        "value": "Extend"
      },
      {
        "start": 68108,
        "end": 68111,
        "value": "Extend"
      },
      {
        "start": 68152,
        "end": 68154,
        "value": "Extend"
      },
      {
        "start": 68159,
        "end": 68159,
        "value": "Extend"
      },
      {
        "start": 68325,
        "end": 68326,
        "value": "Extend"
      },
      {
        "start": 68900,
        "end": 68903,
        "value": "Extend"
      },
      {
        "start": 68969,
        "end": 68973,
        "value": "Extend"
      },
      {
        "start": 69291,
        "end": 69292,
        "value": "Extend"
      },
      {
        "start": 69370,
        "end": 69375,
        "value": "Extend"
      },
      {
        "start": 69446,
        "end": 69456,
        "value": "Extend"
      },
      {
        "start": 69506,
        "end": 69509,
        "value": "Extend"
      },
      {
        "start": 69632,
        "end": 69632,
        "value": "SpacingMark"
      },
      {
        "start": 69633,
        "end": 69633,
        "value": "Extend"
      },
      {
        "start": 69634,
        "end": 69634,
        "value": "SpacingMark"
      },
      {
        "start": 69688,
        "end": 69702,
        "value": "Extend"
      },
      {
        "start": 69744,
        "end": 69744,
        "value": "Extend"
      },
      {
        "start": 69747,
        "end": 69748,
        "value": "Extend"
      },
      {
        "start": 69759,
        "end": 69761,
        "value": "Extend"
      },
      {
        "start": 69762,
        "end": 69762,
        "value": "SpacingMark"
      },
      {
        "start": 69808,
        "end": 69810,
        "value": "SpacingMark"
      },
      {
        "start": 69811,
        "end": 69814,
        "value": "Extend"
      },
      {
        "start": 69815,
        "end": 69816,
        "value": "SpacingMark"
      },
      {
        "start": 69817,
        "end": 69818,
        "value": "Extend"
      },
      {
        "start": 69821,
        "end": 69821,
        "value": "Prepend"
      },
      {
        "start": 69826,
        "end": 69826,
        "value": "Extend"
      },
      {
        "start": 69837,
        "end": 69837,
        "value": "Prepend"
      },
      {
        "start": 69888,
        "end": 69890,
        "value": "Extend"
      },
      {
        "start": 69927,
        "end": 69931,
        "value": "Extend"
      },
      {
        "start": 69932,
        "end": 69932,
        "value": "SpacingMark"
      },
      {
        "start": 69933,
        "end": 69940,
        "value": "Extend"
      },
      {
        "start": 69957,
        "end": 69958,
        "value": "SpacingMark"
      },
      {
        "start": 70003,
        "end": 70003,
        "value": "Extend"
      },
      {
        "start": 70016,
        "end": 70017,
        "value": "Extend"
      },
      {
        "start": 70018,
        "end": 70018,
        "value": "SpacingMark"
      },
      {
        "start": 70067,
        "end": 70069,
        "value": "SpacingMark"
      },
      {
        "start": 70070,
        "end": 70078,
        "value": "Extend"
      },
      {
        "start": 70079,
        "end": 70079,
        "value": "SpacingMark"
      },
      {
        "start": 70080,
        "end": 70080,
        "value": "Extend"
      },
      {
        "start": 70082,
        "end": 70083,
        "value": "Prepend"
      },
      {
        "start": 70089,
        "end": 70092,
        "value": "Extend"
      },
      {
        "start": 70094,
        "end": 70094,
        "value": "SpacingMark"
      },
      {
        "start": 70095,
        "end": 70095,
        "value": "Extend"
      },
      {
        "start": 70188,
        "end": 70190,
        "value": "SpacingMark"
      },
      {
        "start": 70191,
        "end": 70193,
        "value": "Extend"
      },
      {
        "start": 70194,
        "end": 70195,
        "value": "SpacingMark"
      },
      {
        "start": 70196,
        "end": 70199,
        "value": "Extend"
      },
      {
        "start": 70206,
        "end": 70206,
        "value": "Extend"
      },
      {
        "start": 70209,
        "end": 70209,
        "value": "Extend"
      },
      {
        "start": 70367,
        "end": 70367,
        "value": "Extend"
      },
      {
        "start": 70368,
        "end": 70370,
        "value": "SpacingMark"
      },
      {
        "start": 70371,
        "end": 70378,
        "value": "Extend"
      },
      {
        "start": 70400,
        "end": 70401,
        "value": "Extend"
      },
      {
        "start": 70402,
        "end": 70403,
        "value": "SpacingMark"
      },
      {
        "start": 70459,
        "end": 70460,
        "value": "Extend"
      },
      {
        "start": 70462,
        "end": 70462,
        "value": "Extend"
      },
      {
        "start": 70463,
        "end": 70463,
        "value": "SpacingMark"
      },
      {
        "start": 70464,
        "end": 70464,
        "value": "Extend"
      },
      {
        "start": 70465,
        "end": 70468,
        "value": "SpacingMark"
      },
      {
        "start": 70471,
        "end": 70472,
        "value": "SpacingMark"
      },
      {
        "start": 70475,
        "end": 70476,
        "value": "SpacingMark"
      },
      {
        "start": 70477,
        "end": 70477,
        "value": "Extend"
      },
      {
        "start": 70487,
        "end": 70487,
        "value": "Extend"
      },
      {
        "start": 70498,
        "end": 70499,
        "value": "SpacingMark"
      },
      {
        "start": 70502,
        "end": 70508,
        "value": "Extend"
      },
      {
        "start": 70512,
        "end": 70516,
        "value": "Extend"
      },
      {
        "start": 70584,
        "end": 70584,
        "value": "Extend"
      },
      {
        "start": 70585,
        "end": 70586,
        "value": "SpacingMark"
      },
      {
        "start": 70587,
        "end": 70592,
        "value": "Extend"
      },
      {
        "start": 70594,
        "end": 70594,
        "value": "Extend"
      },
      {
        "start": 70597,
        "end": 70597,
        "value": "Extend"
      },
      {
        "start": 70599,
        "end": 70601,
        "value": "Extend"
      },
      {
        "start": 70602,
        "end": 70602,
        "value": "SpacingMark"
      },
      {
        "start": 70604,
        "end": 70605,
        "value": "SpacingMark"
      },
      {
        "start": 70606,
        "end": 70608,
        "value": "Extend"
      },
      {
        "start": 70609,
        "end": 70609,
        "value": "Prepend"
      },
      {
        "start": 70610,
        "end": 70610,
        "value": "Extend"
      },
      {
        "start": 70625,
        "end": 70626,
        "value": "Extend"
      },
      {
        "start": 70709,
        "end": 70711,
        "value": "SpacingMark"
      },
      {
        "start": 70712,
        "end": 70719,
        "value": "Extend"
      },
      {
        "start": 70720,
        "end": 70721,
        "value": "SpacingMark"
      },
      {
        "start": 70722,
        "end": 70724,
        "value": "Extend"
      },
      {
        "start": 70725,
        "end": 70725,
        "value": "SpacingMark"
      },
      {
        "start": 70726,
        "end": 70726,
        "value": "Extend"
      },
      {
        "start": 70750,
        "end": 70750,
        "value": "Extend"
      },
      {
        "start": 70832,
        "end": 70832,
        "value": "Extend"
      },
      {
        "start": 70833,
        "end": 70834,
        "value": "SpacingMark"
      },
      {
        "start": 70835,
        "end": 70840,
        "value": "Extend"
      },
      {
        "start": 70841,
        "end": 70841,
        "value": "SpacingMark"
      },
      {
        "start": 70842,
        "end": 70842,
        "value": "Extend"
      },
      {
        "start": 70843,
        "end": 70844,
        "value": "SpacingMark"
      },
      {
        "start": 70845,
        "end": 70845,
        "value": "Extend"
      },
      {
        "start": 70846,
        "end": 70846,
        "value": "SpacingMark"
      },
      {
        "start": 70847,
        "end": 70848,
        "value": "Extend"
      },
      {
        "start": 70849,
        "end": 70849,
        "value": "SpacingMark"
      },
      {
        "start": 70850,
        "end": 70851,
        "value": "Extend"
      },
      {
        "start": 71087,
        "end": 71087,
        "value": "Extend"
      },
      {
        "start": 71088,
        "end": 71089,
        "value": "SpacingMark"
      },
      {
        "start": 71090,
        "end": 71093,
        "value": "Extend"
      },
      {
        "start": 71096,
        "end": 71099,
        "value": "SpacingMark"
      },
      {
        "start": 71100,
        "end": 71101,
        "value": "Extend"
      },
      {
        "start": 71102,
        "end": 71102,
        "value": "SpacingMark"
      },
      {
        "start": 71103,
        "end": 71104,
        "value": "Extend"
      },
      {
        "start": 71132,
        "end": 71133,
        "value": "Extend"
      },
      {
        "start": 71216,
        "end": 71218,
        "value": "SpacingMark"
      },
      {
        "start": 71219,
        "end": 71226,
        "value": "Extend"
      },
      {
        "start": 71227,
        "end": 71228,
        "value": "SpacingMark"
      },
      {
        "start": 71229,
        "end": 71229,
        "value": "Extend"
      },
      {
        "start": 71230,
        "end": 71230,
        "value": "SpacingMark"
      },
      {
        "start": 71231,
        "end": 71232,
        "value": "Extend"
      },
      {
        "start": 71339,
        "end": 71339,
        "value": "Extend"
      },
      {
        "start": 71340,
        "end": 71340,
        "value": "SpacingMark"
      },
      {
        "start": 71341,
        "end": 71341,
        "value": "Extend"
      },
      {
        "start": 71342,
        "end": 71343,
        "value": "SpacingMark"
      },
      {
        "start": 71344,
        "end": 71351,
        "value": "Extend"
      },
      {
        "start": 71453,
        "end": 71453,
        "value": "Extend"
      },
      {
        "start": 71454,
        "end": 71454,
        "value": "SpacingMark"
      },
      {
        "start": 71455,
        "end": 71455,
        "value": "Extend"
      },
      {
        "start": 71458,
        "end": 71461,
        "value": "Extend"
      },
      {
        "start": 71462,
        "end": 71462,
        "value": "SpacingMark"
      },
      {
        "start": 71463,
        "end": 71467,
        "value": "Extend"
      },
      {
        "start": 71724,
        "end": 71726,
        "value": "SpacingMark"
      },
      {
        "start": 71727,
        "end": 71735,
        "value": "Extend"
      },
      {
        "start": 71736,
        "end": 71736,
        "value": "SpacingMark"
      },
      {
        "start": 71737,
        "end": 71738,
        "value": "Extend"
      },
      {
        "start": 71984,
        "end": 71984,
        "value": "Extend"
      },
      {
        "start": 71985,
        "end": 71989,
        "value": "SpacingMark"
      },
      {
        "start": 71991,
        "end": 71992,
        "value": "SpacingMark"
      },
      {
        "start": 71995,
        "end": 71998,
        "value": "Extend"
      },
      {
        "start": 71999,
        "end": 71999,
        "value": "Prepend"
      },
      {
        "start": 72000,
        "end": 72000,
        "value": "SpacingMark"
      },
      {
        "start": 72001,
        "end": 72001,
        "value": "Prepend"
      },
      {
        "start": 72002,
        "end": 72002,
        "value": "SpacingMark"
      },
      {
        "start": 72003,
        "end": 72003,
        "value": "Extend"
      },
      {
        "start": 72145,
        "end": 72147,
        "value": "SpacingMark"
      },
      {
        "start": 72148,
        "end": 72151,
        "value": "Extend"
      },
      {
        "start": 72154,
        "end": 72155,
        "value": "Extend"
      },
      {
        "start": 72156,
        "end": 72159,
        "value": "SpacingMark"
      },
      {
        "start": 72160,
        "end": 72160,
        "value": "Extend"
      },
      {
        "start": 72164,
        "end": 72164,
        "value": "SpacingMark"
      },
      {
        "start": 72193,
        "end": 72202,
        "value": "Extend"
      },
      {
        "start": 72243,
        "end": 72248,
        "value": "Extend"
      },
      {
        "start": 72249,
        "end": 72249,
        "value": "SpacingMark"
      },
      {
        "start": 72251,
        "end": 72254,
        "value": "Extend"
      },
      {
        "start": 72263,
        "end": 72263,
        "value": "Extend"
      },
      {
        "start": 72273,
        "end": 72278,
        "value": "Extend"
      },
      {
        "start": 72279,
        "end": 72280,
        "value": "SpacingMark"
      },
      {
        "start": 72281,
        "end": 72283,
        "value": "Extend"
      },
      {
        "start": 72324,
        "end": 72329,
        "value": "Prepend"
      },
      {
        "start": 72330,
        "end": 72342,
        "value": "Extend"
      },
      {
        "start": 72343,
        "end": 72343,
        "value": "SpacingMark"
      },
      {
        "start": 72344,
        "end": 72345,
        "value": "Extend"
      },
      {
        "start": 72544,
        "end": 72544,
        "value": "Extend"
      },
      {
        "start": 72545,
        "end": 72545,
        "value": "SpacingMark"
      },
      {
        "start": 72546,
        "end": 72548,
        "value": "Extend"
      },
      {
        "start": 72549,
        "end": 72549,
        "value": "SpacingMark"
      },
      {
        "start": 72550,
        "end": 72550,
        "value": "Extend"
      },
      {
        "start": 72551,
        "end": 72551,
        "value": "SpacingMark"
      },
      {
        "start": 72751,
        "end": 72751,
        "value": "SpacingMark"
      },
      {
        "start": 72752,
        "end": 72758,
        "value": "Extend"
      },
      {
        "start": 72760,
        "end": 72765,
        "value": "Extend"
      },
      {
        "start": 72766,
        "end": 72766,
        "value": "SpacingMark"
      },
      {
        "start": 72767,
        "end": 72767,
        "value": "Extend"
      },
      {
        "start": 72850,
        "end": 72871,
        "value": "Extend"
      },
      {
        "start": 72873,
        "end": 72873,
        "value": "SpacingMark"
      },
      {
        "start": 72874,
        "end": 72880,
        "value": "Extend"
      },
      {
        "start": 72881,
        "end": 72881,
        "value": "SpacingMark"
      },
      {
        "start": 72882,
        "end": 72883,
        "value": "Extend"
      },
      {
        "start": 72884,
        "end": 72884,
        "value": "SpacingMark"
      },
      {
        "start": 72885,
        "end": 72886,
        "value": "Extend"
      },
      {
        "start": 73009,
        "end": 73014,
        "value": "Extend"
      },
      {
        "start": 73018,
        "end": 73018,
        "value": "Extend"
      },
      {
        "start": 73020,
        "end": 73021,
        "value": "Extend"
      },
      {
        "start": 73023,
        "end": 73029,
        "value": "Extend"
      },
      {
        "start": 73030,
        "end": 73030,
        "value": "Prepend"
      },
      {
        "start": 73031,
        "end": 73031,
        "value": "Extend"
      },
      {
        "start": 73098,
        "end": 73102,
        "value": "SpacingMark"
      },
      {
        "start": 73104,
        "end": 73105,
        "value": "Extend"
      },
      {
        "start": 73107,
        "end": 73108,
        "value": "SpacingMark"
      },
      {
        "start": 73109,
        "end": 73109,
        "value": "Extend"
      },
      {
        "start": 73110,
        "end": 73110,
        "value": "SpacingMark"
      },
      {
        "start": 73111,
        "end": 73111,
        "value": "Extend"
      },
      {
        "start": 73459,
        "end": 73460,
        "value": "Extend"
      },
      {
        "start": 73461,
        "end": 73462,
        "value": "SpacingMark"
      },
      {
        "start": 73472,
        "end": 73473,
        "value": "Extend"
      },
      {
        "start": 73474,
        "end": 73474,
        "value": "Prepend"
      },
      {
        "start": 73475,
        "end": 73475,
        "value": "SpacingMark"
      },
      {
        "start": 73524,
        "end": 73525,
        "value": "SpacingMark"
      },
      {
        "start": 73526,
        "end": 73530,
        "value": "Extend"
      },
      {
        "start": 73534,
        "end": 73535,
        "value": "SpacingMark"
      },
      {
        "start": 73536,
        "end": 73538,
        "value": "Extend"
      },
      {
        "start": 73562,
        "end": 73562,
        "value": "Extend"
      },
      {
        "start": 78896,
        "end": 78911,
        "value": "Control"
      },
      {
        "start": 78912,
        "end": 78912,
        "value": "Extend"
      },
      {
        "start": 78919,
        "end": 78933,
        "value": "Extend"
      },
      {
        "start": 90398,
        "end": 90409,
        "value": "Extend"
      },
      {
        "start": 90410,
        "end": 90412,
        "value": "SpacingMark"
      },
      {
        "start": 90413,
        "end": 90415,
        "value": "Extend"
      },
      {
        "start": 92912,
        "end": 92916,
        "value": "Extend"
      },
      {
        "start": 92976,
        "end": 92982,
        "value": "Extend"
      },
      {
        "start": 93539,
        "end": 93539,
        "value": "V"
      },
      {
        "start": 93543,
        "end": 93546,
        "value": "V"
      },
      {
        "start": 94031,
        "end": 94031,
        "value": "Extend"
      },
      {
        "start": 94033,
        "end": 94087,
        "value": "SpacingMark"
      },
      {
        "start": 94095,
        "end": 94098,
        "value": "Extend"
      },
      {
        "start": 94180,
        "end": 94180,
        "value": "Extend"
      },
      {
        "start": 94192,
        "end": 94193,
        "value": "Extend"
      },
      {
        "start": 113821,
        "end": 113822,
        "value": "Extend"
      },
      {
        "start": 113824,
        "end": 113827,
        "value": "Control"
      },
      {
        "start": 118528,
        "end": 118573,
        "value": "Extend"
      },
      {
        "start": 118576,
        "end": 118598,
        "value": "Extend"
      },
      {
        "start": 119141,
        "end": 119145,
        "value": "Extend"
      },
      {
        "start": 119149,
        "end": 119154,
        "value": "Extend"
      },
      {
        "start": 119155,
        "end": 119162,
        "value": "Control"
      },
      {
        "start": 119163,
        "end": 119170,
        "value": "Extend"
      },
      {
        "start": 119173,
        "end": 119179,
        "value": "Extend"
      },
      {
        "start": 119210,
        "end": 119213,
        "value": "Extend"
      },
      {
        "start": 119362,
        "end": 119364,
        "value": "Extend"
      },
      {
        "start": 121344,
        "end": 121398,
        "value": "Extend"
      },
      {
        "start": 121403,
        "end": 121452,
        "value": "Extend"
      },
      {
        "start": 121461,
        "end": 121461,
        "value": "Extend"
      },
      {
        "start": 121476,
        "end": 121476,
        "value": "Extend"
      },
      {
        "start": 121499,
        "end": 121503,
        "value": "Extend"
      },
      {
        "start": 121505,
        "end": 121519,
        "value": "Extend"
      },
      {
        "start": 122880,
        "end": 122886,
        "value": "Extend"
      },
      {
        "start": 122888,
        "end": 122904,
        "value": "Extend"
      },
      {
        "start": 122907,
        "end": 122913,
        "value": "Extend"
      },
      {
        "start": 122915,
        "end": 122916,
        "value": "Extend"
      },
      {
        "start": 122918,
        "end": 122922,
        "value": "Extend"
      },
      {
        "start": 123023,
        "end": 123023,
        "value": "Extend"
      },
      {
        "start": 123184,
        "end": 123190,
        "value": "Extend"
      },
      {
        "start": 123566,
        "end": 123566,
        "value": "Extend"
      },
      {
        "start": 123628,
        "end": 123631,
        "value": "Extend"
      },
      {
        "start": 124140,
        "end": 124143,
        "value": "Extend"
      },
      {
        "start": 124398,
        "end": 124399,
        "value": "Extend"
      },
      {
        "start": 124643,
        "end": 124643,
        "value": "Extend"
      },
      {
        "start": 124646,
        "end": 124646,
        "value": "Extend"
      },
      {
        "start": 124654,
        "end": 124655,
        "value": "Extend"
      },
      {
        "start": 124661,
        "end": 124661,
        "value": "Extend"
      },
      {
        "start": 125136,
        "end": 125142,
        "value": "Extend"
      },
      {
        "start": 125252,
        "end": 125258,
        "value": "Extend"
      },
      {
        "start": 127462,
        "end": 127487,
        "value": "Regional_Indicator"
      },
      {
        "start": 127995,
        "end": 127999,
        "value": "Extend"
      },
      {
        "start": 917504,
        "end": 917535,
        "value": "Control"
      },
      {
        "start": 917536,
        "end": 917631,
        "value": "Extend"
      },
      {
        "start": 917632,
        "end": 917759,
        "value": "Control"
      },
      {
        "start": 917760,
        "end": 917999,
        "value": "Extend"
      },
      {
        "start": 918000,
        "end": 921599,
        "value": "Control"
      }
    ],
    "eastAsianWidth": [
      {
        "start": 0,
        "end": 31,
        "value": "N"
      },
      {
        "start": 32,
        "end": 126,
        "value": "Na"
      },
      {
        "start": 127,
        "end": 160,
        "value": "N"
      },
      {
        "start": 161,
        "end": 161,
        "value": "A"
      },
      {
        "start": 162,
        "end": 163,
        "value": "Na"
      },
      {
        "start": 164,
        "end": 164,
        "value": "A"
      },
      {
        "start": 165,
        "end": 166,
        "value": "Na"
      },
      {
        "start": 167,
        "end": 168,
        "value": "A"
      },
      {
        "start": 169,
        "end": 169,
        "value": "N"
      },
      {
        "start": 170,
        "end": 170,
        "value": "A"
      },
      {
        "start": 171,
        "end": 171,
        "value": "N"
      },
      {
        "start": 172,
        "end": 172,
        "value": "Na"
      },
      {
        "start": 173,
        "end": 174,
        "value": "A"
      },
      {
        "start": 175,
        "end": 175,
        "value": "Na"
      },
      {
        "start": 176,
        "end": 180,
        "value": "A"
      },
      {
        "start": 181,
        "end": 181,
        "value": "N"
      },
      {
        "start": 182,
        "end": 186,
        "value": "A"
      },
      {
        "start": 187,
        "end": 187,
        "value": "N"
      },
      {
        "start": 188,
        "end": 191,
        "value": "A"
      },
      {
        "start": 192,
        "end": 197,
        "value": "N"
      },
      {
        "start": 198,
        "end": 198,
        "value": "A"
      },
      {
        "start": 199,
        "end": 207,
        "value": "N"
      },
      {
        "start": 208,
        "end": 208,
        "value": "A"
      },
      {
        "start": 209,
        "end": 214,
        "value": "N"
      },
      {
        "start": 215,
        "end": 216,
        "value": "A"
      },
      {
        "start": 217,
        "end": 221,
        "value": "N"
      },
      {
        "start": 222,
        "end": 225,
        "value": "A"
      },
      {
        "start": 226,
        "end": 229,
        "value": "N"
      },
      {
        "start": 230,
        "end": 230,
        "value": "A"
      },
      {
        "start": 231,
        "end": 231,
        "value": "N"
      },
      {
        "start": 232,
        "end": 234,
        "value": "A"
      },
      {
        "start": 235,
        "end": 235,
        "value": "N"
      },
      {
        "start": 236,
        "end": 237,
        "value": "A"
      },
      {
        "start": 238,
        "end": 239,
        "value": "N"
      },
      {
        "start": 240,
        "end": 240,
        "value": "A"
      },
      {
        "start": 241,
        "end": 241,
        "value": "N"
      },
      {
        "start": 242,
        "end": 243,
        "value": "A"
      },
      {
        "start": 244,
        "end": 246,
        "value": "N"
      },
      {
        "start": 247,
        "end": 250,
        "value": "A"
      },
      {
        "start": 251,
        "end": 251,
        "value": "N"
      },
      {
        "start": 252,
        "end": 252,
        "value": "A"
      },
      {
        "start": 253,
        "end": 253,
        "value": "N"
      },
      {
        "start": 254,
        "end": 254,
        "value": "A"
      },
      {
        "start": 255,
        "end": 256,
        "value": "N"
      },
      {
        "start": 257,
        "end": 257,
        "value": "A"
      },
      {
        "start": 258,
        "end": 272,
        "value": "N"
      },
      {
        "start": 273,
        "end": 273,
        "value": "A"
      },
      {
        "start": 274,
        "end": 274,
        "value": "N"
      },
      {
        "start": 275,
        "end": 275,
        "value": "A"
      },
      {
        "start": 276,
        "end": 282,
        "value": "N"
      },
      {
        "start": 283,
        "end": 283,
        "value": "A"
      },
      {
        "start": 284,
        "end": 293,
        "value": "N"
      },
      {
        "start": 294,
        "end": 295,
        "value": "A"
      },
      {
        "start": 296,
        "end": 298,
        "value": "N"
      },
      {
        "start": 299,
        "end": 299,
        "value": "A"
      },
      {
        "start": 300,
        "end": 304,
        "value": "N"
      },
      {
        "start": 305,
        "end": 307,
        "value": "A"
      },
      {
        "start": 308,
        "end": 311,
        "value": "N"
      },
      {
        "start": 312,
        "end": 312,
        "value": "A"
      },
      {
        "start": 313,
        "end": 318,
        "value": "N"
      },
      {
        "start": 319,
        "end": 322,
        "value": "A"
      },
      {
        "start": 323,
        "end": 323,
        "value": "N"
      },
      {
        "start": 324,
        "end": 324,
        "value": "A"
      },
      {
        "start": 325,
        "end": 327,
        "value": "N"
      },
      {
        "start": 328,
        "end": 331,
        "value": "A"
      },
      {
        "start": 332,
        "end": 332,
        "value": "N"
      },
      {
        "start": 333,
        "end": 333,
        "value": "A"
      },
      {
        "start": 334,
        "end": 337,
        "value": "N"
      },
      {
        "start": 338,
        "end": 339,
        "value": "A"
      },
      {
        "start": 340,
        "end": 357,
        "value": "N"
      },
      {
        "start": 358,
        "end": 359,
        "value": "A"
      },
      {
        "start": 360,
        "end": 362,
        "value": "N"
      },
      {
        "start": 363,
        "end": 363,
        "value": "A"
      },
      {
        "start": 364,
        "end": 461,
        "value": "N"
      },
      {
        "start": 462,
        "end": 462,
        "value": "A"
      },
      {
        "start": 463,
        "end": 463,
        "value": "N"
      },
      {
        "start": 464,
        "end": 464,
        "value": "A"
      },
      {
        "start": 465,
        "end": 465,
        "value": "N"
      },
      {
        "start": 466,
        "end": 466,
        "value": "A"
      },
      {
        "start": 467,
        "end": 467,
        "value": "N"
      },
      {
        "start": 468,
        "end": 468,
        "value": "A"
      },
      {
        "start": 469,
        "end": 469,
        "value": "N"
      },
      {
        "start": 470,
        "end": 470,
        "value": "A"
      },
      {
        "start": 471,
        "end": 471,
        "value": "N"
      },
      {
        "start": 472,
        "end": 472,
        "value": "A"
      },
      {
        "start": 473,
        "end": 473,
        "value": "N"
      },
      {
        "start": 474,
        "end": 474,
        "value": "A"
      },
      {
        "start": 475,
        "end": 475,
        "value": "N"
      },
      {
        "start": 476,
        "end": 476,
        "value": "A"
      },
      {
        "start": 477,
        "end": 592,
        "value": "N"
      },
      {
        "start": 593,
        "end": 593,
        "value": "A"
      },
      {
        "start": 594,
        "end": 608,
        "value": "N"
      },
      {
        "start": 609,
        "end": 609,
        "value": "A"
      },
      {
        "start": 610,
        "end": 707,
        "value": "N"
      },
      {
        "start": 708,
        "end": 708,
        "value": "A"
      },
      {
        "start": 709,
        "end": 710,
        "value": "N"
      },
      {
        "start": 711,
        "end": 711,
        "value": "A"
      },
      {
        "start": 712,
        "end": 712,
        "value": "N"
      },
      {
        "start": 713,
        "end": 715,
        "value": "A"
      },
      {
        "start": 716,
        "end": 716,
        "value": "N"
      },
      {
        "start": 717,
        "end": 717,
        "value": "A"
      },
      {
        "start": 718,
        "end": 719,
        "value": "N"
      },
      {
        "start": 720,
        "end": 720,
        "value": "A"
      },
      {
        "start": 721,
        "end": 727,
        "value": "N"
      },
      {
        "start": 728,
        "end": 731,
        "value": "A"
      },
      {
        "start": 732,
        "end": 732,
        "value": "N"
      },
      {
        "start": 733,
        "end": 733,
        "value": "A"
      },
      {
        "start": 734,
        "end": 734,
        "value": "N"
      },
      {
        "start": 735,
        "end": 735,
        "value": "A"
      },
      {
        "start": 736,
        "end": 767,
        "value": "N"
      },
      {
        "start": 768,
        "end": 879,
        "value": "A"
      },
      {
        "start": 880,
        "end": 887,
        "value": "N"
      },
      {
        "start": 890,
        "end": 895,
        "value": "N"
      },
      {
        "start": 900,
        "end": 906,
        "value": "N"
      },
      {
        "start": 908,
        "end": 908,
        "value": "N"
      },
      {
        "start": 910,
        "end": 912,
        "value": "N"
      },
      {
        "start": 913,
        "end": 929,
        "value": "A"
      },
      {
        "start": 931,
        "end": 937,
        "value": "A"
      },
      {
        "start": 938,
        "end": 944,
        "value": "N"
      },
      {
        "start": 945,
        "end": 961,
        "value": "A"
      },
      {
        "start": 962,
        "end": 962,
        "value": "N"
      },
      {
        "start": 963,
        "end": 969,
        "value": "A"
      },
      {
        "start": 970,
        "end": 1024,
        "value": "N"
      },
      {
        "start": 1025,
        "end": 1025,
        "value": "A"
      },
      {
        "start": 1026,
        "end": 1039,
        "value": "N"
      },
      {
        "start": 1040,
        "end": 1103,
        "value": "A"
      },
      {
        "start": 1104,
        "end": 1104,
        "value": "N"
      },
      {
        "start": 1105,
        "end": 1105,
        "value": "A"
      },
      {
        "start": 1106,
        "end": 1327,
        "value": "N"
      },
      {
        "start": 1329,
        "end": 1366,
        "value": "N"
      },
      {
        "start": 1369,
        "end": 1418,
        "value": "N"
      },
      {
        "start": 1421,
        "end": 1423,
        "value": "N"
      },
      {
        "start": 1425,
        "end": 1479,
        "value": "N"
      },
      {
        "start": 1488,
        "end": 1514,
        "value": "N"
      },
      {
        "start": 1519,
        "end": 1524,
        "value": "N"
      },
      {
        "start": 1536,
        "end": 1805,
        "value": "N"
      },
      {
        "start": 1807,
        "end": 1866,
        "value": "N"
      },
      {
        "start": 1869,
        "end": 1969,
        "value": "N"
      },
      {
        "start": 1984,
        "end": 2042,
        "value": "N"
      },
      {
        "start": 2045,
        "end": 2093,
        "value": "N"
      },
      {
        "start": 2096,
        "end": 2110,
        "value": "N"
      },
      {
        "start": 2112,
        "end": 2139,
        "value": "N"
      },
      {
        "start": 2142,
        "end": 2142,
        "value": "N"
      },
      {
        "start": 2144,
        "end": 2154,
        "value": "N"
      },
      {
        "start": 2160,
        "end": 2193,
        "value": "N"
      },
      {
        "start": 2199,
        "end": 2435,
        "value": "N"
      },
      {
        "start": 2437,
        "end": 2444,
        "value": "N"
      },
      {
        "start": 2447,
        "end": 2448,
        "value": "N"
      },
      {
        "start": 2451,
        "end": 2472,
        "value": "N"
      },
      {
        "start": 2474,
        "end": 2480,
        "value": "N"
      },
      {
        "start": 2482,
        "end": 2482,
        "value": "N"
      },
      {
        "start": 2486,
        "end": 2489,
        "value": "N"
      },
      {
        "start": 2492,
        "end": 2500,
        "value": "N"
      },
      {
        "start": 2503,
        "end": 2504,
        "value": "N"
      },
      {
        "start": 2507,
        "end": 2510,
        "value": "N"
      },
      {
        "start": 2519,
        "end": 2519,
        "value": "N"
      },
      {
        "start": 2524,
        "end": 2525,
        "value": "N"
      },
      {
        "start": 2527,
        "end": 2531,
        "value": "N"
      },
      {
        "start": 2534,
        "end": 2558,
        "value": "N"
      },
      {
        "start": 2561,
        "end": 2563,
        "value": "N"
      },
      {
        "start": 2565,
        "end": 2570,
        "value": "N"
      },
      {
        "start": 2575,
        "end": 2576,
        "value": "N"
      },
      {
        "start": 2579,
        "end": 2600,
        "value": "N"
      },
      {
        "start": 2602,
        "end": 2608,
        "value": "N"
      },
      {
        "start": 2610,
        "end": 2611,
        "value": "N"
      },
      {
        "start": 2613,
        "end": 2614,
        "value": "N"
      },
      {
        "start": 2616,
        "end": 2617,
        "value": "N"
      },
      {
        "start": 2620,
        "end": 2620,
        "value": "N"
      },
      {
        "start": 2622,
        "end": 2626,
        "value": "N"
      },
      {
        "start": 2631,
        "end": 2632,
        "value": "N"
      },
      {
        "start": 2635,
        "end": 2637,
        "value": "N"
      },
      {
        "start": 2641,
        "end": 2641,
        "value": "N"
      },
      {
        "start": 2649,
        "end": 2652,
        "value": "N"
      },
      {
        "start": 2654,
        "end": 2654,
        "value": "N"
      },
      {
        "start": 2662,
        "end": 2678,
        "value": "N"
      },
      {
        "start": 2689,
        "end": 2691,
        "value": "N"
      },
      {
        "start": 2693,
        "end": 2701,
        "value": "N"
      },
      {
        "start": 2703,
        "end": 2705,
        "value": "N"
      },
      {
        "start": 2707,
        "end": 2728,
        "value": "N"
      },
      {
        "start": 2730,
        "end": 2736,
        "value": "N"
      },
      {
        "start": 2738,
        "end": 2739,
        "value": "N"
      },
      {
        "start": 2741,
        "end": 2745,
        "value": "N"
      },
      {
        "start": 2748,
        "end": 2757,
        "value": "N"
      },
      {
        "start": 2759,
        "end": 2761,
        "value": "N"
      },
      {
        "start": 2763,
        "end": 2765,
        "value": "N"
      },
      {
        "start": 2768,
        "end": 2768,
        "value": "N"
      },
      {
        "start": 2784,
        "end": 2787,
        "value": "N"
      },
      {
        "start": 2790,
        "end": 2801,
        "value": "N"
      },
      {
        "start": 2809,
        "end": 2815,
        "value": "N"
      },
      {
        "start": 2817,
        "end": 2819,
        "value": "N"
      },
      {
        "start": 2821,
        "end": 2828,
        "value": "N"
      },
      {
        "start": 2831,
        "end": 2832,
        "value": "N"
      },
      {
        "start": 2835,
        "end": 2856,
        "value": "N"
      },
      {
        "start": 2858,
        "end": 2864,
        "value": "N"
      },
      {
        "start": 2866,
        "end": 2867,
        "value": "N"
      },
      {
        "start": 2869,
        "end": 2873,
        "value": "N"
      },
      {
        "start": 2876,
        "end": 2884,
        "value": "N"
      },
      {
        "start": 2887,
        "end": 2888,
        "value": "N"
      },
      {
        "start": 2891,
        "end": 2893,
        "value": "N"
      },
      {
        "start": 2901,
        "end": 2903,
        "value": "N"
      },
      {
        "start": 2908,
        "end": 2909,
        "value": "N"
      },
      {
        "start": 2911,
        "end": 2915,
        "value": "N"
      },
      {
        "start": 2918,
        "end": 2935,
        "value": "N"
      },
      {
        "start": 2946,
        "end": 2947,
        "value": "N"
      },
      {
        "start": 2949,
        "end": 2954,
        "value": "N"
      },
      {
        "start": 2958,
        "end": 2960,
        "value": "N"
      },
      {
        "start": 2962,
        "end": 2965,
        "value": "N"
      },
      {
        "start": 2969,
        "end": 2970,
        "value": "N"
      },
      {
        "start": 2972,
        "end": 2972,
        "value": "N"
      },
      {
        "start": 2974,
        "end": 2975,
        "value": "N"
      },
      {
        "start": 2979,
        "end": 2980,
        "value": "N"
      },
      {
        "start": 2984,
        "end": 2986,
        "value": "N"
      },
      {
        "start": 2990,
        "end": 3001,
        "value": "N"
      },
      {
        "start": 3006,
        "end": 3010,
        "value": "N"
      },
      {
        "start": 3014,
        "end": 3016,
        "value": "N"
      },
      {
        "start": 3018,
        "end": 3021,
        "value": "N"
      },
      {
        "start": 3024,
        "end": 3024,
        "value": "N"
      },
      {
        "start": 3031,
        "end": 3031,
        "value": "N"
      },
      {
        "start": 3046,
        "end": 3066,
        "value": "N"
      },
      {
        "start": 3072,
        "end": 3084,
        "value": "N"
      },
      {
        "start": 3086,
        "end": 3088,
        "value": "N"
      },
      {
        "start": 3090,
        "end": 3112,
        "value": "N"
      },
      {
        "start": 3114,
        "end": 3129,
        "value": "N"
      },
      {
        "start": 3132,
        "end": 3140,
        "value": "N"
      },
      {
        "start": 3142,
        "end": 3144,
        "value": "N"
      },
      {
        "start": 3146,
        "end": 3149,
        "value": "N"
      },
      {
        "start": 3157,
        "end": 3158,
        "value": "N"
      },
      {
        "start": 3160,
        "end": 3162,
        "value": "N"
      },
      {
        "start": 3164,
        "end": 3165,
        "value": "N"
      },
      {
        "start": 3168,
        "end": 3171,
        "value": "N"
      },
      {
        "start": 3174,
        "end": 3183,
        "value": "N"
      },
      {
        "start": 3191,
        "end": 3212,
        "value": "N"
      },
      {
        "start": 3214,
        "end": 3216,
        "value": "N"
      },
      {
        "start": 3218,
        "end": 3240,
        "value": "N"
      },
      {
        "start": 3242,
        "end": 3251,
        "value": "N"
      },
      {
        "start": 3253,
        "end": 3257,
        "value": "N"
      },
      {
        "start": 3260,
        "end": 3268,
        "value": "N"
      },
      {
        "start": 3270,
        "end": 3272,
        "value": "N"
      },
      {
        "start": 3274,
        "end": 3277,
        "value": "N"
      },
      {
        "start": 3285,
        "end": 3286,
        "value": "N"
      },
      {
        "start": 3292,
        "end": 3294,
        "value": "N"
      },
      {
        "start": 3296,
        "end": 3299,
        "value": "N"
      },
      {
        "start": 3302,
        "end": 3311,
        "value": "N"
      },
      {
        "start": 3313,
        "end": 3315,
        "value": "N"
      },
      {
        "start": 3328,
        "end": 3340,
        "value": "N"
      },
      {
        "start": 3342,
        "end": 3344,
        "value": "N"
      },
      {
        "start": 3346,
        "end": 3396,
        "value": "N"
      },
      {
        "start": 3398,
        "end": 3400,
        "value": "N"
      },
      {
        "start": 3402,
        "end": 3407,
        "value": "N"
      },
      {
        "start": 3412,
        "end": 3427,
        "value": "N"
      },
      {
        "start": 3430,
        "end": 3455,
        "value": "N"
      },
      {
        "start": 3457,
        "end": 3459,
        "value": "N"
      },
      {
        "start": 3461,
        "end": 3478,
        "value": "N"
      },
      {
        "start": 3482,
        "end": 3505,
        "value": "N"
      },
      {
        "start": 3507,
        "end": 3515,
        "value": "N"
      },
      {
        "start": 3517,
        "end": 3517,
        "value": "N"
      },
      {
        "start": 3520,
        "end": 3526,
        "value": "N"
      },
      {
        "start": 3530,
        "end": 3530,
        "value": "N"
      },
      {
        "start": 3535,
        "end": 3540,
        "value": "N"
      },
      {
        "start": 3542,
        "end": 3542,
        "value": "N"
      },
      {
        "start": 3544,
        "end": 3551,
        "value": "N"
      },
      {
        "start": 3558,
        "end": 3567,
        "value": "N"
      },
      {
        "start": 3570,
        "end": 3572,
        "value": "N"
      },
      {
        "start": 3585,
        "end": 3642,
        "value": "N"
      },
      {
        "start": 3647,
        "end": 3675,
        "value": "N"
      },
      {
        "start": 3713,
        "end": 3714,
        "value": "N"
      },
      {
        "start": 3716,
        "end": 3716,
        "value": "N"
      },
      {
        "start": 3718,
        "end": 3722,
        "value": "N"
      },
      {
        "start": 3724,
        "end": 3747,
        "value": "N"
      },
      {
        "start": 3749,
        "end": 3749,
        "value": "N"
      },
      {
        "start": 3751,
        "end": 3773,
        "value": "N"
      },
      {
        "start": 3776,
        "end": 3780,
        "value": "N"
      },
      {
        "start": 3782,
        "end": 3782,
        "value": "N"
      },
      {
        "start": 3784,
        "end": 3790,
        "value": "N"
      },
      {
        "start": 3792,
        "end": 3801,
        "value": "N"
      },
      {
        "start": 3804,
        "end": 3807,
        "value": "N"
      },
      {
        "start": 3840,
        "end": 3911,
        "value": "N"
      },
      {
        "start": 3913,
        "end": 3948,
        "value": "N"
      },
      {
        "start": 3953,
        "end": 3991,
        "value": "N"
      },
      {
        "start": 3993,
        "end": 4028,
        "value": "N"
      },
      {
        "start": 4030,
        "end": 4044,
        "value": "N"
      },
      {
        "start": 4046,
        "end": 4058,
        "value": "N"
      },
      {
        "start": 4096,
        "end": 4293,
        "value": "N"
      },
      {
        "start": 4295,
        "end": 4295,
        "value": "N"
      },
      {
        "start": 4301,
        "end": 4301,
        "value": "N"
      },
      {
        "start": 4304,
        "end": 4351,
        "value": "N"
      },
      {
        "start": 4352,
        "end": 4447,
        "value": "W"
      },
      {
        "start": 4448,
        "end": 4680,
        "value": "N"
      },
      {
        "start": 4682,
        "end": 4685,
        "value": "N"
      },
      {
        "start": 4688,
        "end": 4694,
        "value": "N"
      },
      {
        "start": 4696,
        "end": 4696,
        "value": "N"
      },
      {
        "start": 4698,
        "end": 4701,
        "value": "N"
      },
      {
        "start": 4704,
        "end": 4744,
        "value": "N"
      },
      {
        "start": 4746,
        "end": 4749,
        "value": "N"
      },
      {
        "start": 4752,
        "end": 4784,
        "value": "N"
      },
      {
        "start": 4786,
        "end": 4789,
        "value": "N"
      },
      {
        "start": 4792,
        "end": 4798,
        "value": "N"
      },
      {
        "start": 4800,
        "end": 4800,
        "value": "N"
      },
      {
        "start": 4802,
        "end": 4805,
        "value": "N"
      },
      {
        "start": 4808,
        "end": 4822,
        "value": "N"
      },
      {
        "start": 4824,
        "end": 4880,
        "value": "N"
      },
      {
        "start": 4882,
        "end": 4885,
        "value": "N"
      },
      {
        "start": 4888,
        "end": 4954,
        "value": "N"
      },
      {
        "start": 4957,
        "end": 4988,
        "value": "N"
      },
      {
        "start": 4992,
        "end": 5017,
        "value": "N"
      },
      {
        "start": 5024,
        "end": 5109,
        "value": "N"
      },
      {
        "start": 5112,
        "end": 5117,
        "value": "N"
      },
      {
        "start": 5120,
        "end": 5788,
        "value": "N"
      },
      {
        "start": 5792,
        "end": 5880,
        "value": "N"
      },
      {
        "start": 5888,
        "end": 5909,
        "value": "N"
      },
      {
        "start": 5919,
        "end": 5942,
        "value": "N"
      },
      {
        "start": 5952,
        "end": 5971,
        "value": "N"
      },
      {
        "start": 5984,
        "end": 5996,
        "value": "N"
      },
      {
        "start": 5998,
        "end": 6000,
        "value": "N"
      },
      {
        "start": 6002,
        "end": 6003,
        "value": "N"
      },
      {
        "start": 6016,
        "end": 6109,
        "value": "N"
      },
      {
        "start": 6112,
        "end": 6121,
        "value": "N"
      },
      {
        "start": 6128,
        "end": 6137,
        "value": "N"
      },
      {
        "start": 6144,
        "end": 6169,
        "value": "N"
      },
      {
        "start": 6176,
        "end": 6264,
        "value": "N"
      },
      {
        "start": 6272,
        "end": 6314,
        "value": "N"
      },
      {
        "start": 6320,
        "end": 6389,
        "value": "N"
      },
      {
        "start": 6400,
        "end": 6430,
        "value": "N"
      },
      {
        "start": 6432,
        "end": 6443,
        "value": "N"
      },
      {
        "start": 6448,
        "end": 6459,
        "value": "N"
      },
      {
        "start": 6464,
        "end": 6464,
        "value": "N"
      },
      {
        "start": 6468,
        "end": 6509,
        "value": "N"
      },
      {
        "start": 6512,
        "end": 6516,
        "value": "N"
      },
      {
        "start": 6528,
        "end": 6571,
        "value": "N"
      },
      {
        "start": 6576,
        "end": 6601,
        "value": "N"
      },
      {
        "start": 6608,
        "end": 6618,
        "value": "N"
      },
      {
        "start": 6622,
        "end": 6683,
        "value": "N"
      },
      {
        "start": 6686,
        "end": 6750,
        "value": "N"
      },
      {
        "start": 6752,
        "end": 6780,
        "value": "N"
      },
      {
        "start": 6783,
        "end": 6793,
        "value": "N"
      },
      {
        "start": 6800,
        "end": 6809,
        "value": "N"
      },
      {
        "start": 6816,
        "end": 6829,
        "value": "N"
      },
      {
        "start": 6832,
        "end": 6877,
        "value": "N"
      },
      {
        "start": 6880,
        "end": 6891,
        "value": "N"
      },
      {
        "start": 6912,
        "end": 6988,
        "value": "N"
      },
      {
        "start": 6990,
        "end": 7155,
        "value": "N"
      },
      {
        "start": 7164,
        "end": 7223,
        "value": "N"
      },
      {
        "start": 7227,
        "end": 7241,
        "value": "N"
      },
      {
        "start": 7245,
        "end": 7306,
        "value": "N"
      },
      {
        "start": 7312,
        "end": 7354,
        "value": "N"
      },
      {
        "start": 7357,
        "end": 7367,
        "value": "N"
      },
      {
        "start": 7376,
        "end": 7418,
        "value": "N"
      },
      {
        "start": 7424,
        "end": 7957,
        "value": "N"
      },
      {
        "start": 7960,
        "end": 7965,
        "value": "N"
      },
      {
        "start": 7968,
        "end": 8005,
        "value": "N"
      },
      {
        "start": 8008,
        "end": 8013,
        "value": "N"
      },
      {
        "start": 8016,
        "end": 8023,
        "value": "N"
      },
      {
        "start": 8025,
        "end": 8025,
        "value": "N"
      },
      {
        "start": 8027,
        "end": 8027,
        "value": "N"
      },
      {
        "start": 8029,
        "end": 8029,
        "value": "N"
      },
      {
        "start": 8031,
        "end": 8061,
        "value": "N"
      },
      {
        "start": 8064,
        "end": 8116,
        "value": "N"
      },
      {
        "start": 8118,
        "end": 8132,
        "value": "N"
      },
      {
        "start": 8134,
        "end": 8147,
        "value": "N"
      },
      {
        "start": 8150,
        "end": 8155,
        "value": "N"
      },
      {
        "start": 8157,
        "end": 8175,
        "value": "N"
      },
      {
        "start": 8178,
        "end": 8180,
        "value": "N"
      },
      {
        "start": 8182,
        "end": 8190,
        "value": "N"
      },
      {
        "start": 8192,
        "end": 8207,
        "value": "N"
      },
      {
        "start": 8208,
        "end": 8208,
        "value": "A"
      },
      {
        "start": 8209,
        "end": 8210,
        "value": "N"
      },
      {
        "start": 8211,
        "end": 8214,
        "value": "A"
      },
      {
        "start": 8215,
        "end": 8215,
        "value": "N"
      },
      {
        "start": 8216,
        "end": 8217,
        "value": "A"
      },
      {
        "start": 8218,
        "end": 8219,
        "value": "N"
      },
      {
        "start": 8220,
        "end": 8221,
        "value": "A"
      },
      {
        "start": 8222,
        "end": 8223,
        "value": "N"
      },
      {
        "start": 8224,
        "end": 8226,
        "value": "A"
      },
      {
        "start": 8227,
        "end": 8227,
        "value": "N"
      },
      {
        "start": 8228,
        "end": 8231,
        "value": "A"
      },
      {
        "start": 8232,
        "end": 8239,
        "value": "N"
      },
      {
        "start": 8240,
        "end": 8240,
        "value": "A"
      },
      {
        "start": 8241,
        "end": 8241,
        "value": "N"
      },
      {
        "start": 8242,
        "end": 8243,
        "value": "A"
      },
      {
        "start": 8244,
        "end": 8244,
        "value": "N"
      },
      {
        "start": 8245,
        "end": 8245,
        "value": "A"
      },
      {
        "start": 8246,
        "end": 8250,
        "value": "N"
      },
      {
        "start": 8251,
        "end": 8251,
        "value": "A"
      },
      {
        "start": 8252,
        "end": 8253,
        "value": "N"
      },
      {
        "start": 8254,
        "end": 8254,
        "value": "A"
      },
      {
        "start": 8255,
        "end": 8292,
        "value": "N"
      },
      {
        "start": 8294,
        "end": 8305,
        "value": "N"
      },
      {
        "start": 8308,
        "end": 8308,
        "value": "A"
      },
      {
        "start": 8309,
        "end": 8318,
        "value": "N"
      },
      {
        "start": 8319,
        "end": 8319,
        "value": "A"
      },
      {
        "start": 8320,
        "end": 8320,
        "value": "N"
      },
      {
        "start": 8321,
        "end": 8324,
        "value": "A"
      },
      {
        "start": 8325,
        "end": 8334,
        "value": "N"
      },
      {
        "start": 8336,
        "end": 8348,
        "value": "N"
      },
      {
        "start": 8352,
        "end": 8360,
        "value": "N"
      },
      {
        "start": 8361,
        "end": 8361,
        "value": "H"
      },
      {
        "start": 8362,
        "end": 8363,
        "value": "N"
      },
      {
        "start": 8364,
        "end": 8364,
        "value": "A"
      },
      {
        "start": 8365,
        "end": 8385,
        "value": "N"
      },
      {
        "start": 8400,
        "end": 8432,
        "value": "N"
      },
      {
        "start": 8448,
        "end": 8450,
        "value": "N"
      },
      {
        "start": 8451,
        "end": 8451,
        "value": "A"
      },
      {
        "start": 8452,
        "end": 8452,
        "value": "N"
      },
      {
        "start": 8453,
        "end": 8453,
        "value": "A"
      },
      {
        "start": 8454,
        "end": 8456,
        "value": "N"
      },
      {
        "start": 8457,
        "end": 8457,
        "value": "A"
      },
      {
        "start": 8458,
        "end": 8466,
        "value": "N"
      },
      {
        "start": 8467,
        "end": 8467,
        "value": "A"
      },
      {
        "start": 8468,
        "end": 8469,
        "value": "N"
      },
      {
        "start": 8470,
        "end": 8470,
        "value": "A"
      },
      {
        "start": 8471,
        "end": 8480,
        "value": "N"
      },
      {
        "start": 8481,
        "end": 8482,
        "value": "A"
      },
      {
        "start": 8483,
        "end": 8485,
        "value": "N"
      },
      {
        "start": 8486,
        "end": 8486,
        "value": "A"
      },
      {
        "start": 8487,
        "end": 8490,
        "value": "N"
      },
      {
        "start": 8491,
        "end": 8491,
        "value": "A"
      },
      {
        "start": 8492,
        "end": 8530,
        "value": "N"
      },
      {
        "start": 8531,
        "end": 8532,
        "value": "A"
      },
      {
        "start": 8533,
        "end": 8538,
        "value": "N"
      },
      {
        "start": 8539,
        "end": 8542,
        "value": "A"
      },
      {
        "start": 8543,
        "end": 8543,
        "value": "N"
      },
      {
        "start": 8544,
        "end": 8555,
        "value": "A"
      },
      {
        "start": 8556,
        "end": 8559,
        "value": "N"
      },
      {
        "start": 8560,
        "end": 8569,
        "value": "A"
      },
      {
        "start": 8570,
        "end": 8584,
        "value": "N"
      },
      {
        "start": 8585,
        "end": 8585,
        "value": "A"
      },
      {
        "start": 8586,
        "end": 8587,
        "value": "N"
      },
      {
        "start": 8592,
        "end": 8601,
        "value": "A"
      },
      {
        "start": 8602,
        "end": 8631,
        "value": "N"
      },
      {
        "start": 8632,
        "end": 8633,
        "value": "A"
      },
      {
        "start": 8634,
        "end": 8657,
        "value": "N"
      },
      {
        "start": 8658,
        "end": 8658,
        "value": "A"
      },
      {
        "start": 8659,
        "end": 8659,
        "value": "N"
      },
      {
        "start": 8660,
        "end": 8660,
        "value": "A"
      },
      {
        "start": 8661,
        "end": 8678,
        "value": "N"
      },
      {
        "start": 8679,
        "end": 8679,
        "value": "A"
      },
      {
        "start": 8680,
        "end": 8703,
        "value": "N"
      },
      {
        "start": 8704,
        "end": 8704,
        "value": "A"
      },
      {
        "start": 8705,
        "end": 8705,
        "value": "N"
      },
      {
        "start": 8706,
        "end": 8707,
        "value": "A"
      },
      {
        "start": 8708,
        "end": 8710,
        "value": "N"
      },
      {
        "start": 8711,
        "end": 8712,
        "value": "A"
      },
      {
        "start": 8713,
        "end": 8714,
        "value": "N"
      },
      {
        "start": 8715,
        "end": 8715,
        "value": "A"
      },
      {
        "start": 8716,
        "end": 8718,
        "value": "N"
      },
      {
        "start": 8719,
        "end": 8719,
        "value": "A"
      },
      {
        "start": 8720,
        "end": 8720,
        "value": "N"
      },
      {
        "start": 8721,
        "end": 8721,
        "value": "A"
      },
      {
        "start": 8722,
        "end": 8724,
        "value": "N"
      },
      {
        "start": 8725,
        "end": 8725,
        "value": "A"
      },
      {
        "start": 8726,
        "end": 8729,
        "value": "N"
      },
      {
        "start": 8730,
        "end": 8730,
        "value": "A"
      },
      {
        "start": 8731,
        "end": 8732,
        "value": "N"
      },
      {
        "start": 8733,
        "end": 8736,
        "value": "A"
      },
      {
        "start": 8737,
        "end": 8738,
        "value": "N"
      },
      {
        "start": 8739,
        "end": 8739,
        "value": "A"
      },
      {
        "start": 8740,
        "end": 8740,
        "value": "N"
      },
      {
        "start": 8741,
        "end": 8741,
        "value": "A"
      },
      {
        "start": 8742,
        "end": 8742,
        "value": "N"
      },
      {
        "start": 8743,
        "end": 8748,
        "value": "A"
      },
      {
        "start": 8749,
        "end": 8749,
        "value": "N"
      },
      {
        "start": 8750,
        "end": 8750,
        "value": "A"
      },
      {
        "start": 8751,
        "end": 8755,
        "value": "N"
      },
      {
        "start": 8756,
        "end": 8759,
        "value": "A"
      },
      {
        "start": 8760,
        "end": 8763,
        "value": "N"
      },
      {
        "start": 8764,
        "end": 8765,
        "value": "A"
      },
      {
        "start": 8766,
        "end": 8775,
        "value": "N"
      },
      {
        "start": 8776,
        "end": 8776,
        "value": "A"
      },
      {
        "start": 8777,
        "end": 8779,
        "value": "N"
      },
      {
        "start": 8780,
        "end": 8780,
        "value": "A"
      },
      {
        "start": 8781,
        "end": 8785,
        "value": "N"
      },
      {
        "start": 8786,
        "end": 8786,
        "value": "A"
      },
      {
        "start": 8787,
        "end": 8799,
        "value": "N"
      },
      {
        "start": 8800,
        "end": 8801,
        "value": "A"
      },
      {
        "start": 8802,
        "end": 8803,
        "value": "N"
      },
      {
        "start": 8804,
        "end": 8807,
        "value": "A"
      },
      {
        "start": 8808,
        "end": 8809,
        "value": "N"
      },
      {
        "start": 8810,
        "end": 8811,
        "value": "A"
      },
      {
        "start": 8812,
        "end": 8813,
        "value": "N"
      },
      {
        "start": 8814,
        "end": 8815,
        "value": "A"
      },
      {
        "start": 8816,
        "end": 8833,
        "value": "N"
      },
      {
        "start": 8834,
        "end": 8835,
        "value": "A"
      },
      {
        "start": 8836,
        "end": 8837,
        "value": "N"
      },
      {
        "start": 8838,
        "end": 8839,
        "value": "A"
      },
      {
        "start": 8840,
        "end": 8852,
        "value": "N"
      },
      {
        "start": 8853,
        "end": 8853,
        "value": "A"
      },
      {
        "start": 8854,
        "end": 8856,
        "value": "N"
      },
      {
        "start": 8857,
        "end": 8857,
        "value": "A"
      },
      {
        "start": 8858,
        "end": 8868,
        "value": "N"
      },
      {
        "start": 8869,
        "end": 8869,
        "value": "A"
      },
      {
        "start": 8870,
        "end": 8894,
        "value": "N"
      },
      {
        "start": 8895,
        "end": 8895,
        "value": "A"
      },
      {
        "start": 8896,
        "end": 8977,
        "value": "N"
      },
      {
        "start": 8978,
        "end": 8978,
        "value": "A"
      },
      {
        "start": 8979,
        "end": 8985,
        "value": "N"
      },
      {
        "start": 8986,
        "end": 8987,
        "value": "W"
      },
      {
        "start": 8988,
        "end": 9000,
        "value": "N"
      },
      {
        "start": 9001,
        "end": 9002,
        "value": "W"
      },
      {
        "start": 9003,
        "end": 9192,
        "value": "N"
      },
      {
        "start": 9193,
        "end": 9196,
        "value": "W"
      },
      {
        "start": 9197,
        "end": 9199,
        "value": "N"
      },
      {
        "start": 9200,
        "end": 9200,
        "value": "W"
      },
      {
        "start": 9201,
        "end": 9202,
        "value": "N"
      },
      {
        "start": 9203,
        "end": 9203,
        "value": "W"
      },
      {
        "start": 9204,
        "end": 9257,
        "value": "N"
      },
      {
        "start": 9280,
        "end": 9290,
        "value": "N"
      },
      {
        "start": 9312,
        "end": 9449,
        "value": "A"
      },
      {
        "start": 9450,
        "end": 9450,
        "value": "N"
      },
      {
        "start": 9451,
        "end": 9547,
        "value": "A"
      },
      {
        "start": 9548,
        "end": 9551,
        "value": "N"
      },
      {
        "start": 9552,
        "end": 9587,
        "value": "A"
      },
      {
        "start": 9588,
        "end": 9599,
        "value": "N"
      },
      {
        "start": 9600,
        "end": 9615,
        "value": "A"
      },
      {
        "start": 9616,
        "end": 9617,
        "value": "N"
      },
      {
        "start": 9618,
        "end": 9621,
        "value": "A"
      },
      {
        "start": 9622,
        "end": 9631,
        "value": "N"
      },
      {
        "start": 9632,
        "end": 9633,
        "value": "A"
      },
      {
        "start": 9634,
        "end": 9634,
        "value": "N"
      },
      {
        "start": 9635,
        "end": 9641,
        "value": "A"
      },
      {
        "start": 9642,
        "end": 9649,
        "value": "N"
      },
      {
        "start": 9650,
        "end": 9651,
        "value": "A"
      },
      {
        "start": 9652,
        "end": 9653,
        "value": "N"
      },
      {
        "start": 9654,
        "end": 9655,
        "value": "A"
      },
      {
        "start": 9656,
        "end": 9659,
        "value": "N"
      },
      {
        "start": 9660,
        "end": 9661,
        "value": "A"
      },
      {
        "start": 9662,
        "end": 9663,
        "value": "N"
      },
      {
        "start": 9664,
        "end": 9665,
        "value": "A"
      },
      {
        "start": 9666,
        "end": 9669,
        "value": "N"
      },
      {
        "start": 9670,
        "end": 9672,
        "value": "A"
      },
      {
        "start": 9673,
        "end": 9674,
        "value": "N"
      },
      {
        "start": 9675,
        "end": 9675,
        "value": "A"
      },
      {
        "start": 9676,
        "end": 9677,
        "value": "N"
      },
      {
        "start": 9678,
        "end": 9681,
        "value": "A"
      },
      {
        "start": 9682,
        "end": 9697,
        "value": "N"
      },
      {
        "start": 9698,
        "end": 9701,
        "value": "A"
      },
      {
        "start": 9702,
        "end": 9710,
        "value": "N"
      },
      {
        "start": 9711,
        "end": 9711,
        "value": "A"
      },
      {
        "start": 9712,
        "end": 9724,
        "value": "N"
      },
      {
        "start": 9725,
        "end": 9726,
        "value": "W"
      },
      {
        "start": 9727,
        "end": 9732,
        "value": "N"
      },
      {
        "start": 9733,
        "end": 9734,
        "value": "A"
      },
      {
        "start": 9735,
        "end": 9736,
        "value": "N"
      },
      {
        "start": 9737,
        "end": 9737,
        "value": "A"
      },
      {
        "start": 9738,
        "end": 9741,
        "value": "N"
      },
      {
        "start": 9742,
        "end": 9743,
        "value": "A"
      },
      {
        "start": 9744,
        "end": 9747,
        "value": "N"
      },
      {
        "start": 9748,
        "end": 9749,
        "value": "W"
      },
      {
        "start": 9750,
        "end": 9755,
        "value": "N"
      },
      {
        "start": 9756,
        "end": 9756,
        "value": "A"
      },
      {
        "start": 9757,
        "end": 9757,
        "value": "N"
      },
      {
        "start": 9758,
        "end": 9758,
        "value": "A"
      },
      {
        "start": 9759,
        "end": 9775,
        "value": "N"
      },
      {
        "start": 9776,
        "end": 9783,
        "value": "W"
      },
      {
        "start": 9784,
        "end": 9791,
        "value": "N"
      },
      {
        "start": 9792,
        "end": 9792,
        "value": "A"
      },
      {
        "start": 9793,
        "end": 9793,
        "value": "N"
      },
      {
        "start": 9794,
        "end": 9794,
        "value": "A"
      },
      {
        "start": 9795,
        "end": 9799,
        "value": "N"
      },
      {
        "start": 9800,
        "end": 9811,
        "value": "W"
      },
      {
        "start": 9812,
        "end": 9823,
        "value": "N"
      },
      {
        "start": 9824,
        "end": 9825,
        "value": "A"
      },
      {
        "start": 9826,
        "end": 9826,
        "value": "N"
      },
      {
        "start": 9827,
        "end": 9829,
        "value": "A"
      },
      {
        "start": 9830,
        "end": 9830,
        "value": "N"
      },
      {
        "start": 9831,
        "end": 9834,
        "value": "A"
      },
      {
        "start": 9835,
        "end": 9835,
        "value": "N"
      },
      {
        "start": 9836,
        "end": 9837,
        "value": "A"
      },
      {
        "start": 9838,
        "end": 9838,
        "value": "N"
      },
      {
        "start": 9839,
        "end": 9839,
        "value": "A"
      },
      {
        "start": 9840,
        "end": 9854,
        "value": "N"
      },
      {
        "start": 9855,
        "end": 9855,
        "value": "W"
      },
      {
        "start": 9856,
        "end": 9865,
        "value": "N"
      },
      {
        "start": 9866,
        "end": 9871,
        "value": "W"
      },
      {
        "start": 9872,
        "end": 9874,
        "value": "N"
      },
      {
        "start": 9875,
        "end": 9875,
        "value": "W"
      },
      {
        "start": 9876,
        "end": 9885,
        "value": "N"
      },
      {
        "start": 9886,
        "end": 9887,
        "value": "A"
      },
      {
        "start": 9888,
        "end": 9888,
        "value": "N"
      },
      {
        "start": 9889,
        "end": 9889,
        "value": "W"
      },
      {
        "start": 9890,
        "end": 9897,
        "value": "N"
      },
      {
        "start": 9898,
        "end": 9899,
        "value": "W"
      },
      {
        "start": 9900,
        "end": 9916,
        "value": "N"
      },
      {
        "start": 9917,
        "end": 9918,
        "value": "W"
      },
      {
        "start": 9919,
        "end": 9919,
        "value": "A"
      },
      {
        "start": 9920,
        "end": 9923,
        "value": "N"
      },
      {
        "start": 9924,
        "end": 9925,
        "value": "W"
      },
      {
        "start": 9926,
        "end": 9933,
        "value": "A"
      },
      {
        "start": 9934,
        "end": 9934,
        "value": "W"
      },
      {
        "start": 9935,
        "end": 9939,
        "value": "A"
      },
      {
        "start": 9940,
        "end": 9940,
        "value": "W"
      },
      {
        "start": 9941,
        "end": 9953,
        "value": "A"
      },
      {
        "start": 9954,
        "end": 9954,
        "value": "N"
      },
      {
        "start": 9955,
        "end": 9955,
        "value": "A"
      },
      {
        "start": 9956,
        "end": 9959,
        "value": "N"
      },
      {
        "start": 9960,
        "end": 9961,
        "value": "A"
      },
      {
        "start": 9962,
        "end": 9962,
        "value": "W"
      },
      {
        "start": 9963,
        "end": 9969,
        "value": "A"
      },
      {
        "start": 9970,
        "end": 9971,
        "value": "W"
      },
      {
        "start": 9972,
        "end": 9972,
        "value": "A"
      },
      {
        "start": 9973,
        "end": 9973,
        "value": "W"
      },
      {
        "start": 9974,
        "end": 9977,
        "value": "A"
      },
      {
        "start": 9978,
        "end": 9978,
        "value": "W"
      },
      {
        "start": 9979,
        "end": 9980,
        "value": "A"
      },
      {
        "start": 9981,
        "end": 9981,
        "value": "W"
      },
      {
        "start": 9982,
        "end": 9983,
        "value": "A"
      },
      {
        "start": 9984,
        "end": 9988,
        "value": "N"
      },
      {
        "start": 9989,
        "end": 9989,
        "value": "W"
      },
      {
        "start": 9990,
        "end": 9993,
        "value": "N"
      },
      {
        "start": 9994,
        "end": 9995,
        "value": "W"
      },
      {
        "start": 9996,
        "end": 10023,
        "value": "N"
      },
      {
        "start": 10024,
        "end": 10024,
        "value": "W"
      },
      {
        "start": 10025,
        "end": 10044,
        "value": "N"
      },
      {
        "start": 10045,
        "end": 10045,
        "value": "A"
      },
      {
        "start": 10046,
        "end": 10059,
        "value": "N"
      },
      {
        "start": 10060,
        "end": 10060,
        "value": "W"
      },
      {
        "start": 10061,
        "end": 10061,
        "value": "N"
      },
      {
        "start": 10062,
        "end": 10062,
        "value": "W"
      },
      {
        "start": 10063,
        "end": 10066,
        "value": "N"
      },
      {
        "start": 10067,
        "end": 10069,
        "value": "W"
      },
      {
        "start": 10070,
        "end": 10070,
        "value": "N"
      },
      {
        "start": 10071,
        "end": 10071,
        "value": "W"
      },
      {
        "start": 10072,
        "end": 10101,
        "value": "N"
      },
      {
        "start": 10102,
        "end": 10111,
        "value": "A"
      },
      {
        "start": 10112,
        "end": 10132,
        "value": "N"
      },
      {
        "start": 10133,
        "end": 10135,
        "value": "W"
      },
      {
        "start": 10136,
        "end": 10159,
        "value": "N"
      },
      {
        "start": 10160,
        "end": 10160,
        "value": "W"
      },
      {
        "start": 10161,
        "end": 10174,
        "value": "N"
      },
      {
        "start": 10175,
        "end": 10175,
        "value": "W"
      },
      {
        "start": 10176,
        "end": 10213,
        "value": "N"
      },
      {
        "start": 10214,
        "end": 10221,
        "value": "Na"
      },
      {
        "start": 10222,
        "end": 10628,
        "value": "N"
      },
      {
        "start": 10629,
        "end": 10630,
        "value": "Na"
      },
      {
        "start": 10631,
        "end": 11034,
        "value": "N"
      },
      {
        "start": 11035,
        "end": 11036,
        "value": "W"
      },
      {
        "start": 11037,
        "end": 11087,
        "value": "N"
      },
      {
        "start": 11088,
        "end": 11088,
        "value": "W"
      },
      {
        "start": 11089,
        "end": 11092,
        "value": "N"
      },
      {
        "start": 11093,
        "end": 11093,
        "value": "W"
      },
      {
        "start": 11094,
        "end": 11097,
        "value": "A"
      },
      {
        "start": 11098,
        "end": 11123,
        "value": "N"
      },
      {
        "start": 11126,
        "end": 11507,
        "value": "N"
      },
      {
        "start": 11513,
        "end": 11557,
        "value": "N"
      },
      {
        "start": 11559,
        "end": 11559,
        "value": "N"
      },
      {
        "start": 11565,
        "end": 11565,
        "value": "N"
      },
      {
        "start": 11568,
        "end": 11623,
        "value": "N"
      },
      {
        "start": 11631,
        "end": 11632,
        "value": "N"
      },
      {
        "start": 11647,
        "end": 11670,
        "value": "N"
      },
      {
        "start": 11680,
        "end": 11686,
        "value": "N"
      },
      {
        "start": 11688,
        "end": 11694,
        "value": "N"
      },
      {
        "start": 11696,
        "end": 11702,
        "value": "N"
      },
      {
        "start": 11704,
        "end": 11710,
        "value": "N"
      },
      {
        "start": 11712,
        "end": 11718,
        "value": "N"
      },
      {
        "start": 11720,
        "end": 11726,
        "value": "N"
      },
      {
        "start": 11728,
        "end": 11734,
        "value": "N"
      },
      {
        "start": 11736,
        "end": 11742,
        "value": "N"
      },
      {
        "start": 11744,
        "end": 11869,
        "value": "N"
      },
      {
        "start": 11904,
        "end": 11929,
        "value": "W"
      },
      {
        "start": 11931,
        "end": 12019,
        "value": "W"
      },
      {
        "start": 12032,
        "end": 12245,
        "value": "W"
      },
      {
        "start": 12272,
        "end": 12287,
        "value": "W"
      },
      {
        "start": 12288,
        "end": 12288,
        "value": "F"
      },
      {
        "start": 12289,
        "end": 12350,
        "value": "W"
      },
      {
        "start": 12351,
        "end": 12351,
        "value": "N"
      },
      {
        "start": 12353,
        "end": 12438,
        "value": "W"
      },
      {
        "start": 12441,
        "end": 12543,
        "value": "W"
      },
      {
        "start": 12549,
        "end": 12591,
        "value": "W"
      },
      {
        "start": 12593,
        "end": 12686,
        "value": "W"
      },
      {
        "start": 12688,
        "end": 12773,
        "value": "W"
      },
      {
        "start": 12783,
        "end": 12830,
        "value": "W"
      },
      {
        "start": 12832,
        "end": 12871,
        "value": "W"
      },
      {
        "start": 12872,
        "end": 12879,
        "value": "A"
      },
      {
        "start": 12880,
        "end": 42124,
        "value": "W"
      },
      {
        "start": 42128,
        "end": 42182,
        "value": "W"
      },
      {
        "start": 42192,
        "end": 42539,
        "value": "N"
      },
      {
        "start": 42560,
        "end": 42743,
        "value": "N"
      },
      {
        "start": 42752,
        "end": 42972,
        "value": "N"
      },
      {
        "start": 42993,
        "end": 43052,
        "value": "N"
      },
      {
        "start": 43056,
        "end": 43065,
        "value": "N"
      },
      {
        "start": 43072,
        "end": 43127,
        "value": "N"
      },
      {
        "start": 43136,
        "end": 43205,
        "value": "N"
      },
      {
        "start": 43214,
        "end": 43225,
        "value": "N"
      },
      {
        "start": 43232,
        "end": 43347,
        "value": "N"
      },
      {
        "start": 43359,
        "end": 43359,
        "value": "N"
      },
      {
        "start": 43360,
        "end": 43388,
        "value": "W"
      },
      {
        "start": 43392,
        "end": 43469,
        "value": "N"
      },
      {
        "start": 43471,
        "end": 43481,
        "value": "N"
      },
      {
        "start": 43486,
        "end": 43518,
        "value": "N"
      },
      {
        "start": 43520,
        "end": 43574,
        "value": "N"
      },
      {
        "start": 43584,
        "end": 43597,
        "value": "N"
      },
      {
        "start": 43600,
        "end": 43609,
        "value": "N"
      },
      {
        "start": 43612,
        "end": 43714,
        "value": "N"
      },
      {
        "start": 43739,
        "end": 43766,
        "value": "N"
      },
      {
        "start": 43777,
        "end": 43782,
        "value": "N"
      },
      {
        "start": 43785,
        "end": 43790,
        "value": "N"
      },
      {
        "start": 43793,
        "end": 43798,
        "value": "N"
      },
      {
        "start": 43808,
        "end": 43814,
        "value": "N"
      },
      {
        "start": 43816,
        "end": 43822,
        "value": "N"
      },
      {
        "start": 43824,
        "end": 43883,
        "value": "N"
      },
      {
        "start": 43888,
        "end": 44013,
        "value": "N"
      },
      {
        "start": 44016,
        "end": 44025,
        "value": "N"
      },
      {
        "start": 44032,
        "end": 55203,
        "value": "W"
      },
      {
        "start": 55216,
        "end": 55238,
        "value": "N"
      },
      {
        "start": 55243,
        "end": 55291,
        "value": "N"
      },
      {
        "start": 55296,
        "end": 57343,
        "value": "N"
      },
      {
        "start": 57344,
        "end": 63743,
        "value": "A"
      },
      {
        "start": 63744,
        "end": 64255,
        "value": "W"
      },
      {
        "start": 64256,
        "end": 64262,
        "value": "N"
      },
      {
        "start": 64275,
        "end": 64279,
        "value": "N"
      },
      {
        "start": 64285,
        "end": 64310,
        "value": "N"
      },
      {
        "start": 64312,
        "end": 64316,
        "value": "N"
      },
      {
        "start": 64318,
        "end": 64318,
        "value": "N"
      },
      {
        "start": 64320,
        "end": 64321,
        "value": "N"
      },
      {
        "start": 64323,
        "end": 64324,
        "value": "N"
      },
      {
        "start": 64326,
        "end": 64975,
        "value": "N"
      },
      {
        "start": 65008,
        "end": 65023,
        "value": "N"
      },
      {
        "start": 65024,
        "end": 65039,
        "value": "A"
      },
      {
        "start": 65040,
        "end": 65049,
        "value": "W"
      },
      {
        "start": 65056,
        "end": 65071,
        "value": "N"
      },
      {
        "start": 65072,
        "end": 65106,
        "value": "W"
      },
      {
        "start": 65108,
        "end": 65126,
        "value": "W"
      },
      {
        "start": 65128,
        "end": 65131,
        "value": "W"
      },
      {
        "start": 65136,
        "end": 65140,
        "value": "N"
      },
      {
        "start": 65142,
        "end": 65276,
        "value": "N"
      },
      {
        "start": 65279,
        "end": 65279,
        "value": "N"
      },
      {
        "start": 65281,
        "end": 65376,
        "value": "F"
      },
      {
        "start": 65377,
        "end": 65470,
        "value": "H"
      },
      {
        "start": 65474,
        "end": 65479,
        "value": "H"
      },
      {
        "start": 65482,
        "end": 65487,
        "value": "H"
      },
      {
        "start": 65490,
        "end": 65495,
        "value": "H"
      },
      {
        "start": 65498,
        "end": 65500,
        "value": "H"
      },
      {
        "start": 65504,
        "end": 65510,
        "value": "F"
      },
      {
        "start": 65512,
        "end": 65518,
        "value": "H"
      },
      {
        "start": 65529,
        "end": 65532,
        "value": "N"
      },
      {
        "start": 65533,
        "end": 65533,
        "value": "A"
      },
      {
        "start": 65536,
        "end": 65547,
        "value": "N"
      },
      {
        "start": 65549,
        "end": 65574,
        "value": "N"
      },
      {
        "start": 65576,
        "end": 65594,
        "value": "N"
      },
      {
        "start": 65596,
        "end": 65597,
        "value": "N"
      },
      {
        "start": 65599,
        "end": 65613,
        "value": "N"
      },
      {
        "start": 65616,
        "end": 65629,
        "value": "N"
      },
      {
        "start": 65664,
        "end": 65786,
        "value": "N"
      },
      {
        "start": 65792,
        "end": 65794,
        "value": "N"
      },
      {
        "start": 65799,
        "end": 65843,
        "value": "N"
      },
      {
        "start": 65847,
        "end": 65934,
        "value": "N"
      },
      {
        "start": 65936,
        "end": 65948,
        "value": "N"
      },
      {
        "start": 65952,
        "end": 65952,
        "value": "N"
      },
      {
        "start": 66000,
        "end": 66045,
        "value": "N"
      },
      {
        "start": 66176,
        "end": 66204,
        "value": "N"
      },
      {
        "start": 66208,
        "end": 66256,
        "value": "N"
      },
      {
        "start": 66272,
        "end": 66299,
        "value": "N"
      },
      {
        "start": 66304,
        "end": 66339,
        "value": "N"
      },
      {
        "start": 66349,
        "end": 66378,
        "value": "N"
      },
      {
        "start": 66384,
        "end": 66426,
        "value": "N"
      },
      {
        "start": 66432,
        "end": 66461,
        "value": "N"
      },
      {
        "start": 66463,
        "end": 66499,
        "value": "N"
      },
      {
        "start": 66504,
        "end": 66517,
        "value": "N"
      },
      {
        "start": 66560,
        "end": 66717,
        "value": "N"
      },
      {
        "start": 66720,
        "end": 66729,
        "value": "N"
      },
      {
        "start": 66736,
        "end": 66771,
        "value": "N"
      },
      {
        "start": 66776,
        "end": 66811,
        "value": "N"
      },
      {
        "start": 66816,
        "end": 66855,
        "value": "N"
      },
      {
        "start": 66864,
        "end": 66915,
        "value": "N"
      },
      {
        "start": 66927,
        "end": 66938,
        "value": "N"
      },
      {
        "start": 66940,
        "end": 66954,
        "value": "N"
      },
      {
        "start": 66956,
        "end": 66962,
        "value": "N"
      },
      {
        "start": 66964,
        "end": 66965,
        "value": "N"
      },
      {
        "start": 66967,
        "end": 66977,
        "value": "N"
      },
      {
        "start": 66979,
        "end": 66993,
        "value": "N"
      },
      {
        "start": 66995,
        "end": 67001,
        "value": "N"
      },
      {
        "start": 67003,
        "end": 67004,
        "value": "N"
      },
      {
        "start": 67008,
        "end": 67059,
        "value": "N"
      },
      {
        "start": 67072,
        "end": 67382,
        "value": "N"
      },
      {
        "start": 67392,
        "end": 67413,
        "value": "N"
      },
      {
        "start": 67424,
        "end": 67431,
        "value": "N"
      },
      {
        "start": 67456,
        "end": 67461,
        "value": "N"
      },
      {
        "start": 67463,
        "end": 67504,
        "value": "N"
      },
      {
        "start": 67506,
        "end": 67514,
        "value": "N"
      },
      {
        "start": 67584,
        "end": 67589,
        "value": "N"
      },
      {
        "start": 67592,
        "end": 67592,
        "value": "N"
      },
      {
        "start": 67594,
        "end": 67637,
        "value": "N"
      },
      {
        "start": 67639,
        "end": 67640,
        "value": "N"
      },
      {
        "start": 67644,
        "end": 67644,
        "value": "N"
      },
      {
        "start": 67647,
        "end": 67669,
        "value": "N"
      },
      {
        "start": 67671,
        "end": 67742,
        "value": "N"
      },
      {
        "start": 67751,
        "end": 67759,
        "value": "N"
      },
      {
        "start": 67808,
        "end": 67826,
        "value": "N"
      },
      {
        "start": 67828,
        "end": 67829,
        "value": "N"
      },
      {
        "start": 67835,
        "end": 67867,
        "value": "N"
      },
      {
        "start": 67871,
        "end": 67897,
        "value": "N"
      },
      {
        "start": 67903,
        "end": 67929,
        "value": "N"
      },
      {
        "start": 67968,
        "end": 68023,
        "value": "N"
      },
      {
        "start": 68028,
        "end": 68047,
        "value": "N"
      },
      {
        "start": 68050,
        "end": 68099,
        "value": "N"
      },
      {
        "start": 68101,
        "end": 68102,
        "value": "N"
      },
      {
        "start": 68108,
        "end": 68115,
        "value": "N"
      },
      {
        "start": 68117,
        "end": 68119,
        "value": "N"
      },
      {
        "start": 68121,
        "end": 68149,
        "value": "N"
      },
      {
        "start": 68152,
        "end": 68154,
        "value": "N"
      },
      {
        "start": 68159,
        "end": 68168,
        "value": "N"
      },
      {
        "start": 68176,
        "end": 68184,
        "value": "N"
      },
      {
        "start": 68192,
        "end": 68255,
        "value": "N"
      },
      {
        "start": 68288,
        "end": 68326,
        "value": "N"
      },
      {
        "start": 68331,
        "end": 68342,
        "value": "N"
      },
      {
        "start": 68352,
        "end": 68405,
        "value": "N"
      },
      {
        "start": 68409,
        "end": 68437,
        "value": "N"
      },
      {
        "start": 68440,
        "end": 68466,
        "value": "N"
      },
      {
        "start": 68472,
        "end": 68497,
        "value": "N"
      },
      {
        "start": 68505,
        "end": 68508,
        "value": "N"
      },
      {
        "start": 68521,
        "end": 68527,
        "value": "N"
      },
      {
        "start": 68608,
        "end": 68680,
        "value": "N"
      },
      {
        "start": 68736,
        "end": 68786,
        "value": "N"
      },
      {
        "start": 68800,
        "end": 68850,
        "value": "N"
      },
      {
        "start": 68858,
        "end": 68903,
        "value": "N"
      },
      {
        "start": 68912,
        "end": 68921,
        "value": "N"
      },
      {
        "start": 68928,
        "end": 68965,
        "value": "N"
      },
      {
        "start": 68969,
        "end": 68997,
        "value": "N"
      },
      {
        "start": 69006,
        "end": 69007,
        "value": "N"
      },
      {
        "start": 69216,
        "end": 69246,
        "value": "N"
      },
      {
        "start": 69248,
        "end": 69289,
        "value": "N"
      },
      {
        "start": 69291,
        "end": 69293,
        "value": "N"
      },
      {
        "start": 69296,
        "end": 69297,
        "value": "N"
      },
      {
        "start": 69314,
        "end": 69319,
        "value": "N"
      },
      {
        "start": 69328,
        "end": 69336,
        "value": "N"
      },
      {
        "start": 69370,
        "end": 69415,
        "value": "N"
      },
      {
        "start": 69424,
        "end": 69465,
        "value": "N"
      },
      {
        "start": 69488,
        "end": 69513,
        "value": "N"
      },
      {
        "start": 69552,
        "end": 69579,
        "value": "N"
      },
      {
        "start": 69600,
        "end": 69622,
        "value": "N"
      },
      {
        "start": 69632,
        "end": 69709,
        "value": "N"
      },
      {
        "start": 69714,
        "end": 69749,
        "value": "N"
      },
      {
        "start": 69759,
        "end": 69826,
        "value": "N"
      },
      {
        "start": 69837,
        "end": 69837,
        "value": "N"
      },
      {
        "start": 69840,
        "end": 69864,
        "value": "N"
      },
      {
        "start": 69872,
        "end": 69881,
        "value": "N"
      },
      {
        "start": 69888,
        "end": 69940,
        "value": "N"
      },
      {
        "start": 69942,
        "end": 69959,
        "value": "N"
      },
      {
        "start": 69968,
        "end": 70006,
        "value": "N"
      },
      {
        "start": 70016,
        "end": 70111,
        "value": "N"
      },
      {
        "start": 70113,
        "end": 70132,
        "value": "N"
      },
      {
        "start": 70144,
        "end": 70161,
        "value": "N"
      },
      {
        "start": 70163,
        "end": 70209,
        "value": "N"
      },
      {
        "start": 70272,
        "end": 70278,
        "value": "N"
      },
      {
        "start": 70280,
        "end": 70280,
        "value": "N"
      },
      {
        "start": 70282,
        "end": 70285,
        "value": "N"
      },
      {
        "start": 70287,
        "end": 70301,
        "value": "N"
      },
      {
        "start": 70303,
        "end": 70313,
        "value": "N"
      },
      {
        "start": 70320,
        "end": 70378,
        "value": "N"
      },
      {
        "start": 70384,
        "end": 70393,
        "value": "N"
      },
      {
        "start": 70400,
        "end": 70403,
        "value": "N"
      },
      {
        "start": 70405,
        "end": 70412,
        "value": "N"
      },
      {
        "start": 70415,
        "end": 70416,
        "value": "N"
      },
      {
        "start": 70419,
        "end": 70440,
        "value": "N"
      },
      {
        "start": 70442,
        "end": 70448,
        "value": "N"
      },
      {
        "start": 70450,
        "end": 70451,
        "value": "N"
      },
      {
        "start": 70453,
        "end": 70457,
        "value": "N"
      },
      {
        "start": 70459,
        "end": 70468,
        "value": "N"
      },
      {
        "start": 70471,
        "end": 70472,
        "value": "N"
      },
      {
        "start": 70475,
        "end": 70477,
        "value": "N"
      },
      {
        "start": 70480,
        "end": 70480,
        "value": "N"
      },
      {
        "start": 70487,
        "end": 70487,
        "value": "N"
      },
      {
        "start": 70493,
        "end": 70499,
        "value": "N"
      },
      {
        "start": 70502,
        "end": 70508,
        "value": "N"
      },
      {
        "start": 70512,
        "end": 70516,
        "value": "N"
      },
      {
        "start": 70528,
        "end": 70537,
        "value": "N"
      },
      {
        "start": 70539,
        "end": 70539,
        "value": "N"
      },
      {
        "start": 70542,
        "end": 70542,
        "value": "N"
      },
      {
        "start": 70544,
        "end": 70581,
        "value": "N"
      },
      {
        "start": 70583,
        "end": 70592,
        "value": "N"
      },
      {
        "start": 70594,
        "end": 70594,
        "value": "N"
      },
      {
        "start": 70597,
        "end": 70597,
        "value": "N"
      },
      {
        "start": 70599,
        "end": 70602,
        "value": "N"
      },
      {
        "start": 70604,
        "end": 70613,
        "value": "N"
      },
      {
        "start": 70615,
        "end": 70616,
        "value": "N"
      },
      {
        "start": 70625,
        "end": 70626,
        "value": "N"
      },
      {
        "start": 70656,
        "end": 70747,
        "value": "N"
      },
      {
        "start": 70749,
        "end": 70753,
        "value": "N"
      },
      {
        "start": 70784,
        "end": 70855,
        "value": "N"
      },
      {
        "start": 70864,
        "end": 70873,
        "value": "N"
      },
      {
        "start": 71040,
        "end": 71093,
        "value": "N"
      },
      {
        "start": 71096,
        "end": 71133,
        "value": "N"
      },
      {
        "start": 71168,
        "end": 71236,
        "value": "N"
      },
      {
        "start": 71248,
        "end": 71257,
        "value": "N"
      },
      {
        "start": 71264,
        "end": 71276,
        "value": "N"
      },
      {
        "start": 71296,
        "end": 71353,
        "value": "N"
      },
      {
        "start": 71360,
        "end": 71369,
        "value": "N"
      },
      {
        "start": 71376,
        "end": 71395,
        "value": "N"
      },
      {
        "start": 71424,
        "end": 71450,
        "value": "N"
      },
      {
        "start": 71453,
        "end": 71467,
        "value": "N"
      },
      {
        "start": 71472,
        "end": 71494,
        "value": "N"
      },
      {
        "start": 71680,
        "end": 71739,
        "value": "N"
      },
      {
        "start": 71840,
        "end": 71922,
        "value": "N"
      },
      {
        "start": 71935,
        "end": 71942,
        "value": "N"
      },
      {
        "start": 71945,
        "end": 71945,
        "value": "N"
      },
      {
        "start": 71948,
        "end": 71955,
        "value": "N"
      },
      {
        "start": 71957,
        "end": 71958,
        "value": "N"
      },
      {
        "start": 71960,
        "end": 71989,
        "value": "N"
      },
      {
        "start": 71991,
        "end": 71992,
        "value": "N"
      },
      {
        "start": 71995,
        "end": 72006,
        "value": "N"
      },
      {
        "start": 72016,
        "end": 72025,
        "value": "N"
      },
      {
        "start": 72096,
        "end": 72103,
        "value": "N"
      },
      {
        "start": 72106,
        "end": 72151,
        "value": "N"
      },
      {
        "start": 72154,
        "end": 72164,
        "value": "N"
      },
      {
        "start": 72192,
        "end": 72263,
        "value": "N"
      },
      {
        "start": 72272,
        "end": 72354,
        "value": "N"
      },
      {
        "start": 72368,
        "end": 72440,
        "value": "N"
      },
      {
        "start": 72448,
        "end": 72457,
        "value": "N"
      },
      {
        "start": 72544,
        "end": 72551,
        "value": "N"
      },
      {
        "start": 72640,
        "end": 72673,
        "value": "N"
      },
      {
        "start": 72688,
        "end": 72697,
        "value": "N"
      },
      {
        "start": 72704,
        "end": 72712,
        "value": "N"
      },
      {
        "start": 72714,
        "end": 72758,
        "value": "N"
      },
      {
        "start": 72760,
        "end": 72773,
        "value": "N"
      },
      {
        "start": 72784,
        "end": 72812,
        "value": "N"
      },
      {
        "start": 72816,
        "end": 72847,
        "value": "N"
      },
      {
        "start": 72850,
        "end": 72871,
        "value": "N"
      },
      {
        "start": 72873,
        "end": 72886,
        "value": "N"
      },
      {
        "start": 72960,
        "end": 72966,
        "value": "N"
      },
      {
        "start": 72968,
        "end": 72969,
        "value": "N"
      },
      {
        "start": 72971,
        "end": 73014,
        "value": "N"
      },
      {
        "start": 73018,
        "end": 73018,
        "value": "N"
      },
      {
        "start": 73020,
        "end": 73021,
        "value": "N"
      },
      {
        "start": 73023,
        "end": 73031,
        "value": "N"
      },
      {
        "start": 73040,
        "end": 73049,
        "value": "N"
      },
      {
        "start": 73056,
        "end": 73061,
        "value": "N"
      },
      {
        "start": 73063,
        "end": 73064,
        "value": "N"
      },
      {
        "start": 73066,
        "end": 73102,
        "value": "N"
      },
      {
        "start": 73104,
        "end": 73105,
        "value": "N"
      },
      {
        "start": 73107,
        "end": 73112,
        "value": "N"
      },
      {
        "start": 73120,
        "end": 73129,
        "value": "N"
      },
      {
        "start": 73136,
        "end": 73179,
        "value": "N"
      },
      {
        "start": 73184,
        "end": 73193,
        "value": "N"
      },
      {
        "start": 73440,
        "end": 73464,
        "value": "N"
      },
      {
        "start": 73472,
        "end": 73488,
        "value": "N"
      },
      {
        "start": 73490,
        "end": 73530,
        "value": "N"
      },
      {
        "start": 73534,
        "end": 73562,
        "value": "N"
      },
      {
        "start": 73648,
        "end": 73648,
        "value": "N"
      },
      {
        "start": 73664,
        "end": 73713,
        "value": "N"
      },
      {
        "start": 73727,
        "end": 74649,
        "value": "N"
      },
      {
        "start": 74752,
        "end": 74862,
        "value": "N"
      },
      {
        "start": 74864,
        "end": 74868,
        "value": "N"
      },
      {
        "start": 74880,
        "end": 75075,
        "value": "N"
      },
      {
        "start": 77712,
        "end": 77810,
        "value": "N"
      },
      {
        "start": 77824,
        "end": 78933,
        "value": "N"
      },
      {
        "start": 78944,
        "end": 82938,
        "value": "N"
      },
      {
        "start": 82944,
        "end": 83526,
        "value": "N"
      },
      {
        "start": 90368,
        "end": 90425,
        "value": "N"
      },
      {
        "start": 92160,
        "end": 92728,
        "value": "N"
      },
      {
        "start": 92736,
        "end": 92766,
        "value": "N"
      },
      {
        "start": 92768,
        "end": 92777,
        "value": "N"
      },
      {
        "start": 92782,
        "end": 92862,
        "value": "N"
      },
      {
        "start": 92864,
        "end": 92873,
        "value": "N"
      },
      {
        "start": 92880,
        "end": 92909,
        "value": "N"
      },
      {
        "start": 92912,
        "end": 92917,
        "value": "N"
      },
      {
        "start": 92928,
        "end": 92997,
        "value": "N"
      },
      {
        "start": 93008,
        "end": 93017,
        "value": "N"
      },
      {
        "start": 93019,
        "end": 93025,
        "value": "N"
      },
      {
        "start": 93027,
        "end": 93047,
        "value": "N"
      },
      {
        "start": 93053,
        "end": 93071,
        "value": "N"
      },
      {
        "start": 93504,
        "end": 93561,
        "value": "N"
      },
      {
        "start": 93760,
        "end": 93850,
        "value": "N"
      },
      {
        "start": 93856,
        "end": 93880,
        "value": "N"
      },
      {
        "start": 93883,
        "end": 93907,
        "value": "N"
      },
      {
        "start": 93952,
        "end": 94026,
        "value": "N"
      },
      {
        "start": 94031,
        "end": 94087,
        "value": "N"
      },
      {
        "start": 94095,
        "end": 94111,
        "value": "N"
      },
      {
        "start": 94176,
        "end": 94180,
        "value": "W"
      },
      {
        "start": 94192,
        "end": 94198,
        "value": "W"
      },
      {
        "start": 94208,
        "end": 101589,
        "value": "W"
      },
      {
        "start": 101631,
        "end": 101662,
        "value": "W"
      },
      {
        "start": 101760,
        "end": 101874,
        "value": "W"
      },
      {
        "start": 110576,
        "end": 110579,
        "value": "W"
      },
      {
        "start": 110581,
        "end": 110587,
        "value": "W"
      },
      {
        "start": 110589,
        "end": 110590,
        "value": "W"
      },
      {
        "start": 110592,
        "end": 110882,
        "value": "W"
      },
      {
        "start": 110898,
        "end": 110898,
        "value": "W"
      },
      {
        "start": 110928,
        "end": 110930,
        "value": "W"
      },
      {
        "start": 110933,
        "end": 110933,
        "value": "W"
      },
      {
        "start": 110948,
        "end": 110951,
        "value": "W"
      },
      {
        "start": 110960,
        "end": 111355,
        "value": "W"
      },
      {
        "start": 113664,
        "end": 113770,
        "value": "N"
      },
      {
        "start": 113776,
        "end": 113788,
        "value": "N"
      },
      {
        "start": 113792,
        "end": 113800,
        "value": "N"
      },
      {
        "start": 113808,
        "end": 113817,
        "value": "N"
      },
      {
        "start": 113820,
        "end": 113827,
        "value": "N"
      },
      {
        "start": 117760,
        "end": 118012,
        "value": "N"
      },
      {
        "start": 118016,
        "end": 118451,
        "value": "N"
      },
      {
        "start": 118458,
        "end": 118480,
        "value": "N"
      },
      {
        "start": 118496,
        "end": 118512,
        "value": "N"
      },
      {
        "start": 118528,
        "end": 118573,
        "value": "N"
      },
      {
        "start": 118576,
        "end": 118598,
        "value": "N"
      },
      {
        "start": 118608,
        "end": 118723,
        "value": "N"
      },
      {
        "start": 118784,
        "end": 119029,
        "value": "N"
      },
      {
        "start": 119040,
        "end": 119078,
        "value": "N"
      },
      {
        "start": 119081,
        "end": 119274,
        "value": "N"
      },
      {
        "start": 119296,
        "end": 119365,
        "value": "N"
      },
      {
        "start": 119488,
        "end": 119507,
        "value": "N"
      },
      {
        "start": 119520,
        "end": 119539,
        "value": "N"
      },
      {
        "start": 119552,
        "end": 119638,
        "value": "W"
      },
      {
        "start": 119648,
        "end": 119670,
        "value": "W"
      },
      {
        "start": 119671,
        "end": 119672,
        "value": "N"
      },
      {
        "start": 119808,
        "end": 119892,
        "value": "N"
      },
      {
        "start": 119894,
        "end": 119964,
        "value": "N"
      },
      {
        "start": 119966,
        "end": 119967,
        "value": "N"
      },
      {
        "start": 119970,
        "end": 119970,
        "value": "N"
      },
      {
        "start": 119973,
        "end": 119974,
        "value": "N"
      },
      {
        "start": 119977,
        "end": 119980,
        "value": "N"
      },
      {
        "start": 119982,
        "end": 119993,
        "value": "N"
      },
      {
        "start": 119995,
        "end": 119995,
        "value": "N"
      },
      {
        "start": 119997,
        "end": 120003,
        "value": "N"
      },
      {
        "start": 120005,
        "end": 120069,
        "value": "N"
      },
      {
        "start": 120071,
        "end": 120074,
        "value": "N"
      },
      {
        "start": 120077,
        "end": 120084,
        "value": "N"
      },
      {
        "start": 120086,
        "end": 120092,
        "value": "N"
      },
      {
        "start": 120094,
        "end": 120121,
        "value": "N"
      },
      {
        "start": 120123,
        "end": 120126,
        "value": "N"
      },
      {
        "start": 120128,
        "end": 120132,
        "value": "N"
      },
      {
        "start": 120134,
        "end": 120134,
        "value": "N"
      },
      {
        "start": 120138,
        "end": 120144,
        "value": "N"
      },
      {
        "start": 120146,
        "end": 120485,
        "value": "N"
      },
      {
        "start": 120488,
        "end": 120779,
        "value": "N"
      },
      {
        "start": 120782,
        "end": 121483,
        "value": "N"
      },
      {
        "start": 121499,
        "end": 121503,
        "value": "N"
      },
      {
        "start": 121505,
        "end": 121519,
        "value": "N"
      },
      {
        "start": 122624,
        "end": 122654,
        "value": "N"
      },
      {
        "start": 122661,
        "end": 122666,
        "value": "N"
      },
      {
        "start": 122880,
        "end": 122886,
        "value": "N"
      },
      {
        "start": 122888,
        "end": 122904,
        "value": "N"
      },
      {
        "start": 122907,
        "end": 122913,
        "value": "N"
      },
      {
        "start": 122915,
        "end": 122916,
        "value": "N"
      },
      {
        "start": 122918,
        "end": 122922,
        "value": "N"
      },
      {
        "start": 122928,
        "end": 122989,
        "value": "N"
      },
      {
        "start": 123023,
        "end": 123023,
        "value": "N"
      },
      {
        "start": 123136,
        "end": 123180,
        "value": "N"
      },
      {
        "start": 123184,
        "end": 123197,
        "value": "N"
      },
      {
        "start": 123200,
        "end": 123209,
        "value": "N"
      },
      {
        "start": 123214,
        "end": 123215,
        "value": "N"
      },
      {
        "start": 123536,
        "end": 123566,
        "value": "N"
      },
      {
        "start": 123584,
        "end": 123641,
        "value": "N"
      },
      {
        "start": 123647,
        "end": 123647,
        "value": "N"
      },
      {
        "start": 124112,
        "end": 124153,
        "value": "N"
      },
      {
        "start": 124368,
        "end": 124410,
        "value": "N"
      },
      {
        "start": 124415,
        "end": 124415,
        "value": "N"
      },
      {
        "start": 124608,
        "end": 124638,
        "value": "N"
      },
      {
        "start": 124640,
        "end": 124661,
        "value": "N"
      },
      {
        "start": 124670,
        "end": 124671,
        "value": "N"
      },
      {
        "start": 124896,
        "end": 124902,
        "value": "N"
      },
      {
        "start": 124904,
        "end": 124907,
        "value": "N"
      },
      {
        "start": 124909,
        "end": 124910,
        "value": "N"
      },
      {
        "start": 124912,
        "end": 124926,
        "value": "N"
      },
      {
        "start": 124928,
        "end": 125124,
        "value": "N"
      },
      {
        "start": 125127,
        "end": 125142,
        "value": "N"
      },
      {
        "start": 125184,
        "end": 125259,
        "value": "N"
      },
      {
        "start": 125264,
        "end": 125273,
        "value": "N"
      },
      {
        "start": 125278,
        "end": 125279,
        "value": "N"
      },
      {
        "start": 126065,
        "end": 126132,
        "value": "N"
      },
      {
        "start": 126209,
        "end": 126269,
        "value": "N"
      },
      {
        "start": 126464,
        "end": 126467,
        "value": "N"
      },
      {
        "start": 126469,
        "end": 126495,
        "value": "N"
      },
      {
        "start": 126497,
        "end": 126498,
        "value": "N"
      },
      {
        "start": 126500,
        "end": 126500,
        "value": "N"
      },
      {
        "start": 126503,
        "end": 126503,
        "value": "N"
      },
      {
        "start": 126505,
        "end": 126514,
        "value": "N"
      },
      {
        "start": 126516,
        "end": 126519,
        "value": "N"
      },
      {
        "start": 126521,
        "end": 126521,
        "value": "N"
      },
      {
        "start": 126523,
        "end": 126523,
        "value": "N"
      },
      {
        "start": 126530,
        "end": 126530,
        "value": "N"
      },
      {
        "start": 126535,
        "end": 126535,
        "value": "N"
      },
      {
        "start": 126537,
        "end": 126537,
        "value": "N"
      },
      {
        "start": 126539,
        "end": 126539,
        "value": "N"
      },
      {
        "start": 126541,
        "end": 126543,
        "value": "N"
      },
      {
        "start": 126545,
        "end": 126546,
        "value": "N"
      },
      {
        "start": 126548,
        "end": 126548,
        "value": "N"
      },
      {
        "start": 126551,
        "end": 126551,
        "value": "N"
      },
      {
        "start": 126553,
        "end": 126553,
        "value": "N"
      },
      {
        "start": 126555,
        "end": 126555,
        "value": "N"
      },
      {
        "start": 126557,
        "end": 126557,
        "value": "N"
      },
      {
        "start": 126559,
        "end": 126559,
        "value": "N"
      },
      {
        "start": 126561,
        "end": 126562,
        "value": "N"
      },
      {
        "start": 126564,
        "end": 126564,
        "value": "N"
      },
      {
        "start": 126567,
        "end": 126570,
        "value": "N"
      },
      {
        "start": 126572,
        "end": 126578,
        "value": "N"
      },
      {
        "start": 126580,
        "end": 126583,
        "value": "N"
      },
      {
        "start": 126585,
        "end": 126588,
        "value": "N"
      },
      {
        "start": 126590,
        "end": 126590,
        "value": "N"
      },
      {
        "start": 126592,
        "end": 126601,
        "value": "N"
      },
      {
        "start": 126603,
        "end": 126619,
        "value": "N"
      },
      {
        "start": 126625,
        "end": 126627,
        "value": "N"
      },
      {
        "start": 126629,
        "end": 126633,
        "value": "N"
      },
      {
        "start": 126635,
        "end": 126651,
        "value": "N"
      },
      {
        "start": 126704,
        "end": 126705,
        "value": "N"
      },
      {
        "start": 126976,
        "end": 126979,
        "value": "N"
      },
      {
        "start": 126980,
        "end": 126980,
        "value": "W"
      },
      {
        "start": 126981,
        "end": 127019,
        "value": "N"
      },
      {
        "start": 127024,
        "end": 127123,
        "value": "N"
      },
      {
        "start": 127136,
        "end": 127150,
        "value": "N"
      },
      {
        "start": 127153,
        "end": 127167,
        "value": "N"
      },
      {
        "start": 127169,
        "end": 127182,
        "value": "N"
      },
      {
        "start": 127183,
        "end": 127183,
        "value": "W"
      },
      {
        "start": 127185,
        "end": 127221,
        "value": "N"
      },
      {
        "start": 127232,
        "end": 127242,
        "value": "A"
      },
      {
        "start": 127243,
        "end": 127247,
        "value": "N"
      },
      {
        "start": 127248,
        "end": 127277,
        "value": "A"
      },
      {
        "start": 127278,
        "end": 127279,
        "value": "N"
      },
      {
        "start": 127280,
        "end": 127337,
        "value": "A"
      },
      {
        "start": 127338,
        "end": 127343,
        "value": "N"
      },
      {
        "start": 127344,
        "end": 127373,
        "value": "A"
      },
      {
        "start": 127374,
        "end": 127374,
        "value": "W"
      },
      {
        "start": 127375,
        "end": 127376,
        "value": "A"
      },
      {
        "start": 127377,
        "end": 127386,
        "value": "W"
      },
      {
        "start": 127387,
        "end": 127404,
        "value": "A"
      },
      {
        "start": 127405,
        "end": 127405,
        "value": "N"
      },
      {
        "start": 127462,
        "end": 127487,
        "value": "N"
      },
      {
        "start": 127488,
        "end": 127490,
        "value": "W"
      },
      {
        "start": 127504,
        "end": 127547,
        "value": "W"
      },
      {
        "start": 127552,
        "end": 127560,
        "value": "W"
      },
      {
        "start": 127568,
        "end": 127569,
        "value": "W"
      },
      {
        "start": 127584,
        "end": 127589,
        "value": "W"
      },
      {
        "start": 127744,
        "end": 127776,
        "value": "W"
      },
      {
        "start": 127777,
        "end": 127788,
        "value": "N"
      },
      {
        "start": 127789,
        "end": 127797,
        "value": "W"
      },
      {
        "start": 127798,
        "end": 127798,
        "value": "N"
      },
      {
        "start": 127799,
        "end": 127868,
        "value": "W"
      },
      {
        "start": 127869,
        "end": 127869,
        "value": "N"
      },
      {
        "start": 127870,
        "end": 127891,
        "value": "W"
      },
      {
        "start": 127892,
        "end": 127903,
        "value": "N"
      },
      {
        "start": 127904,
        "end": 127946,
        "value": "W"
      },
      {
        "start": 127947,
        "end": 127950,
        "value": "N"
      },
      {
        "start": 127951,
        "end": 127955,
        "value": "W"
      },
      {
        "start": 127956,
        "end": 127967,
        "value": "N"
      },
      {
        "start": 127968,
        "end": 127984,
        "value": "W"
      },
      {
        "start": 127985,
        "end": 127987,
        "value": "N"
      },
      {
        "start": 127988,
        "end": 127988,
        "value": "W"
      },
      {
        "start": 127989,
        "end": 127991,
        "value": "N"
      },
      {
        "start": 127992,
        "end": 128062,
        "value": "W"
      },
      {
        "start": 128063,
        "end": 128063,
        "value": "N"
      },
      {
        "start": 128064,
        "end": 128064,
        "value": "W"
      },
      {
        "start": 128065,
        "end": 128065,
        "value": "N"
      },
      {
        "start": 128066,
        "end": 128252,
        "value": "W"
      },
      {
        "start": 128253,
        "end": 128254,
        "value": "N"
      },
      {
        "start": 128255,
        "end": 128317,
        "value": "W"
      },
      {
        "start": 128318,
        "end": 128330,
        "value": "N"
      },
      {
        "start": 128331,
        "end": 128334,
        "value": "W"
      },
      {
        "start": 128335,
        "end": 128335,
        "value": "N"
      },
      {
        "start": 128336,
        "end": 128359,
        "value": "W"
      },
      {
        "start": 128360,
        "end": 128377,
        "value": "N"
      },
      {
        "start": 128378,
        "end": 128378,
        "value": "W"
      },
      {
        "start": 128379,
        "end": 128404,
        "value": "N"
      },
      {
        "start": 128405,
        "end": 128406,
        "value": "W"
      },
      {
        "start": 128407,
        "end": 128419,
        "value": "N"
      },
      {
        "start": 128420,
        "end": 128420,
        "value": "W"
      },
      {
        "start": 128421,
        "end": 128506,
        "value": "N"
      },
      {
        "start": 128507,
        "end": 128591,
        "value": "W"
      },
      {
        "start": 128592,
        "end": 128639,
        "value": "N"
      },
      {
        "start": 128640,
        "end": 128709,
        "value": "W"
      },
      {
        "start": 128710,
        "end": 128715,
        "value": "N"
      },
      {
        "start": 128716,
        "end": 128716,
        "value": "W"
      },
      {
        "start": 128717,
        "end": 128719,
        "value": "N"
      },
      {
        "start": 128720,
        "end": 128722,
        "value": "W"
      },
      {
        "start": 128723,
        "end": 128724,
        "value": "N"
      },
      {
        "start": 128725,
        "end": 128728,
        "value": "W"
      },
      {
        "start": 128732,
        "end": 128735,
        "value": "W"
      },
      {
        "start": 128736,
        "end": 128746,
        "value": "N"
      },
      {
        "start": 128747,
        "end": 128748,
        "value": "W"
      },
      {
        "start": 128752,
        "end": 128755,
        "value": "N"
      },
      {
        "start": 128756,
        "end": 128764,
        "value": "W"
      },
      {
        "start": 128768,
        "end": 128985,
        "value": "N"
      },
      {
        "start": 128992,
        "end": 129003,
        "value": "W"
      },
      {
        "start": 129008,
        "end": 129008,
        "value": "W"
      },
      {
        "start": 129024,
        "end": 129035,
        "value": "N"
      },
      {
        "start": 129040,
        "end": 129095,
        "value": "N"
      },
      {
        "start": 129104,
        "end": 129113,
        "value": "N"
      },
      {
        "start": 129120,
        "end": 129159,
        "value": "N"
      },
      {
        "start": 129168,
        "end": 129197,
        "value": "N"
      },
      {
        "start": 129200,
        "end": 129211,
        "value": "N"
      },
      {
        "start": 129216,
        "end": 129217,
        "value": "N"
      },
      {
        "start": 129232,
        "end": 129240,
        "value": "N"
      },
      {
        "start": 129280,
        "end": 129291,
        "value": "N"
      },
      {
        "start": 129292,
        "end": 129338,
        "value": "W"
      },
      {
        "start": 129339,
        "end": 129339,
        "value": "N"
      },
      {
        "start": 129340,
        "end": 129349,
        "value": "W"
      },
      {
        "start": 129350,
        "end": 129350,
        "value": "N"
      },
      {
        "start": 129351,
        "end": 129535,
        "value": "W"
      },
      {
        "start": 129536,
        "end": 129623,
        "value": "N"
      },
      {
        "start": 129632,
        "end": 129645,
        "value": "N"
      },
      {
        "start": 129648,
        "end": 129660,
        "value": "W"
      },
      {
        "start": 129664,
        "end": 129674,
        "value": "W"
      },
      {
        "start": 129678,
        "end": 129734,
        "value": "W"
      },
      {
        "start": 129736,
        "end": 129736,
        "value": "W"
      },
      {
        "start": 129741,
        "end": 129756,
        "value": "W"
      },
      {
        "start": 129759,
        "end": 129770,
        "value": "W"
      },
      {
        "start": 129775,
        "end": 129784,
        "value": "W"
      },
      {
        "start": 129792,
        "end": 129938,
        "value": "N"
      },
      {
        "start": 129940,
        "end": 130042,
        "value": "N"
      },
      {
        "start": 131072,
        "end": 196605,
        "value": "W"
      },
      {
        "start": 196608,
        "end": 262141,
        "value": "W"
      },
      {
        "start": 917505,
        "end": 917505,
        "value": "N"
      },
      {
        "start": 917536,
        "end": 917631,
        "value": "N"
      },
      {
        "start": 917760,
        "end": 917999,
        "value": "A"
      },
      {
        "start": 983040,
        "end": 1048573,
        "value": "A"
      },
      {
        "start": 1048576,
        "end": 1114109,
        "value": "A"
      }
    ],
    "emoji": [
      {
        "property": "Emoji",
        "ranges": [
          {
            "start": 35,
            "end": 35
          },
          {
            "start": 42,
            "end": 42
          },
          {
            "start": 48,
            "end": 57
          },
          {
            "start": 169,
            "end": 169
          },
          {
            "start": 174,
            "end": 174
          },
          {
            "start": 8252,
            "end": 8252
          },
          {
            "start": 8265,
            "end": 8265
          },
          {
            "start": 8482,
            "end": 8482
          },
          {
            "start": 8505,
            "end": 8505
          },
          {
            "start": 8596,
            "end": 8601
          },
          {
            "start": 8617,
            "end": 8618
          },
          {
            "start": 8986,
            "end": 8987
          },
          {
            "start": 9000,
            "end": 9000
          },
          {
            "start": 9167,
            "end": 9167
          },
          {
            "start": 9193,
            "end": 9203
          },
          {
            "start": 9208,
            "end": 9210
          },
          {
            "start": 9410,
            "end": 9410
          },
          {
            "start": 9642,
            "end": 9643
          },
          {
            "start": 9654,
            "end": 9654
          },
          {
            "start": 9664,
            "end": 9664
          },
          {
            "start": 9723,
            "end": 9726
          },
          {
            "start": 9728,
            "end": 9732
          },
          {
            "start": 9742,
            "end": 9742
          },
          {
            "start": 9745,
            "end": 9745
          },
          {
            "start": 9748,
            "end": 9749
          },
          {
            "start": 9752,
            "end": 9752
          },
          {
            "start": 9757,
            "end": 9757
          },
          {
            "start": 9760,
            "end": 9760
          },
          {
            "start": 9762,
            "end": 9763
          },
          {
            "start": 9766,
            "end": 9766
          },
          {
            "start": 9770,
            "end": 9770
          },
          {
            "start": 9774,
            "end": 9775
          },
          {
            "start": 9784,
            "end": 9786
          },
          {
            "start": 9792,
            "end": 9792
          },
          {
            "start": 9794,
            "end": 9794
          },
          {
            "start": 9800,
            "end": 9811
          },
          {
            "start": 9823,
            "end": 9824
          },
          {
            "start": 9827,
            "end": 9827
          },
          {
            "start": 9829,
            "end": 9830
          },
          {
            "start": 9832,
            "end": 9832
          },
          {
            "start": 9851,
            "end": 9851
          },
          {
            "start": 9854,
            "end": 9855
          },
          {
            "start": 9874,
            "end": 9879
          },
          {
            "start": 9881,
            "end": 9881
          },
          {
            "start": 9883,
            "end": 9884
          },
          {
            "start": 9888,
            "end": 9889
          },
          {
            "start": 9895,
            "end": 9895
          },
          {
            "start": 9898,
            "end": 9899
          },
          {
            "start": 9904,
            "end": 9905
          },
          {
            "start": 9917,
            "end": 9918
          },
          {
            "start": 9924,
            "end": 9925
          },
          {
            "start": 9928,
            "end": 9928
          },
          {
            "start": 9934,
            "end": 9935
          },
          {
            "start": 9937,
            "end": 9937
          },
          {
            "start": 9939,
            "end": 9940
          },
          {
            "start": 9961,
            "end": 9962
          },
          {
            "start": 9968,
            "end": 9973
          },
          {
            "start": 9975,
            "end": 9978
          },
          {
            "start": 9981,
            "end": 9981
          },
          {
            "start": 9986,
            "end": 9986
          },
          {
            "start": 9989,
            "end": 9989
          },
          {
            "start": 9992,
            "end": 9997
          },
          {
            "start": 9999,
            "end": 9999
          },
          {
            "start": 10002,
            "end": 10002
          },
          {
            "start": 10004,
            "end": 10004
          },
          {
            "start": 10006,
            "end": 10006
          },
          {
            "start": 10013,
            "end": 10013
          },
          {
            "start": 10017,
            "end": 10017
          },
          {
            "start": 10024,
            "end": 10024
          },
          {
            "start": 10035,
            "end": 10036
          },
          {
            "start": 10052,
            "end": 10052
          },
          {
            "start": 10055,
            "end": 10055
          },
          {
            "start": 10060,
            "end": 10060
          },
          {
            "start": 10062,
            "end": 10062
          },
          {
            "start": 10067,
            "end": 10069
          },
          {
            "start": 10071,
            "end": 10071
          },
          {
            "start": 10083,
            "end": 10084
          },
          {
            "start": 10133,
            "end": 10135
          },
          {
            "start": 10145,
            "end": 10145
          },
          {
            "start": 10160,
            "end": 10160
          },
          {
            "start": 10175,
            "end": 10175
          },
          {
            "start": 10548,
            "end": 10549
          },
          {
            "start": 11013,
            "end": 11015
          },
          {
            "start": 11035,
            "end": 11036
          },
          {
            "start": 11088,
            "end": 11088
          },
          {
            "start": 11093,
            "end": 11093
          },
          {
            "start": 12336,
            "end": 12336
          },
          {
            "start": 12349,
            "end": 12349
          },
          {
            "start": 12951,
            "end": 12951
          },
          {
            "start": 12953,
            "end": 12953
          },
          {
            "start": 126980,
            "end": 126980
          },
          {
            "start": 127183,
            "end": 127183
          },
          {
            "start": 127344,
            "end": 127345
          },
          {
            "start": 127358,
            "end": 127359
          },
          {
            "start": 127374,
            "end": 127374
          },
          {
            "start": 127377,
            "end": 127386
          },
          {
            "start": 127462,
            "end": 127487
          },
          {
            "start": 127489,
            "end": 127490
          },
          {
            "start": 127514,
            "end": 127514
          },
          {
            "start": 127535,
            "end": 127535
          },
          {
            "start": 127538,
            "end": 127546
          },
          {
            "start": 127568,
            "end": 127569
          },
          {
            "start": 127744,
            "end": 127777
          },
          {
            "start": 127780,
            "end": 127891
          },
          {
            "start": 127894,
            "end": 127895
          },
          {
            "start": 127897,
            "end": 127899
          },
          {
            "start": 127902,
            "end": 127984
          },
          {
            "start": 127987,
            "end": 127989
          },
          {
            "start": 127991,
            "end": 128253
          },
          {
            "start": 128255,
            "end": 128317
          },
          {
            "start": 128329,
            "end": 128334
          },
          {
            "start": 128336,
            "end": 128359
          },
          {
            "start": 128367,
            "end": 128368
          },
          {
            "start": 128371,
            "end": 128378
          },
          {
            "start": 128391,
            "end": 128391
          },
          {
            "start": 128394,
            "end": 128397
          },
          {
            "start": 128400,
            "end": 128400
          },
          {
            "start": 128405,
            "end": 128406
          },
          {
            "start": 128420,
            "end": 128421
          },
          {
            "start": 128424,
            "end": 128424
          },
          {
            "start": 128433,
            "end": 128434
          },
          {
            "start": 128444,
            "end": 128444
          },
          {
            "start": 128450,
            "end": 128452
          },
          {
            "start": 128465,
            "end": 128467
          },
          {
            "start": 128476,
            "end": 128478
          },
          {
            "start": 128481,
            "end": 128481
          },
          {
            "start": 128483,
            "end": 128483
          },
          {
            "start": 128488,
            "end": 128488
          },
          {
            "start": 128495,
            "end": 128495
          },
          {
            "start": 128499,
            "end": 128499
          },
          {
            "start": 128506,
            "end": 128591
          },
          {
            "start": 128640,
            "end": 128709
          },
          {
            "start": 128715,
            "end": 128722
          },
          {
            "start": 128725,
            "end": 128728
          },
          {
            "start": 128732,
            "end": 128741
          },
          {
            "start": 128745,
            "end": 128745
          },
          {
            "start": 128747,
            "end": 128748
          },
          {
            "start": 128752,
            "end": 128752
          },
          {
            "start": 128755,
            "end": 128764
          },
          {
            "start": 128992,
            "end": 129003
          },
          {
            "start": 129008,
            "end": 129008
          },
          {
            "start": 129292,
            "end": 129338
          },
          {
            "start": 129340,
            "end": 129349
          },
          {
            "start": 129351,
            "end": 129535
          },
          {
            "start": 129648,
            "end": 129660
          },
          {
            "start": 129664,
            "end": 129674
          },
          {
            "start": 129678,
            "end": 129734
          },
          {
            "start": 129736,
            "end": 129736
          },
          {
            "start": 129741,
            "end": 129756
          },
          {
            "start": 129759,
            "end": 129770
          },
          {
            "start": 129775,
            "end": 129784
          }
        ]
      },
      {
        "property": "Emoji_Component",
        "ranges": [
          {
            "start": 35,
            "end": 35
          },
          {
            "start": 42,
            "end": 42
          },
          {
            "start": 48,
            "end": 57
          },
          {
            "start": 8205,
            "end": 8205
          },
          {
            "start": 8419,
            "end": 8419
          },
          {
            "start": 65039,
            "end": 65039
          },
          {
            "start": 127462,
            "end": 127487
          },
          {
            "start": 127995,
            "end": 127999
          },
          {
            "start": 129456,
            "end": 129459
          },
          {
            "start": 917536,
            "end": 917631
          }
        ]
      },
      {
        "property": "Emoji_Modifier",
        "ranges": [
          {
            "start": 127995,
            "end": 127999
          }
        ]
      },
      {
        "property": "Emoji_Modifier_Base",
        "ranges": [
          {
            "start": 9757,
            "end": 9757
          },
          {
            "start": 9977,
            "end": 9977
          },
          {
            "start": 9994,
            "end": 9997
          },
          {
            "start": 127877,
            "end": 127877
          },
          {
            "start": 127938,
            "end": 127940
          },
          {
            "start": 127943,
            "end": 127943
          },
          {
            "start": 127946,
            "end": 127948
          },
          {
            "start": 128066,
            "end": 128067
          },
          {
            "start": 128070,
            "end": 128080
          },
          {
            "start": 128102,
            "end": 128120
          },
          {
            "start": 128124,
            "end": 128124
          },
          {
            "start": 128129,
            "end": 128131
          },
          {
            "start": 128133,
            "end": 128135
          },
          {
            "start": 128143,
            "end": 128143
          },
          {
            "start": 128145,
            "end": 128145
          },
          {
            "start": 128170,
            "end": 128170
          },
          {
            "start": 128372,
            "end": 128373
          },
          {
            "start": 128378,
            "end": 128378
          },
          {
            "start": 128400,
            "end": 128400
          },
          {
            "start": 128405,
            "end": 128406
          },
          {
            "start": 128581,
            "end": 128583
          },
          {
            "start": 128587,
            "end": 128591
          },
          {
            "start": 128675,
            "end": 128675
          },
          {
            "start": 128692,
            "end": 128694
          },
          {
            "start": 128704,
            "end": 128704
          },
          {
            "start": 128716,
            "end": 128716
          },
          {
            "start": 129292,
            "end": 129292
          },
          {
            "start": 129295,
            "end": 129295
          },
          {
            "start": 129304,
            "end": 129311
          },
          {
            "start": 129318,
            "end": 129318
          },
          {
            "start": 129328,
            "end": 129337
          },
          {
            "start": 129340,
            "end": 129342
          },
          {
            "start": 129399,
            "end": 129399
          },
          {
            "start": 129461,
            "end": 129462
          },
          {
            "start": 129464,
            "end": 129465
          },
          {
            "start": 129467,
            "end": 129467
          },
          {
            "start": 129485,
            "end": 129487
          },
          {
            "start": 129489,
            "end": 129501
          },
          {
            "start": 129731,
            "end": 129733
          },
          {
            "start": 129776,
            "end": 129784
          }
        ]
      },
      {
        "property": "Emoji_Presentation",
        "ranges": [
          {
            "start": 8986,
            "end": 8987
          },
          {
            "start": 9193,
            "end": 9196
          },
          {
            "start": 9200,
            "end": 9200
          },
          {
            "start": 9203,
            "end": 9203
          },
          {
            "start": 9725,
            "end": 9726
          },
          {
            "start": 9748,
            "end": 9749
          },
          {
            "start": 9800,
            "end": 9811
          },
          {
            "start": 9855,
            "end": 9855
          },
          {
            "start": 9875,
            "end": 9875
          },
          {
            "start": 9889,
            "end": 9889
          },
          {
            "start": 9898,
            "end": 9899
          },
          {
            "start": 9917,
            "end": 9918
          },
          {
            "start": 9924,
            "end": 9925
          },
          {
            "start": 9934,
            "end": 9934
          },
          {
            "start": 9940,
            "end": 9940
          },
          {
            "start": 9962,
            "end": 9962
          },
          {
            "start": 9970,
            "end": 9971
          },
          {
            "start": 9973,
            "end": 9973
          },
          {
            "start": 9978,
            "end": 9978
          },
          {
            "start": 9981,
            "end": 9981
          },
          {
            "start": 9989,
            "end": 9989
          },
          {
            "start": 9994,
            "end": 9995
          },
          {
            "start": 10024,
            "end": 10024
          },
          {
            "start": 10060,
            "end": 10060
          },
          {
            "start": 10062,
            "end": 10062
          },
          {
            "start": 10067,
            "end": 10069
          },
          {
            "start": 10071,
            "end": 10071
          },
          {
            "start": 10133,
            "end": 10135
          },
          {
            "start": 10160,
            "end": 10160
          },
          {
            "start": 10175,
            "end": 10175
          },
          {
            "start": 11035,
            "end": 11036
          },
          {
            "start": 11088,
            "end": 11088
          },
          {
            "start": 11093,
            "end": 11093
          },
          {
            "start": 126980,
            "end": 126980
          },
          {
            "start": 127183,
            "end": 127183
          },
          {
            "start": 127374,
            "end": 127374
          },
          {
            "start": 127377,
            "end": 127386
          },
          {
            "start": 127462,
            "end": 127487
          },
          {
            "start": 127489,
            "end": 127489
          },
          {
            "start": 127514,
            "end": 127514
          },
          {
            "start": 127535,
            "end": 127535
          },
          {
            "start": 127538,
            "end": 127542
          },
          {
            "start": 127544,
            "end": 127546
          },
          {
            "start": 127568,
            "end": 127569
          },
          {
            "start": 127744,
            "end": 127776
          },
          {
            "start": 127789,
            "end": 127797
          },
          {
            "start": 127799,
            "end": 127868
          },
          {
            "start": 127870,
            "end": 127891
          },
          {
            "start": 127904,
            "end": 127946
          },
          {
            "start": 127951,
            "end": 127955
          },
          {
            "start": 127968,
            "end": 127984
          },
          {
            "start": 127988,
            "end": 127988
          },
          {
            "start": 127992,
            "end": 128062
          },
          {
            "start": 128064,
            "end": 128064
          },
          {
            "start": 128066,
            "end": 128252
          },
          {
            "start": 128255,
            "end": 128317
          },
          {
            "start": 128331,
            "end": 128334
          },
          {
            "start": 128336,
            "end": 128359
          },
          {
            "start": 128378,
            "end": 128378
          },
          {
            "start": 128405,
            "end": 128406
          },
          {
            "start": 128420,
            "end": 128420
          },
          {
            "start": 128507,
            "end": 128591
          },
          {
            "start": 128640,
            "end": 128709
          },
          {
            "start": 128716,
            "end": 128716
          },
          {
            "start": 128720,
            "end": 128722
          },
          {
            "start": 128725,
            "end": 128728
          },
          {
            "start": 128732,
            "end": 128735
          },
          {
            "start": 128747,
            "end": 128748
          },
          {
            "start": 128756,
            "end": 128764
          },
          {
            "start": 128992,
            "end": 129003
          },
          {
            "start": 129008,
            "end": 129008
          },
          {
            "start": 129292,
            "end": 129338
          },
          {
            "start": 129340,
            "end": 129349
          },
          {
            "start": 129351,
            "end": 129535
          },
          {
            "start": 129648,
            "end": 129660
          },
          {
            "start": 129664,
            "end": 129674
          },
          {
            "start": 129678,
            "end": 129734
          },
          {
            "start": 129736,
            "end": 129736
          },
          {
            "start": 129741,
            "end": 129756
          },
          {
            "start": 129759,
            "end": 129770
          },
          {
            "start": 129775,
            "end": 129784
          }
        ]
      },
      {
        "property": "Extended_Pictographic",
        "ranges": [
          {
            "start": 169,
            "end": 169
          },
          {
            "start": 174,
            "end": 174
          },
          {
            "start": 8252,
            "end": 8252
          },
          {
            "start": 8265,
            "end": 8265
          },
          {
            "start": 8482,
            "end": 8482
          },
          {
            "start": 8505,
            "end": 8505
          },
          {
            "start": 8596,
            "end": 8601
          },
          {
            "start": 8617,
            "end": 8618
          },
          {
            "start": 8986,
            "end": 8987
          },
          {
            "start": 9000,
            "end": 9000
          },
          {
            "start": 9167,
            "end": 9167
          },
          {
            "start": 9193,
            "end": 9203
          },
          {
            "start": 9208,
            "end": 9210
          },
          {
            "start": 9410,
            "end": 9410
          },
          {
            "start": 9642,
            "end": 9643
          },
          {
            "start": 9654,
            "end": 9654
          },
          {
            "start": 9664,
            "end": 9664
          },
          {
            "start": 9723,
            "end": 9726
          },
          {
            "start": 9728,
            "end": 9732
          },
          {
            "start": 9742,
            "end": 9742
          },
          {
            "start": 9745,
            "end": 9745
          },
          {
            "start": 9748,
            "end": 9749
          },
          {
            "start": 9752,
            "end": 9752
          },
          {
            "start": 9757,
            "end": 9757
          },
          {
            "start": 9760,
            "end": 9760
          },
          {
            "start": 9762,
            "end": 9763
          },
          {
            "start": 9766,
            "end": 9766
          },
          {
            "start": 9770,
            "end": 9770
          },
          {
            "start": 9774,
            "end": 9775
          },
          {
            "start": 9784,
            "end": 9786
          },
          {
            "start": 9792,
            "end": 9792
          },
          {
            "start": 9794,
            "end": 9794
          },
          {
            "start": 9800,
            "end": 9811
          },
          {
            "start": 9823,
            "end": 9824
          },
          {
            "start": 9827,
            "end": 9827
          },
          {
            "start": 9829,
            "end": 9830
          },
          {
            "start": 9832,
            "end": 9832
          },
          {
            "start": 9851,
            "end": 9851
          },
          {
            "start": 9854,
            "end": 9855
          },
          {
            "start": 9874,
            "end": 9879
          },
          {
            "start": 9881,
            "end": 9881
          },
          {
            "start": 9883,
            "end": 9884
          },
          {
            "start": 9888,
            "end": 9889
          },
          {
            "start": 9895,
            "end": 9895
          },
          {
            "start": 9898,
            "end": 9899
          },
          {
            "start": 9904,
            "end": 9905
          },
          {
            "start": 9917,
            "end": 9918
          },
          {
            "start": 9924,
            "end": 9925
          },
          {
            "start": 9928,
            "end": 9928
          },
          {
            "start": 9934,
            "end": 9935
          },
          {
            "start": 9937,
            "end": 9937
          },
          {
            "start": 9939,
            "end": 9940
          },
          {
            "start": 9961,
            "end": 9962
          },
          {
            "start": 9968,
            "end": 9973
          },
          {
            "start": 9975,
            "end": 9978
          },
          {
            "start": 9981,
            "end": 9981
          },
          {
            "start": 9986,
            "end": 9986
          },
          {
            "start": 9989,
            "end": 9989
          },
          {
            "start": 9992,
            "end": 9997
          },
          {
            "start": 9999,
            "end": 9999
          },
          {
            "start": 10002,
            "end": 10002
          },
          {
            "start": 10004,
            "end": 10004
          },
          {
            "start": 10006,
            "end": 10006
          },
          {
            "start": 10013,
            "end": 10013
          },
          {
            "start": 10017,
            "end": 10017
          },
          {
            "start": 10024,
            "end": 10024
          },
          {
            "start": 10035,
            "end": 10036
          },
          {
            "start": 10052,
            "end": 10052
          },
          {
            "start": 10055,
            "end": 10055
          },
          {
            "start": 10060,
            "end": 10060
          },
          {
            "start": 10062,
            "end": 10062
          },
          {
            "start": 10067,
            "end": 10069
          },
          {
            "start": 10071,
            "end": 10071
          },
          {
            "start": 10083,
            "end": 10084
          },
          {
            "start": 10133,
            "end": 10135
          },
          {
            "start": 10145,
            "end": 10145
          },
          {
            "start": 10160,
            "end": 10160
          },
          {
            "start": 10175,
            "end": 10175
          },
          {
            "start": 10548,
            "end": 10549
          },
          {
            "start": 11013,
            "end": 11015
          },
          {
            "start": 11035,
            "end": 11036
          },
          {
            "start": 11088,
            "end": 11088
          },
          {
            "start": 11093,
            "end": 11093
          },
          {
            "start": 12336,
            "end": 12336
          },
          {
            "start": 12349,
            "end": 12349
          },
          {
            "start": 12951,
            "end": 12951
          },
          {
            "start": 12953,
            "end": 12953
          },
          {
            "start": 126980,
            "end": 126980
          },
          {
            "start": 127020,
            "end": 127023
          },
          {
            "start": 127124,
            "end": 127135
          },
          {
            "start": 127151,
            "end": 127152
          },
          {
            "start": 127168,
            "end": 127168
          },
          {
            "start": 127183,
            "end": 127184
          },
          {
            "start": 127222,
            "end": 127231
          },
          {
            "start": 127344,
            "end": 127345
          },
          {
            "start": 127358,
            "end": 127359
          },
          {
            "start": 127374,
            "end": 127374
          },
          {
            "start": 127377,
            "end": 127386
          },
          {
            "start": 127406,
            "end": 127461
          },
          {
            "start": 127489,
            "end": 127503
          },
          {
            "start": 127514,
            "end": 127514
          },
          {
            "start": 127535,
            "end": 127535
          },
          {
            "start": 127538,
            "end": 127546
          },
          {
            "start": 127548,
            "end": 127551
          },
          {
            "start": 127561,
            "end": 127583
          },
          {
            "start": 127590,
            "end": 127777
          },
          {
            "start": 127780,
            "end": 127891
          },
          {
            "start": 127894,
            "end": 127895
          },
          {
            "start": 127897,
            "end": 127899
          },
          {
            "start": 127902,
            "end": 127984
          },
          {
            "start": 127987,
            "end": 127989
          },
          {
            "start": 127991,
            "end": 127994
          },
          {
            "start": 128000,
            "end": 128253
          },
          {
            "start": 128255,
            "end": 128317
          },
          {
            "start": 128329,
            "end": 128334
          },
          {
            "start": 128336,
            "end": 128359
          },
          {
            "start": 128367,
            "end": 128368
          },
          {
            "start": 128371,
            "end": 128378
          },
          {
            "start": 128391,
            "end": 128391
          },
          {
            "start": 128394,
            "end": 128397
          },
          {
            "start": 128400,
            "end": 128400
          },
          {
            "start": 128405,
            "end": 128406
          },
          {
            "start": 128420,
            "end": 128421
          },
          {
            "start": 128424,
            "end": 128424
          },
          {
            "start": 128433,
            "end": 128434
          },
          {
            "start": 128444,
            "end": 128444
          },
          {
            "start": 128450,
            "end": 128452
          },
          {
            "start": 128465,
            "end": 128467
          },
          {
            "start": 128476,
            "end": 128478
          },
          {
            "start": 128481,
            "end": 128481
          },
          {
            "start": 128483,
            "end": 128483
          },
          {
            "start": 128488,
            "end": 128488
          },
          {
            "start": 128495,
            "end": 128495
          },
          {
            "start": 128499,
            "end": 128499
          },
          {
            "start": 128506,
            "end": 128591
          },
          {
            "start": 128640,
            "end": 128709
          },
          {
            "start": 128715,
            "end": 128722
          },
          {
            "start": 128725,
            "end": 128741
          },
          {
            "start": 128745,
            "end": 128745
          },
          {
            "start": 128747,
            "end": 128752
          },
          {
            "start": 128755,
            "end": 128767
          },
          {
            "start": 128986,
            "end": 129023
          },
          {
            "start": 129036,
            "end": 129039
          },
          {
            "start": 129096,
            "end": 129103
          },
          {
            "start": 129114,
            "end": 129119
          },
          {
            "start": 129160,
            "end": 129167
          },
          {
            "start": 129198,
            "end": 129199
          },
          {
            "start": 129212,
            "end": 129215
          },
          {
            "start": 129218,
            "end": 129231
          },
          {
            "start": 129241,
            "end": 129279
          },
          {
            "start": 129292,
            "end": 129338
          },
          {
            "start": 129340,
            "end": 129349
          },
          {
            "start": 129351,
            "end": 129535
          },
          {
            "start": 129624,
            "end": 129631
          },
          {
            "start": 129646,
            "end": 129791
          },
          {
            "start": 130048,
            "end": 131069
          }
        ]
      }
    ]
  }
}`),Qx=`17.0.0`,$x=We(Zx);Ge($x),new Je([$x],{defaultUnicodeVersion:Qx});var eS={schema:`deno-tui.unicode-width-data`,schemaVersion:1,unicodeVersion:`17.0.0`,dataPackFingerprint:`4c885bc9201552e99c0797a4b8ea72db55fc2c315af3347ad53a9743c65bbfc2`,source:{name:`derived-general-category`,url:`https://www.unicode.org/Public/17.0.0/ucd/extracted/DerivedGeneralCategory.txt`,sha256:`d62e5bab70ca74f099343f71224fa051cb1fdd61a1ab45c0488c44cfc0b6102e`},eastAsianWidthValues:[`A`,`F`,`H`,`N`,`Na`,`W`],eastAsianWidthRanges:[0,31,3,0,94,4,0,33,3,0,0,0,0,1,4,0,0,0,0,1,4,0,1,0,0,0,3,0,0,0,0,0,3,0,0,4,0,1,0,0,0,4,0,4,0,0,0,3,0,4,0,0,0,3,0,3,0,0,5,3,0,0,0,0,8,3,0,0,0,0,5,3,0,1,0,0,4,3,0,3,0,0,3,3,0,0,0,0,0,3,0,2,0,0,0,3,0,1,0,0,1,3,0,0,0,0,0,3,0,1,0,0,2,3,0,3,0,0,0,3,0,0,0,0,0,3,0,0,0,0,1,3,0,0,0,0,14,3,0,0,0,0,0,3,0,0,0,0,6,3,0,0,0,0,9,3,0,1,0,0,2,3,0,0,0,0,4,3,0,2,0,0,3,3,0,0,0,0,5,3,0,3,0,0,0,3,0,0,0,0,2,3,0,3,0,0,0,3,0,0,0,0,3,3,0,1,0,0,17,3,0,1,0,0,2,3,0,0,0,0,97,3,0,0,0,0,0,3,0,0,0,0,0,3,0,0,0,0,0,3,0,0,0,0,0,3,0,0,0,0,0,3,0,0,0,0,0,3,0,0,0,0,0,3,0,0,0,0,115,3,0,0,0,0,14,3,0,0,0,0,97,3,0,0,0,0,1,3,0,0,0,0,0,3,0,2,0,0,0,3,0,0,0,0,1,3,0,0,0,0,6,3,0,3,0,0,0,3,0,0,0,0,0,3,0,0,0,0,31,3,0,111,0,0,7,3,2,5,3,4,6,3,1,0,3,1,2,3,0,16,0,1,6,0,0,6,3,0,16,0,0,0,3,0,6,0,0,54,3,0,0,0,0,13,3,0,63,0,0,0,3,0,0,0,0,221,3,1,37,3,2,49,3,2,2,3,1,54,3,8,26,3,4,5,3,11,269,3,1,59,3,2,100,3,14,58,3,2,48,3,2,14,3,1,27,3,2,0,3,1,10,3,5,33,3,5,236,3,1,7,3,2,1,3,2,21,3,1,6,3,1,0,3,3,3,3,2,8,3,2,1,3,2,3,3,8,0,3,4,1,3,1,4,3,2,24,3,2,2,3,1,5,3,4,1,3,2,21,3,1,6,3,1,1,3,1,1,3,1,1,3,2,0,3,1,4,3,4,1,3,2,2,3,3,0,3,7,3,3,1,0,3,7,16,3,10,2,3,1,8,3,1,2,3,1,21,3,1,6,3,1,1,3,1,4,3,2,9,3,1,2,3,1,2,3,2,0,3,15,3,3,2,11,3,7,6,3,1,2,3,1,7,3,2,1,3,2,21,3,1,6,3,1,1,3,1,4,3,2,8,3,2,1,3,2,2,3,7,2,3,4,1,3,1,4,3,2,17,3,10,1,3,1,5,3,3,2,3,1,3,3,3,1,3,1,0,3,1,1,3,3,1,3,3,2,3,3,11,3,4,4,3,3,2,3,1,3,3,2,0,3,6,0,3,14,20,3,5,12,3,1,2,3,1,22,3,1,15,3,2,8,3,1,2,3,1,3,3,7,1,3,1,2,3,1,1,3,2,3,3,2,9,3,7,21,3,1,2,3,1,22,3,1,9,3,1,4,3,2,8,3,1,2,3,1,3,3,7,1,3,5,2,3,1,3,3,2,9,3,1,2,3,12,12,3,1,2,3,1,50,3,1,2,3,1,5,3,4,15,3,2,25,3,1,2,3,1,17,3,3,23,3,1,8,3,1,0,3,2,6,3,3,0,3,4,5,3,1,0,3,1,7,3,6,9,3,2,2,3,12,57,3,4,28,3,37,1,3,1,0,3,1,4,3,1,23,3,1,0,3,1,22,3,2,4,3,1,0,3,1,6,3,1,9,3,2,3,3,32,71,3,1,35,3,4,38,3,1,35,3,1,14,3,1,12,3,37,197,3,1,0,3,5,0,3,2,47,3,0,95,5,0,232,3,1,3,3,2,6,3,1,0,3,1,3,3,2,40,3,1,3,3,2,32,3,1,3,3,2,6,3,1,0,3,1,3,3,2,14,3,1,56,3,1,3,3,2,66,3,2,31,3,3,25,3,6,85,3,2,5,3,2,668,3,3,88,3,7,21,3,9,23,3,9,19,3,12,12,3,1,2,3,1,1,3,12,93,3,2,9,3,6,9,3,6,25,3,6,88,3,7,42,3,5,69,3,10,30,3,1,11,3,4,11,3,4,0,3,3,41,3,2,4,3,11,43,3,4,25,3,6,10,3,3,61,3,2,64,3,1,28,3,2,10,3,6,9,3,6,13,3,2,45,3,2,11,3,20,76,3,1,165,3,8,59,3,3,14,3,3,61,3,5,42,3,2,10,3,8,42,3,5,533,3,2,5,3,2,37,3,2,5,3,2,7,3,1,0,3,1,0,3,1,0,3,1,30,3,2,52,3,1,14,3,1,13,3,2,5,3,1,18,3,2,2,3,1,8,3,1,15,3,0,0,0,0,1,3,0,3,0,0,0,3,0,1,0,0,1,3,0,1,0,0,1,3,0,2,0,0,0,3,0,3,0,0,7,3,0,0,0,0,0,3,0,1,0,0,0,3,0,0,0,0,4,3,0,0,0,0,1,3,0,0,0,0,37,3,1,11,3,2,0,0,0,9,3,0,0,0,0,0,3,0,3,0,0,9,3,1,12,3,3,8,3,0,0,2,0,1,3,0,0,0,0,20,3,14,32,3,15,2,3,0,0,0,0,0,3,0,0,0,0,2,3,0,0,0,0,8,3,0,0,0,0,1,3,0,0,0,0,9,3,0,1,0,0,2,3,0,0,0,0,3,3,0,0,0,0,38,3,0,1,0,0,5,3,0,3,0,0,0,3,0,11,0,0,3,3,0,9,0,0,14,3,0,0,0,0,1,3,4,9,0,0,29,3,0,1,0,0,23,3,0,0,0,0,0,3,0,0,0,0,17,3,0,0,0,0,23,3,0,0,0,0,0,3,0,1,0,0,2,3,0,1,0,0,1,3,0,0,0,0,2,3,0,0,0,0,0,3,0,0,0,0,2,3,0,0,0,0,3,3,0,0,0,0,1,3,0,3,0,0,1,3,0,0,0,0,0,3,0,0,0,0,0,3,0,5,0,0,0,3,0,0,0,0,4,3,0,3,0,0,3,3,0,1,0,0,9,3,0,0,0,0,2,3,0,0,0,0,4,3,0,0,0,0,12,3,0,1,0,0,1,3,0,3,0,0,1,3,0,1,0,0,1,3,0,1,0,0,17,3,0,1,0,0,1,3,0,1,0,0,12,3,0,0,0,0,2,3,0,0,0,0,10,3,0,0,0,0,24,3,0,0,0,0,81,3,0,0,0,0,6,3,0,1,5,0,12,3,0,1,5,0,189,3,0,3,5,0,2,3,0,0,5,0,1,3,0,0,5,0,53,3,22,10,3,21,137,0,0,0,3,0,96,0,0,3,3,0,35,0,0,11,3,0,15,0,0,1,3,0,3,0,0,9,3,0,1,0,0,0,3,0,6,0,0,7,3,0,1,0,0,1,3,0,1,0,0,3,3,0,1,0,0,1,3,0,1,0,0,3,3,0,2,0,0,1,3,0,0,0,0,1,3,0,3,0,0,15,3,0,3,0,0,8,3,0,0,0,0,12,3,0,1,5,0,5,3,0,1,0,0,1,3,0,0,0,0,3,3,0,1,0,0,3,3,0,1,5,0,5,3,0,0,0,0,0,3,0,0,0,0,16,3,0,7,5,0,7,3,0,0,0,0,0,3,0,0,0,0,4,3,0,11,5,0,11,3,0,1,0,0,0,3,0,2,0,0,0,3,0,3,0,0,0,3,0,1,0,0,0,3,0,0,0,0,14,3,0,0,5,0,9,3,0,5,5,0,2,3,0,0,5,0,9,3,0,1,0,0,0,3,0,0,5,0,7,3,0,1,5,0,16,3,0,1,5,0,0,0,0,3,3,0,1,5,0,7,0,0,0,5,0,4,0,0,0,5,0,12,0,0,0,3,0,0,0,0,3,3,0,1,0,0,0,5,0,6,0,0,1,5,0,0,0,0,0,5,0,3,0,0,0,5,0,1,0,0,0,5,0,1,0,0,4,3,0,0,5,0,3,3,0,1,5,0,27,3,0,0,5,0,19,3,0,0,0,0,13,3,0,0,5,0,0,3,0,0,5,0,3,3,0,2,5,0,0,3,0,0,5,0,29,3,0,9,0,0,20,3,0,2,5,0,23,3,0,0,5,0,13,3,0,0,5,0,37,3,0,7,4,0,406,3,0,1,4,0,403,3,0,1,5,0,50,3,0,0,5,0,3,3,0,0,5,0,3,0,0,25,3,2,381,3,5,44,3,1,0,3,5,0,3,2,55,3,7,1,3,14,23,3,9,6,3,1,6,3,1,6,3,1,6,3,1,6,3,1,6,3,1,6,3,1,6,3,1,125,3,34,25,5,1,88,5,12,213,5,26,15,5,0,0,1,0,61,5,0,0,3,1,85,5,2,102,5,5,42,5,1,93,5,1,85,5,9,47,5,1,39,5,0,7,0,0,29244,5,3,54,5,9,347,3,20,183,3,8,220,3,20,59,3,3,9,3,6,55,3,8,69,3,8,11,3,6,115,3,11,0,3,0,28,5,3,77,3,1,10,3,4,32,3,1,54,3,9,13,3,2,9,3,2,102,3,24,27,3,10,5,3,2,5,3,2,5,3,9,6,3,1,6,3,1,59,3,4,125,3,2,9,3,6,11171,5,12,22,3,4,48,3,4,2047,3,0,6399,0,0,511,5,0,6,3,12,4,3,5,25,3,1,4,3,1,0,3,1,1,3,1,1,3,1,649,3,32,15,3,0,15,0,0,9,5,6,15,3,0,34,5,1,18,5,1,3,5,4,4,3,1,134,3,2,0,3,1,95,1,0,93,2,3,5,2,2,5,2,2,5,2,2,2,2,3,6,1,1,6,2,10,3,3,0,0,0,2,11,3,1,25,3,1,18,3,1,1,3,1,14,3,2,13,3,34,122,3,5,2,3,4,44,3,3,87,3,1,12,3,3,0,3,47,45,3,130,28,3,3,48,3,15,27,3,4,35,3,9,29,3,5,42,3,5,29,3,1,36,3,4,13,3,42,157,3,2,9,3,6,35,3,4,35,3,4,39,3,8,51,3,11,11,3,1,14,3,1,6,3,1,1,3,1,10,3,1,14,3,1,6,3,1,1,3,3,51,3,12,310,3,9,21,3,10,7,3,24,5,3,1,41,3,1,8,3,69,5,3,2,0,3,1,43,3,1,1,3,3,0,3,2,22,3,1,71,3,8,8,3,48,18,3,1,1,3,5,32,3,3,26,3,5,26,3,38,55,3,4,19,3,2,49,3,1,1,3,5,7,3,1,2,3,1,28,3,2,2,3,4,9,3,7,8,3,7,63,3,32,38,3,4,11,3,9,53,3,3,28,3,2,26,3,5,25,3,7,3,3,12,6,3,80,72,3,55,50,3,13,50,3,7,45,3,8,9,3,6,37,3,3,28,3,8,1,3,208,30,3,1,41,3,1,2,3,2,1,3,16,5,3,8,8,3,33,45,3,8,41,3,22,25,3,38,27,3,20,22,3,9,77,3,4,35,3,9,67,3,10,0,3,2,24,3,7,9,3,6,52,3,1,17,3,8,38,3,9,95,3,1,19,3,11,17,3,1,46,3,62,6,3,1,0,3,1,3,3,1,14,3,1,10,3,6,58,3,5,9,3,6,3,3,1,7,3,2,1,3,2,21,3,1,6,3,1,1,3,1,4,3,1,9,3,2,1,3,2,2,3,2,0,3,6,0,3,5,6,3,2,6,3,3,4,3,11,9,3,1,0,3,2,0,3,1,37,3,1,9,3,1,0,3,2,0,3,1,3,3,1,9,3,1,1,3,8,1,3,29,91,3,1,4,3,30,71,3,8,9,3,166,53,3,2,37,3,34,68,3,11,9,3,6,12,3,19,57,3,6,9,3,6,19,3,28,26,3,2,14,3,4,22,3,185,59,3,100,82,3,12,7,3,2,0,3,2,7,3,1,1,3,1,29,3,1,1,3,2,11,3,9,9,3,70,7,3,2,45,3,2,10,3,27,71,3,8,82,3,13,72,3,7,9,3,86,7,3,88,33,3,14,9,3,6,8,3,1,44,3,1,13,3,10,28,3,3,31,3,2,21,3,1,13,3,73,6,3,1,1,3,1,43,3,3,0,3,1,1,3,1,8,3,8,9,3,6,5,3,1,1,3,1,36,3,1,1,3,1,5,3,7,9,3,6,43,3,4,9,3,246,24,3,7,16,3,1,40,3,3,28,3,85,0,3,15,49,3,13,922,3,102,110,3,1,4,3,11,195,3,2636,98,3,13,1109,3,10,3994,3,5,582,3,6841,57,3,1734,568,3,7,30,3,1,9,3,4,80,3,1,9,3,6,29,3,2,5,3,10,69,3,10,9,3,1,6,3,1,20,3,5,18,3,432,57,3,198,90,3,5,24,3,2,24,3,44,74,3,4,56,3,7,16,3,64,4,5,11,6,5,9,7381,5,41,31,5,97,114,5,8701,3,5,1,6,5,1,1,5,1,290,5,15,0,5,29,2,5,2,0,5,14,3,5,8,395,5,2308,106,3,5,12,3,3,8,3,7,9,3,2,7,3,3932,252,3,3,435,3,6,22,3,15,16,3,15,45,3,2,22,3,9,115,3,60,245,3,10,38,3,2,193,3,21,69,3,122,19,3,12,19,3,12,86,5,9,22,5,0,1,3,135,84,3,1,70,3,1,1,3,2,0,3,2,1,3,2,3,3,1,11,3,1,0,3,1,6,3,1,64,3,1,3,3,2,7,3,1,6,3,1,27,3,1,3,3,1,4,3,1,0,3,3,6,3,1,339,3,2,291,3,2,701,3,15,4,3,1,14,3,1104,30,3,6,5,3,213,6,3,1,16,3,2,6,3,1,1,3,1,4,3,5,61,3,33,0,3,112,44,3,3,13,3,2,9,3,4,1,3,320,30,3,17,57,3,5,0,3,464,41,3,214,42,3,4,0,3,192,30,3,1,21,3,8,1,3,224,6,3,1,3,3,1,1,3,1,14,3,1,196,3,2,15,3,41,75,3,4,9,3,4,1,3,785,67,3,76,60,3,194,3,3,1,26,3,1,1,3,1,0,3,2,0,3,1,9,3,1,3,3,1,0,3,1,0,3,6,0,3,4,0,3,1,0,3,1,0,3,1,2,3,1,1,3,1,0,3,2,0,3,1,0,3,1,0,3,1,0,3,1,0,3,1,1,3,1,0,3,2,3,3,1,6,3,1,3,3,1,3,3,1,0,3,1,9,3,1,16,3,5,2,3,1,4,3,1,16,3,52,1,3,270,3,3,0,0,5,0,38,3,4,99,3,12,14,3,2,14,3,1,13,3,0,0,5,1,36,3,10,10,0,0,4,3,0,29,0,0,1,3,0,57,0,0,5,3,0,29,0,0,0,5,0,1,0,0,9,5,0,17,0,0,0,3,56,25,3,0,2,5,13,43,5,4,8,5,7,1,5,14,5,5,154,32,5,0,11,3,0,8,5,0,0,3,0,69,5,0,0,3,0,21,5,0,11,3,0,42,5,0,3,3,0,4,5,0,11,3,0,16,5,0,2,3,0,0,5,0,2,3,0,70,5,0,0,3,0,0,5,0,0,3,0,186,5,0,1,3,0,62,5,0,12,3,0,3,5,0,0,3,0,23,5,0,17,3,0,0,5,0,25,3,0,1,5,0,12,3,0,0,5,0,85,3,0,84,5,0,47,3,0,69,5,0,5,3,0,0,5,0,2,3,0,2,5,0,1,3,0,3,5,3,3,5,0,10,3,0,1,5,3,3,3,0,8,5,3,217,3,6,11,5,4,0,5,15,11,3,4,55,3,8,9,3,6,39,3,8,29,3,2,11,3,4,1,3,14,8,3,39,11,3,0,46,5,0,0,3,0,9,5,0,0,3,0,184,5,0,87,3,8,13,3,2,12,5,3,10,5,3,56,5,1,0,5,4,15,5,2,11,5,4,9,5,7,146,3,1,102,3,1029,65533,5,2,65533,5,655363,0,3,30,95,3,128,239,0,65040,65533,0,2,65533,0],assignedRanges:[0,887,2,5,4,6,1,0,1,19,1,396,1,37,2,49,2,2,1,54,8,26,4,5,11,269,1,59,2,100,14,58,2,48,2,14,1,27,2,0,1,10,5,33,5,236,1,7,2,1,2,21,1,6,1,0,3,3,2,8,2,1,2,3,8,0,4,1,1,4,2,24,2,2,1,5,4,1,2,21,1,6,1,1,1,1,1,1,2,0,1,4,4,1,2,2,3,0,7,3,1,0,7,16,10,2,1,8,1,2,1,21,1,6,1,1,1,4,2,9,1,2,1,2,2,0,15,3,2,11,7,6,1,2,1,7,2,1,2,21,1,6,1,1,1,4,2,8,2,1,2,2,7,2,4,1,1,4,2,17,10,1,1,5,3,2,1,3,3,1,1,0,1,1,3,1,3,2,3,11,4,4,3,2,1,3,2,0,6,0,14,20,5,12,1,2,1,22,1,15,2,8,1,2,1,3,7,1,1,2,1,1,2,3,2,9,7,21,1,2,1,22,1,9,1,4,2,8,1,2,1,3,7,1,5,2,1,3,2,9,1,2,12,12,1,2,1,50,1,2,1,5,4,15,2,25,1,2,1,17,3,23,1,8,1,0,2,6,3,0,4,5,1,0,1,7,6,9,2,2,12,57,4,28,37,1,1,0,1,4,1,23,1,0,1,22,2,4,1,0,1,6,1,9,2,3,32,71,1,35,4,38,1,35,1,14,1,12,37,197,1,0,5,0,2,376,1,3,2,6,1,0,1,3,2,40,1,3,2,32,1,3,2,6,1,0,1,3,2,14,1,56,1,3,2,66,2,31,3,25,6,85,2,5,2,668,3,88,7,21,9,23,9,19,12,12,1,2,1,1,12,93,2,9,6,9,6,25,6,88,7,42,5,69,10,30,1,11,4,11,4,0,3,41,2,4,11,43,4,25,6,10,3,61,2,64,1,28,2,10,6,9,6,13,2,45,2,11,20,76,1,165,8,59,3,14,3,61,5,42,2,10,8,42,5,533,2,5,2,37,2,5,2,7,1,0,1,0,1,0,1,30,2,52,1,14,1,13,2,5,1,18,2,2,1,8,1,100,1,11,2,26,1,12,3,33,14,32,15,139,4,665,22,10,21,1811,2,381,5,44,1,0,5,0,2,55,7,1,14,23,9,6,1,6,1,6,1,6,1,6,1,6,1,6,1,6,1,125,34,25,1,88,12,213,26,79,1,85,2,102,5,42,1,93,1,85,9,47,1,29292,3,54,9,347,20,183,8,220,20,59,3,9,6,55,8,69,8,11,6,115,11,29,3,77,1,10,4,32,1,54,9,13,2,9,2,102,24,27,10,5,2,5,2,5,9,6,1,6,1,59,4,125,2,9,6,11171,12,22,4,48,4,8813,2,105,38,6,12,4,5,25,1,4,1,0,1,1,1,1,1,649,32,41,6,50,1,18,1,3,4,4,1,134,2,0,1,189,3,5,2,5,2,5,2,2,3,6,1,6,10,4,2,11,1,25,1,18,1,1,1,14,2,13,34,122,5,2,4,44,3,87,1,12,3,0,47,45,130,28,3,48,15,27,4,35,9,29,5,42,5,29,1,36,4,13,42,157,2,9,6,35,4,35,4,39,8,51,11,11,1,14,1,6,1,1,1,10,1,14,1,6,1,1,3,51,12,310,9,21,10,7,24,5,1,41,1,8,69,5,2,0,1,43,1,1,3,0,2,22,1,71,8,8,48,18,1,1,5,32,3,26,5,26,38,55,4,19,2,49,1,1,5,7,1,2,1,28,2,2,4,9,7,8,7,63,32,38,4,11,9,53,3,28,2,26,5,25,7,3,12,6,80,72,55,50,13,50,7,45,8,9,6,37,3,28,8,1,208,30,1,41,1,2,2,1,16,5,8,8,33,45,8,41,22,25,38,27,20,22,9,77,4,35,9,67,10,0,2,24,7,9,6,52,1,17,8,38,9,95,1,19,11,17,1,46,62,6,1,0,1,3,1,14,1,10,6,58,5,9,6,3,1,7,2,1,2,21,1,6,1,1,1,4,1,9,2,1,2,2,2,0,6,0,5,6,2,6,3,4,11,9,1,0,2,0,1,37,1,9,1,0,2,0,1,3,1,9,1,1,8,1,29,91,1,4,30,71,8,9,166,53,2,37,34,68,11,9,6,12,19,57,6,9,6,19,28,26,2,14,4,22,185,59,100,82,12,7,2,0,2,7,1,1,1,29,1,1,2,11,9,9,70,7,2,45,2,10,27,71,8,82,13,72,7,9,86,7,88,33,14,9,6,8,1,44,1,13,10,28,3,31,2,21,1,13,73,6,1,1,1,43,3,0,1,1,1,8,8,9,6,5,1,1,1,36,1,1,1,5,7,9,6,43,4,9,246,24,7,16,1,40,3,28,85,0,15,49,13,922,102,110,1,4,11,195,2636,98,13,1109,10,3994,5,582,6841,57,1734,568,7,30,1,9,4,80,1,9,6,29,2,5,10,69,10,9,1,6,1,20,5,18,432,57,198,90,5,24,2,24,44,74,4,56,7,16,64,4,11,6,9,7381,41,31,97,114,8701,3,1,6,1,1,1,290,15,0,29,2,2,0,14,3,8,395,2308,106,5,12,3,8,7,9,2,7,3932,252,3,435,6,22,15,16,15,45,2,22,9,115,60,245,10,38,2,193,21,69,122,19,12,19,12,86,9,24,135,84,1,70,1,1,2,0,2,1,2,3,1,11,1,0,1,6,1,64,1,3,2,7,1,6,1,27,1,3,1,4,1,0,3,6,1,339,2,291,2,701,15,4,1,14,1104,30,6,5,213,6,1,16,2,6,1,1,1,4,5,61,33,0,112,44,3,13,2,9,4,1,320,30,17,57,5,0,464,41,214,42,4,0,192,30,1,21,8,1,224,6,1,3,1,1,1,14,1,196,2,15,41,75,4,9,4,1,785,67,76,60,194,3,1,26,1,1,1,0,2,0,1,9,1,3,1,0,1,0,6,0,4,0,1,0,1,0,1,2,1,1,1,0,2,0,1,0,1,0,1,0,1,0,1,1,1,0,2,3,1,6,1,3,1,3,1,0,1,9,1,16,5,2,1,4,1,16,52,1,270,43,4,99,12,14,2,14,1,14,1,36,10,173,56,28,13,43,4,8,7,1,14,5,154,984,3,16,3,12,3,217,6,11,4,0,15,11,4,55,8,9,6,39,8,29,2,11,4,1,14,8,39,343,8,13,2,12,3,10,3,56,1,0,4,15,2,11,4,9,7,146,1,102,1029,42719,32,4381,2,5773,2,7472,15,621,2466,541,1506,4938,5,8489,707463,0,30,95,128,239,65040,65533,2,65533],combiningRanges:[768,111,275,6,263,44,1,0,1,1,1,1,1,0,72,10,48,20,16,0,101,6,2,5,2,1,1,3,35,0,30,26,91,10,58,8,9,0,24,3,1,8,1,2,1,4,43,2,59,8,42,23,1,31,55,0,1,0,4,7,4,0,3,6,10,1,29,0,58,0,4,3,8,0,20,1,26,0,2,1,57,0,4,1,4,1,2,2,3,0,30,1,3,0,11,1,57,0,4,4,1,1,4,0,20,1,22,5,1,0,58,0,2,0,1,3,8,0,7,1,11,1,30,0,61,0,12,0,50,0,3,0,55,0,1,2,5,2,1,3,7,1,11,1,29,0,58,0,2,0,6,0,5,1,20,1,28,1,57,1,4,3,8,0,20,1,29,0,72,0,7,2,1,0,90,0,2,6,12,7,98,0,2,8,11,6,73,1,27,0,1,0,1,0,55,13,1,4,1,1,5,10,1,35,9,0,102,3,1,5,1,1,2,1,25,1,4,2,16,3,13,0,2,1,6,0,15,0,194,159,349,2,946,2,29,1,30,1,30,1,64,1,1,6,8,0,2,10,9,0,45,2,1,0,117,1,34,0,118,2,4,1,9,0,6,2,219,1,2,0,58,0,1,6,1,0,1,0,2,7,6,9,2,0,48,45,2,11,20,3,48,0,1,4,1,0,5,0,40,8,12,1,32,3,2,1,1,2,56,0,1,1,3,0,1,2,58,7,2,1,152,2,1,12,1,6,4,0,6,0,3,1,198,63,720,32,3070,2,141,0,96,31,554,3,107,1,30164,3,1,9,32,1,80,1,272,0,3,0,4,0,25,1,5,0,151,1,26,17,13,0,38,7,25,10,46,2,48,0,2,3,2,1,39,0,67,5,2,1,2,1,12,0,8,0,47,0,51,0,1,2,2,1,5,1,1,0,42,1,8,0,238,0,2,0,4,0,11202,22,4,48,8994,0,737,15,16,15,973,0,226,0,149,4,1670,2,1,1,5,3,40,2,4,0,165,1,573,3,65,4,317,1,77,5,70,10,49,3,123,0,54,14,41,0,2,1,10,2,49,3,2,1,7,0,61,2,36,4,1,7,62,0,12,1,52,8,10,3,2,0,95,2,2,0,1,1,6,0,2,0,157,0,3,7,21,1,57,1,3,0,37,6,3,4,70,5,13,0,1,0,1,0,14,1,85,7,2,2,1,0,23,0,84,5,1,0,4,1,1,1,238,3,6,1,1,1,27,1,85,7,2,0,1,1,106,0,1,0,2,5,1,0,101,0,1,0,2,3,1,4,259,8,1,1,256,1,1,0,4,0,144,3,2,1,4,0,32,9,40,5,2,3,8,0,9,5,2,2,46,12,1,1,198,0,1,2,1,0,201,6,1,5,1,0,82,21,2,6,1,1,1,1,122,5,3,0,1,1,1,6,1,0,72,1,3,0,1,0,347,1,11,1,52,4,5,0,1,0,23,0,5349,0,6,14,11464,11,3,2,2496,4,59,6,556,0,3,3,484,0,63,3,81,0,19640,1,4705,45,2,22,544,2,17,7,2,6,30,3,148,2,1979,54,4,49,8,0,14,0,22,4,1,14,1360,6,1,16,2,6,1,1,1,4,100,0,160,6,375,0,61,3,508,3,254,1,243,0,2,0,7,1,5,0,474,6,109,6,792501,239],zeroWidthRanges:[0,31,95,32,13,0,1390,0,4593,0,2044,4,24,6,49,15,56975,0,240,11,13364,15,34912,3,5327,7,798341,255,240,3599],fingerprint:`f9935ff076aa5994700815d5b6117c7bc9fda5991c8d6dc4b8f78e742b4259f3`},tS=Object.freeze({maxProfiles:32,maxNameLength:64,maxDescriptionLength:256,maxTextUtf16Length:1048576,maxEncodedValues:1e5,maxDiagnosticLength:256}),nS=class extends TypeError{code;path;constructor(e,t,n){let r=dS(t),i=dS(n);super(`${r}: ${i}`),this.code=e,this.path=t,this.name=`TerminalWidthError`,this.path=r}},rS=/^[a-z][a-z0-9._-]{0,63}$/,iS=/^[0-9a-f]{64}$/,aS=1114111,oS=`17.0.0`,sS=`4c885bc9201552e99c0797a4b8ea72db55fc2c315af3347ad53a9743c65bbfc2`,cS=Object.freeze([`A`,`F`,`H`,`N`,`Na`,`W`]),lS=new WeakSet,uS;function dS(e){return e.length<=tS.maxDiagnosticLength?e:`${e.slice(0,tS.maxDiagnosticLength-3)}...`}function $(e,t,n){throw new nS(e,t,n)}function fS(e,t,n,r=n,i=`invalid-data`){let a=!1;try{a=Array.isArray(e)}catch{return $(i,t,`object identity could not be inspected safely`)}(typeof e!=`object`||!e||a)&&$(i,t,`expected a plain object`);let o,s;try{o=Object.getPrototypeOf(e),s=Reflect.ownKeys(e)}catch{return $(i,t,`object could not be inspected safely`)}o!==Object.prototype&&o!==null&&$(i,t,`expected a plain object`),s.length>n.length&&$(i,t,`property count exceeds the expected shape`);let c=new Set(n),l=Object.create(null);for(let n of s){(typeof n!=`string`||!c.has(n))&&$(i,t,`unknown property`);let r;try{r=Reflect.getOwnPropertyDescriptor(e,n)}catch{return $(i,`${t}.${n}`,`property could not be inspected safely`)}(r===void 0||!(`value`in r)||r.get!==void 0||r.set!==void 0||r.enumerable!==!0)&&$(i,`${t}.${n}`,`expected an enumerable data property`),l[n]=r.value}for(let e of r)Object.hasOwn(l,e)||$(i,`${t}.${e}`,`required property is missing`);return l}function pS(e,t,n,r=`invalid-data`){let i=!1;try{i=Array.isArray(e)}catch{return $(r,t,`array identity could not be inspected safely`)}i||$(r,t,`expected an array`);let a,o;try{a=Object.getPrototypeOf(e),o=Reflect.getOwnPropertyDescriptor(e,`length`)}catch{return $(r,t,`array could not be inspected safely`)}a!==Array.prototype&&a!==null&&$(r,t,`expected a plain array`),(o===void 0||!(`value`in o))&&$(r,`${t}.length`,`expected an own data property`);let s=o.value;(!Number.isSafeInteger(s)||s<0||s>n)&&$(`limit-exceeded`,`${t}.length`,`must be from 0 through ${n}`);let c;try{c=Reflect.ownKeys(e)}catch{return $(r,t,`array keys could not be inspected safely`)}c.length!==s+1&&$(r,t,`sparse arrays and custom properties are not allowed`);let l=Array(s);for(let n of c){if(n===`length`)continue;(typeof n!=`string`||!/^(0|[1-9]\d*)$/.test(n))&&$(r,t,`custom array properties are not allowed`);let i=Number(n),a;try{a=Reflect.getOwnPropertyDescriptor(e,n)}catch{return $(r,`${t}[${n}]`,`property could not be inspected safely`)}(!Number.isSafeInteger(i)||i<0||i>=s||a===void 0||!(`value`in a)||a.get!==void 0||a.set!==void 0||a.enumerable!==!0)&&$(r,`${t}[${n}]`,`expected a dense enumerable data property`),l[i]=a.value}for(let e=0;e<s;e+=1)Object.hasOwn(l,e)||$(r,`${t}[${e}]`,`sparse arrays are not allowed`);return l}function mS(e,t,n,r=`invalid-data`){return(typeof e!=`string`||e.length===0||e.length>n)&&$(r,t,`expected a string from 1 through ${n} UTF-16 units`),e}function hS(e,t,n,r){return(!Number.isSafeInteger(e)||e<n||e>r)&&$(`invalid-data`,t,`expected an integer from ${n} through ${r}`),e}function gS(e,t,n){let r=pS(e,t,tS.maxEncodedValues);r.length%n!==0&&$(`invalid-data`,t,`length must be divisible by ${n}`);let i=[],a=-1;for(let e=0;e<r.length;e+=n){let o=hS(r[e],`${t}[${e}]`,0,1114112),s=hS(r[e+1],`${t}[${e+1}]`,0,aS),c=a+1+o,l=c+s;if((!Number.isSafeInteger(c)||!Number.isSafeInteger(l)||c<0||l>aS)&&$(`invalid-data`,`${t}[${e/n}]`,`decoded range is outside Unicode`),n===3){let n=hS(r[e+2],`${t}[${e+2}]`,0,cS.length-1);i.push(Object.freeze({start:c,end:l,value:cS[n]}))}else i.push(Object.freeze({start:c,end:l}));a=l}return Object.freeze(i)}function _S(){if(uS!==void 0)return uS;let e=fS(eS,`$.widthData`,[`schema`,`schemaVersion`,`unicodeVersion`,`dataPackFingerprint`,`source`,`eastAsianWidthValues`,`eastAsianWidthRanges`,`assignedRanges`,`combiningRanges`,`zeroWidthRanges`,`fingerprint`]);(e.schema!==`deno-tui.unicode-width-data`||e.schemaVersion!==1)&&$(`invalid-data`,`$.widthData`,`unsupported width-data schema`),e.unicodeVersion!==oS&&$(`invalid-data`,`$.widthData.unicodeVersion`,`does not match the supported Unicode version`),e.dataPackFingerprint!==sS&&$(`invalid-data`,`$.widthData.dataPackFingerprint`,`does not match the built-in data pack`);let t=fS(e.source,`$.widthData.source`,[`name`,`url`,`sha256`]),n=Object.freeze({name:mS(t.name,`$.widthData.source.name`,64),url:mS(t.url,`$.widthData.source.url`,2048),sha256:mS(t.sha256,`$.widthData.source.sha256`,64)});(!/^https:\/\/[^\s]+$/.test(n.url)||!iS.test(n.sha256))&&$(`invalid-data`,`$.widthData.source`,`source URL or SHA-256 is malformed`);let r=pS(e.eastAsianWidthValues,`$.widthData.eastAsianWidthValues`,16);r.length!==cS.length&&$(`invalid-data`,`$.widthData.eastAsianWidthValues`,`property codec has the wrong length`);for(let e=0;e<cS.length;e+=1)r[e]!==cS[e]&&$(`invalid-data`,`$.widthData.eastAsianWidthValues`,`property codec does not match UAX #11`);let i={schema:e.schema,schemaVersion:e.schemaVersion,unicodeVersion:e.unicodeVersion,dataPackFingerprint:e.dataPackFingerprint,source:e.source,eastAsianWidthValues:e.eastAsianWidthValues,eastAsianWidthRanges:e.eastAsianWidthRanges,assignedRanges:e.assignedRanges,combiningRanges:e.combiningRanges,zeroWidthRanges:e.zeroWidthRanges},a=mS(e.fingerprint,`$.widthData.fingerprint`,64);return(!iS.test(a)||Ue(JSON.stringify(i))!==a)&&$(`invalid-data`,`$.widthData.fingerprint`,`does not match the encoded width data`),uS=Object.freeze({unicodeVersion:oS,dataPackFingerprint:sS,fingerprint:a,source:n,eastAsianWidth:gS(e.eastAsianWidthRanges,`$.widthData.eastAsianWidthRanges`,3),assigned:gS(e.assignedRanges,`$.widthData.assignedRanges`,2),combining:gS(e.combiningRanges,`$.widthData.combiningRanges`,2),zeroWidth:gS(e.zeroWidthRanges,`$.widthData.zeroWidthRanges`,2)}),uS}function vS(e,t){let n=0,r=e.length-1;for(;n<=r;){let i=n+(r-n>>>1),a=e[i];if(t<a.start)r=i-1;else if(t>a.end)n=i+1;else return a}}function yS(e){(!Number.isInteger(e)||e<0||e>aS||e>=55296&&e<=57343)&&$(`invalid-code-point`,`$.codePoint`,`expected a Unicode scalar value`)}function bS(e){return e>=57344&&e<=63743||e>=983040&&e<=1048573||e>=1048576&&e<=1114109}function xS(e){return Object.freeze({ambiguous:e.ambiguous,combining:e.combining,privateUse:e.privateUse,unassigned:e.unassigned})}function SS(e,t){let n=fS(e,t,[`ambiguous`,`combining`,`privateUse`,`unassigned`],void 0,`invalid-profile`);return n.ambiguous!==1&&n.ambiguous!==2&&$(`invalid-profile`,`${t}.ambiguous`,`expected 1 or 2 cells`),n.combining!==0&&n.combining!==1&&$(`invalid-profile`,`${t}.combining`,`expected 0 or 1 cells`),n.privateUse!==1&&n.privateUse!==2&&$(`invalid-profile`,`${t}.privateUse`,`expected 1 or 2 cells`),n.unassigned!==0&&n.unassigned!==1&&n.unassigned!==2&&$(`invalid-profile`,`${t}.unassigned`,`expected 0, 1, or 2 cells`),Object.freeze({ambiguous:n.ambiguous,combining:n.combining,privateUse:n.privateUse,unassigned:n.unassigned})}function CS(e){let t=fS(e,`$.profile`,[`name`,`description`,`policy`],[`name`,`policy`],`invalid-profile`),n=mS(t.name,`$.profile.name`,tS.maxNameLength,`invalid-profile`);rS.test(n)||$(`invalid-profile`,`$.profile.name`,`expected a lowercase profile token`);let r=``;return Object.hasOwn(t,`description`)&&((typeof t.description!=`string`||t.description.length>tS.maxDescriptionLength)&&$(`invalid-profile`,`$.profile.description`,`description is too long or is not a string`),r=t.description),Object.freeze({name:n,description:r,policy:SS(t.policy,`$.profile.policy`)})}function wS(){return{"zero-width-control":0,combining:0,"private-use":0,unassigned:0,ambiguous:0,fullwidth:0,wide:0,halfwidth:0,narrow:0,neutral:0}}function TS(e,t,n,r){let i=vS(r.eastAsianWidth,t)?.value??`N`,a=vS(r.assigned,t)!==void 0;return e.eastAsianWidth=i,e.assigned=a,bS(t)?(e.width=n.privateUse,e.category=`private-use`):a?vS(r.zeroWidth,t)===void 0?vS(r.combining,t)===void 0?i===`A`?(e.width=n.ambiguous,e.category=`ambiguous`):i===`F`?(e.width=2,e.category=`fullwidth`):i===`W`?(e.width=2,e.category=`wide`):i===`H`?(e.width=1,e.category=`halfwidth`):i===`Na`?(e.width=1,e.category=`narrow`):(e.width=1,e.category=`neutral`):(e.width=n.combining,e.category=`combining`):(e.width=0,e.category=`zero-width-control`):(e.width=n.unassigned,e.category=`unassigned`),e}new class e{#e;#t;#n;constructor(t){new.target!==e&&$(`invalid-profile`,`$.profile`,`width profiles cannot be subclassed`);let n=CS(t);this.#e=n.name,this.#t=n.description,this.#n=n.policy,lS.add(this),Object.freeze(this)}get name(){return this.#e}get policy(){return xS(this.#n)}measureCodePoint(e){yS(e);let t=_S(),n=TS({width:0,category:`neutral`,eastAsianWidth:`N`,assigned:!1},e,this.#n,t);return Object.freeze({codePoint:e,...n})}codePointWidth(e){return this.measureCodePoint(e).width}measureText(e){typeof e!=`string`&&$(`invalid-data`,`$.text`,`expected a primitive string`),e.length>tS.maxTextUtf16Length&&$(`limit-exceeded`,`$.text`,`text exceeds the UTF-16 measurement limit`);let t=0,n=0,r=wS(),i=_S(),a={width:0,category:`neutral`,eastAsianWidth:`N`,assigned:!1};for(let o of e){let e=o.codePointAt(0);yS(e),TS(a,e,this.#n,i),t+=1,n+=a.width,r[a.category]+=1}return Object.freeze({utf16Length:e.length,codePointCount:t,cells:n,categoryCounts:Object.freeze(r)})}textWidth(e){return this.measureText(e).cells}inspect(){let e=_S();return Object.freeze({name:this.#e,description:this.#t,unicodeVersion:e.unicodeVersion,dataPackFingerprint:e.dataPackFingerprint,widthDataFingerprint:e.fingerprint,assignedSource:Object.freeze({...e.source}),policy:xS(this.#n)})}}({name:`unicode-narrow`,description:`Unicode 17 defaults with ambiguous, private-use, and unassigned scalars measured narrowly.`,policy:{ambiguous:1,combining:0,privateUse:1,unassigned:1}}).name;function ES(e,t){return Q(e,{char:` `,background:t.background})}var DS=F,OS=`ulg-exowebtui-shader-stack-v1`,kS=Object.freeze([{id:`clean`,label:`Clean (Off)`,enabled:[],options:{}},{id:`trinitron`,label:`Trinitron CRT`,enabled:[`crt`,`phosphor`,`scanlines`,`degauss`],options:{crt:{curve:.04,vignette:.25,fringe:4e-4},phosphor:{glow:.75},scanlines:{strength:.14,period:3},degauss:{rate:.02}}},{id:`phosphor-scan`,label:`Phosphor Scan`,enabled:[`phosphor`,`scanlines`],options:{phosphor:{glow:.9},scanlines:{strength:.14,period:3}}},{id:`vhs-tape`,label:`VHS Tape`,enabled:[`vhs`,`crt`,`scanlines`],options:{vhs:{tracking:.35,noise:.12,bleed:1.25},crt:{curve:.04,vignette:.3,fringe:8e-4},scanlines:{strength:.18,period:3}}},{id:`full-stack`,label:`Full Stack (All 5)`,enabled:[`vhs`,`crt`,`phosphor`,`scanlines`,`degauss`],options:{vhs:{tracking:.25,noise:.08,bleed:.75},crt:{curve:.04,vignette:.25,fringe:4e-4},phosphor:{glow:.9},scanlines:{strength:.14,period:3},degauss:{rate:.04}}}]),AS=new Map(F.map(e=>[e.id,e]));function jS(e,t,n){return Math.max(t,Math.min(n,e))}function MS(){let e={};for(let t of F){let n={};for(let e of t.options??[])n[e.key]=e.value;e[t.id]=n}return{enabled:[],options:e}}function NS(e=null){let t=MS();if(!e||typeof e!=`object`)return t;let n=new Set;if(Array.isArray(e.enabled))for(let t of e.enabled)AS.has(t)&&n.add(t);if(t.enabled=F.filter(e=>n.has(e.id)).map(e=>e.id),e.options&&typeof e.options==`object`)for(let n of F){let r=e.options[n.id];if(!(!r||typeof r!=`object`))for(let e of n.options??[]){let i=Number(r[e.key]);Number.isFinite(i)&&(t.options[n.id][e.key]=jS(i,e.min,e.max))}}return t}function PS({presenterShader:e=null,overlayEl:t=null,workspaceEl:n=null,onStateChange:r=null}={}){let i=MS(),a=.02,o=-1/0,s=0,c=0,l=0,u=!1,d=null,f=null;t&&typeof document<`u`&&(d=document.createElement(`canvas`),d.className=`exo-shader-fx-canvas`,d.setAttribute(`aria-hidden`,`true`),t.appendChild(d),f=d.getContext(`2d`));function p(){if(e)try{for(let t of F){let n=i.options[t.id]||{};for(let r of t.options??[]){let i=Number(n[r.key]??r.value);e.setOption(t.id,r.key,i)}}e.setEnabled(i.enabled)}catch{}}function m(){if(e&&typeof e.magnetism==`function`){let t=Number(e.magnetism());Number.isFinite(t)&&(a=t)}return i.enabled.includes(`degauss`)?jS(a,.02,1):.5}function h(e=performance.now()){if(typeof document>`u`)return;let r=document.documentElement,a=new Set(i.enabled),s=a.size>0,c=(e-o)/1e3,l=c>=0&&c<1.35,u=m(),p=a.has(`degauss`)?.45+u*1.55:1;r.dataset.ulgShaderActive=s||l?`1`:`0`,r.dataset.ulgShaders=i.enabled.join(`,`),r.dataset.ulgCrt=a.has(`crt`)||a.has(`scanlines`)?`1`:`0`;let h=i.options.scanlines||{},g=i.options.crt||{},_=i.options.phosphor||{},v=i.options.vhs||{},y=a.has(`scanlines`)?jS((h.strength??.14)*p,0,.65):0,b=Math.max(2,Math.round(h.period??3)),x=a.has(`crt`)?jS((g.vignette??.25)*p,0,.85):0,S=a.has(`crt`)?jS(g.curve??.04,0,.25):0,C=a.has(`crt`)?jS((g.fringe??4e-4)*1800*p,0,4.5):0,w=a.has(`phosphor`)?jS((_.glow??.9)*(.6+.4*p),0,2.2):0,T=a.has(`degauss`)?jS(u*.42,0,.48):0,E=r.style;if(E.setProperty(`--exo-scan-strength`,y.toFixed(3)),E.setProperty(`--exo-scan-period`,`${b}px`),E.setProperty(`--exo-crt-vignette`,x.toFixed(3)),E.setProperty(`--exo-crt-radius`,`${Math.round(S*110)}px`),E.setProperty(`--exo-crt-fringe`,`${C.toFixed(2)}px`),E.setProperty(`--exo-phosphor-glow`,w.toFixed(3)),E.setProperty(`--exo-degauss-stain`,T.toFixed(3)),n){let t=[];if(a.has(`phosphor`)&&w>.02){let e=1+w*.06,n=1+w*.12;t.push(`brightness(${e.toFixed(3)}) saturate(${n.toFixed(3)})`)}if(a.has(`vhs`)){let e=jS(v.bleed??1,0,3);e>.05&&t.push(`contrast(${(1+e*.03).toFixed(3)})`)}if(n.style.filter=t.length?t.join(` `):``,l){let e=Math.exp(-2.6*c),t=Math.sin(c*34)*e,r=t*1.8,i=1+t*.022,a=Math.cos(c*27)*e*1.4;n.style.transform=`scale(${i.toFixed(4)}) rotate(${r.toFixed(3)}deg) skewX(${a.toFixed(3)}deg)`}else if(a.has(`degauss`)&&u>.08){let t=e*.001,r=u*.45*Math.sin(t*.4);n.style.transform=`rotate(${r.toFixed(3)}deg)`}else n.style.transform=``}if(t&&(t.classList.toggle(`active`,s||l),t.classList.toggle(`has-crt`,a.has(`crt`)),t.classList.toggle(`has-scanlines`,a.has(`scanlines`)),t.classList.toggle(`has-phosphor`,a.has(`phosphor`)),t.classList.toggle(`has-degauss`,a.has(`degauss`)||l)),d&&f){let t=a.has(`vhs`)||l||a.has(`degauss`)&&u>.05;if(d.style.display=t?`block`:`none`,t){(d.width!==320||d.height!==180)&&(d.width=320,d.height=180),f.clearRect(0,0,320,180);let t=e*.001;if(a.has(`vhs`)){let e=jS((v.tracking??.3)*p,0,1.5),n=jS((v.noise??.1)*p,0,.8),r=jS((v.bleed??1)*p,0,3.5),i=(1-t*.11%1)*180,a=Math.max(6,Math.round(14+e*16)),o=f.createLinearGradient(0,i-a,0,i+a);o.addColorStop(0,`rgba(255,255,255,0)`),o.addColorStop(.5,`rgba(215,245,255,${(.05+e*.14).toFixed(3)})`),o.addColorStop(1,`rgba(255,255,255,0)`),f.fillStyle=o,f.fillRect(0,i-a,320,a*2),e>.02&&(f.fillStyle=`rgba(255,255,255,${(.06+e*.14).toFixed(3)})`,f.fillRect(0,175,320,5));let s=Math.round(8+n*45+r*6);for(let e=0;e<s;e+=1){let i=Math.floor(Math.abs(Math.sin(t*61.3+e*19.7))*180),a=Math.floor(Math.abs(Math.sin(t*37.1+e*43.3))*320),o=10+e*13%44,s=e%3==0?`rgba(255,70,120,${(.04+r*.035).toFixed(3)})`:e%3==1?`rgba(70,220,255,${(.04+r*.035).toFixed(3)})`:`rgba(255,255,255,${(.05+n*.16).toFixed(3)})`;f.fillStyle=s,f.fillRect(a,i,o,1)}}if(a.has(`degauss`)&&u>.05){let e=jS(u*.24,0,.28),t=f.createRadialGradient(0,0,4,0,0,320*.45);t.addColorStop(0,`rgba(195, 65, 255, ${e.toFixed(3)})`),t.addColorStop(1,`rgba(195, 65, 255, 0)`),f.fillStyle=t,f.fillRect(0,0,320,180);let n=f.createRadialGradient(320,180,4,320,180,320*.45);n.addColorStop(0,`rgba(65, 255, 165, ${e.toFixed(3)})`),n.addColorStop(1,`rgba(65, 255, 165, 0)`),f.fillStyle=n,f.fillRect(0,0,320,180)}if(l){let e=Math.exp(-2.6*c),t=Math.max(8,c*2.1*Math.hypot(320,180)*.55);f.save(),f.lineWidth=Math.max(2,16*e),f.strokeStyle=`rgba(110, 255, 210, ${(.42*e).toFixed(3)})`,f.beginPath(),f.arc(320*.5,180*.5,t,0,Math.PI*2),f.stroke(),f.strokeStyle=`rgba(255, 95, 210, ${(.32*e).toFixed(3)})`,f.beginPath(),f.arc(320*.5,180*.5,Math.max(4,t-10),0,Math.PI*2),f.stroke(),f.restore()}}}}function g(){let e=i.enabled;return(performance.now()-o)/1e3<1.35||e.includes(`vhs`)||e.includes(`degauss`)}function _(t){if(l=0,u)return;let n=s?Math.min(.25,(t-s)/1e3):0;if(s=t,i.enabled.includes(`degauss`)&&(!e||typeof e.magnetism!=`function`)){let e=Number(i.options.degauss?.rate??.02);a=Math.min(1,a+n*e/300)}h(t),g()&&(l=requestAnimationFrame(_))}function v(){h(performance.now()),g()&&!l&&typeof requestAnimationFrame==`function`&&(s=performance.now(),l=requestAnimationFrame(_))}function y(){try{window.localStorage?.setItem(OS,JSON.stringify(i))}catch{}}function b(){p(),v(),y(),typeof r==`function`&&r(x())}function x(){let e={};for(let t of F)e[t.id]={...i.options[t.id]||{}};return{enabled:[...i.enabled],options:e,magnetism:Number(m().toFixed(4)),thumpSeq:c,catalogIds:F.map(e=>e.id)}}return{catalog:F,presets:kS,load(e){return i=NS(e),b(),x()},setEnabledIds(e){return i=NS({...i,enabled:Array.isArray(e)?e:[]}),b(),x()},toggleShader(e,t=null){if(!AS.has(e))return x();let n=new Set(i.enabled);return(t===null?!n.has(e):t)?n.add(e):n.delete(e),this.setEnabledIds([...n])},setOption(e,t,n){let r=AS.get(e);if(!r)return x();let a=(r.options??[]).find(e=>e.key===t);if(!a)return x();let o=jS(Number(n),a.min,a.max);return Number.isFinite(o)?(i.options[e][t]=o,b(),x()):x()},applyPreset(e){let t=kS.find(t=>t.id===e);if(!t)return x();let n=MS().options;for(let[e,r]of Object.entries(t.options||{}))n[e]&&Object.assign(n[e],r);return i=NS({enabled:t.enabled,options:n}),b(),x()},degauss(){o=performance.now(),a=.02,c+=1;try{e?.degauss?.()}catch{}return v(),typeof r==`function`&&r(x()),x()},getMagnetism:()=>m(),getSnapshot:x,dispose(){u=!0,l&&cancelAnimationFrame(l),l=0,d&&d.remove()}}}typeof document<`u`&&e(()=>Promise.resolve({}),__vite__mapDeps([0]),import.meta.url).catch(()=>{});var FS=Object.freeze([{id:`universes`,shortLabel:`Universes`,title:`ULG Universes (40-OOM)`,icon:`✦`,scale:`10⁺²⁵ → 10⁻¹⁵ m`,desc:`Continuous WebGPU Cosmic Web, Galaxies, Star Systems, Stellar Fusion, SPH Planets, Weather & Nuclei.`,src:`./universes.html?embedded=exowebtui`,defaultRect:{x:.03,y:.03,w:.72,h:.84}},{id:`studio`,shortLabel:`Studio`,title:`Continuum Studio (MLS-MPM)`,icon:`◈`,scale:`10⁻³ → 10⁺² m`,desc:`3D WebGPU MLS-MPM fluids, rigid solids, phase transitions, refraction & chemical reactions.`,src:`./index.html?embedded=exowebtui&studio=1`,defaultRect:{x:.08,y:.06,w:.68,h:.82}},{id:`elements`,shortLabel:`Elements`,title:`Material Physics Lab (Z=1..118)`,icon:`⚛`,scale:`10⁻¹⁵ → 10⁻⁹ m`,desc:`4-component Dirac–KS atoms, nuclear fission/tunneling, Yee–Taflove FDTD optics, MD & Polytope Atlas.`,src:`./elements-lab.html?embedded=exowebtui`,defaultRect:{x:.14,y:.08,w:.72,h:.84}},{id:`organic`,shortLabel:`Organic`,title:`Organic Chemistry Lab`,icon:`⬡`,scale:`10⁻¹⁰ → 10⁻⁶ m`,desc:`GPU Hückel π-MO orbitals, R↔S chirality, QEq reactive bond-order MD & autocatalytic networks.`,src:`./organic-lab.html?embedded=exowebtui`,defaultRect:{x:.18,y:.1,w:.72,h:.82}},{id:`life`,shortLabel:`Bio Lab`,title:`Biophysics & Emergent Life Lab`,icon:`🧬`,scale:`10⁻⁹ → 10⁻² m`,desc:`Vivarium alien organisms, amphiphile protocells, biopolymer folding, Eigen evolution & morphogenesis.`,src:`./life-lab.html?embedded=exowebtui`,defaultRect:{x:.22,y:.12,w:.72,h:.82}},{id:`console`,shortLabel:`Settings`,title:`ExoWebTUI Theme & System Console`,icon:`⚙`,scale:`SHELL // WM`,desc:`Switch ExoWebTUI palettes, live animated cell-canvas wallpapers, CRT scanlines & window tiling.`,src:null,defaultRect:{x:.56,y:.08,w:.4,h:.74}}]),IS=new Map(FS.map(e=>[e.id,e])),LS=[`section9`,`midnight`,`amber`,`matrix`,`unit01`,`arcane`,`forge`,`t2`,`paper`],RS=[`circuit`,`matrix`,`metaballs`,`rainy windows`,`vaporwave`,`biomech`,`fire`,`dots`,`plain`];function zS(e){return`rgb(${e[0]}, ${e[1]}, ${e[2]})`}function BS(e,t){return`rgba(${e[0]}, ${e[1]}, ${e[2]}, ${t})`}function VS(e){try{let t=new URL(e,window.location.href);t.searchParams.set(`embedded`,`exowebtui`),(t.pathname.endsWith(`studio.html`)||t.pathname.endsWith(`index.html`)||t.pathname.endsWith(`pages.html`))&&t.searchParams.set(`studio`,`1`);let n=t.pathname.split(`/`).pop()||`universes.html`;return`./${n===`studio.html`||n===`pages.html`?`index.html`:n}${t.search}${t.hash}`}catch{return e}}function HS(){let e=document.getElementById(`exotui-canvas-root`),n=document.getElementById(`exo-windows-layer`),r=document.getElementById(`exo-tab-strip`),i=document.getElementById(`exo-start-btn`),a=document.getElementById(`exo-start-menu`),o=document.getElementById(`exo-desktop-icons`),s=document.getElementById(`exo-mobile-dock`),c=document.getElementById(`exo-mobile-active-title`),l=document.getElementById(`exo-tile-btn`),u=document.getElementById(`exo-cascade-btn`),d=document.getElementById(`exo-crt-btn`),f=document.getElementById(`exo-degauss-btn`),p=document.getElementById(`exo-console-btn`),m=document.getElementById(`exo-clock`),h=document.getElementById(`exo-shader-overlay`),g=cp(`section9`),_=`circuit`,v=!1,y=`floating`,b=!1,x=40;try{let e=window.localStorage?.getItem(`ulg-exowebtui-theme-id`);e&&(g=cp(e));let t=window.localStorage?.getItem(`ulg-exowebtui-wallpaper-id`);t&&(_=t),window.localStorage?.getItem(`ulg-exowebtui-crt`)===`1`&&(v=!0)}catch{}let S=tf({workspace:za({}),ownerId:`ulg-exowebtui-desktop`,snapDistance:2,snapOnRelease:!0,historyCapacity:64,compactMode:`auto`,windows:FS.map((e,t)=>({id:e.id,title:e.title,minWidth:28,minHeight:10,state:`closed`,placement:`floating`,floatingRect:{column:3+t*3,row:1+t*2,width:72,height:26}}))}),C=new Map;for(let e of FS)C.set(e.id,{id:e.id,open:!1,minimized:!1,maximized:!1,z:++x,rectPx:null,el:null,iframe:null,currentSrc:e.src});let w=null,T=()=>window.innerWidth<680;function E(){let e=n.getBoundingClientRect();return{width:Math.max(240,Math.round(e.width)),height:Math.max(200,Math.round(e.height))}}function ee(e){return!Array.isArray(e)||e.length<3?!1:.299*e[0]+.587*e[1]+.114*e[2]>140}function te(){let e=up(g),t=ee(g.background);return{id:g.id,label:g.label,background:g.background,surface:g.surface,surfaceStrong:g.surfaceStrong,border:g.border,text:g.text,muted:g.muted,accent:g.accent,onAccent:e,isLight:t,success:g.success,warning:g.warning,danger:g.danger,crt:v}}function ne(){let e=te();for(let t of C.values())if(t.iframe?.contentWindow)try{t.iframe.contentWindow.postMessage({type:`ulg-exowebtui-theme`,theme:e},`*`)}catch{}}function re(e){g=cp(e);let t=te(),n=t.onAccent,r=t.isLight;document.documentElement.dataset.ulgTheme=g.id,document.documentElement.dataset.ulgThemeMode=r?`light`:`dark`;let i=document.documentElement.style;i.setProperty(`--exo-bg`,zS(g.background)),i.setProperty(`--exo-surface`,zS(g.surface)),i.setProperty(`--exo-surface-strong`,zS(g.surfaceStrong)),i.setProperty(`--exo-surface-tint`,r?`rgba(0, 0, 0, 0.06)`:`rgba(0, 0, 0, 0.24)`),i.setProperty(`--exo-icon-bg`,BS(g.surface,r?.94:.88)),i.setProperty(`--exo-border`,BS(g.accent,r?.55:.42)),i.setProperty(`--exo-accent`,zS(g.accent)),i.setProperty(`--exo-on-accent`,zS(n)),i.setProperty(`--exo-text`,zS(g.text)),i.setProperty(`--exo-muted`,zS(g.muted)),i.setProperty(`--exo-danger`,zS(g.danger)),i.setProperty(`--ulg-retro-bg`,zS(g.background)),i.setProperty(`--ulg-retro-surface`,BS(g.surface,.94)),i.setProperty(`--ulg-retro-surface-strong`,BS(g.surfaceStrong,.97)),i.setProperty(`--ulg-retro-accent`,zS(g.accent)),i.setProperty(`--ulg-retro-accent-dim`,BS(g.accent,r?.14:.16)),i.setProperty(`--ulg-retro-on-accent`,zS(n)),i.setProperty(`--ulg-retro-text`,zS(g.text)),i.setProperty(`--ulg-retro-muted`,zS(g.muted)),i.setProperty(`--ulg-retro-border`,BS(g.accent,r?.48:.38)),i.setProperty(`--ulg-retro-border-hi`,BS(g.accent,r?.85:.8)),i.setProperty(`--ulg-retro-glow`,`0 0 14px ${BS(g.accent,r?.12:.18)}`),i.setProperty(`--ulg-retro-bevel`,r?`inset 1px 1px 0 rgba(255, 255, 255, 0.82), inset -1px -1px 0 rgba(0, 0, 0, 0.18), 0 1px 2px rgba(0, 0, 0, 0.08)`:`inset 1px 1px 0 rgba(255, 255, 255, 0.08), inset -1px -1px 0 rgba(0, 0, 0, 0.68), 0 0 0 1px rgba(0, 0, 0, 0.55)`);try{window.localStorage?.setItem(`ulg-exowebtui-theme-id`,g.id),window.localStorage?.setItem(`ulg-exowebtui-theme-json`,JSON.stringify(t))}catch{}ne(),A(),Te()}function ie(e=null){let t=e||k?.getSnapshot?.()||null;if(t){for(let e of C.values())if(e.iframe?.contentWindow)try{e.iframe.contentWindow.postMessage({type:`ulg-exowebtui-shader-stack`,stack:t},`*`)}catch{}}}function ae(e){if(v=!!e,k)if(v){let e=k.getSnapshot().enabled;e.length===0?k.applyPreset(`trinitron`):!e.includes(`crt`)&&!e.includes(`scanlines`)&&k.setEnabledIds([...e,`crt`,`scanlines`])}else k.setEnabledIds([]);document.documentElement.dataset.ulgCrt=v?`1`:`0`,d?.classList.toggle(`active`,v);try{window.localStorage?.setItem(`ulg-exowebtui-crt`,v?`1`:`0`),window.localStorage?.setItem(`ulg-exowebtui-theme-json`,JSON.stringify(te()))}catch{}ne(),ie(),A()}let D=null,oe=``,se=null,ce=``,O=0,le={columns:100,rows:32};function ue(){if(oe===_)return D;if(D&&typeof D.dispose==`function`)try{D.dispose()}catch{}if(oe=_,se=null,ce=``,_===`plain`||_===`dots`)return D=null,null;let e=Ob.find(e=>e.id===_)||Ob.find(e=>e.id===`circuit`);return D=e?e.create():null,D}function de(e){_=e;try{window.localStorage?.setItem(`ulg-exowebtui-wallpaper-id`,e)}catch{}ue(),A()}let fe=Gb({}),pe=null,me=null;if(e)try{let n=Ma({root:e,storeDatabase:`ulg-exowebtui`,host:{sinkOptions:{cellWidth:9,cellHeight:18,font:`14px "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`}}});me=n,pe=t(n,{init(e){le=e?.size?.()||le},resize(e){le=e,se=null},frame(e,t){t&&t.columns>0&&t.rows>0&&(le=t);let n=Math.max(10,le.columns),r=Math.max(6,le.rows),i=ES({width:n,height:r},fe),a=g.background,o=g.surfaceStrong;for(let e=0;e<r;e+=1){let t=i[e];for(let e=0;e<n;e+=1)t[e]={char:` `,background:a}}let s=[...C.values()].filter(e=>e.open&&!e.minimized);if(T()?s.length>0:s.some(e=>e.maximized))return i;if(_===`dots`)for(let e=1;e<r;e+=3)for(let t=e%2==0?2:4;t<n;t+=6)i[e][t]={char:`·`,foreground:o,background:a};else if(_!==`plain`){let t=ue();if(t){let o={column:0,row:0,width:n,height:r},s=!1;e-O>=140&&(O=e,s=t.advance({bounds:o,obstacles:[],now:e}));let c=`${_}|${g.id}|${n}x${r}`;if((s||!se||ce!==c)&&(se=t.rasterizeCells(o,g),ce=c),se)for(let e=0;e<se.length&&e<r;e+=1){let t=se[e],r=i[e];if(!(!t||!r))for(let e=0;e<t.length&&e<n;e+=1){let n=t[e];n&&(r[e]=n.char===`█`?{char:` `,background:n.foreground}:{char:n.char,foreground:n.foreground,background:a})}}}}return i}})}catch(e){console.warn(`ExoWebTUI cell-canvas wallpaper fallback:`,e)}let k=null;k=PS({presenterShader:me?.shader||null,overlayEl:h,workspaceEl:n,onStateChange(e){let t=e.enabled.length>0;v=e.enabled.includes(`crt`)||e.enabled.includes(`scanlines`)||t,d&&(d.classList.toggle(`active`,t),d.textContent=t?`FX (${e.enabled.length})`:`FX`);try{window.localStorage?.setItem(`ulg-exowebtui-crt`,v?`1`:`0`),window.localStorage?.setItem(`ulg-exowebtui-theme-json`,JSON.stringify(te()))}catch{}ie(e)}});let he=window.setInterval(()=>{let e=document.getElementById(`exo-degauss-mag-fill`),t=document.getElementById(`exo-degauss-mag-pct`);if(e&&t&&k){let n=Math.round(k.getMagnetism()*100);e.style.width=`${Math.max(2,Math.min(100,n))}%`,t.textContent=`${n}%`}},450);function ge(e){let{width:t,height:n}=E(),r=Math.min(340,t),i=Math.min(240,n),a=Math.max(r,Math.min(t,Math.round(e.w))),o=Math.max(i,Math.min(n,Math.round(e.h)));return{x:Math.max(0,Math.min(Math.max(0,t-a),Math.round(e.x))),y:Math.max(0,Math.min(Math.max(0,n-o),Math.round(e.y))),w:a,h:o}}function _e(e){let{width:t,height:n}=E(),r=[...C.values()].filter(e=>e.open).length%5*26,i=e.defaultRect;return ge({x:Math.round(t*i.x)+r,y:Math.round(n*i.y)+r,w:Math.round(t*i.w),h:Math.round(n*i.h)})}function ve(e,t){let n=Math.max(40,le.columns||120),r=Math.max(16,le.rows||40),i={column:0,row:0,width:n,height:r};try{if(!t.open){S.execute({kind:`close`,id:e},i,{});return}if(t.minimized){S.execute({kind:`minimize`,id:e},i,{});return}if(S.execute({kind:`restore`,id:e},i,{}),t.maximized||T())S.execute({kind:`maximize`,id:e},i,{});else if(y===`tiled`)S.execute({kind:`set-placement`,id:e,placement:`tiled`},i,{});else if(t.rectPx){let{width:a,height:o}=E(),s={column:Math.round(t.rectPx.x/a*n),row:Math.round(t.rectPx.y/o*r),width:Math.max(28,Math.round(t.rectPx.w/a*n)),height:Math.max(10,Math.round(t.rectPx.h/o*r))};S.execute({kind:`set-placement`,id:e,placement:`floating`,rect:s},i,{})}w===e&&S.execute({kind:`focus`,id:e},i,{})}catch{}}function ye(){let e=document.createElement(`div`);return e.className=`exo-console-body`,e.id=`exo-console-content`,e}function A(){let e=document.getElementById(`exo-console-content`);if(!e)return;let t=[...C.values()].filter(e=>e.open),n=LS.map(e=>{let t=cp(e);return`<button type="button" class="exo-bar-btn ${t.id===g.id?`active`:``}" data-exo-theme="${t.id}">${t.label}</button>`}).join(``),r=RS.map(e=>`<button type="button" class="exo-bar-btn ${e===_?`active`:``}" data-exo-wall="${e}">${e}</button>`).join(``),i=FS.filter(e=>e.id!==`console`).map(e=>{let t=C.get(e.id),n=t.open?t.minimized?`MIN`:`OPEN`:`LAUNCH`;return`<button type="button" class="exo-bar-btn ${t.open&&!t.minimized?`active`:``}" data-exo-launch="${e.id}">${e.icon} ${e.shortLabel} [${n}]</button>`}).join(``),a=k?k.getSnapshot():{enabled:[],options:{},magnetism:.02},o=new Set(a.enabled||[]),s=kS.map(e=>`<button type="button" class="exo-bar-btn ${e.enabled.length===o.size&&e.enabled.every(e=>o.has(e))?`active`:``}" data-exo-shader-preset="${e.id}">${e.label}</button>`).join(``),c=DS.map(e=>{let t=o.has(e.id),n=a.options?.[e.id]||{},r=(e.options??[]).map(t=>{let r=Number(n[t.key]??t.value),i=t.step<.001?4:t.step<.1?2:+(t.step<1);return`
          <label class="exo-knob-row">
            <span>${t.label}</span>
            <input type="range" min="${t.min}" max="${t.max}" step="${t.step}" value="${r}"
              data-exo-shader-id="${e.id}" data-exo-shader-key="${t.key}" />
            <span class="exo-knob-val" data-exo-knob-val="${e.id}:${t.key}">${r.toFixed(i)}</span>
          </label>
        `}).join(``),i=Math.round((a.magnetism??.02)*100),s=e.id===`degauss`?`<div class="exo-mag-bar-wrap">
             <span style="color:var(--exo-muted);">Magnetization</span>
             <div class="exo-mag-track"><div id="exo-degauss-mag-fill" class="exo-mag-fill" style="width:${Math.max(2,i)}%;"></div></div>
             <span id="exo-degauss-mag-pct" style="font-weight:700;min-width:34px;text-align:right;">${i}%</span>
             <button type="button" class="exo-bar-btn primary" data-exo-act="degauss">⚡ DEGAUSS</button>
           </div>`:``;return`
        <div class="exo-shader-card ${t?`enabled`:``}">
          <div class="exo-shader-head">
            <span class="exo-shader-title">${e.label}</span>
            <button type="button" class="exo-bar-btn ${t?`active`:``}" data-exo-shader-toggle="${e.id}">${t?`ON`:`OFF`}</button>
          </div>
          <div class="exo-shader-knobs">${r}${s}</div>
        </div>
      `}).join(``);e.innerHTML=`
      <div class="exo-console-sec">
        <h3>▣ ULG // EXOWEB TUI WORKSPACE</h3>
        <div style="color:var(--exo-muted);margin-bottom:8px;">
          Open Windows: <b style="color:var(--exo-text);">${t.length}</b> ·
          Layout: <b style="color:var(--exo-accent);">${T()?`MOBILE SINGLE-WINDOW`:y.toUpperCase()}</b> ·
          Theme: <b style="color:var(--exo-text);">${g.label}</b> ·
          Shaders: <b style="color:var(--exo-text);">${a.enabled.length?a.enabled.join(` + `):`OFF`}</b>
        </div>
        <div class="exo-chip-grid">
          <button type="button" class="exo-bar-btn" data-exo-act="tile">⊞ Tile Open Labs</button>
          <button type="button" class="exo-bar-btn" data-exo-act="cascade">❐ Cascade Floating</button>
          <button type="button" class="exo-bar-btn ${v?`active`:``}" data-exo-act="crt">📺 CRT Quick: ${v?`ON`:`OFF`}</button>
          <button type="button" class="exo-bar-btn" data-exo-act="degauss">⚡ Degauss Coil</button>
          <a class="exo-bar-btn" href="./index.html" style="text-decoration:none;">↩ Landing Page</a>
        </div>
      </div>
      <div class="exo-console-sec">
        <h3>📺 PEERCOMPUTE / @EXOTUI SHADER STACK (5-PASS WEBGL2 + LIVE LABS)</h3>
        <div class="exo-chip-grid" style="margin-bottom:6px;">${s}</div>
        ${c}
      </div>
      <div class="exo-console-sec">
        <h3>✦ QUICK LAUNCH ULG WEBGPU LABS</h3>
        <div class="exo-chip-grid">${i}</div>
      </div>
      <div class="exo-console-sec">
        <h3>🎨 EXOWEB TUI SHELL THEME (SYNCS LIVE TO ALL LABS)</h3>
        <div class="exo-chip-grid">${n}</div>
      </div>
      <div class="exo-console-sec">
        <h3>▒ ANIMATED TUI CELL WALLPAPER</h3>
        <div class="exo-chip-grid">${r}</div>
      </div>
    `,e.querySelectorAll(`[data-exo-theme]`).forEach(e=>{e.addEventListener(`click`,()=>re(e.dataset.exoTheme))}),e.querySelectorAll(`[data-exo-wall]`).forEach(e=>{e.addEventListener(`click`,()=>de(e.dataset.exoWall))}),e.querySelectorAll(`[data-exo-launch]`).forEach(e=>{e.addEventListener(`click`,()=>Oe(e.dataset.exoLaunch))}),e.querySelectorAll(`[data-exo-shader-preset]`).forEach(e=>{e.addEventListener(`click`,()=>{k?.applyPreset(e.dataset.exoShaderPreset),A()})}),e.querySelectorAll(`[data-exo-shader-toggle]`).forEach(e=>{e.addEventListener(`click`,()=>{k?.toggleShader(e.dataset.exoShaderToggle),A()})}),e.querySelectorAll(`input[data-exo-shader-id]`).forEach(t=>{t.addEventListener(`input`,()=>{let n=t.dataset.exoShaderId,r=t.dataset.exoShaderKey,i=Number(t.value);k?.setOption(n,r,i);let a=e.querySelector(`[data-exo-knob-val="${n}:${r}"]`);if(a){let e=Number(t.step)||.01,n=e<.001?4:e<.1?2:+(e<1);a.textContent=i.toFixed(n)}})}),e.querySelectorAll(`[data-exo-act="degauss"]`).forEach(e=>{e.addEventListener(`click`,()=>{k?.degauss()})}),e.querySelector(`[data-exo-act="tile"]`)?.addEventListener(`click`,()=>je()),e.querySelector(`[data-exo-act="cascade"]`)?.addEventListener(`click`,()=>Me()),e.querySelector(`[data-exo-act="crt"]`)?.addEventListener(`click`,()=>ae(!v))}function be(e){let t=C.get(e),r=IS.get(e);if(!t||!r)return null;if(t.el)return t.el;let i=document.createElement(`section`);i.className=`exo-win`,i.dataset.winId=e,i.setAttribute(`aria-label`,r.title);let a=document.createElement(`div`);a.className=`exo-win-titlebar`,a.innerHTML=`
      <span class="exo-win-title-text"><span>${r.icon}</span><span>${r.title}</span></span>
      <span class="exo-win-controls">
        <button type="button" class="exo-win-ctl min" title="Minimize window" aria-label="Minimize ${r.title}">─</button>
        <button type="button" class="exo-win-ctl max" title="Maximize / Restore" aria-label="Maximize ${r.title}">□</button>
        <button type="button" class="exo-win-ctl close" title="Close window" aria-label="Close ${r.title}">×</button>
      </span>
    `;let o=document.createElement(`div`);if(o.className=`exo-win-body`,r.src){let e=document.createElement(`iframe`);e.className=`exo-win-iframe`,e.title=r.title,e.allow=`fullscreen; xr-spatial-tracking; gamepad`,e.src=VS(t.currentSrc||r.src),e.addEventListener(`load`,()=>{try{e.contentWindow?.postMessage({type:`ulg-exowebtui-theme`,theme:te()},`*`),k&&e.contentWindow?.postMessage({type:`ulg-exowebtui-shader-stack`,stack:k.getSnapshot()},`*`)}catch{}}),o.appendChild(e),t.iframe=e}else o.appendChild(ye());let s=document.createElement(`div`);s.className=`exo-win-focus-shield`,s.addEventListener(`pointerdown`,t=>{t.stopPropagation(),Ee(e)}),o.appendChild(s);let c=document.createElement(`div`);c.className=`exo-resize-handle exo-resize-e`;let l=document.createElement(`div`);l.className=`exo-resize-handle exo-resize-s`;let u=document.createElement(`div`);u.className=`exo-resize-handle exo-resize-se`,i.append(a,o,c,l,u),n.appendChild(i),t.el=i,a.querySelector(`.min`).addEventListener(`click`,t=>{t.stopPropagation(),ke(e)}),a.querySelector(`.max`).addEventListener(`click`,t=>{t.stopPropagation(),j(e)}),a.querySelector(`.close`).addEventListener(`click`,t=>{t.stopPropagation(),Ae(e)}),a.addEventListener(`dblclick`,t=>{t.target.closest(`.exo-win-ctl`)||j(e)}),a.addEventListener(`pointerdown`,n=>{if(n.target.closest(`.exo-win-ctl`)||T())return;Ee(e),(t.maximized||y===`tiled`)&&(y=`floating`,t.maximized=!1,t.rectPx||=_e(r));let i=n.clientX,o=n.clientY,s={...t.rectPx};document.body.classList.add(`exo-dragging`),a.setPointerCapture?.(n.pointerId);let c=e=>{let n=e.clientX-i,r=e.clientY-o;t.rectPx=ge({x:s.x+n,y:s.y+r,w:s.w,h:s.h}),xe()},l=()=>{document.body.classList.remove(`exo-dragging`),window.removeEventListener(`pointermove`,c),window.removeEventListener(`pointerup`,l),window.removeEventListener(`pointercancel`,l),ve(e,t)};window.addEventListener(`pointermove`,c),window.addEventListener(`pointerup`,l),window.addEventListener(`pointercancel`,l)});function d(n,r){n.addEventListener(`pointerdown`,n=>{if(T()||t.maximized||y===`tiled`)return;n.stopPropagation(),Ee(e);let i=n.clientX,a=n.clientY,o={...t.rectPx};document.body.classList.add(`exo-dragging`);let s=e=>{let n=e.clientX-i,s=e.clientY-a;t.rectPx=ge({x:o.x,y:o.y,w:r.includes(`e`)?o.w+n:o.w,h:r.includes(`s`)?o.h+s:o.h}),xe()},c=()=>{document.body.classList.remove(`exo-dragging`),window.removeEventListener(`pointermove`,s),window.removeEventListener(`pointerup`,c),window.removeEventListener(`pointercancel`,c),ve(e,t)};window.addEventListener(`pointermove`,s),window.addEventListener(`pointerup`,c),window.addEventListener(`pointercancel`,c)})}return d(c,`e`),d(l,`s`),d(u,`se`),e===`console`&&A(),i}function xe(){let{width:e,height:t}=E(),n=T(),r=[...C.values()].filter(e=>e.open&&!e.minimized).sort((e,t)=>e.z-t.z);if(n){(!w||!C.get(w)?.open||C.get(w)?.minimized)&&r.length>0&&(w=r[r.length-1].id);for(let n of C.values()){if(!n.el)continue;let r=n.open&&!n.minimized&&n.id===w;n.el.classList.toggle(`hidden-win`,!r),n.el.classList.toggle(`active`,r),n.el.classList.add(`maximized`),n.el.classList.remove(`tiled`),r&&(n.el.style.left=`0px`,n.el.style.top=`0px`,n.el.style.width=`${e}px`,n.el.style.height=`${t}px`,n.el.style.zIndex=`60`)}let n=IS.get(w);c&&(c.textContent=n?`${n.icon} ${n.shortLabel.toUpperCase()}`:`ULG // EXOWEB TUI`)}else if(y===`tiled`&&r.length>0){let n=r.length,i=n===1?1:2,a=Math.ceil(n/i),o=Math.floor((e-4*(i+1))/i),s=Math.floor((t-4*(a+1))/a);r.forEach((t,r)=>{if(!t.el)return;let a=r%i,c=Math.floor(r/i),l=r===n-1&&n%i===1&&i>1?e-8:o,u=4+a*(o+4),d=4+c*(s+4);t.el.classList.remove(`hidden-win`,`maximized`),t.el.classList.add(`tiled`),t.el.classList.toggle(`active`,t.id===w),t.el.style.left=`${u}px`,t.el.style.top=`${d}px`,t.el.style.width=`${l}px`,t.el.style.height=`${s}px`,t.el.style.zIndex=String(t.id===w?80:40+r)});for(let e of C.values())e.el&&(!e.open||e.minimized)&&e.el.classList.add(`hidden-win`)}else for(let n of C.values())if(n.el){if(!n.open||n.minimized){n.el.classList.add(`hidden-win`);continue}n.el.classList.remove(`hidden-win`,`tiled`),n.el.classList.toggle(`active`,n.id===w),n.el.classList.toggle(`maximized`,n.maximized),n.maximized?(n.el.style.left=`0px`,n.el.style.top=`0px`,n.el.style.width=`${e}px`,n.el.style.height=`${t}px`):(n.rectPx||=_e(IS.get(n.id)),n.rectPx=ge(n.rectPx),n.el.style.left=`${n.rectPx.x}px`,n.el.style.top=`${n.rectPx.y}px`,n.el.style.width=`${n.rectPx.w}px`,n.el.style.height=`${n.rectPx.h}px`),n.el.style.zIndex=String(n.z)}l?.classList.toggle(`active`,y===`tiled`),u?.classList.toggle(`active`,y===`floating`),Se()}function Se(){let e=[...C.values()].filter(e=>e.open);if(r){r.innerHTML=``;for(let t of e){let e=IS.get(t.id),n=document.createElement(`button`);n.type=`button`,n.className=`exo-tab-btn${t.id===w&&!t.minimized?` active`:``}${t.minimized?` minimized`:``}`,n.dataset.tabWinId=t.id,n.textContent=`${e.icon} ${e.shortLabel}${t.minimized?` [min]`:``}`,n.addEventListener(`click`,()=>{t.id===w&&!t.minimized&&!T()?ke(t.id):Ee(t.id)}),r.appendChild(n)}}if(s){s.innerHTML=``;for(let e of FS.filter(e=>e.id!==`console`)){let t=C.get(e.id),n=document.createElement(`button`);n.type=`button`,n.className=`exo-dock-btn${t.open&&!t.minimized&&w===e.id?` active`:``}`,n.dataset.dockLabId=e.id,n.textContent=`${e.icon} ${e.shortLabel}`,n.addEventListener(`click`,()=>Oe(e.id)),s.appendChild(n)}}}function Ce(){if(o){o.innerHTML=``;for(let e of FS){let t=document.createElement(`button`);t.type=`button`,t.className=`exo-desktop-icon`,t.dataset.iconLabId=e.id,t.innerHTML=`<span class="ico">${e.icon}</span><span>${e.shortLabel}</span>`,t.addEventListener(`click`,()=>Oe(e.id)),o.appendChild(t)}}}function we(e){b=!!e,a.classList.toggle(`open`,b),i.setAttribute(`aria-expanded`,String(b)),document.body.classList.toggle(`exo-menu-open`,b),b&&Te()}function Te(){if(!a)return;let e=FS.map(e=>{let t=C.get(e.id),n=t.open?t.minimized?`MINIMIZED`:`● OPEN`:e.scale;return`
        <button type="button" class="exo-menu-item" data-menu-lab="${e.id}">
          <span class="exo-menu-item-top"><span>${e.icon} ${e.title}</span><span class="tag">${n}</span></span>
          <span class="exo-menu-item-desc">${e.desc}</span>
        </button>
      `}).join(``);a.innerHTML=`
      <div class="exo-menu-hdr">
        <span>⏻ ULG // EXOWEB TUI LAUNCHER</span>
        <span>${g.label}</span>
      </div>
      <div class="exo-menu-section">Physics Labs &amp; Simulators</div>
      ${e}
      <div class="exo-menu-section">Workspace Actions</div>
      <button type="button" class="exo-menu-item" data-menu-action="tile-dual">
        <span class="exo-menu-item-top"><span>⊞ Tiled Workspace: Universes + Elements</span><span class="tag">SPLIT</span></span>
        <span class="exo-menu-item-desc">Run astrophysics &amp; quantum/material physics side-by-side.</span>
      </button>
      <button type="button" class="exo-menu-item" data-menu-action="tile-all">
        <span class="exo-menu-item-top"><span>⊞ Tile All Open Windows</span><span class="tag">GRID</span></span>
        <span class="exo-menu-item-desc">Arrange every running lab window into a clean zero-overlap grid.</span>
      </button>
      <a class="exo-menu-item" href="./index.html">
        <span class="exo-menu-item-top"><span>↩ Return to ULG Landing Gate</span><span class="tag">EXIT</span></span>
        <span class="exo-menu-item-desc">Back to standalone lab launcher &amp; Continuum Studio entry.</span>
      </a>
    `,a.querySelectorAll(`[data-menu-lab]`).forEach(e=>{e.addEventListener(`click`,()=>{we(!1),Oe(e.dataset.menuLab)})}),a.querySelector(`[data-menu-action="tile-dual"]`)?.addEventListener(`click`,()=>{we(!1),Oe(`universes`),Oe(`elements`),je()}),a.querySelector(`[data-menu-action="tile-all"]`)?.addEventListener(`click`,()=>{we(!1),je()})}function Ee(e){let t=C.get(e);!t||!t.open||(t.minimized=!1,t.z=++x,w=e,ve(e,t),xe(),A())}function De(e){try{let t=new URL(e,window.location.href);for(let e of t.searchParams.keys())if(e!==`embedded`&&e!==`studio`)return!0;return!!(t.hash&&t.hash.length>1)}catch{return!1}}function Oe(e,t=null){let n=C.get(e),r=IS.get(e);if(!n||!r)return!1;if(t&&r.src){let e=VS(t),r=De(t);(!n.open||!n.iframe||r&&n.currentSrc!==e)&&(n.currentSrc=e,n.iframe&&(n.iframe.src=e))}return n.open?n.minimized=!1:(n.open=!0,n.minimized=!1,n.maximized=T(),n.rectPx||=_e(r),be(e)),n.z=++x,w=e,ve(e,n),xe(),A(),!0}function ke(e){let t=C.get(e);if(!(!t||!t.open)){if(t.minimized=!0,w===e){let e=[...C.values()].filter(e=>e.open&&!e.minimized).sort((e,t)=>t.z-e.z)[0];w=e?e.id:null}ve(e,t),xe(),A()}}function j(e){let t=C.get(e);!t||!t.open||(y===`tiled`?(y=`floating`,t.maximized=!0):t.maximized=!t.maximized,t.minimized=!1,t.z=++x,w=e,ve(e,t),xe())}function Ae(e){let t=C.get(e);if(!(!t||!t.open)){if(t.open=!1,t.minimized=!1,t.maximized=!1,t.el&&(t.el.remove(),t.el=null,t.iframe=null),w===e){let e=[...C.values()].filter(e=>e.open&&!e.minimized).sort((e,t)=>t.z-e.z)[0];w=e?e.id:null}ve(e,t),xe(),A()}}function je(){y=`tiled`;for(let e of C.values())e.open&&(e.minimized=!1,e.maximized=!1,ve(e.id,e));xe(),A()}function Me(){y=`floating`;let{width:e,height:t}=E(),n=0;for(let r of C.values()){if(!r.open)continue;r.minimized=!1,r.maximized=!1;let i=IS.get(r.id);r.rectPx=ge({x:24+n*34,y:18+n*28,w:Math.round(e*Math.min(.76,i.defaultRect.w)),h:Math.round(t*Math.min(.84,i.defaultRect.h))}),r.z=++x,w=r.id,ve(r.id,r),n+=1}xe(),A()}i.addEventListener(`click`,e=>{e.stopPropagation(),we(!b)}),l.addEventListener(`click`,()=>{we(!1),je()}),u.addEventListener(`click`,()=>{we(!1),Me()}),d.addEventListener(`click`,()=>ae(!v)),f?.addEventListener(`click`,()=>k?.degauss()),p.addEventListener(`click`,()=>{we(!1);let e=C.get(`console`);e.open&&!e.minimized&&w===`console`?Ae(`console`):Oe(`console`)}),document.addEventListener(`pointerdown`,e=>{b&&!e.target.closest(`#exo-start-menu`)&&!e.target.closest(`#exo-start-btn`)&&we(!1)}),window.addEventListener(`keydown`,e=>{e.key===`Escape`&&b&&we(!1)}),window.addEventListener(`resize`,()=>xe()),window.addEventListener(`message`,e=>{let t=e?.data;!t||typeof t!=`object`||(t.type===`ulg-exowebtui-open-lab`&&t.labId?Oe(String(t.labId),t.href||null):t.type===`ulg-exowebtui-ready`&&(ne(),ie()))});let Ne=()=>{m&&(m.textContent=new Date().toLocaleTimeString([],{hour:`2-digit`,minute:`2-digit`}))};Ne(),window.setInterval(Ne,15e3),Ce(),re(g.id);try{let e=window.localStorage?.getItem(OS);e?k?.load(JSON.parse(e)):v&&k?.applyPreset(`trinitron`)}catch{v&&k?.applyPreset(`trinitron`)}let Pe=new URLSearchParams(window.location.search),Fe=Pe.get(`open`),Ie=Pe.get(`layout`),Le=Pe.get(`theme`),Re=Pe.get(`shaderPreset`),ze=Pe.get(`shaders`);Le&&re(Le),Re?k?.applyPreset(Re):ze?k?.setEnabledIds(ze.split(`,`).map(e=>e.trim()).filter(Boolean)):Pe.get(`crt`)===`1`&&ae(!0);let Be=Fe?Fe.split(`,`).map(e=>e.trim()).filter(e=>IS.has(e)):[`universes`],Ve=Be.length>0?Be:[`universes`];for(let e of Ve)Oe(e);if(Ie===`tile`&&!T())je();else if(Ve.length===1&&!T()){let e=C.get(Ve[0]),{width:t,height:n}=E();e.rectPx=ge({x:132,y:12,w:Math.max(600,t-148),h:Math.max(420,n-24)}),xe()}let He={openLab:Oe,closeLab:Ae,focusLab:Ee,minimizeLab:ke,toggleMaximizeLab:j,tileAll:je,cascadeAll:Me,setTheme:re,setWallpaper:de,setCrt:ae,setStartMenuOpen:we,getShaderStack:()=>k?.getSnapshot()||null,setShaderEnabled:(e,t)=>{let n=k?.toggleShader(e,t);return A(),n},setShaderOption:(e,t,n)=>{let r=k?.setOption(e,t,n);return A(),r},applyShaderPreset:e=>{let t=k?.applyPreset(e);return A(),t},degauss:()=>k?.degauss()||null,getState:()=>({activeWinId:w,layoutMode:y,mobile:T(),themeId:g.id,wallpaperId:_,crtEnabled:v,shaderStack:k?.getSnapshot()||null,startMenuOpen:b,hostInspection:S.controller.inspect(),windows:[...C.values()].map(e=>({id:e.id,open:e.open,minimized:e.minimized,maximized:e.maximized,rectPx:e.rectPx}))}),dispose:()=>{window.clearInterval(he);try{k?.dispose?.()}catch{}try{pe?.dispose?.()}catch{}}};return window.__ulgExoWebTui=He,He}typeof document<`u`&&(document.readyState===`loading`?document.addEventListener(`DOMContentLoaded`,()=>HS(),{once:!0}):HS());