editing the controls should trigger a "pause" and don't try to dynamically update anything until the user hits play or reset. 

axis-aligned edge lengths should be inferred from the material properties and the "particles per edge" control.

if volumes overlap or are out of bounds. correct them by moving them around or expanding the box size rather than generating an error. 

the world/global origin should be the center of the floor of the box. 

water does not flow correctly or settle realistically. it currently behaves more like a gel. 
