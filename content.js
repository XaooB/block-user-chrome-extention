const config = {
    messages: {
        userMarkedAsBlocked: 'Użytkownik został dodany do listy.',
        userBlocked: 'Użytkownik znajduje się na liście zablokowanych.'
    },
    userType: {
        blocked: 'BLOCKED',
        unblocked: 'UNBLOCKED',
    },
    labels: {
        block: 'Zablokuj',
        unblock: 'Odblokuj',
        showBlockedText: 'Pokaż komentarz'
    },
    selectors: {
        userName: '.user-comment__name',
        loggedUserName: '.signed-user-name',
        commentHolder: '.comments-list .user-comment',
        commentText: '.comment-text',
        commentAction: '.comments-action',
        commentsBlocked: `[data-user-type="BLOCKED"]`,
        customBlockButton: '.unblock-user'
    }
}

//init app
initApp();

function initApp() {
    var script = document.createElement('script');
    script.src = chrome.extension.getURL('injected.js');
    script.onload = function () {
        this.remove();
    };

    (document.head || document.documentElement).appendChild(script);

    chrome.runtime.onMessage.addListener(function (message, sender) {
        let commentsNodes = document.querySelectorAll(config.selectors.commentHolder);
        let blockedUsers = getBlockedUsers();

        if (message.interception) {
            hideComments(commentsNodes, blockedUsers);
        }

        if (message.reset) {
            localStorage.setItem('blockedUsers', '')
            let blockedComments = document.querySelectorAll(config.selectors.commentsBlocked);
            let blockedCommentsHolder = Array.from(blockedComments).map(function (el) {
                return el.closest(config.selectors.commentHolder)
            });
            let blockedUsers = getBlockedUsers();
            hideComments(blockedCommentsHolder, blockedUsers);
        }
    });
}

function deleteCommentNotice(originalNode) {
    let noticeNode = originalNode.querySelector('.comment-notice-message-copy'),
        comment = originalNode.querySelector(config.selectors.commentText);
    
    if (noticeNode) {
        comment.parentNode.removeChild(noticeNode);
    }
}

function createCommentNotice(originalNode) {
    let div = document.createElement('div');
    originalNode = originalNode.querySelector(config.selectors.commentText);

    originalNode.style.display = 'none';
    div.classList.add('comment-text', 'comment-notice-message-copy');
    div.setAttribute(
        "style",
        "color: #ff0033; font-style: italic; font-size: 13px; padding: 4px 0;"
    );
    
    div.innerText = config.messages.userBlocked;
    insertAfter(div, originalNode);
}

function insertAfter(newNode, refNode) {
    refNode.parentNode.insertBefore(newNode, refNode.nextSibling);
}

function resetComments(comments, unblockedUserName) {
    for (let i = 0; i < comments.length; i++) {
        let commentUserName = comments[i].querySelector(config.selectors.userName).textContent.trim(),
            commentContent = comments[i].querySelector(config.selectors.commentText),
            article = comments[i].closest('article')

        if (unblockedUserName === commentUserName) {
            commentContent.style.display = 'block';
            commentContent.dataset.userType = config.userType.unblocked;
            article.querySelector(config.selectors.customBlockButton).remove();
            createActionLink(config.labels.block, comments[i]);
        }
    }
}

function hideComments(comments, users, deletedComments = 0, userToBeBlocked = '') {
    let loggedUser = document.querySelector(config.selectors.loggedUserName);
    loggedUser = loggedUser ? loggedUser.textContent.trim() : '';

    for (let i = 0; i < comments.length; i++) {
        let commentUserName = comments[i].querySelector(config.selectors.userName).textContent.trim(),
            commentContent = comments[i].querySelector(config.selectors.commentText),
            article = comments[i].closest('article');

        if (commentUserName === loggedUser) {
            continue;
        }
        
        if (userToBeBlocked && userToBeBlocked === commentUserName) {
            commentContent.style.display = 'none';
            commentContent.dataset.userType = config.userType.blocked;
            article.querySelector(config.selectors.customBlockButton).remove();
            createActionLink(config.labels.unblock, comments[i]);
            continue;
        } else if (userToBeBlocked) {
            continue;
        }

        if (users.includes(commentUserName)) {
            let comment = comments[i].querySelector(config.selectors.commentText),
                oldComment = comment.textContent.trim();

            comment.dataset.userType = config.userType.blocked;
            createActionLink(config.labels.unblock, comments[i], oldComment);
            deletedComments++;
        } else {
            createActionLink(config.labels.block, comments[i]);
        }
    }
    //send number of deleted comments to the background
    if (deletedComments !== 0) {
        chrome.runtime.sendMessage({data: `${deletedComments}`});
    } else {
        chrome.runtime.sendMessage({data: ''});
    }
}

function createActionLink(nodeName, holder, oldComment = null) {
    let anchor = document.createElement('a'),
        userName = holder.querySelector(config.selectors.userName).textContent.trim(),
        userType = holder.querySelector(config.selectors.commentText).dataset.userType,
        originalNode = holder.querySelector('.user-comment__text');

    anchor.classList.add('unblock-user', 'link-naked', 'text-color_appblue', 'box-inline', 'shift-margin_2-right', 'user-actions');
    anchor.setAttribute('style', 'font-weight: bold;');
    anchor.textContent = nodeName;
    anchor.title = nodeName + ' użytkownika ' + userName;
    anchor.dataset.userName = userName;

    switch (userType) {
        case config.userType.blocked:
            anchor.onclick = unblockUser;
            createCommentNotice(originalNode);
            break;

        case config.userType.unblocked:
            anchor.onclick = blockUser;
            deleteCommentNotice(originalNode);
            break;

        default:
            anchor.onclick = blockUser;
            break;
    }
    
    if (oldComment) {
        anchor.dataset.hiddenContent = oldComment;
    }

    holder.querySelector(config.selectors.commentAction).append(anchor);
}

function unblockUser(event) {
    let element = event.target.closest('article'),
        comment = element.querySelector(config.selectors.commentText),
        blockedUsers = getBlockedUsers(),
        userName = element.querySelector(config.selectors.userName).textContent.trim(),
        indexToDelete = blockedUsers.indexOf(userName),
        comments = document.querySelectorAll(config.selectors.commentHolder);

    blockedUsers.splice(indexToDelete, 1);
    saveBlockedUsers(blockedUsers.join());
    
    comment.dataset.userType = config.userType.unblocked;
    comment.setAttribute('style', '');
    resetComments(comments, userName);
}

function blockUser(event) {
    let element = event.target.closest('article'),
        userName = element.querySelector(config.selectors.userName).textContent.trim(),
        blockedUsers = getBlockedUsers(),
        comments = document.querySelectorAll(config.selectors.commentHolder);

    blockedUsers.push(userName);
    let newList = [...new Set(blockedUsers)].join();
    saveBlockedUsers(newList);
    hideComments(comments, [], 0, userName)
}

function getBlockedUsers() {
    let userList = localStorage.getItem('blockedUsers');
    return userList ? userList.split(',') : [];
}

function saveBlockedUsers(users) {
    localStorage.setItem('blockedUsers', users);
}