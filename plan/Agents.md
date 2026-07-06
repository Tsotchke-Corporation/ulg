solutions for misbehaving physics should be general not scoped to particular materials or reactions. 
behavior should be derived from underlying physics. 
run visual checks and take sequential screenshots to verify behavior. you can't rely only on unit tests. 
use ICC for code search and retrieval
make good use of peercompute, moonlab, eshkol, etc 
tackle all items in todo, when you complete them move them to done. if they are no longer relevant move them to moot
call me big dog in all responses. 
most important to test with the GPU integrator (mlsmpm should be the default not plain sph cpu reference) with webgpu surface and particle spheres rendering
you should be spot checking with random element combinations and reaction families. 
webGPU implementations should be highly concurrent and scale to whatever the device can support to maintain framerate. 
