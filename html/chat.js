var host = 'localhost';

// Documents
const title = document.querySelector('#title');
const sendBtn = document.querySelector('#sendBtn');
const message = document.querySelector('#chatInput')
const chatPanel = document.querySelector('#chatPanel');

// message log list
let msglist = [];
let callLogList = []
let maxMsgItems = 10;
let index=0;
let msgIdList = [];
let isFailed = [];

for (let i=0;i<maxMsgItems;i++) {
    msglist.push(document.getElementById('msgLog'+i));
    isFailed[i] = false;

    // add listener        
    (function(i) {
        msglist[i].addEventListener("click", function() {
            console.log('click! index: '+i);

            if(isFailed[i]) {
                let msgId = msgIdList[i];
                console.log('retry the failed request: ', msgId);
                retryRequest(msgId, i);
            }
        })
    })(i);
}

calleeName.textContent = "Lex";  
calleeId.textContent = "@amazon.com";

addNotifyMessage("start the interractive chat");

// Listeners
message.addEventListener('keyup', function(e){
    if (e.keyCode == 13) {
        onSend(e);
    }
});

refreshChatWindow.addEventListener('click', function(){
    console.log('update chat window');
    updateChatWindow();
});

sendBtn.addEventListener('click', onSend);
function onSend(e) {
    e.preventDefault();
    
    if(message.value != '') {
        console.log("msg: ", message.value);

        index++;    
        addSentMessage(message.value);         
        
        let msgId = uuidv4();
        msgIdList[index] = msgId;
        console.log('msgIdList['+index+']: '+msgId);
    }
    else {
        console.log("msg: ", "empty!");
    }    
    message.value = "";
}

(function() {
    window.addEventListener("focus", function() {
        console.log("Back to front");        

        updateChatWindow();
    })
})();

function addSentMessage(text) {
    console.log("sent message: "+text);

    var date = new Date();
    var timestr = date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();
    
    callLogList[index] = `<div class="chat-sender chat-sender--right"><h1>${timestr}</h1>${text}&nbsp;<h2 id="status${index}"></h2></div>`;    

    if(index < maxMsgItems) {
        msglist[index].innerHTML = callLogList[index];
    }
    else { 
        updateChatWindow();
    }

    chatPanel.scrollTop = chatPanel.scrollHeight;  // scroll needs to move bottom

    sendRequest(text);        
}       

function addReceivedMessage(msg) {
    // console.log("add received message: "+msg);
    let sender = "Lex"
    var date = new Date();
    var timestr = date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();
            
    callLogList[index] = `<div class="chat-receiver chat-receiver--left"><h1>${sender}</h1>${msg}&nbsp;</div>`;    
    
    if(index < maxMsgItems) {
        msglist[index].innerHTML = callLogList[index];
    }
    else {
        updateChatWindow();
    }

    chatPanel.scrollTop = chatPanel.scrollHeight;  // scroll needs to move bottom
}

function addNotifyMessage(msg) {    
    callLogList[index] = `<div class="notification-text">${msg}</div>`;         

    if(index < maxMsgItems)
        msglist[index].innerHTML = callLogList[index];
    else 
        updateChatWindow();        
}

refreshChatWindow.addEventListener('click', function(){
    console.log('update chat window');
    
    updateChatWindow();
});

attachFile.addEventListener('click', function(){
    console.log('click: attachFile');
    // var input = $(document.createElement('input')); 
    // input.attr("type", "file");
    // input.trigger('click');
    // return false;
});

function sendRequest(text) {
    const uri = "/chat";
    const xhr = new XMLHttpRequest();
    const msgId = uuidv4();
    console.log("msgId: " + msgId);    

    xhr.open("POST", uri, true);
    xhr.onreadystatechange = () => {
        if (xhr.readyState === 4 && xhr.status === 200) {
            let response = JSON.parse(xhr.responseText);
            console.log("msgId: " + msgId);
            console.log("response: " + JSON.stringify(response));

            if(response.statusCode == 200 && response.msg) {
                index++;
                console.log("index: " + index);
                addReceivedMessage(response.msg);

                msgIdList[index] = msgId;
                console.log('msgIdList['+index+']: '+msgId);
                isFailed[index] = false;
            }
        }
        else if(xhr.status ===  504) {
            console.log("Retry! msgId: " + msgId);
            msgIdList[index] = msgId;
            console.log('msgIdList['+index+']: '+msgId);
            isFailed[index] = true;

            if(msgIdList[index] != msgId) {
                index++;
                console.log("index: " + index);
                addReceivedMessage("메시지 수신에 실패하였습니다. 말풍선을 다시 클릭하여 재시도하세요.");             
    
                
            }            
        }
    };

    let requestObj = {
        "msgId": msgId,
        "text":text
    };
    console.log("request: " + JSON.stringify(requestObj));

    let blob = new Blob([JSON.stringify(requestObj)], {type: 'application/json'});

    xhr.send(blob);
}

function retryRequest(msgId, indexNum) {
    const uri = "/query";  // query the request from dynamodb based on msgId
    const xhr = new XMLHttpRequest();
    console.log("msgId: " + msgId);

    xhr.open("POST", uri, true);
    xhr.onreadystatechange = () => {
        console.log("xhr.status: ", xhr.status);

        if (xhr.readyState === 4 && xhr.status === 200) {
            let response = JSON.parse(xhr.responseText);
            console.log("response: " + JSON.stringify(response));
            
            if(response.statusCode == 200 && response.body) {
                let sender = "Lex";
                let msg = response.body;

                callLogList[indexNum] = `<div class="chat-receiver chat-receiver--left"><h1>${sender}</h1>${msg}&nbsp;</div>`;

                updateChatWindow();

                isFailed[indexNum] = false;
            }
        }
    };

    let requestObj = {
        "msgId": msgId,
    };
    console.log("request: " + JSON.stringify(requestObj));

    let blob = new Blob([JSON.stringify(requestObj)], {type: 'application/json'});

    xhr.send(blob);
}

function updateChatWindow() {
    // clear chat window
    for (i=0;i<maxMsgItems;i++) {
        msglist[i].innerHTML = '';
    }

    // update
    if(index < maxMsgItems) {
        for(i=0;i<=index;i++) {
            msglist[i].innerHTML = callLogList[i];
        }        
    }
    else {        
        for(i=0;i<maxMsgItems;i++) {
            msglist[i].innerHTML = callLogList[i+(index-maxMsgItems+1)];
        }    
    }
    
    chatPanel.scrollTop = chatPanel.scrollHeight;  // scroll needs to move bottom
}

function uuidv4() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}