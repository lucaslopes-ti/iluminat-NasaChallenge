import {Camera} from './Scripts/Javascript/Camera.js';
import * as THREE from 'three';
import {GLTFLoader} from '../three.js/examples/jsm/loaders/GLTFLoader.js';
import { Scene } from './Scripts/Javascript/Scene.js';

var camera, renderer;
var scene;
var delta = 0;

init();
render();
function init()
    {
    
    camera = new Camera();
    
    scene = new Scene(1);
    

    

    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio(window.devicePixelRatio);
    //renderer.setSize(window.innerWidth/2,window.innerHeight/2);
    renderer.setSize(document.getElementById('planetas').offsetWidth,document.getElementById('planetas').offsetHeight)

    //document.body.appendChild(renderer.domElement);
    document.getElementById('planetas').appendChild(renderer.domElement);

    
    scene.scene.background = new THREE.Color("#789C75");
    

    //window.onresize = Resize;
    

    
    }

 function render(){
        
        requestAnimationFrame(render); 
        
        //delta = clock.getDelta();
        
        camera.Update();
        scene.Update(0);
        renderer.render(scene.scene,camera.camera);
        
    }

 export function Load(id){
        const loader = new GLTFLoader();
        var model = new THREE.Scene();
        loader.load('./Models/scene.glb',function(glb){
            scene.scene.clear();
            /*
            const light1 = new THREE.AmbientLight( 0x404040 ,30);
            const light2 = new THREE.PointLight(0xFFFFFF,300,1000);
            light2.position.y = 10;
            light2.position.z = -25;
            
            scene.scene.add( light1 );
            scene.scene.add( light2 );
            */

            scene.scene.rotation.y = 0;

            scene.scene.add(glb.scene);

            ChangeScene(id);

        },function(xhr){
            console.log((xhr.loaded/xhr.total * 100) + "% loaded");
            
        },function(error){
            console.log('Error: ' + error);
        });
        return model;
    }
        