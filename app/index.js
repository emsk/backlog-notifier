'use strict';

(() => {
  const isMac = process.platform === 'darwin';
  const defaultFetchIntervalSec = 600;
  const notieDisplaySec = 1.5;
  const colorIconFilename64 = 'icon_black.png';
  const blackIconFilename24 = 'icon_black.png';
  const blackIconFilename24Notification = 'icon_black.png';
  const colorIconFilename24 = 'icon_black.png';
  const colorIconFilename24Notification = 'icon_black.png';

  const electron = require('electron');
  const remote = electron.remote;
  const app = remote.app;
  const dialog = remote.dialog;
  const shell = remote.shell;
  const Menu = remote.Menu;
  const Tray = remote.Tray;
  const fs = require('fs');
  const notie = require('notie');

  const appName = app.getName();
  const appCopyright = 'Copyright (c) 2017 emsk';

  let appDir = `${__dirname}.unpacked`; // Production
  try {
    fs.statSync(appDir);
  } catch (err) {
    appDir = __dirname; // Development
  }

  const nodeNotifier = require('node-notifier');

  const appIconFilePath = isMac ? null : `${appDir}/images/${colorIconFilename64}`;

  let notifierScreen = null;

  class BacklogNotifier {
    constructor(index) {
      this._newFlag = false;
      this._index = index;
      this._lastExecutionTime = null;
      this._settings = null;
      this._fetchTimer = null;
      this._mostRecentIssueKey = null;
    }

    setNewFlag(newFlag) {
      this._newFlag = newFlag;
      return this;
    }

    displaySettings() {
      document.getElementById('space-id').value = this._settings.spaceId;
      document.getElementById('api-key').value = this._settings.apiKey;
      document.getElementById('project-id').value = this._settings.projectId;
      document.getElementById('fetch-interval-sec').value = this._settings.fetchIntervalSec;
      return this;
    }

    getPageSettings() {
      return {
        spaceId: document.getElementById('space-id').value,
        apiKey: document.getElementById('api-key').value,
        projectId: document.getElementById('project-id').value,
        fetchIntervalSec: document.getElementById('fetch-interval-sec').value
      };
    }

    readScreenSettings() {
      this._settings = this.getPageSettings();
      return this;
    }

    readStoredSettings() {
      this._settings = {
        spaceId: localStorage.getItem(`spaceId${this._index}`),
        apiKey: localStorage.getItem(`apiKey${this._index}`),
        projectId: localStorage.getItem(`projectId${this._index}`),
        fetchIntervalSec: localStorage.getItem(`fetchIntervalSec${this._index}`)
      };

      return this;
    }

    getStoredSetting(key) {
      return localStorage.getItem(`${key}${this._index}`);
    }

    updateLastExecutionTime() {
      this._lastExecutionTime = (new Date()).toISOString().replace(/\.\d+Z$/, 'Z');
      localStorage.setItem(`lastExecutionTime${this._index}`, this._lastExecutionTime);
      return this;
    }

    updateSettings() {
      localStorage.setItem(`spaceId${this._index}`, this._settings.spaceId);
      localStorage.setItem(`apiKey${this._index}`, this._settings.apiKey);
      localStorage.setItem(`projectId${this._index}`, this._settings.projectId);
      localStorage.setItem(`fetchIntervalSec${this._index}`, this._settings.fetchIntervalSec);
      return this;
    }

    deleteStoredSettings() {
      localStorage.removeItem(`spaceId${this._index}`);
      localStorage.removeItem(`apiKey${this._index}`);
      localStorage.removeItem(`projectId${this._index}`);
      localStorage.removeItem(`fetchIntervalSec${this._index}`);
      return this;
    }

    validateSettings() {
      if (this._settings.spaceId && this._settings.apiKey) {
        return true;
      }

      notie.alert({
        type: 'error',
        text: 'Please enter required fields.',
        time: notieDisplaySec
      });

      return false;
    }

    initFetch() {
      const intervalMsec = 1000 * (this._settings.fetchIntervalSec || defaultFetchIntervalSec);

      clearInterval(this._fetchTimer);

      this._fetchTimer = setInterval(() => {
        this.fetch();
      }, intervalMsec);

      return this;
    }

    fetch() {
      const xhr = new XMLHttpRequest();

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          this.handleResponseFetch(xhr.status, xhr.responseText);
        }
      };

      xhr.open('GET', `https://${this._settings.spaceId}.backlog.jp/api/v2/issues${this.getRequestParams(this._settings.apiKey, this._settings.projectId)}`);
      xhr.send();

      return this;
    }

    handleResponseFetch(status, responseText) {
      if (status === 200) {
        const response = JSON.parse(responseText);
        this.notify(this.pickIssues(response));
      }

      this.updateLastExecutionTime();

      return this;
    }

    pickIssues(responseIssues) {
      const lastExecutionTime = new Date(this._lastExecutionTime).getTime();

      const issues = responseIssues.filter(issue => {
        const updatedTime = new Date(issue.updated).getTime();
        return updatedTime >= lastExecutionTime;
      });

      return issues;
    }

    testConnection() {
      const xhr = new XMLHttpRequest();
      const pageSettings = this.getPageSettings();

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          this.handleResponseTestConnection(xhr.status);
        }
      };

      xhr.open('GET', `https://${pageSettings.spaceId}.backlog.jp/api/v2/issues${this.getRequestParams(pageSettings.apiKey, pageSettings.projectId)}`);
      xhr.send();

      return this;
    }

    handleResponseTestConnection(status) {
      if (status === 200) {
        notie.alert({
          type: 'success',
          text: 'Connection succeeded.',
          time: notieDisplaySec
        });
        return this;
      }

      notie.alert({
        type: 'error',
        text: 'Connection failed.',
        time: notieDisplaySec
      });

      return this;
    }

    getRequestParams(apiKey, projectId) {
      const params = [
        `apiKey=${apiKey}`,
        `updatedSince=${this.getLastExecutionDate()}`,
        'sort=updated',
        'count=100'
      ];

      if (typeof projectId === 'string' && projectId !== '') {
        params.unshift(`projectId[]=${projectId}`);
      }

      return `?${params.join('&')}`;
    }

    getLastExecutionDate() {
      return this._lastExecutionTime.replace(/T.*/, '');
    }

    notify(issues) {
      const issueCount = issues.length;

      if (issueCount === 0) {
        return this;
      }

      this._mostRecentIssueKey = issues[0].issueKey;
      notifierScreen.setNotificationIcon(this._index);

      // Display the latest issue's summary only
      nodeNotifier.notify({
        title: `(${issueCount}) Backlog Notifier`,
        message: issues[0].summary,
        wait: true
      });

      nodeNotifier.removeAllListeners();

      nodeNotifier.once('click', () => {
        shell.openExternal(`https://${this._settings.spaceId}.backlog.jp/view/${this._mostRecentIssueKey}`);
        notifierScreen.setNormalIcon();
        nodeNotifier.removeAllListeners();
      });

      nodeNotifier.once('timeout', () => {
        nodeNotifier.removeAllListeners();
      });

      return this;
    }
  }

  class BacklogNotifierScreen {
    constructor() {
      this._notifiers = null;
      this._currentNotifierIndex = null;
      this._tray = null;
      this._contextMenu = null;
      this._mostRecentNotifierIndex = null;

      if (isMac) {
        this._iconFilePath = `${__dirname}/images/${blackIconFilename24}`;
        this._notificationIconFilePath = `${__dirname}/images/${blackIconFilename24Notification}`;
      } else {
        this._iconFilePath = `${__dirname}/images/${colorIconFilename24}`;
        this._notificationIconFilePath = `${__dirname}/images/${colorIconFilename24Notification}`;
      }
    }

    initNotifiers(notifiers) {
      this._notifiers = notifiers;
      this._currentNotifierIndex = Number(localStorage.getItem('lastDisplayedNotifierIndex'));

      const notifier = this._notifiers[this._currentNotifierIndex];
      notifier.displaySettings();

      return this;
    }

    initMenu() {
      const appMenu = Menu.buildFromTemplate([
        {
          label: 'Edit',
          submenu: [
            {role: 'undo'},
            {role: 'redo'},
            {role: 'cut'},
            {role: 'copy'},
            {role: 'paste'},
            {role: 'selectall'}
          ]
        }
      ]);

      let aboutMenuItem;
      if (isMac) {
        aboutMenuItem = {role: 'about'};
      } else {
        aboutMenuItem = {
          label: `About ${appName}`,
          click: () => {
            dialog.showMessageBox({
              title: `About ${appName}`,
              message: `${appName} ${app.getVersion()}`,
              detail: appCopyright,
              icon: appIconFilePath,
              buttons: []
            });
          }
        };
      }

      this._contextMenu = Menu.buildFromTemplate([
        {
          label: 'Open Most Recent Issue in Browser',
          click: () => {
            const notifier = this._notifiers[this._mostRecentNotifierIndex];
            shell.openExternal(`https://${notifier._settings.spaceId}.backlog.jp/view/${notifier._mostRecentIssueKey}`);
            notifierScreen.setNormalIcon();
          },
          enabled: false
        },
        {
          label: 'Preferences',
          click: () => {
            remote.getCurrentWindow().show();
          }
        },
        {
          type: 'separator'
        },
        aboutMenuItem,
        {
          type: 'separator'
        },
        {
          label: 'Quit',
          click: () => {
            const notifier = this._notifiers[this._currentNotifierIndex];
            if (!notifier._newFlag) {
              this.updateLastDisplayedNotifierIndex();
            }

            remote.app.quit();
          }
        }
      ]);

      Menu.setApplicationMenu(appMenu);

      this._tray = new Tray(this._iconFilePath);
      this._tray.setContextMenu(this._contextMenu);

      return this;
    }

    initEventListener() {
      document.getElementById('save-button').addEventListener('click', () => {
        const notifier = this._notifiers[this._currentNotifierIndex];
        notifier.readScreenSettings();

        if (notifier.validateSettings()) {
          notifier.initFetch()
            .updateSettings();
          this.updateNotifierCount();

          if (notifier._newFlag) {
            this.updateLastDisplayedNotifierIndex();
            notifier.setNewFlag(false);
          }

          notie.alert({
            type: 'success',
            text: 'Settings have been saved.',
            time: notieDisplaySec
          });
        } else {
          notifier.readStoredSettings();
        }
      });

      document.getElementById('close-button').addEventListener('click', () => {
        const notifier = this._notifiers[this._currentNotifierIndex];
        notifier.readStoredSettings()
          .displaySettings();
        remote.getCurrentWindow().hide();
      });

      document.getElementById('test-connection-button').addEventListener('click', () => {
        const notifier = this._notifiers[this._currentNotifierIndex];
        notifier.testConnection();
      });

      document.getElementById('new-setting-button').addEventListener('click', () => {
        const lastNotifier = this._notifiers[this._notifiers.length - 1];
        if (lastNotifier._settings.spaceId === null) {
          return;
        }

        this._currentNotifierIndex = this._notifiers.length;
        this.addNotifier(this._currentNotifierIndex)
          .displaySettings();
      });

      document.getElementById('other-settings-button').addEventListener('click', () => {
        this.openSettingMenu();

        if (this._notifiers.length === 0) {
          this.addNotifier(0);
        }
      });

      document.getElementById('delete-button').addEventListener('click', () => {
        notie.confirm({
          text: 'Are you sure you want to delete this setting?',
          cancelText: 'No',
          submitCallback: () => {
            this.deleteCurrentNotifierSettings()
              .resetAllSettings()
              .updateNotifierCount()
              .displaySettingsAfterDelete();

            notie.alert({
              type: 'success',
              text: 'Settings have been deleted.',
              time: notieDisplaySec
            });
          }
        });
      });

      return this;
    }

    displayDefaultSettings() {
      document.getElementById('default-fetch-interval-sec').innerHTML = defaultFetchIntervalSec;
      return this;
    }

    updateNotifierCount() {
      localStorage.setItem('notifierCount', this._notifiers.length);
      return this;
    }

    updateLastDisplayedNotifierIndex() {
      localStorage.setItem('lastDisplayedNotifierIndex', this._currentNotifierIndex);
      return this;
    }

    addNotifier(index) {
      const notifier = new BacklogNotifier(index);
      notifier.updateLastExecutionTime()
        .readStoredSettings()
        .setNewFlag(true);
      this._notifiers.push(notifier);
      return notifier;
    }

    selectValidNotifiers() {
      return this._notifiers.filter(notifier => {
        return notifier._settings.spaceId !== null;
      });
    }

    openSettingMenu() {
      const choices = [];

      const notifiers = this.selectValidNotifiers();
      notifiers.forEach((notifier, index) => {
        choices.push({
          text: notifier.getStoredSetting('spaceId'),
          handler: () => {
            this._currentNotifierIndex = index;
            this.updateLastDisplayedNotifierIndex();
            notifier.readStoredSettings()
              .displaySettings();

            this._notifiers = this.selectValidNotifiers();
          }
        });
      });

      notie.select({
        text: 'Stored Space IDs',
        choices
      });

      this.wrapSettingMenuItems();

      return this;
    }

    wrapSettingMenuItems() {
      const selectContainer = document.createElement('div');
      selectContainer.className = 'notie-select-container';

      const selectChoices = Array.prototype.slice.call(document.getElementsByClassName('notie-select-choice'));
      const notieContainer = selectChoices[0].parentNode;

      selectChoices.forEach(choice => {
        selectContainer.appendChild(choice);
      });

      const cancelButton = notieContainer.getElementsByClassName('notie-background-neutral notie-button')[0];
      notieContainer.insertBefore(selectContainer, cancelButton);

      return this;
    }

    deleteCurrentNotifierSettings() {
      const notifier = this._notifiers[this._currentNotifierIndex];
      notifier.deleteStoredSettings()
        .readStoredSettings();
      return this;
    }

    resetAllSettings() {
      this._notifiers = this.selectValidNotifiers();

      localStorage.clear();

      this._notifiers.forEach((notifier, index) => {
        notifier._index = index;
        notifier.updateSettings();
      });

      return this;
    }

    displaySettingsAfterDelete() {
      if (this._notifiers.length === 0) {
        // Display the first settings
        this._currentNotifierIndex = 0;
        this.addNotifier(this._currentNotifierIndex);
      } else if (this._notifiers[this._currentNotifierIndex] === undefined) {
        // Display the previous settings
        this._currentNotifierIndex = this._currentNotifierIndex - 1;
      }

      const notifier = this._notifiers[this._currentNotifierIndex];
      notifier.displaySettings();

      return this;
    }

    setNormalIcon() {
      this._tray.setImage(this._iconFilePath);
      this._contextMenu.items[0].enabled = false;
      this._mostRecentNotifierIndex = null;
      return this;
    }

    setNotificationIcon(index) {
      this._tray.setImage(this._notificationIconFilePath);
      this._contextMenu.items[0].enabled = true;
      this._mostRecentNotifierIndex = index;
      return this;
    }
  }

  window.addEventListener('load', () => {
    notie.setOptions({
      classes: {
        selectChoice: 'notie-select-choice'
      }
    });

    const notifiers = [];
    const notifierCount = Number(localStorage.getItem('notifierCount'));

    for (let i = 0; i < notifierCount; i++) {
      const notifier = new BacklogNotifier(i);
      notifier.updateLastExecutionTime()
        .readStoredSettings();

      if (notifier.validateSettings()) {
        notifier.initFetch();
      }

      notifiers.push(notifier);
    }

    if (notifiers.length === 0) {
      const notifier = new BacklogNotifier(0);
      notifier.updateLastExecutionTime()
        .readStoredSettings();
      notifiers.push(notifier);
    }

    notifierScreen = new BacklogNotifierScreen();
    notifierScreen.initNotifiers(notifiers)
      .initMenu()
      .initEventListener()
      .displayDefaultSettings();
  });
})();

