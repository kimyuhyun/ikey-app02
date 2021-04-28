var menu = [{
        "title": "회원관리",
        "child": [{
                "title": "권한 관리",
                "link": "/admin/page/grade"
            },
            {
                "title": "관리자 관리",
                "link": "/admin/page/manager"
            },
            {
                "title": "회원 관리",
                "link": "/admin/page/user"
            }
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
                "title": "고객센터",
                "link": "/admin/page/cscenter"
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
