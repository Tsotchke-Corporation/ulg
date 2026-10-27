import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectExactPlacementConservation } from './fixtures/sphExactPlacementQuantityInspection.js';
const fields=['momentumX','momentumY','momentumZ','totalEnergy','restVolume','currentVolume','phaseReferenceMass'];
const shape={massWordCount:1,particleCount:2,eventCapacity:1,recordWords:59,scalarOffsetWords:17,scalar:{wordCount:1,recordWords:6},fields};
const beforeLayout={...shape,originalRowOffset:0,currentRowOffset:2,eventRowOffset:4,rowCount:5,wordLength:295};
const afterLayout={...shape,currentRowOffset:0,eventRowOffset:2,rowCount:3,wordLength:177};
function row(words,index,mass){
 const at=index*59;words[at]=1;words[at+16]=mass;
 for(let field=0;field<7;field++){
  const p=at+17+field*6;let n=mass,e=0;while(n&&!(n&1)){n>>>=1;e++;}
  words[p+2]=e;words[p+4]=n;words[p+5]=1;
 }
}
function inputs(){const beforeWords=new Uint32Array(295),afterWords=new Uint32Array(177);
 row(beforeWords,2,3);row(beforeWords,3,5);row(beforeWords,4,2);
 row(afterWords,0,5);row(afterWords,1,5);
 return{beforeWords,beforeLayout,afterWords,afterLayout,residualCount:[0,0],residualCompanions:Array(11).fill(0),companionStrideWords:11,terminalStatus:1};}
test('integer conservation oracle accepts redistribution across carrier and residual planes',()=>{
 const r=inspectExactPlacementConservation(inputs());assert.equal(r.matches,true);assert.equal(r.massBefore,'10');assert.equal(r.massAfter,'10');assert.equal(r.fields.length,7);
});
test('integer conservation oracle catches duplicate mass and each changed conserved channel',()=>{
 for(let field=0;field<7;field++){const a=inputs();a.afterWords[17+field*6+4]++;const r=inspectExactPlacementConservation(a);assert.equal(r.matches,false);assert.ok(r.failures.includes(fields[field]));}
 const a=inputs();row(a.afterWords,2,2);const r=inspectExactPlacementConservation(a);assert.equal(r.matches,false);assert.ok(r.failures.includes('mass'));assert.ok(r.failures.includes('after:0:retired residual'));
});
test('integer conservation oracle rejects zero denominator and a mismatched residual companion',()=>{
 const a=inputs();a.afterWords[22]=0;assert.equal(inspectExactPlacementConservation(a).matches,false);
 const b=inputs();row(b.afterWords,0,3);row(b.afterWords,2,2);b.residualCount[0]=1;
 const bad=inspectExactPlacementConservation(b);assert.equal(bad.matches,false);assert.ok(bad.failures.includes('after:0:companion mass'));
 b.residualCompanions[10]=2;assert.equal(inspectExactPlacementConservation(b).matches,true);
});
test('rollback compares every conserved channel with pre-reaction originals',()=>{
 const a=inputs();a.terminalStatus=2;
 row(a.beforeWords,0,7);row(a.beforeWords,1,3);
 row(a.afterWords,0,7);row(a.afterWords,1,3);
 // Reaction candidates have the same mass but different extensive quantities.
 for(let field=0;field<7;field++){
  a.beforeWords[17+field*6+4]=9;a.afterWords[17+field*6+4]=9;
 }
 const restored=inspectExactPlacementConservation(a);
 assert.equal(restored.matches,true);assert.equal(restored.comparisonBasis,'pre-reaction originals');
 assert.equal(inspectExactPlacementConservation({...a,terminalStatus:1}).matches,false);
 for(let field=0;field<7;field++){
  const words=a.afterWords.slice();words[17+field*6+4]++;
  const changed=inspectExactPlacementConservation({...a,afterWords:words});
  assert.equal(changed.matches,false);assert.ok(changed.failures.includes(fields[field]));
 }
});
test('missing or unsafe terminal status cannot certify conservation',()=>{
 for(const terminalStatus of[undefined,0,3,99]){
  const r=inspectExactPlacementConservation({...inputs(),terminalStatus});
  assert.equal(r.matches,false);assert.ok(r.failures.includes('terminal status'));
 }
});
