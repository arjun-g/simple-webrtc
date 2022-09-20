(async ()  => {
    async function initMedia(){
        const mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        const videoEle =  document.createElement('video');
        videoEle.setAttribute('autoplay', true);
        videoEle.setAttribute('playsinline', true);
        videoEle.setAttribute('id', 'self');
        videoEle.muted = true;
        videoEle.srcObject = mediaStream;

        const confContainer = document.querySelector(".conf");
        confContainer.appendChild(videoEle);

        return mediaStream
    }

    async function addStream(stream, id){
        const videoEle =  document.createElement('video');
        videoEle.setAttribute('autoplay', true);
        videoEle.setAttribute('playsinline', true);
        videoEle.setAttribute('id', id);
        videoEle.muted = true;
        videoEle.srcObject = stream;

        const confContainer = document.querySelector(".conf");
        confContainer.appendChild(videoEle);
    }

    function initPeer(id){
        const peerConnection = new RTCPeerConnection({
            iceServers: [
                {
                    'urls': 'stun:stun.l.google.com:19302'
                }
            ]
        });
        peerConnection.onicecandidate = event => {
            if(event.candidate){
                const {
                    sdpMLineIndex,
                    candidate,
                    sdpMid
                } = event.candidate;
                socket.emit('candidate', { type: 'candidate', sdpMLineIndex, sdpMid, candidate });
            }
        }
        peerConnection.onaddstream = event => {
            console.log("ADD STREAM", event);
            addStream(event.stream, id);
        }
        peerConnection.onremovestream = event => {
            console.log("REMOVE STREAM", event);
        }
        return peerConnection;
    }

    function sendMessage(message){
        console.log("SENDING", message);
        socket.emit('message', message);
    }

    /** @type {MediaStream} */
    let mediaStream = await initMedia();

    let peerConnections = {};

    console.log("MEDIA ###############################");

    const socket = io({ transports: ["websocket"] });

    console.log("SOCK", socket);
    
    socket.on('joined room', async id => {
        console.log("JOINED ROOM");
        const peerConnection = peerConnections[id] = initPeer(id);
        peerConnection.addStream(mediaStream);
        const desc = await peerConnection.createOffer();
        peerConnection.setLocalDescription(desc);
        const { type, sdp } = desc;
        socket.emit('offer', { toId: id, fromId: socket.id, type, sdp }, answer => {
            console.log("ANS", answer);
            peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        });
        socket.on('candidate', candidate => {
            peerConnection && peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        });
    });

    socket.on('offer', async offer => {
        const peerConnection = peerConnections[offer.fromId]= initPeer(offer.fromId);
        peerConnection.addStream(mediaStream);
        peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const desc = await peerConnection.createAnswer();
        peerConnection.setLocalDescription(desc);
        const { type, sdp } = desc;
        socket.emit('answer', { toId: offer.fromId, fromId: offer.toId, type, sdp });
        socket.on('candidate', candidate => {
            peerConnection && peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        });
    });

    socket.on('left room', id => {
        console.log('ID', id, peerConnections[id]);
        peerConnections[id].close();
        delete peerConnections[id];
        document.getElementById(id).remove();
    });

})();