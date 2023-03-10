var host = 'localhost';

// Documents
const title = document.querySelector('#title');
const sendBtn = document.querySelector('#sendBtn');
const message = document.querySelector('#chatInput')
const chatPanel = document.querySelector('#chatPanel');

// message log list
var msglist = [];
var callLogList = []
var maxMsgItems = 10;
var index=0;

for (let i=0;i<maxMsgItems;i++) {
    msglist.push(document.getElementById('msgLog'+i));

    // add listener        
    (function(index) {
        msglist[index].addEventListener("click", function() {
            if(msglist.length < maxMsgItems) i = index;
            else i = index + maxMsgItems;

            console.log('click! index: '+index);
        })
    })(i);
}

calleeName.textContent = "Lex";  
calleeId.textContent = "@amazon.com";

index = 0;

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
        addSentMessage(message.value);
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
    index++;

    callLogList[index] = `<div class="chat-sender chat-sender--right"><h1>${timestr}</h1>${text}&nbsp;<h2 id="status${index}"></h2></div>`;

    if(index < maxMsgItems)
        msglist[index].innerHTML = callLogList[index];
    else 
        updateChatWindow();

    chatPanel.scrollTop = chatPanel.scrollHeight;  // scroll needs to move bottom

    sendRequest(text);        
}       

function addReceivedMessage(msg) {
    // console.log("add received message: "+msg);
    let sender = "Lex"
    var date = new Date();
    var timestr = date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();
    index++;

    callLogList[index] = `<div class="chat-receiver chat-receiver--left"><h1>${sender}</h1>${msg}&nbsp;</div>`;

    if(index < maxMsgItems)
        msglist[index].innerHTML = callLogList[index];
    else 
        updateChatWindow();

    chatPanel.scrollTop = chatPanel.scrollHeight;  // scroll needs to move bottom
}

function addNotifyMessage(msg) {
    index++;

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
    const uri = "https://d3ndv6lhze8yc5.cloudfront.net/chat";
    const xhr = new XMLHttpRequest();

    xhr.open("POST", uri, true);
    xhr.onreadystatechange = () => {
        if (xhr.readyState === 4 && xhr.status === 200) {
            let response = JSON.parse(xhr.responseText);
            console.log("response: " + JSON.stringify(response));
            
            if(response.statusCode == 200)
                addReceivedMessage(response.msg);
        }
    };

    var requestObj = {"text":text};
    console.log("request: " + JSON.stringify(requestObj));

    var blob = new Blob([JSON.stringify(requestObj)], {type: 'application/json'});

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