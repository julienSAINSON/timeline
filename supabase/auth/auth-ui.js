import {
  getCurrentUser,
  loginWithGoogle,
  logout,
  onAuthStateChange,
} from './auth.js';

/**
 * Monte une interface d'authentification minimale dans un conteneur.
 * L'application doit appeler initAuth() avant cette fonction.
 *
 * @param {Element|string} container Cible CSS ou élément HTML.
 * @param {object} [options]
 * @param {string} [options.loginLabel]
 * @param {string} [options.logoutLabel]
 * @returns {Promise<{destroy: () => void}>}
 */
export async function mountAuthUI(container, options = {}) {
  const element = resolveContainer(container);
  const labels = {
    login: options.loginLabel || 'Continuer avec Google',
    logout: options.logoutLabel || 'Se déconnecter',
  };

  let currentUser = await getCurrentUser();
  let actionPending = false;
  let message = '';

  const render = () => {
    element.innerHTML = currentUser
      ? connectedTemplate(currentUser, labels.logout, actionPending, message)
      : signedOutTemplate(labels.login, actionPending, message);

    const loginButton = element.querySelector('[data-appkit-auth-login]');
    const logoutButton = element.querySelector('[data-appkit-auth-logout]');

    loginButton?.addEventListener('click', async () => {
      actionPending = true;
      message = '';
      render();

      try {
        await loginWithGoogle();
      } catch (error) {
        actionPending = false;
        message = error.message;
        render();
      }
    });

    logoutButton?.addEventListener('click', async () => {
      actionPending = true;
      message = '';
      render();

      try {
        await logout();
      } catch (error) {
        message = error.message;
      } finally {
        actionPending = false;
        render();
      }
    });
  };

  const unsubscribe = onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    actionPending = false;
    message = '';
    render();
  });

  render();

  return {
    destroy() {
      unsubscribe();
      element.replaceChildren();
    },
  };
}

function resolveContainer(container) {
  const element = typeof container === 'string' ? document.querySelector(container) : container;

  if (!(element instanceof Element)) {
    throw new Error('Le conteneur de l’interface auth est introuvable.');
  }

  return element;
}

function signedOutTemplate(loginLabel, actionPending, message) {
  return `
    <div class="appkit-auth" aria-live="polite">
      <button class="appkit-auth__button" type="button" data-appkit-auth-login ${disabled(actionPending)}>
        ${escapeHtml(actionPending ? 'Connexion en cours...' : loginLabel)}
      </button>
      ${messageTemplate(message)}
    </div>
  `;
}

function connectedTemplate(user, logoutLabel, actionPending, message) {
  const identity = user.user_metadata?.full_name || user.email || 'Utilisateur connecté';

  return `
    <div class="appkit-auth appkit-auth--connected" aria-live="polite">
      <span class="appkit-auth__user">${escapeHtml(identity)}</span>
      <button class="appkit-auth__button appkit-auth__button--secondary" type="button" data-appkit-auth-logout ${disabled(actionPending)}>
        ${escapeHtml(actionPending ? 'Déconnexion en cours...' : logoutLabel)}
      </button>
      ${messageTemplate(message)}
    </div>
  `;
}

function messageTemplate(message) {
  return message
    ? `<p class="appkit-auth__message" role="alert">${escapeHtml(message)}</p>`
    : '';
}

function disabled(isDisabled) {
  return isDisabled ? 'disabled' : '';
}

function escapeHtml(value) {
  const temporaryElement = document.createElement('span');
  temporaryElement.textContent = String(value);
  return temporaryElement.innerHTML;
}
