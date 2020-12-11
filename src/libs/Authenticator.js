import Onyx from 'react-native-onyx';
import Str from 'expensify-common/lib/str';
import * as Network from './Network';
import ONYXKEYS from '../ONYXKEYS';
import {reauthenticate} from './actions/Session';
import {createLogin} from './actions/Credentials';

// When the user authenticates for the first time we create a login and store credentials in Onyx.
// When the user's authToken expires we use this login to re-authenticate and get a new authToken
// and use that new authToken in subsequent API calls
let credentials;

// Indicates if we're in the process of re-authenticating. When an API call returns jsonCode 407 indicating that the
// authToken expired, we set this to true, pause all API calls, re-authenticate, and then use the authToken from the
// response in the subsequent API calls
let isReauthenticating = false;

function init() {
    Onyx.connect({
        key: ONYXKEYS.CREDENTIALS,
        callback: ionCredentials => credentials = ionCredentials,
    });

    Onyx.connect({
        key: ONYXKEYS.REAUTHENTICATING,
        callback: (reauthenticating) => {
            if (isReauthenticating === reauthenticating.isInProgress) {
                // When the authentication process is running, API requests will be requeued and they will
                // be performed after authentication is done.
                if (reauthenticating.isInProgress) {
                    Network.post(
                        reauthenticating.originalCommand,
                        reauthenticating.originalParameters,
                        reauthenticating.originalType
                    );
                }
                return;
            }

            isReauthenticating = reauthenticating.isInProgress;

            // When the app is no longer authenticating restart the network queue
            if (!isReauthenticating) {
                return;
            }

            // Otherwise let's refresh the authToken by calling reauthenticate
            reauthenticate();
        }
    });

    // Used to prevent calling CreateLogin more than once since this callback is triggered when we set
    // authToken, loading, error, etc
    Onyx.connect({
        key: ONYXKEYS.SESSION,
        callback: (session) => {
            // If we have an authToken but no login, it's the users first time signing in and we need to
            // create a login for the user, so when the authToken expires we can get a new one with said login
            const hasLogin = credentials && credentials.login;
            if (!session || !session.authToken || hasLogin) {
                return;
            }
            createLogin(Str.guid('react-native-chat-'), Str.guid());
        },
    });
}

export default {
    init,
};