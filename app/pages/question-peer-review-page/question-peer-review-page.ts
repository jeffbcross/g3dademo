import {
    NavController, NavParams, Loading,
    LoadingController, MenuController
} from 'ionic-angular';
import {DomSanitizationService, SafeHtml} from "@angular/platform-browser";
import {Component, ChangeDetectorRef, ViewChild} from '@angular/core';
import {ContentData} from '../../providers/contentProvider';
import {ContentItem} from '../../models/content-item';
import {MenuItem} from '../../models/menu-item';

import {ProgressProvider} from '../../providers/progressProvider';
import {ChannelService} from '../../services/channelService';

import {CharacterPhraseImg} from "../../components/character-phrase-img/character-phrase-img";
import {InnerContent} from "../../components/inner-content/inner-content";
import {ModalService} from "../../services/modalService";
import {Globals} from "../../globals";
import {UserService} from "../../services/userService";

@Component({
    templateUrl: 'build/pages/question-peer-review-page/question-peer-review-page.html',
    providers: [],
    directives: [CharacterPhraseImg, InnerContent]
})
export class QuestionPeerReviewPage {
    selectedItem: any;
    private _pageContent: string;
    private isClassroomModeOn: boolean;
    questions: any;
    state: string = '';
    loader: Loading;
    formComplete: boolean = false;
    receivedReview: any;
    submittedReview: boolean;
    submittedFeedback: boolean;
    respondingToClientId: string;
    userData: Map<string, string>;

    @ViewChild(CharacterPhraseImg) characterPhraseImg:CharacterPhraseImg;
    @ViewChild(InnerContent) innerContent:InnerContent;

    constructor(private nav: NavController,
                navParams: NavParams,
                private content: ContentData,
                private progress: ProgressProvider,
                private channelService:ChannelService,
                private cdRef: ChangeDetectorRef,
                private _sanitizer: DomSanitizationService,
                private loadingController:LoadingController,
                private modalService: ModalService,
                private menu: MenuController,
                private _globals: Globals,
                private userService: UserService) {
            this.userData = userService.getUserData();
            _globals.isClassroomModeOn.subscribe((data) => {
            this.isClassroomModeOn = data;
        });
        // If we navigated to this page, we will have an item available as a nav param
        this.state = 'answer';
        this.selectedItem = navParams.get('item');
        if (!this.selectedItem)
        {
            this.selectedItem = new ContentItem(navParams.get('urlName'), navParams.get('urlName'), QuestionPeerReviewPage);
            this.selectedItem.project = navParams.get('project');
            this.selectedItem.session = navParams.get('session');
            this.selectedItem.menuItem = new MenuItem('Title', this.selectedItem.project, this.selectedItem.session, null, [this.selectedItem]);
            this.selectedItem.page = 2;
        }
    }
    ngOnInit() {
        this.content.loadQuestions(this.selectedItem.menuItem.project, this.selectedItem.menuItem.session, this.selectedItem.urlName).then(
            (data) => {
                this.questions = data;
            },
            (error) => {
                console.log(error);
            }
        );
        this.content.loadContent(this.selectedItem.menuItem.project, this.selectedItem.menuItem.session, this.selectedItem.urlName).then(
            (data) => {
                this._pageContent = data._body;
                this.content.loadModel(this.selectedItem.menuItem.project, this.selectedItem.menuItem.session, this.selectedItem.urlName).then(
                    (data) => {
                        let pageModel = data['_body'] ? JSON.parse(data['_body']) : null;
                        this.innerContent.recompileTemplate(this._pageContent, pageModel, this);
                        this.characterPhraseImg.draw(pageModel);
                        this.channelService.getConnection().proxies.inclasshub.invoke("checkForExistingState");
                        //console.log("Attaching CD");
                        //this.cdRef.markForCheck();
                    }
                ).catch((e) => {
                    this.innerContent.recompileTemplate(this._pageContent, '');
                })
            },
            (error) => {
                console.log(error);
            }
        );
        this.receivedReview = {};
        let answersDataObservable = this.channelService.getAssignmentData();
        answersDataObservable['source'].subscribe((answer) => {
            console.log("Got assignment:", answer);
            for(let question of answer.questions) { // to reset isCorrect and response fields before giving feedback
                let firstAnswer = question['answers'][0];
                firstAnswer['isCorrect'] = null;
                firstAnswer['response'] = null;
            }
            this.state = "give-feedback";
            this.gotAssignment(answer);
        });
        let reviewDataObservable = this.channelService.getReviewData();
        reviewDataObservable['source'].subscribe((answer) => {
            console.log("Got review:", answer);
            console.log(this.receivedReview);
            
            if ((this.receivedReview && this.receivedReview.UserId)||(this.submittedFeedback && this.state == "loading")){
                console.log("Show feedback");
                this.state = "get-feedback";
                this.gotAssignment(answer);
            } else {
                console.log("Still giving feedback, store for later.");
                this.receivedReview = answer;
            }
        });
    }
    ngOnDestroy(){
        console.log("Destroy Review");
        this.receivedReview = {};
    }
    public get pageContent() : SafeHtml {
        return this._sanitizer.bypassSecurityTrustHtml(this._pageContent); //to avoid xss attacks warnings
    }
    showFeedback(){
        if (this.receivedReview && this.receivedReview.UserId){
            console.log("Show feedback from function");
            this.gotAssignment(this.receivedReview);
            this.state = "get-feedback";
            this.submittedReview = true;
        }
    }
    pullReview(){
        this.channelService.getConnection().proxies.inclasshub.invoke("pullReview");   
    }
    gotAssignment(answer){
        this.respondingToClientId = answer.ClientId;
        this.questions = answer;
        this.cdRef.detectChanges();
    }
    validateAnswerFields(){
        for (var i = 0; i < this.questions.questions.length; i++){
            console.log(this.questions.questions[i].answers[0].answer);
            
            if (!this.questions.questions[i].answers[0].answer || this.questions.questions[i].answers[0].answer.length == 0){
                this.formComplete = false;
                return;
            }
        }
        this.formComplete = true;
    }
    submitAnswers(){
        //Validate answers completed
        this.loader = this.loadingController.create();
        this.questions.ProjectNumber = this.selectedItem.menuItem.project;
        this.questions.SessionNumber = this.selectedItem.menuItem.session;
        this.questions.PageNumber = this.selectedItem.page;

        this.channelService.getConnection().proxies.inclasshub.invoke("submitAnswer", this.questions); //JSON.stringify(this.questions)
        this.state = "loading";
        this.submittedReview = true;
    }
    submitFeedback(){
        this.channelService.getConnection().proxies.inclasshub.invoke("submitReview", this.questions);
        this.submittedFeedback = true;
        if (this.receivedReview && this.receivedReview.UserId){
            this.questions = this.receivedReview;
            this.state = "get-feedback";
            this.cdRef.detectChanges();
        }else {
            this.receivedReview = true;
            this.state = "loading";
        }
    }
    toggleMenu() {
        if (this.menu.isOpen()) {
            this.menu.close();
        } else {
            this.menu.open();
        }
    }
    navigateBackTo(page) {
        this.progress.openPage(page);
        this.nav.pop();
    }
    navigateForwardTo(page) {

        this.progress.openPage(page);
        this.nav.push(page.componentType, { item: page });
    }
    finishSession() {
        this.progress.finishSession(this.selectedItem.menuItem);
    }
    private getAnswer(){
        var resp = `{
            "questions": [
                {
                    "questionId": 100,
                    "type": "peer-review",
                    "question": "What conclusions can you draw from this data?",
                    "answers": [
                        {
                            "answer": "Education, Parents",
                            "isCorrect": true,
                            "response": "I agree"
                        }
                    ]
                },
                {
                    "questionId": 101,
                    "type": "peer-review",
                    "question": "What are some reasons why higher education leads to a higher annual salary?",
                    "answers": [
                        {
                            "answer": "Education",
                            "isCorrect": true,
                            "response": "With a good education you can make it on your own."
                        }
                    ]

                },
                {
                    "questionId": 102,
                    "type": "peer-review",
                    "question": "What stands out to you about this data set? Why?",
                    "answers": [
                        {
                            "answer": "Education",
                            "isCorrect": false,
                            "response": "With a good education you can make it on your own."
                        }
                    ]

                }

            ]
            }`;
            var obj = JSON.parse(resp);
            if (this.respondingToClientId){
                obj.ClientId = this.respondingToClientId;
            }
            return obj;
    }
    createNote(){
        this.modalService.showAddNotePopup();
    }

}
