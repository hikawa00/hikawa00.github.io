function show_runtime() {
  var startDate = new Date('03/01/2026 00:00:00');
  var nowDate = new Date();
  var t = nowDate.getTime() - startDate.getTime();
  var i = 24 * 60 * 60 * 1000;
  var d = Math.floor(t / i);
  var h = Math.floor((t % i) / (60 * 60 * 1000));
  var m = Math.floor((t % (60 * 60 * 1000)) / (60 * 1000));
  var s = Math.floor((t % (60 * 1000)) / 1000);
  var span = document.getElementById("runtime_span");
  if (span) {
    span.innerHTML = "本站已不间断运行 🚀 " + d + " 天 " + h + " 小时 " + m + " 分 " + s + " 秒";
  }
  setTimeout(show_runtime, 1000); // 性能更好的写法
}
show_runtime();