/** Desktop Art browser SDK 2.2.0. plugin.json schema version is independent. */
export type Surface = 'background' | 'foreground';
export type PluginSurface = Surface | 'both';
export type DeepReadonly<T> = T extends (...args:any[])=>any ? T : T extends object ? {readonly [K in keyof T]:DeepReadonly<T[K]>} : T;
export interface LibraryDependency { version:string; entry:string }
export interface PluginDependencies { plugins:Record<string,string>; libraries:Record<string,LibraryDependency> }
/** Qualified plugin.json, validated against plugin.schema.json plus filesystem/dependency rules. */
export interface PluginManifest {
  $schema?:string; manifestVersion:1; sdkVersion:2; id:string; name:string; version:string;
  author:string; dependencies:PluginDependencies; entry:string; updateUrl:string|null;
  surface:PluginSurface; description?:string;
}
/** Native-normalized metadata. Legacy plugins have manifestVersion 0 and empty version/author. */
export type PluginDescriptor = Omit<PluginManifest,'manifestVersion'|'$schema'> & {manifestVersion:0|1};
export interface Point { x:number; y:number }
export interface Rect extends Point { width:number; height:number }
export interface IconState {
  id:string; boxId:number; name:string; rect:Rect; labelRect:Rect; clip:Rect;
  visible:boolean; selected:boolean; hovered:boolean; dragging:boolean; labelVisible:boolean;
  imageUrl:string; imageWidth:number; imageHeight:number; imageSuppressed:boolean; labelSuppressed:boolean;
}
export interface BoxState extends Rect {
  id:number; itemCount:number; collapsed:boolean; title:string; headerPosition:0|1|2|3;
  titleAlignment:0|1|2; titleVisible:boolean; headerVisible:boolean; scroll:number; dragging:boolean;
}
export interface Scene {
  version:2; revision:number; time:number; surface:Surface; viewport:{width:number;height:number};
  screenOrigin:Point; desktop:DesktopEnvironment|null; icons:readonly IconState[]; boxes:readonly BoxState[];
}
/** Primary monitor and exposed taskbar geometry, in canvas physical pixels. */
export interface DesktopEnvironment {
  rect:Rect; bottomEdge:number;
  taskbar:{visible:boolean;edge:'none'|'top'|'bottom'|'left'|'right';rect:Rect|null};
}
export interface LayerOptions {backend?:'2d'|'webgl2';surface?:Surface;iconId?:string;boxId?:number;clip?:'box'|'none';zIndex?:number}
export interface Layer {
  readonly element:HTMLDivElement; readonly canvas:HTMLCanvasElement;
  readonly context:CanvasRenderingContext2D|WebGL2RenderingContext;
  clear():void; dispose():void;
}
export interface CanvasLayer extends Layer { readonly context:CanvasRenderingContext2D }
export interface WebGLLayer extends Layer { readonly context:WebGL2RenderingContext }
export interface Lease {
  readonly token:string; readonly target:string; readonly committed:boolean;
  commit():Promise<void>; release():Promise<void>;
}
export interface AnimationFrame { time:number; delta:number; progress:number; state:DeepReadonly<Scene> }
export interface AnimationOptions {duration?:number;from?:number;to?:number;easing?:(t:number)=>number;onFrame:(frame:AnimationFrame)=>void;onComplete?:()=>void}
export interface Animation {done:Promise<{cancelled:boolean}>;cancel():void;pause():void;resume():void;reverse():void}
export type InputEventType = 'pointerMove'|'pointerLeave'|'pointerDown'|'click'|'doubleClick'|'wheel';
export type IconEventType = 'hoverEnter'|'hoverLeave'|'selectionChanged'|'visibilityChanged'|'iconAdded'|'iconRemoved'|'iconMoved';
export type BoxEventType = 'boxShown'|'boxHidden'|'boxMoved'|'boxResized'|'boxFolded'|'scroll';
export interface PointerEvent {type:InputEventType;iconId:string;boxId:number;x:number;y:number;delta:number;event?:InputEventType}
export type PluginEventMap = {[K in InputEventType]:PointerEvent & {type:K}} &
  {[K in IconEventType]:{type:K;icon:DeepReadonly<IconState>} & (K extends 'hoverEnter'|'hoverLeave' ? {iconId:string} : {})} &
  {[K in BoxEventType]:{type:K;box:DeepReadonly<BoxState>}} &
  {dragStart:{type:'dragStart'};dragEnd:{type:'dragEnd'};settingsChanged:{type:'settingsChanged';pluginId:string;value:object}};
export type PluginEvent = PluginEventMap[keyof PluginEventMap];
export interface PluginAPI {
  readonly version:string; readonly pluginId:string; readonly surface:Surface;
  readonly manifest:DeepReadonly<PluginDescriptor>|null;
  readonly state:DeepReadonly<Scene>;
  readonly capabilities:Readonly<{canvas2d:boolean;webgl2:boolean;visualReplacement:boolean;sceneTexture:boolean;nativeInput:false}>;
  dependencies:{getPlugin<T extends object=Record<string,unknown>>(id:string):Readonly<T>;importLibrary<T extends object=Record<string,unknown>>(name:string):Promise<T>};
  onState(listener:(state:DeepReadonly<Scene>)=>void):()=>void;
  createLayer(name:string):HTMLDivElement;
  scene:{snapshot():DeepReadonly<Scene>;subscribe(listener:(state:DeepReadonly<Scene>)=>void):()=>void;
    getIcon(id:string):DeepReadonly<IconState>|undefined;getBox(id:number|string):DeepReadonly<BoxState>|undefined;
    screenToCanvas(point:Point):Point;canvasToScreen(point:Point):Point};
  assets:{getIcon(id:string):Promise<ImageBitmap>;getLabel(id:string):Promise<ImageBitmap>;getPixels(id:string):Promise<ImageData>};
  render:{createLayer(options?:Omit<LayerOptions,'backend'> & {backend?:'2d'}):CanvasLayer;
    createLayer(options:Omit<LayerOptions,'backend'> & {backend:'webgl2'}):WebGLLayer;
    createLayer(options:LayerOptions):Layer;acquire(target:string,options?:{parts?:'image'|'label'|'icon'|'box'}):Promise<Lease>;
    getSceneTexture(boxId:number):Promise<{url:string;padding:number;bitmap:ImageBitmap}>};
  events:{on<K extends keyof PluginEventMap>(type:K,listener:(event:DeepReadonly<PluginEventMap[K]>)=>void):()=>void};
  animation:{start(options:AnimationOptions):Animation};
  settings:{get<T extends object>(defaults?:T):T;set(value:object):void};
  lifecycle:{onDispose(cleanup:()=>void|Promise<void>):()=>void|Promise<void>};
  dispose():Promise<void>;
}
export const SDK_VERSION:'2.2.0';
export interface PluginModule {activate(api:PluginAPI):void|(()=>void)|Promise<void|(()=>void)>;dispose?():void|Promise<void>}
export interface PluginHostDebug {
  readonly version:string;readonly surface:Surface;readonly pluginIds:string[];
  readonly states:{id:string;revision:string;status:string}[];
  unload(id:string):Promise<void>;load(id:string):void;reload(id:string):void;
}
declare global {interface Window {desktopArt:PluginAPI;desktopArtHost:PluginHostDebug}}
