import { AppBar, Backdrop, Box, CircularProgress, Fade, Grid, Slide, Toolbar } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { AnyAction, Dispatch } from '@reduxjs/toolkit';
import axios from 'axios';
import { cloneDeep } from 'lodash';
import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { useDebounce, useLocalstorageState, useRefElement } from 'rooks';

import Error404 from './404';
import PageManageEvents from './manage/events';
import { AppBarBreadcrumbs } from '../components/AppBar/Breadcrumbs';
import { Logo } from '../components/AppBar/Logo';
import CookieBar from '../components/CookieBar';
import { DashboardStats } from '../components/Dashboard/Stats';
import { DashboardWidgetAction } from '../components/Dashboard/Widget/Action';
import { DashboardWidgetBot } from '../components/Dashboard/Widget/Bot';
import { DashboardWidgetTwitch } from '../components/Dashboard/Widget/Twitch';
import DebugBar from '../components/DebugBar';
import ErrorBoundary from '../components/ErrorBoundary';
import { LoginWarning } from '../components/LoginWarning';
import NavDrawer from '../components/NavDrawer/navDrawer';
import { OnboardingTokens } from '../components/OnboardingTokens';
import { ServerRouterQueryParam } from '../components/ServerRouterQueryParam';
import { ServerSelect } from '../components/ServerSelect';
import { Version } from '../components/Version';
import checkTokenValidity from '../helpers/check-token-validity';
import { setLocale } from '../helpers/dayjsHelper';
import { getListOf, populateListOf } from '../helpers/getListOf';
import { isUserLoggedIn } from '../helpers/isUserLoggedIn';
import { getConfiguration, getSocket } from '../helpers/socket';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import useMobile from '../hooks/useMobile';
import { setConfiguration, setMessage, setState, setSystem, setTranslation, showLoginWarning } from '../store/loaderSlice';
import { setScrollY } from '../store/pageSlice';
import { setUser } from '../store/userSlice';

const PageCommandsAlias = lazy(() => import('./commands/alias'));
const PageCommandsAliasGroup = lazy(() => import('./commands/aliasGroup'));
const PageCommandsBot = lazy(() => import('./commands/botcommands'));
const PageCommandsPrice = lazy(() => import('./commands/price'));
const PageCommandsCooldowns = lazy(() => import('./commands/cooldowns'));
const PageCommandsKeywords = lazy(() => import('./commands/keywords'));
const PageCommandsKeywordsGroup = lazy(() => import('./commands/keywordsGroup'));
const PageCommandsCustomCommands = lazy(() => import('./commands/customcommands'));
const PageCommandsCustomCommandsGroup = lazy(() => import('./commands/customcommandsGroup'));

const PageManageQuotes = lazy(() => import('./manage/quotes'));
const PageManageTimers = lazy(() => import('./manage/timers'));
const PageManageViewers = lazy(() => import('./manage/viewers'));
const PageManageHighlights = lazy(() => import('./manage/highlights'));
const PageManageRanks = lazy(() => import('./manage/ranks'));
const PageManageHLTB = lazy(() => import('./manage/howlongtobeat'));
const PageManagePlaylist = lazy(() => import('./manage/youtube/playlist'));
const PageManageBannedSongs = lazy(() => import('./manage/youtube/bannedsongs'));
const PageManageBannedSongsSpotify = lazy(() => import('./manage/spotify/bannedsongs'));

const PageSettingsModules = lazy(() => import('./settings/modules'));
const PageSettingsPermissions = lazy(() => import('./settings/permissions'));
const PageSettingsTranslations = lazy(() => import('./settings/translations'));

const PageRegistryOBSWebsocket = lazy(() => import('./registry/obswebsocket'));
const PageRegistryOverlays = lazy(() => import('./registry/overlays'));
const PageRegistryRandomizer = lazy(() => import('./registry/randomizer'));
const PageRegistryPlugins = lazy(() => import('./registry/plugins'));
const PageRegistryCustomVariables = lazy(() => import('./registry/customvariables'));
const PageRegistryGallery = lazy(() => import('./registry/gallery'));

const PageStatsBits = lazy(() => import('./stats/bits'));
const PageStatsTips = lazy(() => import('./stats/tips'));
const PageStatsCommandCount = lazy(() => import('./stats/commandcount'));
const PageStatsProfiler = lazy(() => import('./stats/profiler'));

const botInit = async (dispatch: Dispatch<AnyAction>, server: null | string, connectedToServer: boolean) => {
  if (!server || !connectedToServer) {
    setTimeout(() => {
      botInit(dispatch, server, connectedToServer);
    }, 100);
    return;
  }

  dispatch(setState(false));

  try {
    const headers = {
      'x-twitch-token':  localStorage.code,
      'x-twitch-userid': localStorage.userId,
    };
    console.group('isUserLoggedIn::bot::validation');
    console.debug(JSON.stringify({ headers }));
    const validation = await axios.get(`${localStorage.serverUrl}/socket/validate`, { headers });
    console.debug(JSON.stringify({ validation }));
    console.groupEnd();
    localStorage[`${localStorage.server}::accessToken`] = validation.data.accessToken;
    localStorage[`${localStorage.server}::refreshToken`] = validation.data.refreshToken;
    localStorage[`${localStorage.server}::userType`] = validation.data.userType;
  } catch(e) {
    console.error(e);
    console.groupEnd();
    dispatch(showLoginWarning());
    dispatch(setMessage('You don\'t have access to this server.'));
    return;
  }

  console.log('Waiting for user data.');
  dispatch(setUser(await isUserLoggedIn()));

  console.log('Populating systems.');
  await populateListOf('core');
  await populateListOf('systems');
  await populateListOf('services');
  await populateListOf('integrations');

  console.log('Dispatching systems.');
  dispatch(setSystem({
    type: 'core', value: cloneDeep(getListOf('core')),
  }));
  dispatch(setSystem({
    type: 'services', value: cloneDeep(getListOf('services')),
  }));
  dispatch(setSystem({
    type: 'systems', value: cloneDeep(getListOf('systems')),
  }));
  dispatch(setSystem({
    type: 'integrations', value: cloneDeep(getListOf('integrations')),
  }));

  console.log('Populating configuration.');
  const configuration = await getConfiguration();
  console.log('Dispatching configuration.');
  dispatch(setConfiguration(configuration));

  // translations hydration
  console.log('Populating translations.');
  await new Promise<void>(resolve => {
    getSocket('/', true).emit('translations', (translations) => {
      console.log('Dispatching translations.');
      dispatch(setTranslation(translations));
      resolve();
    });
  });

  setLocale(configuration.lang as string);

  console.log('Checking token validity');
  checkTokenValidity();

  console.log('Dispatching bot state OK.');
  dispatch(setState(true));
};

export default function Root() {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const { server, connectedToServer, state, tokensOnboardingState, configuration } = useAppSelector((s: any) => s.loader);
  const [ isIndexPage, setIndexPage ] = useState(false);
  const isMobile = useMobile();

  const [ unfold ] = useLocalstorageState('action_unfold', true);
  const [ chatUnfold ] = useLocalstorageState('chat_unfold', true);

  useEffect(() => {
    setIndexPage(location.pathname === '/');
  }, [location.pathname, dispatch]);

  useEffect(() => {
    botInit(dispatch, server, connectedToServer);
  }, [server, dispatch, connectedToServer]);

  const [pageRef, element]  = useRefElement<HTMLElement>();
  const throttledFunction = useDebounce((el: HTMLElement) => {
    dispatch(setScrollY(el.scrollTop));
  }, 100, { trailing: true });

  useEffect(() => {
    if (element) {
      element.addEventListener('scroll', () => {
        throttledFunction(element);
      }, { passive: true });
    }
  }, [ element, dispatch, throttledFunction ]);
  return <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={configuration.lang}>
    <ErrorBoundary>
      <ServerSelect/>
      <Version/>
      <LoginWarning/>
      <CookieBar/>
      <DebugBar/>
      <ServerRouterQueryParam/>

      {state && <>
        <OnboardingTokens/>
        <Fade in={state && tokensOnboardingState}>
          <Box sx={{ flexGrow: 1 }}>
            <Slide in={!isIndexPage}>
              <AppBar position="sticky" sx={{ px: '70px' }}>
                <Toolbar>
                  <Box sx={{ flexGrow: 1 }}>
                    <AppBarBreadcrumbs/>
                  </Box>
                  <Logo/>
                </Toolbar>
              </AppBar>
            </Slide>
            <NavDrawer />

            {state && tokensOnboardingState && <Box sx={{ paddingLeft: isMobile ? undefined : '65px' }}>
              <Fade in={isIndexPage}>
                <Box sx={{
                  position: 'absolute', top: '0px', width: isMobile ? '100%' : 'calc(100% - 75px)', left: isMobile ? undefined : '70px',
                }} mr={0.2}>
                  <DashboardStats/>
                  <Grid container pt={0.5} pr={0.2} spacing={0.5} sx={{
                    flexFlow: 'nowrap', minWidth: 0,
                  }}>
                    <Grid item
                      sx={{ minWidth: 0 }}
                      sm={chatUnfold ? 12 : true}
                      md={chatUnfold ? 6 : true}
                      xs={chatUnfold ? 12 : true}>
                      <DashboardWidgetBot/>
                    </Grid>
                    <Grid item
                      sx={{ minWidth: 0 }}
                      sm={chatUnfold ? true : 'auto'}
                      md={chatUnfold ? true : 'auto'}
                      xs={chatUnfold ? true : 'auto'}>
                      <DashboardWidgetTwitch/>
                    </Grid>
                    <Grid item
                      sm={unfold ? 2 : 'auto'}
                      md={unfold ? 2 : 'auto'}
                      xs={unfold ? 12 : 'auto'}
                      sx={{ minWidth: unfold ? '180px' : 0 }}>
                      <DashboardWidgetAction/>
                    </Grid>
                  </Grid>
                </Box>
              </Fade>

              <Fade in={!isIndexPage}>
                <Box ref={pageRef} sx={{
                  minHeight: 'calc(100vh - 64px)', maxHeight: 'calc(100vh - 64px)', padding: '0.3em', overflow: 'auto',
                }}>
                  <Suspense fallback={<Backdrop open={true}>
                    <CircularProgress/>
                  </Backdrop>}>
                    <Routes>
                      <Route path="/commands/alias/group/:type?/:id?" element={<PageCommandsAliasGroup/>}/>
                      <Route path="/commands/alias/:type?/:id?" element={<PageCommandsAlias/>}/>
                      <Route path="/commands/botcommands/:type?/:id?" element={<PageCommandsBot/>}/>
                      <Route path="/commands/price/:type?/:id?" element={<PageCommandsPrice/>}/>
                      <Route path="/commands/cooldowns/:type?/:id?" element={<PageCommandsCooldowns/>}/>
                      <Route path="/commands/keywords/group/:type?/:id?" element={<PageCommandsKeywordsGroup/>}/>
                      <Route path="/commands/keywords/:type?/:id?" element={<PageCommandsKeywords/>}/>
                      <Route path="/commands/customcommands/group/:type?/:id?" element={<PageCommandsCustomCommandsGroup/>}/>
                      <Route path="/commands/customcommands/:type?/:id?" element={<PageCommandsCustomCommands/>}/>

                      <Route path="/manage/events/:type?/:id?" element={<PageManageEvents/>}/>
                      <Route path="/manage/quotes/:type?/:id?" element={<PageManageQuotes/>}/>
                      <Route path="/manage/timers/:type?/:id?" element={<PageManageTimers/>}/>
                      <Route path="/manage/viewers/:userId?" element={<PageManageViewers/>}/>
                      <Route path="/manage/highlights" element={<PageManageHighlights/>}/>
                      <Route path="/manage/ranks/:type?/:id?" element={<PageManageRanks/>}/>
                      <Route path="/manage/howlongtobeat/:type?/:id?" element={<PageManageHLTB/>}/>
                      <Route path="/manage/songs/playlist/:type?/:id?" element={<PageManagePlaylist/>}/>
                      <Route path="/manage/songs/bannedsongs/" element={<PageManageBannedSongs/>}/>
                      <Route path="/manage/spotify/bannedsongs/" element={<PageManageBannedSongsSpotify/>}/>

                      <Route path="/settings/modules/:type/:id?" element={<PageSettingsModules/>}/>
                      <Route path="/settings/permissions/:type?/:id?" element={<PageSettingsPermissions/>}/>
                      <Route path="/settings/translations/:type?/:id?" element={<PageSettingsTranslations/>}/>

                      <Route path="/registry/obswebsocket/:type?/:id?" element={<PageRegistryOBSWebsocket/>}/>
                      <Route path="/registry/overlays/:type?/:id?" element={<PageRegistryOverlays/>}/>
                      <Route path="/registry/randomizer/:type?/:id?" element={<PageRegistryRandomizer/>}/>
                      <Route path="/registry/plugins/:type?/:id?" element={<PageRegistryPlugins/>}/>
                      <Route path="/registry/customvariables/:type?/:id?" element={<PageRegistryCustomVariables/>}/>
                      <Route path="/registry/gallery" element={<PageRegistryGallery/>}/>

                      <Route path="/stats/bits" element={<PageStatsBits/>}/>
                      <Route path="/stats/tips" element={<PageStatsTips/>}/>
                      <Route path="/stats/commandcount" element={<PageStatsCommandCount/>}/>
                      <Route path="/stats/profiler" element={<PageStatsProfiler/>}/>

                      <Route path="/" element={<span/>} errorElement={<ErrorBoundary />}/>
                      <Route path="*" element={<Error404/>}/>
                    </Routes>
                  </Suspense>
                </Box>
              </Fade>
            </Box>}
          </Box>
        </Fade>
      </>}
    </ErrorBoundary>
  </LocalizationProvider>;
}
