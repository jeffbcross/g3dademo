import { provideRouter, RouterConfig } from '@angular/router';

import {LoginPage} from './pages/login-page/login-page';
import {MainPage} from './pages/main-page/main-page';
import { WelcomePage } from './pages/welcome-page/welcome-page';
import {ForgotPassword} from './pages/forgot-password-page/forgot-password-page';

const routes: RouterConfig = [

    { path: 'login', component: LoginPage},
    { path: 'main', component: MainPage },
    { path: 'forget-password', component: ForgotPassword },
    { path: '', component: WelcomePage }
    //{ path: '', redirectTo: '/login',  pathMatch: 'full'}

];

export const appRouterProviders = [
    provideRouter(routes)
];