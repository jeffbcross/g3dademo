import { Injectable } from '@angular/core';
import {Router} from '@angular/router';
import {Http, Headers} from '@angular/http';
import {Globals} from "../app/globals";
import {ChannelConfig} from "./channelService";
import {ToastService} from "./toastService";

export class User {
    constructor(
        public login: string,
        public password: string) { }
}

@Injectable()
export class UserService {
    private token: string;

  public baseUrl: string = "https://girlsinc.azurewebsites.net"; // "http://localhost:26209"; //

    constructor(public router: Router,
                public http: Http,
                public _globals: Globals,
                public toastService: ToastService){
        this.checkIfLoggedInFlag();
    }

    saveToken(token){
        this.token = token; 
    }
    getToken(){
        if (this.token){
            return this.token;
        }
    }
    loginWithToken(token){
            let headers = new Headers();
            headers.append('Authorization', 'Bearer ' + token);
            //get data of userprofile
            this.http.get(this.baseUrl + '/api/account/userprofile', {headers: headers}).subscribe(res => {
                let parsedRes = res.json();
                localStorage.setItem("userData", JSON.stringify(parsedRes));
                this.persistToken(token);
                this._globals.isLoggedIn.next(true);
                this.router.navigate(['/main']);
            }, 
            err => {
                console.log(err);
                this.http.post(this.baseUrl + '/api/account/ConnectExternalToUser', null, {headers: headers}).subscribe(res => {
                    this.redirectGoogleAuth();
                });
                
            });
    }
    redirectGoogleAuth(){
        this.http.get(this.baseUrl + '/api/Account/ExternalLogins?returnUrl=http://g3da.azurewebsites.net/&generateState=true').subscribe(res => {
            let parsedRes = res.json();
            window.location.href = this.baseUrl + parsedRes[0].Url;
        });
    }
    persistToken(token){
        localStorage.setItem("api_token", token);
        let expiry = new Date().getTime() + (28800 * 1000) - 300;
        localStorage.setItem("api_token_expiry", expiry.toString());
    }

    logout():void{
        localStorage.removeItem("api_token");
        localStorage.removeItem("userData");
        localStorage.removeItem("api_token_expiry");
        this._globals.isLoggedIn.next(false);
        this.router.navigate(['/login']);
    }

    singUp(newUserData: any) {
        this.http.post(this.baseUrl + '/api/account/register', newUserData).subscribe(res => {
            this.router.navigate(['/login']);
        });
    }

    newLogin(user) {
        let creds = "username=" + user.login + "&password=" + user.password + "&grant_type=password";
        let headers = new Headers();
        headers.append('Content-Type', 'application/x-www-form-urlencoded');
        this.http.post(this.baseUrl + '/token', creds, {headers: headers}).subscribe(res => {
            let parsedRes = res.json();
            let token = parsedRes['access_token'];
            localStorage.setItem("api_token", token);
            let expiry = new Date().getTime() + (parsedRes['expires_in'] * 1000) - 300;
            localStorage.setItem("api_token_expiry", expiry.toString());
            this._globals.isLoggedIn.next(true);
            this.updateUserInfo(() => {
                this.router.navigate(['/main']);
            });

        }, (err) => {
            var parsedErr = err.json();
            if(parsedErr && parsedErr.error_description) this.toastService.loginFails(parsedErr.error_description);
        });
    }
    updateUserInfo(callback) {
        let token = localStorage.getItem("api_token");
        if(token) {
            let headers = new Headers();
            headers.append('Authorization', 'Bearer ' + token);
            //get data of userprofile
            this.http.get(this.baseUrl + '/api/account/userprofile', {headers: headers}).subscribe(res => {
                let parsedRes = res.json();
                localStorage.setItem("userData", JSON.stringify(parsedRes));
                if(callback){
                    callback();
                }
            });
        }
    }
    checkIfLoggedInFlag():void{
        let token = localStorage.getItem("api_token");
        let tokenExpiryTime = new Date(parseInt(localStorage.getItem("api_token_expiry")));
        if(token && new Date() < tokenExpiryTime){
            this._globals.isLoggedIn.next(true);
        } else {
            localStorage.removeItem("api_token");
            localStorage.removeItem("api_token_expiry");
            localStorage.removeItem("userData");
        }
    }
    goToMain():void{
        this.router.navigate(['/main']);
    }
    goToLogin():void{
        this.router.navigate(['/login']);
    }
    goToForgetPasswordPage():void{
        this.router.navigate(['/forget-password']);
    }
    resetPassword():void{
        this.router.navigate(['/login']);
    }
    getUserData(){
         let userDataString = localStorage.getItem('userData');
         return userDataString ? JSON.parse(userDataString) : {};
    }
    setSelectedCourse(courseId) {
        let userData = this.getUserData();
        userData.SelectedCourseId = courseId;
        localStorage.setItem("userData", JSON.stringify(userData));
    }
    getChannelConfiguration() {
        var userData = this.getUserData();
        let channelConfig = new ChannelConfig();
        channelConfig.url = this.baseUrl + "/signalr";
        channelConfig.hubName = "inClassHub";
        channelConfig.params = new Map<string, string>();
        channelConfig.params['uid'] = userData.UserId;
        channelConfig.params['courseClassId'] = userData.SelectedCourseId;
        return channelConfig;
    }
}
