import {Component, EventEmitter, Input, Output, OnChanges, ElementRef, ChangeDetectorRef, OnInit} from '@angular/core';
import {ContentData} from '../../providers/contentProvider';
import {Globals} from '../../globals';
import {Events} from "ionic-angular";
declare var createjs: any;
declare var lib: any;

@Component({
    selector: 'animation',
    providers: [ContentData],
    template: `
        <canvas *ngIf="isClassroomModeOn == false"
         [hidden]="!animationFileFound || !dataLoaded"
         (click)="playButtonAction()" width="600" height="600" 
         style="background-color:#FFFFFF;position:relative;display:block;"></canvas>
        <img *ngIf="!dataLoaded" src="{{firstFramePath}}" 
        style="position:absolute;top:0;left:0;"
        [ngStyle]="{'width': sizeOfCanvas+'px','height': sizeOfCanvas+'px'}"/>
        <img *ngIf="paused && isClassroomModeOn == false && isBusy == false"
         (click)="playButtonAction()"
          src="/img/play-button-overlay.png"
          style="position:absolute;top:0;left:0;z-index: 9999"
          [ngStyle]="{'width': sizeOfCanvas+'px','height': sizeOfCanvas+'px'}"/>
        <img *ngIf="isClassroomModeOn == true" src="/img/play-button-disabled-overlay.png" style="position:absolute;top:0;left:0;"
         [ngStyle]="{'width': sizeOfCanvas+'px','height': sizeOfCanvas+'px'}"/>   
        <div *ngIf="isBusy == true">
            <div style="background:url(/img/ring-alt.gif) no-repeat center center;position:absolute;top:0;left:0;"
             [ngStyle]="{'width': sizeOfCanvas+'px','height': sizeOfCanvas+'px'}">
             <a style="text-align: center; vertical-align: middle; font-weight: bold;"
             [ngStyle]="{'line-height': sizeOfCanvas+'px'}"> {{formattedProgress}}</a>
            </div>
         </div>
  `,
    directives: []
})
export class Animation implements OnChanges, OnInit {

    @Input() name: string;
    @Input() project: string;
    @Input() session: string;
    @Input() urlName: string;
    @Input() firstFrame: string;
    @Input() paused: boolean;

    @Output() playStateChanged: EventEmitter<boolean> = new EventEmitter<boolean>();

    private canvas: any;
    private stage: any;
    private exportRoot: any;
    private page_canvas: any;
    private stageWidth: number;
    private stageHeight: number;
    private animationCode: any;
    private content: ContentData;
    private animationFileFound: boolean;
    //private updateRate:EventEmitter = new EventEmitter();
    private isClassroomModeOn: boolean = false;
    private sound: any = null;

    private dataLoaded: boolean = false;
    private isBusy: boolean = false;
    private formattedProgress: string = '0';

    sizeOfCanvas: number = 600;
    firstFramePath = '';

    constructor(content: ContentData,
                private thisElement: ElementRef,
                private _globals: Globals,
                private cdRef: ChangeDetectorRef,
                private events: Events) {
        var self = this;
        this.content = content;
        this._globals.isClassroomModeOn.subscribe(value => {
            this.isClassroomModeOn = value;
            // this.loadAnimationAction();
        });
        window['playSound'] = function (id, loop) {
            self.sound = createjs.Sound.play(id, createjs.Sound.INTERRUPT_EARLY, 0, 0, loop);
            return self.sound;
        };
        events.subscribe('lesson:next-prev', (val) => {
            if(!this.paused) {
                this.playPauseAnimation();
            }
        });
    }

    ngOnInit(): void {
        setTimeout(() => {
            this.getContainerSize();
            this.buildFirstFramePath();
        });
    }

    buildFirstFramePath(){
        if(this.project && this.session && this.urlName && this.firstFrame) {
            this.firstFramePath = '/build/content/project' + this.project+'/session' + this.session+ '/' + this.urlName +  '/' + this.firstFrame;
        }
    }

    loadAnimationAction() {
        this.isBusy = true;
        if (this.project && this.session && this.urlName && this.name) {
            this.content.loadAnimation(this.project, this.session, this.urlName, this.name).then(
                (data) => {
                    this.animationFileFound = true;
                    this.animationCode = data;
                    this.loadAnimation();
                },
                (error) => {
                    console.log(error);
                    this.animationFileFound = false;
                }
            );
        }
    }

    ngOnChanges(changes) {
        if (this.paused && this.stage && !createjs.Ticker.getPaused()) {
            console.log("Triggered Paused");
            this.playPauseAnimation();
        }
    }

    update(value) {
        //this.updateRate.next(value);
    }

    playButtonAction() {
        if (!this.dataLoaded) {
            this.loadAnimationAction();
        } else {
            this.playPauseAnimation();
        }
    }

    playPauseAnimation() {
        var anim = this.stage.getChildAt(0);
        this.playStateChanged.emit(!createjs.Ticker.getPaused());
        let st = this.sound;
        if (st) {
            st.setPaused(!createjs.Ticker.getPaused());
        }
        createjs.Ticker.setPaused(!createjs.Ticker.getPaused());
        this.paused = st.paused;
    }

    loadAnimation() {
        if (!createjs.Sound.initializeDefaultPlugins()) {
            return;
        }
        this.page_canvas = this.thisElement.nativeElement.firstElementChild;
        this.stageWidth = this.page_canvas.width;
        this.stageHeight = this.page_canvas.height;

        this.canvas = this.thisElement.nativeElement.firstElementChild;
        let basePath = "/build/content/project" + this.project + "/session" + this.session + "/" + this.urlName + "/";
        var loader = new createjs.LoadQueue(false, basePath);
        loader.installPlugin(createjs.Sound);
        loader.addEventListener("complete", this.handleComplete(this));
        loader.addEventListener("fileload", this.handleFileLoad);
        loader.addEventListener("progress", this.handleQueueProgress(this));
        loader.loadManifest(lib.properties.manifest);
    }
    doneLoading(){
        this.isBusy = false;
        this.dataLoaded = true;
        console.log(this.isBusy);
        this.cdRef.detectChanges();
    }
    handleFileLoad(evt) {
        if (evt.item.type == "image") {
            if (!window['createJSImages']) window['createJSImages'] = {};
            if (!window['images']) window['images'] = {};
            window['createJSImages'][evt.item.id] = evt.result;
            window['images'][evt.item.id] = evt.result;
        }
    }
    handleQueueProgress(that){
        var self = this;
        return function(progress){
            console.log(progress.loaded);
            self.formattedProgress = progress.loaded ? (progress.loaded * 100).toFixed(0) : '0';
            self.cdRef.detectChanges();
            if (progress.loaded == 1){
                console.log("Done loading", that.isBusy);
                that.doneLoading();
            }
        }

    }
    handleComplete(that) {
        this.paused = false;
        return function () {
            that.stage = new createjs.Stage(that.canvas);
            that.stage.addChild(new that.animationCode[that.name]());

            createjs.Ticker.timingMode = createjs.Ticker.RAF_SYNCHED;
            createjs.Ticker.setFPS(lib.properties.fps);
            createjs.Ticker.addEventListener("tick", that.tickHandler(that));
            createjs.Ticker.setPaused(false);
            that.resizeAnimation();

            let st = null;
            // let st = that.stage.getChildAt(0).soundTrack ? that.stage.getChildAt(0).soundTrack : that.stage.getChildAt(0).children[0].soundTrack;
            if (that.stage.getChildAt(0) && that.stage.getChildAt(0).soundTrack) {
                st = that.stage.getChildAt(0).soundTrack
            } else {
                if (that.stage.getChildAt(0) && that.stage.getChildAt(0).children[0] && that.stage.getChildAt(0).children[0].soundTrack) {
                    st = that.stage.getChildAt(0).children[0].soundTrack;
                }
            }
            if (!st) {
                st = createjs.Sound._instances[0];
            }
            // if (st){
            //     st.setPaused(true);
            // }
            // createjs.Ticker.setPaused(true);
        }
    }

    tickHandler(that) {
        var self = this;
        var newCircle = false;
        return function (event) {
            if (!that.paused && !event.paused) {
                that.stage.update();
            }
            let stage = that.stage.children[0];
            let timeline = stage['timeline'];
            if (timeline.position == 0) newCircle = false;
            if (timeline.duration - timeline.position == 1 && !newCircle) { //to pause at the end of movie
                newCircle = true;
                self.playPauseAnimation();
            }
        }
    }

    getContainerSize(){
        var newWidth = this.thisElement.nativeElement.offsetWidth; //window.innerWidth;
        this.sizeOfCanvas = newWidth; //  new value instead of default 600 px
    }

    resizeAnimation() {
        var widthToHeight = this.stageWidth / this.stageHeight;
        var newWidth = this.thisElement.nativeElement.offsetWidth; //window.innerWidth;
        var newHeight = this.thisElement.nativeElement.offsetHeight; //window.innerHeight;
        var newWidthToHeight = newWidth / newHeight;
        //
        // if (newWidthToHeight > widthToHeight) {
        //     newWidth = newHeight * widthToHeight;
        //     this.page_canvas.style.height = newHeight + "px";
        //     this.page_canvas.style.width = newWidth + "px";
        // } else {
        //     newHeight = newWidth / widthToHeight;
        //     this.page_canvas.style.height = newHeight + "px";
        //     this.page_canvas.style.width = newWidth + "px";
        // }
        // if (scale){
        //     scale = newWidthToHeight / widthToHeight;
        // }

        this.page_canvas.style.height = newWidth + "px";
        this.page_canvas.style.width = newWidth + "px";

        this.sizeOfCanvas = newWidth; //  new value instead of default 600 px

        if (this.stage) {
            this.stage.width = newWidth;
            this.stage.height = newWidth;
        }
        //this.page_canvas.style.marginTop = ((window.innerHeight - newHeight) / 2) + "px";
        //this.page_canvas.style.marginLeft = ((window.innerWidth - newWidth) / 2) + "px";
        // this.page_canvas.parentElement.style.width = this.page_canvas.width + "px";
        // this.page_canvas.parentElement.style.height = this.page_canvas.height + "px";
    }

}