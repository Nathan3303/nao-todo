import{x as O,y as V,a as y,d as I,e as v,n as D,z as b,o as j,h as E,l as C,A as g,w as P,b as h,t as x,u as i,B as w,g as S,X as k,c as T,C as B,D as R,E as L,G as q,H as F}from"./index-DednGyhX.js";import{f as $,n as G}from"./utils-DBKh7t1p.js";const J={class:"nue-prompt__header"},M={class:"nue-prompt__content"},Y={class:"nue-prompt__footer"},z=I({name:"NuePromptNode",__name:"prompt",props:{title:{default:"Prompt"},label:{},placeholder:{default:"Please input"},inputType:{default:"text"},confirmButtonText:{default:"Yes"},cancelButtonText:{default:"No"},close:{},validator:{},beforeConfirm:{}},setup(t){const p=t,_=v(),f=v(),a=v(""),d=v(!1);function u(o){const{close:r,validator:e,beforeConfirm:l}=p;if(o){if(e){const n=e(a.value);if(d.value=!n,!n)return}if(l){const n=l(a.value);if(n instanceof Promise){n.then(s=>{const c=s||a.value;r(o,c)}).catch(s=>console.log(s));return}else n&&r(o,a.value)}}r(o,a.value)}return D(()=>{requestAnimationFrame(()=>{f.value.innerInputRef.focus()})}),b(()=>a.value,()=>d.value=!1),(o,r)=>(j(),E("div",{ref_key:"promptRef",ref:_,class:"nue-prompt"},[C("div",J,[g(o.$slots,"header",{},()=>[y(i(w),null,{default:P(()=>[h(x(o.title),1)]),_:1}),y(i(k),{icon:"clear",theme:"pure",onClick:r[0]||(r[0]=S(e=>u(!1),["stop"]))})])]),C("div",M,[g(o.$slots,"default",{},()=>[o.label?(j(),T(i(w),{key:0,class:"nue-prompt__label"},{default:P(()=>[h(x(o.label),1)]),_:1})):B("",!0),(j(),T(R(o.inputType==="textarea"?i(L):i(q)),{ref_key:"promptInputRef",ref:f,modelValue:a.value,"onUpdate:modelValue":r[1]||(r[1]=e=>a.value=e),type:o.inputType,placeholder:o.placeholder},null,8,["modelValue","type","placeholder"])),d.value?(j(),T(i(w),{key:1,class:"nue-prompt__value-error"},{default:P(()=>[h(" Invalid value. ")]),_:1})):B("",!0)])]),C("div",Y,[g(o.$slots,"footer",{},()=>[y(i(k),{onClick:r[2]||(r[2]=S(e=>u(!1),["stop"]))},{default:P(()=>[h(x(o.cancelButtonText),1)]),_:1}),y(i(k),{theme:"primary",onClick:r[3]||(r[3]=S(e=>u(!0),["stop"]))},{default:P(()=>[h(x(o.confirmButtonText),1)]),_:1})])])],512))}}),H=t=>{const p=O(t.wrapperId);return new Promise((_,f)=>{const a=document.createElement("div");a.classList.add("nue-prompt-wrapper"),p.appendChild(a),V(y(z,{...t,close:(d,u)=>{a.dataset.leaving="true",d?_(u):f(u),setTimeout(()=>{p.removeChild(a)},240)}}),a)})},X=H,N="@projects",Q=F("projectStore",()=>{const t=v([]),p=v(null);function _(e,l){const n=new Date().toString();return{id:G(),name:e,description:l,createAt:n,updateAt:n}}function f(e,l){return e=e.trim(),new Promise((n,s)=>{if(e==="")s("Project name is required");else{const c=_(e,l);$(t.value,m=>m.name===c.name)?s("Project name is already used"):(t.value.unshift(c),n("Project created successfully"))}})}function a(e){return new Promise((l,n)=>{const s=t.value.find(c=>c.id===e);if(s){const c=t.value.indexOf(s);t.value.splice(c,1)?l("Project removed successfully"):n("Failed to remove project")}})}function d(e,l){return new Promise((n,s)=>{const c=t.value.find(m=>m.id===e);if(c){const m=t.value.indexOf(c),A={...c,...l,updateAt:new Date().toString()};t.value.splice(m,1,A),n("Project updated successfully")}else s("Project not found")})}function u(){const e=localStorage.getItem(N);e&&(t.value=JSON.parse(e))}function o(e){return t.value.filter((l,n)=>e(l,n))}function r(){const e=JSON.stringify(t.value);localStorage.setItem(N,e)}return b(()=>t.value,()=>r(),{deep:!0}),{projects:t,selectedProject:p,create:f,remove:a,update:d,read:u,filter:o}});export{X as a,Q as u};
