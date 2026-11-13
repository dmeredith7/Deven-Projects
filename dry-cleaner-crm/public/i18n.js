'use strict';

// English / Korean interface text. English text is the key; KO holds the
// Korean for each key, with the same {placeholders}. The language choice is
// remembered in this browser. Customer data, service names and message
// templates are the shop's own words and are never translated.
(function (root) {
  const KO = {
    // Status & labels
    'Received': '접수됨',
    'Cleaning': '세탁 중',
    'Ready': '준비 완료',
    'Picked up': '픽업 완료',
    'Cancelled': '취소됨',
    '#{ticket} marked received': '#{ticket} 접수됨으로 변경',
    '#{ticket} marked cleaning': '#{ticket} 세탁 중으로 변경',
    '#{ticket} marked ready': '#{ticket} 준비 완료로 변경',
    '#{ticket} marked picked up': '#{ticket} 픽업 완료로 변경',
    '#{ticket} marked cancelled': '#{ticket} 취소됨으로 변경',
    'Start cleaning': '세탁 시작',
    'Mark ready': '준비 완료 처리',
    'Sent': '발송됨',
    'Not sent (not connected)': '미발송 (연결 안 됨)',
    'Failed': '실패',
    'Skipped': '건너뜀',
    'Reply': '답장',
    'ready notice': '준비 완료 알림',
    'reminder': '픽업 알림',
    'message': '메시지',
    'test': '테스트',
    'customer reply': '고객 답장',
    'Text': '문자',
    'Email': '이메일',
    'Due today': '오늘 마감',
    'Due tomorrow': '내일 마감',
    'Overdue · {date}': '기한 지남 · {date}',
    'Due {date}': '{date} 마감',
    'Due today & overdue': '오늘 마감 및 기한 지남',
    'Picked up {date}': '{date} 픽업 완료',
    'Rack {rack}': '랙 {rack}',
    '{amount} due': '{amount} 미결제',
    'Paid': '결제 완료',
    'Amount paid': '결제액',

    // Shell & navigation
    'Front counter': '카운터 관리',
    'New order': '새 주문',
    'New': '새 주문',
    'Dashboard': '대시보드',
    'Orders': '주문',
    'Customers': '고객',
    'Messages': '메시지',
    'Price list': '가격표',
    'Settings': '설정',
    'Log out': '로그아웃',
    'Open menu': '메뉴 열기',
    'Loading…': '불러오는 중…',
    'Close': '닫기',
    'Something went wrong': '문제가 발생했습니다',
    'Back to dashboard': '대시보드로 돌아가기',
    'Please log in': '로그인해 주세요',
    'Request failed ({status})': '요청 실패 ({status})',
    'Something went wrong ({status})': '문제가 발생했습니다 ({status})',

    // Toasts
    '{channel} sent': '{channel} 발송됨',
    '{channel} saved (not connected yet)': '{channel} 저장됨 (아직 연결 안 됨)',
    '{channel} failed': '{channel} 실패',
    '{channel} skipped': '{channel} 건너뜀',

    // Counts
    '{n} pc': '{n}벌',
    '{n} pcs': '{n}벌',
    '{n} piece': '{n}벌',
    '{n} pieces': '{n}벌',
    '{n} order': '주문 {n}건',
    '{n} orders': '주문 {n}건',
    '{n} order today': '오늘 주문 {n}건',
    '{n} orders today': '오늘 주문 {n}건',
    '{n} customer': '고객 {n}명',
    '{n} customers': '고객 {n}명',
    '{n} service': '서비스 {n}개',
    '{n} services': '서비스 {n}개',
    'Send {n} reminder': '알림 {n}건 보내기',
    'Send {n} reminders': '알림 {n}건 보내기',
    'Reminders sent for {n} order': '주문 {n}건에 알림을 보냈습니다',
    'Reminders sent for {n} orders': '주문 {n}건에 알림을 보냈습니다',
    '{n} active': '진행 중 {n}건',
    '{n} sent, last {date}': '{n}회 발송, 마지막 {date}',

    // Lists
    'No orders here': '주문이 없습니다',
    'New orders will show up in this list.': '새 주문이 이 목록에 표시됩니다.',
    'Ticket': '티켓',
    'Customer': '고객',
    'Status': '상태',
    'Due': '마감일',
    'Total': '합계',
    'No messages yet': '아직 메시지가 없습니다',
    'Texts and emails to this customer will appear here.': '이 고객에게 보낸 문자와 이메일이 여기에 표시됩니다.',

    // Dashboard
    'Good morning, {name}': '{name}님, 좋은 아침입니다',
    'Good afternoon, {name}': '{name}님, 좋은 오후입니다',
    'Good evening, {name}': '{name}님, 좋은 저녁입니다',
    'Find an order: ticket number, customer name or phone': '티켓 번호, 이름, 전화번호로 주문 찾기',
    'Waiting to clean': '세탁 대기',
    'Ready for pickup': '픽업 준비 완료',
    'Sales today': '오늘 매출',
    'You’re all caught up': '처리할 주문이 없습니다',
    'No orders are due today.': '오늘 마감인 주문이 없습니다.',
    'Waiting for pickup': '픽업 대기 중',
    'Reminders go out automatically': '알림은 자동으로 발송됩니다',
    'Nothing on the rack': '랙이 비어 있습니다',
    'Orders marked ready will show up here.': '준비 완료된 주문이 여기에 표시됩니다.',
    '{amount} in unpaid balances': '미결제 잔액 {amount}',

    // Orders
    'Active': '진행 중',
    'Waiting': '대기',
    'All': '전체',
    'Tap an order to see details, or move it along with one click.': '주문을 눌러 자세히 보거나, 한 번의 클릭으로 다음 단계로 넘기세요.',
    'Ticket, name, phone or rack': '티켓, 이름, 전화번호 또는 랙',
    'No matching orders': '일치하는 주문이 없습니다',
    'Nothing matches “{q}”. Try a ticket number or phone number.': '“{q}”와(과) 일치하는 결과가 없습니다. 티켓 번호나 전화번호로 검색해 보세요.',

    // New order
    'Pick the customer, tap what they dropped off, and create the ticket.': '고객을 선택하고, 맡긴 옷을 눌러 추가한 뒤 티켓을 만드세요.',
    'Items': '품목',
    'Tap to add · tap again for more': '눌러서 추가 · 다시 누르면 수량 추가',
    'Something else? e.g. Wedding gown': '기타 품목 (예: 웨딩드레스)',
    'Add': '추가',
    'Review ticket': '티켓 확인',
    'Ticket number': '티켓 번호',
    'From the paper ticket': '종이 티켓의 번호',
    'Due date': '마감일',
    'Rack / bin': '랙 / 보관함',
    'Optional': '선택 사항',
    'Discount': '할인',
    'Paid now': '선결제',
    'Notes': '메모',
    'Stains, damage, special instructions': '얼룩, 손상, 특별 요청 사항',
    'Create order': '주문 만들기',
    'No contact details': '연락처 없음',
    'Change': '변경',
    'Preferences:': '선호 사항:',
    'Search by name or phone': '이름 또는 전화번호로 검색',
    'New customer': '새 고객',
    'Add “{name}” as a new customer': '“{name}”을(를) 새 고객으로 추가',
    'Name': '이름',
    'Mobile phone': '휴대폰 번호',
    'Preferences': '선호 사항',
    'e.g. light starch, shirts on hangers': '예: 풀 약하게, 셔츠는 옷걸이에',
    'We’ll text and/or email them when their order is ready.': '주문이 준비되면 문자나 이메일로 알려 드립니다.',
    'Cancel': '취소',
    'Save customer': '고객 저장',
    'No services yet.': '아직 서비스가 없습니다.',
    'Add some to your price list.': '가격표에 추가하세요.',
    'No items yet': '아직 품목이 없습니다',
    'Tap a service to add it.': '서비스를 눌러 추가하세요.',
    'Fewer': '줄이기',
    'More': '늘리기',
    'Color, brand, stain…': '색상, 브랜드, 얼룩…',
    'Price each': '개당 가격',
    'Subtotal': '소계',
    'Tax ({rate}%)': '세금 ({rate}%)',
    'Balance due': '남은 금액',
    'Choose a customer first': '먼저 고객을 선택하세요',
    'Add at least one item': '품목을 하나 이상 추가하세요',
    'Enter the ticket number': '티켓 번호를 입력하세요',
    '#{ticket} is already on an active order for {name}.': '#{ticket}은(는) 이미 {name} 님의 진행 중인 주문에 사용 중입니다.',
    'Order #{ticket} created': '주문 #{ticket}이(가) 생성되었습니다',

    // Order detail
    'Order #{ticket}': '주문 #{ticket}',
    '{name} · dropped off {date}': '{name} · {date} 접수',
    'Print ticket': '티켓 인쇄',
    'This order was cancelled.': '취소된 주문입니다.',
    'Item': '품목',
    'Qty': '수량',
    'Each': '단가',
    'Balance': '잔액',
    'Take a payment': '결제 받기',
    'Record payment': '결제 기록',
    'Paid in full': '전액 결제 완료',
    'Adjust payment': '결제 조정',
    'Customer updates': '고객 알림',
    'Send “ready”': '“준비 완료” 보내기',
    'Send reminder': '알림 보내기',
    'No updates sent yet': '아직 보낸 알림이 없습니다',
    'The customer is notified automatically when you mark this order ready.': '이 주문을 준비 완료로 표시하면 고객에게 자동으로 알림이 갑니다.',
    'Use the buttons above to notify the customer.': '위 버튼을 눌러 고객에게 알리세요.',
    'View profile': '프로필 보기',
    'Details': '상세 정보',
    'e.g. A-12': '예: A-12',
    'Reminders': '알림',
    'Save details': '저장',
    'Change status': '상태 변경',
    'Update': '변경',
    'In: {date}': '접수: {date}',
    'Due: {date}': '마감: {date}',
    'Rack: {rack}': '랙: {rack}',
    'Cancel this order?': '이 주문을 취소할까요?',
    'Details saved': '저장되었습니다',
    'Payment recorded': '결제가 기록되었습니다',
    'Enter a negative amount to record a refund.': '환불은 음수 금액으로 입력하세요.',
    'Amount': '금액',
    'Save': '저장',

    // Customers
    'Everyone who has dropped off with you.': '세탁물을 맡긴 모든 고객입니다.',
    'Add customer': '고객 추가',
    'Search name, phone or email': '이름, 전화번호 또는 이메일 검색',
    'Phone': '전화번호',
    'Last visit {date}': '최근 방문 {date}',
    'No orders yet': '아직 주문이 없습니다',
    'No matching customers': '일치하는 고객이 없습니다',
    'Nothing matches “{q}”.': '“{q}”와(과) 일치하는 결과가 없습니다.',
    'No customers yet': '아직 고객이 없습니다',
    'Customers are added when you create their first order, or add one now.': '첫 주문을 만들 때 고객이 추가됩니다. 지금 바로 추가할 수도 있습니다.',
    'Edit customer': '고객 정보 수정',
    'e.g. no starch, boxed shirts': '예: 풀 없이, 셔츠는 박스 포장',
    'Text message updates': '문자 알림',
    'Order ready notices and pickup reminders by text': '주문 준비 완료 및 픽업 알림을 문자로 받기',
    'Email updates': '이메일 알림',
    'The same notices by email': '같은 알림을 이메일로 받기',
    'Delete': '삭제',
    'Save changes': '변경 사항 저장',
    'Customer saved': '고객 정보가 저장되었습니다',
    'Customer added': '고객이 추가되었습니다',
    'Delete {name}? This can’t be undone.': '{name} 고객을 삭제할까요? 되돌릴 수 없습니다.',
    'Customer deleted': '고객이 삭제되었습니다',
    'On': '켜짐',
    'Off': '꺼짐',
    'Edit': '수정',
    'Active orders': '진행 중인 주문',
    'Lifetime spend': '누적 결제액',
    'Customer since': '첫 방문일',
    'Create their first order': '첫 주문 만들기',
    'Profile': '프로필',
    'Texts': '문자',
    'No phone number': '전화번호 없음',
    'Emails': '이메일',
    'No email address': '이메일 주소 없음',
    'Send a message': '메시지 보내기',
    'Email subject': '이메일 제목',
    'Write a message to {name}…': '{name} 님에게 보낼 메시지를 입력하세요…',
    'Send': '보내기',
    'Choose text and/or email': '문자 또는 이메일을 선택하세요',

    // Price list
    'Changes save automatically. These appear as buttons when you create an order.': '변경 사항은 자동으로 저장되며, 주문을 만들 때 버튼으로 표시됩니다.',
    'Only the shop owner can change prices.': '가격은 대표만 변경할 수 있습니다.',
    'Add service': '서비스 추가',
    'Service name': '서비스 이름',
    'Price': '가격',
    'Show when creating orders': '주문 만들기에 표시',
    'Remove': '삭제',
    'Hidden': '숨김',
    'Your price list is empty': '가격표가 비어 있습니다',
    'Add the services you offer and their prices.': '제공하는 서비스와 가격을 추가하세요.',
    'Saved': '저장되었습니다',
    'Remove this service?': '이 서비스를 삭제할까요?',
    'Used on past orders, so it was hidden instead': '이전 주문에 사용되어 삭제 대신 숨겼습니다',
    'Removed': '삭제되었습니다',
    'e.g. Silk blouse': '예: 실크 블라우스',
    'Category': '분류',
    'Service added': '서비스가 추가되었습니다',

    // Messages
    'texts and emails': '문자와 이메일',
    'texts': '문자',
    'emails': '이메일',
    'Every text and email sent to customers, and their replies.': '고객에게 보낸 모든 문자와 이메일, 그리고 고객의 답장입니다.',
    'Sending {what} isn’t connected yet, so those messages are saved here but not delivered.': '{what} 발송이 아직 연결되지 않아 메시지가 여기에 저장만 되고 전달되지는 않습니다.',
    'See notification settings.': '알림 설정 보기',
    'Replies': '답장',
    'Messages appear here when you mark orders ready or send reminders.': '주문을 준비 완료로 표시하거나 알림을 보내면 메시지가 여기에 표시됩니다.',

    // Settings
    'Business': '매장 정보',
    'Notifications': '알림',
    'Message wording': '메시지 문구',
    'Team': '팀',
    'My account': '내 계정',
    'Connected via {provider}': '{provider}(으)로 연결됨',
    'Business details': '매장 정보',
    'Shown on tickets, texts and emails': '티켓, 문자, 이메일에 표시됩니다',
    'Business name': '매장 이름',
    'Customer email replies go here': '고객의 이메일 답장이 이 주소로 옵니다',
    'Address': '주소',
    'Sales tax (%)': '판매세 (%)',
    'Usual turnaround (days)': '기본 처리 기간 (일)',
    'Sets the default due date on new orders': '새 주문의 기본 마감일이 됩니다',
    'Ticket numbers': '티켓 번호',
    'Use my paper ticket numbers': '종이 티켓 번호 사용',
    'Number orders automatically': '자동으로 번호 매기기',
    'With paper tickets, staff type the number when writing up an order': '종이 티켓을 쓰면 주문을 받을 때 직원이 번호를 입력합니다',
    'Connections': '연결',
    'Text messages': '문자 메시지',
    'Not connected yet. Texts are saved in Messages but not delivered.': '아직 연결되지 않았습니다. 문자는 메시지에 저장만 되고 전달되지 않습니다.',
    'Not connected yet. Emails are saved in Messages but not delivered.': '아직 연결되지 않았습니다. 이메일은 메시지에 저장만 되고 전달되지 않습니다.',
    'When to notify customers': '고객 알림 시점',
    'Notify customers when their order is ready': '주문이 준비되면 고객에게 알림',
    'Sent the moment you mark an order Ready': '주문을 준비 완료로 표시하는 즉시 발송됩니다',
    'Send text messages': '문자 보내기',
    'To customers with a mobile number': '휴대폰 번호가 있는 고객에게',
    'Send emails': '이메일 보내기',
    'To customers with an email address': '이메일 주소가 있는 고객에게',
    'First pickup reminder after': '첫 픽업 알림 시점',
    'Days after the order is ready': '준비 완료 후 경과 일수',
    'Then remind every': '이후 알림 간격',
    'Days between reminders': '알림 사이 일수',
    'Stop after': '최대 알림 횟수',
    'Reminders per order (0 turns them off)': '주문당 알림 횟수 (0이면 사용 안 함)',
    'Send yourself a test': '테스트 발송',
    'Your mobile number': '내 휴대폰 번호',
    'Send test text': '테스트 문자 보내기',
    'Your email address': '내 이메일 주소',
    'Send test email': '테스트 이메일 보내기',
    'Use these to fill in details automatically:': '아래 항목을 넣으면 자동으로 채워집니다:',
    'Text — order ready': '문자 — 주문 준비 완료',
    'Text — pickup reminder': '문자 — 픽업 알림',
    'Texts end with “Reply STOP to opt out.” automatically.': '문자 끝에는 “Reply STOP to opt out.”(수신 거부 안내)이 자동으로 붙습니다.',
    'Email subject — order ready': '이메일 제목 — 주문 준비 완료',
    'Email subject — pickup reminder': '이메일 제목 — 픽업 알림',
    'Email — order ready': '이메일 — 주문 준비 완료',
    'Email — pickup reminder': '이메일 — 픽업 알림',
    'Add person': '직원 추가',
    '(you)': '(나)',
    'Owner': '대표',
    'Staff': '직원',
    'Remove {name}': '{name} 삭제',
    'Staff can manage orders and customers. Owners can also change settings, prices and the team.': '직원은 주문과 고객을 관리할 수 있고, 대표는 설정, 가격, 팀도 변경할 수 있습니다.',
    'Change your password': '비밀번호 변경',
    'Current password': '현재 비밀번호',
    'New password': '새 비밀번호',
    'At least 8 characters': '8자 이상',
    'Update password': '비밀번호 변경',
    'Only the shop owner can change shop settings.': '매장 설정은 대표만 변경할 수 있습니다.',
    'Settings saved': '설정이 저장되었습니다',
    'Add a team member': '팀원 추가',
    'Temporary password': '임시 비밀번호',
    'Share it with them. They can change it under My account.': '팀원에게 알려 주세요. 내 계정에서 변경할 수 있습니다.',
    'Role': '역할',
    'Staff — orders and customers': '직원 — 주문 및 고객 관리',
    'Owner — everything': '대표 — 모든 권한',
    'Team member added': '팀원이 추가되었습니다',
    'Remove this person? They will be logged out.': '이 팀원을 삭제할까요? 바로 로그아웃됩니다.',
    'Password updated': '비밀번호가 변경되었습니다',

    // Login page
    'Log in · Dry Cleaner CRM': '로그인 · Dry Cleaner CRM',
    'Keep your tickets. Lose the “is it ready yet?” calls.': '쓰던 티켓은 그대로, “다 됐나요?” 전화는 이제 그만.',
    'Works with the paper tickets you already use': '지금 쓰는 종이 티켓을 그대로 사용',
    'Write up orders in seconds from your price list': '가격표에서 몇 초 만에 주문 접수',
    'Customers get a text or email the moment it’s ready': '준비되는 즉시 고객에게 문자나 이메일 발송',
    'Automatic reminders for clothes left on the rack': '찾아가지 않은 옷은 자동으로 알림',
    'Every customer’s history and preferences in one place': '모든 고객의 이력과 선호 사항을 한곳에서',
    'Made for independent dry cleaners.': '동네 세탁소를 위해 만들었습니다.',
    'Welcome back': '다시 오신 것을 환영합니다',
    'Log in to your shop.': '매장 계정으로 로그인하세요.',
    'Password': '비밀번호',
    'Log in': '로그인',
    'Forgot password?': '비밀번호를 잊으셨나요?',
    'Create an account': '계정 만들기',
    'Set up your shop': '매장 등록',
    'Takes about a minute. You can change everything later.': '1분이면 됩니다. 모든 정보는 나중에 바꿀 수 있습니다.',
    'e.g. Sparkle Dry Cleaners': '예: 반짝 세탁소',
    'Your name': '이름',
    'How do you number tickets?': '티켓 번호는 어떻게 관리하시나요?',
    'I use pre-numbered paper tickets': '번호가 인쇄된 종이 티켓을 사용합니다',
    'Type the number from the ticket when you write up an order': '주문을 받을 때 티켓의 번호를 입력합니다',
    'Number them for me': '자동으로 번호 매기기',
    'Orders are numbered automatically, starting at 1001': '주문 번호가 1001번부터 자동으로 매겨집니다',
    'Create account': '계정 만들기',
    'Already have an account?': '이미 계정이 있으신가요?',
    'Reset your password': '비밀번호 재설정',
    'We’ll email you a link to choose a new one.': '새 비밀번호를 설정할 수 있는 링크를 이메일로 보내 드립니다.',
    'If there’s an account for that email, a reset link is on its way. Check your inbox.': '해당 이메일로 가입된 계정이 있으면 재설정 링크를 보냈습니다. 받은편지함을 확인하세요.',
    'Send reset link': '재설정 링크 보내기',
    'Back to log in': '로그인으로 돌아가기',
    'Choose a new password': '새 비밀번호 설정',
    'You’ll be logged in right after.': '설정 후 바로 로그인됩니다.',
    'Save password': '비밀번호 저장',

    // Messages from the server
    'A valid email address is required': '올바른 이메일 주소를 입력하세요',
    'An account with that email already exists. Try logging in.': '이미 가입된 이메일입니다. 로그인해 보세요.',
    'An order needs at least one item': '주문에는 품목이 하나 이상 있어야 합니다',
    'Business email looks invalid': '매장 이메일 주소가 올바르지 않습니다',
    'Business name is required': '매장 이름을 입력하세요',
    'Current password is incorrect': '현재 비밀번호가 올바르지 않습니다',
    'Customer has orders and cannot be deleted': '주문이 있는 고객은 삭제할 수 없습니다',
    'Customer name is required': '고객 이름을 입력하세요',
    'Each item needs a description or service': '각 품목에 서비스나 설명이 필요합니다',
    'Email address looks invalid': '이메일 주소가 올바르지 않습니다',
    'Enter a valid email address': '올바른 이메일 주소를 입력하세요',
    'Enter a valid phone number': '올바른 전화번호를 입력하세요',
    'Enter the number from the paper ticket': '종이 티켓의 번호를 입력하세요',
    'Incorrect email or password': '이메일 또는 비밀번호가 올바르지 않습니다',
    'Invalid item price': '품목 가격이 올바르지 않습니다',
    'Invalid price': '가격이 올바르지 않습니다',
    'Message body is required': '메시지 내용을 입력하세요',
    'Name is required': '이름을 입력하세요',
    'Not found': '찾을 수 없습니다',
    'Only the shop owner can do that': '대표만 할 수 있는 작업입니다',
    'Order not found': '주문을 찾을 수 없습니다',
    'Customer not found': '고객을 찾을 수 없습니다',
    'Service not found': '서비스를 찾을 수 없습니다',
    'User not found': '사용자를 찾을 수 없습니다',
    'Password is too long': '비밀번호가 너무 깁니다',
    'Password must be at least 8 characters': '비밀번호는 8자 이상이어야 합니다',
    'Service name is required': '서비스 이름을 입력하세요',
    'Sign-ups are closed': '현재 가입을 받지 않습니다',
    'That email is already in use': '이미 사용 중인 이메일입니다',
    'This reset link is invalid or has expired. Please request a new one.': '재설정 링크가 잘못되었거나 만료되었습니다. 새 링크를 요청하세요.',
    'Ticket numbers can use letters, numbers and dashes (up to 20 characters)': '티켓 번호에는 영문, 숫자, 하이픈(-)만 쓸 수 있습니다 (최대 20자)',
    'Too many attempts. Please wait a few minutes and try again.': '시도 횟수가 너무 많습니다. 몇 분 후 다시 시도하세요.',
    'Unknown service': '알 수 없는 서비스입니다',
    'Valid customer_id is required': '고객을 선택하세요',
    'Your name is required': '이름을 입력하세요',
    'amount_cents must be a non-zero number': '0이 아닌 금액을 입력하세요',
    'You can’t remove yourself': '본인은 삭제할 수 없습니다',
    'Cross-site request blocked': '허용되지 않은 요청입니다',
    'Internal server error': '서버 오류가 발생했습니다',
    'Invalid JSON': '잘못된 요청입니다',
    'Body too large': '요청이 너무 큽니다',
    // Why a message was not sent
    'No valid email address': '올바른 이메일 주소 없음',
    'Customer opted out of texts': '고객이 문자 수신을 거부함',
    'Customer unsubscribed from email': '고객이 이메일 수신을 거부함',
    'Texts are turned off in Settings': '설정에서 문자 발송이 꺼져 있음',
    'Email is turned off in Settings': '설정에서 이메일 발송이 꺼져 있음',
    'Customer has no phone or email': '고객의 전화번호와 이메일이 없음',
  };

  // Server messages that carry details. Matched when there's no exact entry.
  const ERROR_PATTERNS = [
    [/^Ticket #(.+) is already on an active order for (.+)$/, (m) => `티켓 #${m[1]}은(는) 이미 ${m[2]} 님의 진행 중인 주문에 사용 중입니다`],
    [/^You can't remove yourself$/, () => KO['You can’t remove yourself']],
    [/^Status must be one of/, () => '올바른 상태를 선택하세요'],
    [/^channels must include/, () => '문자 또는 이메일을 선택하세요'],
    [/^ticket_mode must be/, () => '티켓 번호 방식이 올바르지 않습니다'],
  ];

  const LANGS = { en: 'EN', ko: '한국어' };
  const fill = (s, vars) => (vars ? String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { KO, ERROR_PATTERNS, LANGS, fill };
    return;
  }

  const STORAGE_KEY = 'crm-lang';
  const readLang = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved in LANGS) return saved;
    } catch {}
    return /^ko\b/i.test(navigator.language || '') ? 'ko' : 'en';
  };
  let lang = readLang();
  const listeners = [];

  const t = (key, vars) => fill(lang === 'ko' && KO[key] != null ? KO[key] : key, vars);
  const tn = (n, one, many) => t(n === 1 ? one : many, { n });
  const N_ = (s) => s; // marks text that is translated later, where it's shown

  function tErr(msg) {
    if (lang !== 'ko' || !msg) return msg;
    if (KO[msg] != null) return KO[msg];
    for (const [re, fn] of ERROR_PATTERNS) {
      const m = String(msg).match(re);
      if (m) return fn(m);
    }
    return msg;
  }

  // Fills elements marked with data-i18n (text) and data-i18n-placeholder/-title/-aria.
  function applyStatic(scope = document) {
    document.documentElement.lang = lang;
    scope.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
    scope.querySelectorAll('[data-i18n-placeholder]').forEach((el) => (el.placeholder = t(el.dataset.i18nPlaceholder)));
    scope.querySelectorAll('[data-i18n-title]').forEach((el) => (el.title = t(el.dataset.i18nTitle)));
    scope.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  }

  function renderToggles() {
    document.querySelectorAll('[data-lang-toggle]').forEach((box) => {
      box.innerHTML = `<div class="lang-toggle ${box.dataset.langToggle || ''}" role="group" aria-label="Language / 언어">${Object.entries(LANGS)
        .map(([code, label]) => `<button type="button" lang="${code}" data-set-lang="${code}" aria-pressed="${code === lang}">${label}</button>`)
        .join('')}</div>`;
      box.querySelectorAll('[data-set-lang]').forEach((b) => (b.onclick = () => setLang(b.dataset.setLang)));
    });
  }

  function setLang(next) {
    if (!(next in LANGS) || next === lang) return;
    lang = next;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {}
    applyStatic();
    renderToggles();
    listeners.forEach((fn) => fn(lang));
  }

  root.I18N = {
    t,
    tn,
    N_,
    tErr,
    setLang,
    mount: () => {
      applyStatic();
      renderToggles();
    },
    onChange: (fn) => listeners.push(fn),
    locale: () => (lang === 'ko' ? 'ko-KR' : 'en-US'),
    get lang() {
      return lang;
    },
  };
  document.documentElement.lang = lang;
})(typeof window !== 'undefined' ? window : globalThis);
