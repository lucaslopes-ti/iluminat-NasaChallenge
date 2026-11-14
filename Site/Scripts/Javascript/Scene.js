import * as THREE from 'three';
//import {GLTFLoader} from './three.js/examples/jsm/loaders/GLTFLoader.js';
import * as Main from '../../Main.js';
import {Vector3} from '../../three.js/build/three.module.js';



export class Scene{
    
    constructor(id){
        this.id = id;
        this.scene = new THREE.Scene();
        Main.Load("Mars_Earth");
        this.positionX = 0;
    }
    Update(delta){
        this.positionX +=1 * delta;
        console.log("scene");       
        //this.scene.rotation.y += 0.20 * delta;
        //this.scene.scale.setScalar(this.positionX,this.positionX,this.positionX);
        this.scene.scale.setScalar(4,4,4);
    }
    GetScene(){
        return this.scene;
    }

    
    

}