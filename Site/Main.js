import {Camera} from './Scripts/Javascript/Camera.js';
import * as THREE from 'three';
import {GLTFLoader} from '../three.js/examples/jsm/loaders/GLTFLoader.js';
import { Scene } from './Scripts/Javascript/Scene.js';
import {Vector3} from '../../three.js/build/three.module.js';

var camera, renderer;
var scene;
var delta = 0;
var object = null;
var MousePositionAtual = {};
var arrastar = false;
const clock = new THREE.Clock();

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

    
    scene.scene.background = new THREE.Color("#313131");
    

    //window.onresize = Resize;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

        // 4. Evento de Clique
     document.addEventListener('mousedown',function(m){
        
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        //RAYCASTER
        const coords = new THREE.Vector2((m.clientX/renderer.domElement.clientWidth) * 2 -1,-((m.clientY/renderer.domElement.clientHeight) * 2 - 1));
        //raycaster.setFromCamera(coords,camera.camera);
        raycaster.setFromCamera(mouse, camera.camera);
        const intersections = raycaster.intersectObjects(scene.scene.children,true);
        if(intersections.length > 0){
            //console.log(intersections);
            //if(intersections[0].object.parent.name.includes("Scene")){
                
                document.body.style.cursor ='auto';
                object = intersections[0].object;
                const localPoint = object.worldToLocal(intersections[0].point.clone());
                //const coords = vector3ToLatLon(localPoint, radius);
                const lat_log = vector3ToLatLon(localPoint, 1);

                camera.camera.lookAt(latLonToVector3(lat_log.lat, lat_log.lon, 1));
                MousePositionAtual[0] = m.pageX;
                MousePositionAtual[1] = m.pageY;
                arrastar = true;
                console.log(lat_log);
           // }
        }else{
            arrastar = false;
        }        

    });

    document.addEventListener('mousemove',function(m){
        
               
        //movimentação do objeto
        if(arrastar)
            { 
                           
                if(m.pageX < MousePositionAtual[0])
                {
                    //scene.scene.rotation.y -= 0.50 * delta;
                    object.parent.rotation.y -= 0.80 * delta;
                }else{
                    //scene.scene.rotation.y += 0.50 * delta;
                    object.parent.rotation.y += 0.80 * delta;
                }
                /*
                 if(m.pageY < MousePositionAtual[1])
                {
                    //scene.scene.rotation.y -= 0.50 * delta;
                    object.parent.rotation.z -= 0.80 * delta;
                }else{
                    //scene.scene.rotation.y += 0.50 * delta;
                    object.parent.rotation.z += 0.80 * delta;
                }
                    */
                
                
            }  
        
    });
     document.addEventListener('mouseup',function(m){
        //movimento de arrastar false
       
            arrastar = false;
          
    });


}

 function render(){
        
        requestAnimationFrame(render); 
        
        delta = clock.getDelta();
        
        camera.Update(delta);
        scene.Update(delta);
        renderer.render(scene.scene,camera.camera);
        
    }

 export function Load(name){
        const loader = new GLTFLoader();
        var model = new THREE.Scene();
        loader.load('./Assets/Models/'+name+'.glb',function(glb){
            scene.scene.clear();
            
            const light1 = new THREE.AmbientLight( 0x404040 ,30);
            const light2 = new THREE.PointLight(0xFFFFFF,300,1000);
            light2.position.y = 10;
            light2.position.z = -25;
            
            scene.scene.add( light1 );
            scene.scene.add( light2 );
            

            //scene.scene.rotation.y = 0;
            
            scene.scene.add(glb.scene);


        },function(xhr){
            console.log((xhr.loaded/xhr.total * 100) + "% loaded");
            
        },function(error){
            console.log('Error: ' + error);
        });
        return model;
    }
        
    function vector3ToLatLon(vector, sphereRadius) {
    

    const p = vector.clone().normalize();

    // Latitude: arco-seno de Y (-90° a +90°)
    const lat = Math.asin(p.y) * (180 / Math.PI);

    // Longitude: atan2 entre Z e X (-180° a +180°)
    // O sinal negativo ou a inversão de eixos pode ser necessária dependendo da textura do mapa
    let lon = Math.atan2(-p.z, p.x) * (180 / Math.PI);

    return { lat, lon };
    }

    function latLonToVector3(lat, lon, sphereRadius) {
    // 1. Converter graus para radianos
    const latRad = lat * (Math.PI / 180);
    const lonRad = lon * (Math.PI / 180);

    // 2. Inverter o cálculo da latitude (Math.asin)
    const y = Math.sin(latRad);

    // 3. O raio horizontal da projeção no plano XZ
    const horizontalCos = Math.cos(latRad);

    // 4. Inverter o cálculo da longitude (Math.atan2(-p.z, p.x))
    const x = horizontalCos * Math.cos(lonRad);
    const z = -horizontalCos * Math.sin(lonRad);

    // 5. Retornar o vetor ajustado pelo raio da esfera
    return new THREE.Vector3(x, y, z).multiplyScalar(sphereRadius);
    }

    