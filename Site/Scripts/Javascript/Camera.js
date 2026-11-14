import * as THREE from 'three';
import * as Main from '../../Main.js';

export class Camera{

    constructor(){
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight,1 , 1000)
        this.camera.position.z = 70;
        this.camera.position.y = 10;
        this.camera.rotation.x = -0.1;
        this.ultimaPosicao = 0;
        
    }
    Update(delta){
        //his.camera.position.x += 10 * delta;
    }
    Resize(){
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight,1 , 1000)
        this.camera.position.z = 70;
        this.camera.position.y = 10;
        this.camera.rotation.x = -0.1;
    }

    

}