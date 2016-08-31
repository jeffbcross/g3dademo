import {Component, ViewChild} from '@angular/core';
import {NavController, NavParams, MenuController, Toast, ToastController} from 'ionic-angular';
import {ContentData} from '../../providers/contentProvider';
import {WelcomePage} from '../welcome-page/welcome-page';
import {ContentItem} from '../../models/content-item';
import {MenuItem} from '../../models/menu-item';

import {ProgressProvider} from '../../providers/progressProvider';
import {ChannelService} from '../../services/channelService';
import {DomSanitizationService, SafeHtml} from "@angular/platform-browser";
import {CharacterPhraseImg} from "../../components/character-phrase-img/character-phrase-img";
import {InnerContent} from "../../components/inner-content/inner-content";

@Component({
    templateUrl: 'build/pages/answer-question-page/answer-question-page.html',
    providers: [],
    directives: [CharacterPhraseImg, InnerContent]
})
export class AnswerQuestionPage {
    selectedItem: any;
    private _pageContent: string;
    questions: Array<any>;

    @ViewChild(CharacterPhraseImg) characterPhraseImg:CharacterPhraseImg;
    @ViewChild(InnerContent) innerContent:InnerContent;

    constructor(private nav: NavController,
                navParams: NavParams,
                private content: ContentData,
                private menu: MenuController,
                private progress: ProgressProvider,
                private channelService:ChannelService,
                private _sanitizer: DomSanitizationService,
                private toastController: ToastController) {
        // If we navigated to this page, we will have an item available as a nav param
        this.selectedItem = navParams.get('item');
        if (!this.selectedItem)
        {
            this.selectedItem = new ContentItem(navParams.get('urlName'), navParams.get('urlName'), AnswerQuestionPage);
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
                    }
                ).catch((e) => {
                    this.innerContent.recompileTemplate(this._pageContent, '');
                })
            },
            (error) => {
                console.log(error);
            }
        );
    }
    public get pageContent() : SafeHtml {
        return this._sanitizer.bypassSecurityTrustHtml(this._pageContent); //to avoid xss attacks warnings
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
        this.progress.finishSession(this.selectedItem.menuItem, this.nav);
    }
    onSuggest(question){
        if (!question.suggestions){
            question.suggestions = [];    
        }
        question.suggestions.push(question.suggestion);
        this.channelService.getConnection().proxies.inclasshub.invoke('send', 'student', question.suggestion);
        question.suggestion = ""; 
    }

}
