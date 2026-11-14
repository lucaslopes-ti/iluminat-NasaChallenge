import * as THREE from 'three';
//import {GLTFLoader} from '../Scripts/Javascript/three.js/examples/jsm/loaders/GLTFLoader.js';
import * as Main from '../../Main.js';
//import { Vector3 } from '../three.js/build/three.module.js';



export class Scene{
    
    constructor(id){
        this.id = id;
        this.scene = new THREE.Scene();
        Main.Load();

    }
    Update(delta){

        console.log("scene");
        
        
        

    }
    GetScene(){
        return this.scene;
    }

    
    

}