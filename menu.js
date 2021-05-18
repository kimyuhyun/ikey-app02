var menu = [{
        "title": "회원관리",
        "child": [{
                "title": "권한관리",
                "link": "/admin/page/grade"
            },
            {
                "title": "관리자",
                "link": "/admin/page/manager"
            },
            {
                "title": "의사회원",
                "link": "/admin/page/doctor"
            },
            {
                "title": "회원",
                "link": "/admin/page/user"
            },
            {
                "title": "의사 심사대기",
                "link": "/admin/page/doctor_wait"
            },
        ]
    },
    {
        "title": "게시판",
        "child": [
            {
                "title": "공지사항",
                "link": "/admin/page/notice"
            },
            {
                "title": "이벤트",
                "link": "/admin/page/event"
            },
            {
                "title": "1:1문의",
                "link": "/admin/page/counsel"
            },
            {
                "title": "자주묻는질문",
                "link": "/admin/page/faq"
            },
            {
                "title": "신고게시판",
                "link": "/admin/page/singo"
            },
        ]
    },
    {
        "title": "통계",
        "child": [{
                "title": "전체방문자",
                "link": "/analyzer/graph1"
            },
            {
                "title": "트래픽수",
                "link": "/analyzer/graph2"
            },
            {
                "title": "시간대별",
                "link": "/analyzer/graph3"
            },
            {
                "title": "현재접속자",
                "link": "/analyzer/liveuser"
            }
        ]
    }
];

module.exports = menu;
