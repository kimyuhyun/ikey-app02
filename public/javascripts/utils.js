function util_convert_to_millis(time) {
	var time = new Date(time).getTime() / 1000;
	var currentTime = Math.floor(new Date().getTime()/1000);
	var inputTime = time;
	var diffTime = currentTime - inputTime;
	var postTime;
	switch(true) {
		case diffTime < 60 :
			postTime = '방금';
			break;
		case diffTime < 3600 :
			postTime = parseInt(diffTime / 60) + '분 전';
			break;
		case diffTime < 86400 :
			postTime = parseInt(diffTime / 3600) + '시간 전';
			break;
		case diffTime < 604800 :
			postTime = parseInt(diffTime / 86400) + '일 전';
			break;
		case diffTime > 604800 :
			var date = new Date(time*1000);
			var month = eval(date.getMonth()+1);
			var day = date.getDate();

			if (eval(date.getMonth()+1) < 10) {
				month = "0" + eval(date.getMonth()+1);
			}

			if (date.getDate() < 10) {
				day = "0" + date.getDate()
			}

			postTime = date.getFullYear() + "-" + month + "-" + day;
			break;
		default: postTime = time;
	}
	return postTime;
}

function util_convert_to_hangle(time) {
	var time = new Date(time).getTime() / 1000;
	var currentTime = new Date().getTime() / 1000;
	var inputTime = time;
	var diffTime = currentTime - inputTime;
	var postTime;

	var date = new Date(time*1000);
	postTime = eval(date.getMonth()+1) + "월" + date.getDate() + "일";

	return postTime;
}
